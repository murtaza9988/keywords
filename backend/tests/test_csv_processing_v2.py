import asyncio
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from app.database import get_db
from app.main import app
from app.services.csv_processing_job import CsvProcessingJobService
from app.services.keyword import KeywordService
from app.services.project_csv_runner import ProjectCsvRunnerService
from app.services.project_processing_lease import ProjectProcessingLeaseService
from app.utils.security import get_current_user
from app.models.csv_processing_job import CsvProcessingJob
from app.services.processing_queue import processing_queue_service


def _override_get_current_user() -> dict:
    return {"username": "tester"}


@asynccontextmanager
async def _override_get_db():
    yield AsyncMock()


def _install_dependency_overrides() -> None:
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user


def _clear_dependency_overrides() -> None:
    app.dependency_overrides = {}


def test_grouping_locked_returns_409(monkeypatch):
    monkeypatch.setenv("TESTING", "False")
    _install_dependency_overrides()
    monkeypatch.setattr(
        CsvProcessingJobService,
        "has_pending_jobs",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        ProjectProcessingLeaseService,
        "is_locked",
        AsyncMock(return_value=False),
    )

    client = TestClient(app)
    response = client.post(
        "/api/projects/1/group",
        json={"keywordIds": [1], "groupName": "Locked"},
    )
    _clear_dependency_overrides()
    monkeypatch.setenv("TESTING", "True")

    assert response.status_code == 409
    payload = response.json()["detail"]
    assert payload["error"] == "processing_locked"
    assert payload["project_id"] == 1


def test_processing_status_includes_lock_counts(monkeypatch):
    monkeypatch.setenv("TESTING", "False")
    _install_dependency_overrides()
    monkeypatch.setattr(
        CsvProcessingJobService,
        "counts_by_status",
        AsyncMock(return_value={"queued": 2, "running": 1, "succeeded": 0, "failed": 0}),
    )
    monkeypatch.setattr(
        CsvProcessingJobService,
        "has_pending_jobs",
        AsyncMock(return_value=True),
    )
    monkeypatch.setattr(
        ProjectProcessingLeaseService,
        "is_locked",
        AsyncMock(return_value=False),
    )
    monkeypatch.setattr(processing_queue_service, "get_status", lambda _project_id: "processing")
    monkeypatch.setattr(
        processing_queue_service,
        "get_result",
        lambda _project_id: {
            "processed_count": 3,
            "skipped_count": 1,
            "duplicate_count": 0,
            "keywords": [],
            "complete": False,
            "total_rows": 10,
            "progress": 30.0,
            "message": "",
            "stage": None,
            "stage_detail": None,
            "uploaded_files": [],
            "processed_files": [],
            "file_errors": [],
        },
    )
    monkeypatch.setattr(
        CsvProcessingJobService,
        "list_file_names_by_status",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        CsvProcessingJobService,
        "list_failed_jobs",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        CsvProcessingJobService,
        "get_running_job",
        AsyncMock(return_value=None),
    )

    client = TestClient(app)
    response = client.get("/api/projects/1/processing-status")
    _clear_dependency_overrides()
    monkeypatch.setenv("TESTING", "True")

    assert response.status_code == 200
    data = response.json()
    assert data["locked"] is True
    assert data["queuedJobs"] == 2
    assert data["runningJobs"] == 1


@pytest.mark.asyncio
async def test_runner_kick_starts_once(monkeypatch):
    runner = ProjectCsvRunnerService()
    calls: list[object] = []

    async def _fake_acquire(*_args, **_kwargs):
        return len(calls) == 0

    async def _fake_release(*_args, **_kwargs):
        return None

    @asynccontextmanager
    async def _fake_db():
        yield AsyncMock()

    def _fake_create_task(coro):
        calls.append(coro)
        coro.close()
        return AsyncMock()

    monkeypatch.setattr(ProjectProcessingLeaseService, "try_acquire", _fake_acquire)
    monkeypatch.setattr(ProjectProcessingLeaseService, "release", _fake_release)
    monkeypatch.setattr("app.services.project_csv_runner.get_db_context", _fake_db)
    monkeypatch.setattr(asyncio, "create_task", _fake_create_task)

    await runner.kick(1)
    await runner.kick(1)

    assert len(calls) == 1


@pytest.mark.asyncio
async def test_runner_processes_jobs_in_order(monkeypatch):
    runner = ProjectCsvRunnerService()
    job_one = SimpleNamespace(id=1, storage_path="one.csv", source_filename="one.csv")
    job_two = SimpleNamespace(id=2, storage_path="two.csv", source_filename="two.csv")
    claim_side_effect = [job_one, job_two, None]

    @asynccontextmanager
    async def _fake_db():
        yield AsyncMock()

    async def _fake_claim(*_args, **_kwargs):
        return claim_side_effect.pop(0)

    process_mock = AsyncMock()
    group_mock = AsyncMock()

    monkeypatch.setattr("app.services.project_csv_runner.get_db_context", _fake_db)
    monkeypatch.setattr(ProjectProcessingLeaseService, "renew", AsyncMock())
    monkeypatch.setattr(ProjectProcessingLeaseService, "release", AsyncMock())
    monkeypatch.setattr(CsvProcessingJobService, "recovery_sweep", AsyncMock())
    monkeypatch.setattr(CsvProcessingJobService, "claim_next_job", _fake_claim)
    monkeypatch.setattr(CsvProcessingJobService, "mark_succeeded", AsyncMock())
    monkeypatch.setattr(CsvProcessingJobService, "mark_failed", AsyncMock())
    monkeypatch.setattr(CsvProcessingJobService, "has_pending_jobs", AsyncMock(return_value=False))
    monkeypatch.setattr(processing_queue_service, "set_current_file", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.routes.keyword_processing.process_csv_file", process_mock)
    monkeypatch.setattr("app.routes.keyword_processing.group_remaining_ungrouped_keywords", group_mock)

    await runner.run(1, owner="owner")

    assert process_mock.call_count == 2
    assert process_mock.call_args_list[0].args[0] == "one.csv"
    assert process_mock.call_args_list[1].args[0] == "two.csv"
    group_mock.assert_called_once()


@pytest.mark.asyncio
async def test_keyword_create_many_builds_on_conflict():
    db = AsyncMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()

    await KeywordService.create_many(
        db,
        [
            {
                "project_id": 1,
                "keyword": "test",
                "tokens": "[]",
            }
        ],
    )

    stmt = db.execute.call_args[0][0]
    compiled = str(stmt.compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT" in compiled
    assert "project_id" in compiled
    assert "keyword" in compiled


@pytest.mark.asyncio
async def test_claim_next_job_orders_by_created_at():
    db = AsyncMock()

    class _Result:
        def scalar_one_or_none(self):
            return None

    db.execute = AsyncMock(return_value=_Result())

    await CsvProcessingJobService.claim_next_job(db, 1)

    stmt = db.execute.call_args[0][0]
    order_by = list(stmt._order_by_clauses)
    assert order_by
    assert order_by[0].compare(CsvProcessingJob.created_at.asc())


@pytest.mark.asyncio
async def test_recovery_sweep_requeues_and_fails(monkeypatch):
    db = AsyncMock()
    running_job = SimpleNamespace(id=10, attempts=0)
    exhausted_job = SimpleNamespace(id=11, attempts=3)

    class _Result:
        def scalars(self):
            return self

        def all(self):
            return [running_job, exhausted_job]

    calls: list[object] = []

    async def _execute(stmt, *args, **kwargs):
        calls.append(stmt)
        if "SELECT" in str(stmt):
            return _Result()
        return AsyncMock()

    db.execute = AsyncMock(side_effect=_execute)
    db.commit = AsyncMock()

    await CsvProcessingJobService.recovery_sweep(db, 1, max_attempts=1)

    update_statements = [stmt for stmt in calls if "UPDATE csv_processing_jobs" in str(stmt)]
    assert len(update_statements) == 2
    value_keys = [set(stmt._values.keys()) for stmt in update_statements]
    key_names = {
        getattr(key, "name", str(key))
        for keys in value_keys
        for key in keys
    }
    assert "error" in key_names
