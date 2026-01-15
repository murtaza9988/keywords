from unittest.mock import AsyncMock

import pytest

from app.routes import keyword_processing
from app.routes.keyword_processing import process_csv_file
from app.services.project import ProjectService
from app.services.keyword import KeywordService
from app.models.keyword import KeywordStatus


@pytest.fixture
def sample_csv_bytes():
    return (
        "Keyword,Volume,Difficulty,SERP Features\n"
        "Alpha,100,0.5,featured_snippet\n"
        "Beta,200,0.4,people_also_ask\n"
        "Alpha,300,0.3,video_carousel\n"
        "Gamma,,,\n"
    ).encode("utf-8")


@pytest.fixture
def mocked_nltk(monkeypatch):
    monkeypatch.setattr(keyword_processing, "word_tokenize", lambda text: text.split())

    class DummyLemmatizer:
        def lemmatize(self, token, pos=None):
            return token

    monkeypatch.setattr(keyword_processing, "lemmatizer", DummyLemmatizer())
    monkeypatch.setattr(keyword_processing, "stop_words", set())
    monkeypatch.setattr(keyword_processing, "get_synonyms", lambda _: set())


def test_upload_keywords_non_chunked_sets_processing_state(
    test_api_client,
    mock_db,
    mock_project_model,
    mock_processing_tasks,
    mock_processing_results,
    mock_processing_queue,
    mock_processing_current_files,
    temp_upload_dir,
    monkeypatch,
):
    monkeypatch.setattr(
        ProjectService,
        "get_by_id",
        AsyncMock(return_value=mock_project_model),
    )
    mock_process = AsyncMock()
    monkeypatch.setattr("app.routes.keyword_processing.process_csv_file", mock_process)

    response = test_api_client.post(
        "/api/projects/1/upload",
        files={
            "file": (
                "keywords.csv",
                b"Keyword,Volume\nalpha,10\n",
                "text/csv",
            )
        },
    )

    assert response.status_code == 202
    assert response.json()["status"] == "processing"
    assert mock_processing_tasks[1] == "processing"
    assert mock_processing_results[1]["complete"] is False
    assert mock_db.add.called
    assert mock_db.commit.await_count >= 1

    status_response = test_api_client.get("/api/projects/1/processing-status")
    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["status"] == "processing"
    assert status_payload["progress"] == 0.0


def test_upload_keywords_chunked_combines_and_queues(
    test_api_client,
    mock_project_model,
    mock_processing_tasks,
    mock_processing_results,
    mock_processing_queue,
    mock_processing_current_files,
    temp_upload_dir,
    monkeypatch,
):
    monkeypatch.setattr(
        ProjectService,
        "get_by_id",
        AsyncMock(return_value=mock_project_model),
    )
    mock_process = AsyncMock()
    monkeypatch.setattr("app.routes.keyword_processing.process_csv_file", mock_process)

    chunk_one = b"Keyword,Volume\nalpha,"
    chunk_two = b"10\n"

    response_first = test_api_client.post(
        "/api/projects/1/upload",
        data={
            "chunkIndex": 0,
            "totalChunks": 2,
            "originalFilename": "keywords.csv",
        },
        files={"file": ("keywords.csv", chunk_one, "text/csv")},
    )

    assert response_first.status_code == 202
    assert response_first.json()["status"] == "uploading"
    assert mock_processing_tasks[1] == "uploading"

    response_second = test_api_client.post(
        "/api/projects/1/upload",
        data={
            "chunkIndex": 1,
            "totalChunks": 2,
            "originalFilename": "keywords.csv",
        },
        files={"file": ("keywords.csv", chunk_two, "text/csv")},
    )

    assert response_second.status_code == 202
    assert response_second.json()["status"] == "processing"
    assert mock_processing_tasks[1] == "processing"
    assert mock_processing_results[1]["complete"] is False


def test_upload_keywords_batch_combines_files(
    test_api_client,
    mock_project_model,
    mock_processing_tasks,
    mock_processing_results,
    mock_processing_queue,
    mock_processing_current_files,
    temp_upload_dir,
    monkeypatch,
):
    monkeypatch.setattr(
        ProjectService,
        "get_by_id",
        AsyncMock(return_value=mock_project_model),
    )
    mock_process = AsyncMock()
    monkeypatch.setattr("app.routes.keyword_processing.process_csv_file", mock_process)

    response_first = test_api_client.post(
        "/api/projects/1/upload",
        data={
            "batchId": "batch-1",
            "fileIndex": 0,
            "totalFiles": 2,
        },
        files={
            "file": (
                "keywords-one.csv",
                b"Keyword,Volume\nalpha,10\n",
                "text/csv",
            )
        },
    )

    assert response_first.status_code == 202
    assert response_first.json()["status"] == "uploading"

    response_second = test_api_client.post(
        "/api/projects/1/upload",
        data={
            "batchId": "batch-1",
            "fileIndex": 1,
            "totalFiles": 2,
        },
        files={
            "file": (
                "keywords-two.csv",
                b"Keyword,Volume\nbeta,20\n",
                "text/csv",
            )
        },
    )

    assert response_second.status_code == 202
    assert response_second.json()["status"] == "processing"
    assert mock_processing_tasks[1] == "processing"
    assert mock_processing_results[1]["complete"] is False

    # Batch should enqueue both files (one started, one queued)
    assert 1 in mock_processing_queue
    queued = list(mock_processing_queue[1])
    # One file should remain in queue after processing starts
    assert len(queued) == 1
    assert queued[0]["file_name"] in {"keywords-one.csv", "keywords-two.csv"}


def test_upload_keywords_multi_file_request_enqueues_all_files(
    test_api_client,
    mock_project_model,
    mock_processing_tasks,
    mock_processing_queue,
    temp_upload_dir,
    monkeypatch,
):
    monkeypatch.setattr(
        ProjectService,
        "get_by_id",
        AsyncMock(return_value=mock_project_model),
    )
    monkeypatch.setattr("app.routes.keyword_processing.process_csv_file", AsyncMock())

    response = test_api_client.post(
        "/api/projects/1/upload",
        files=[
            ("file", ("keywords-one.csv", b"Keyword,Volume\nalpha,10\n", "text/csv")),
            ("file", ("keywords-two.csv", b"Keyword,Volume\nbeta,20\n", "text/csv")),
            ("file", ("keywords-three.csv", b"Keyword,Volume\ngamma,30\n", "text/csv")),
        ],
    )

    assert response.status_code == 202
    assert response.json()["status"] == "processing"
    assert mock_processing_tasks[1] == "processing"
    assert 1 in mock_processing_queue
    assert len(list(mock_processing_queue[1])) == 2


def test_processing_status_idle_does_not_force_complete(
    test_api_client,
    mock_processing_tasks,
    mock_processing_results,
    mock_processing_queue,
    mock_processing_current_files,
    monkeypatch,
):
    mock_processing_tasks.clear()
    mock_processing_results[1] = {
        "processed_count": 2,
        "skipped_count": 1,
        "keywords": [],
        "complete": False,
        "total_rows": 3,
        "progress": 40.0,
    }

    monkeypatch.setattr(
        KeywordService,
        "count_total_by_project",
        AsyncMock(return_value=3),
    )

    response = test_api_client.get("/api/projects/1/processing-status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "idle"
    assert payload["keywordCount"] == 2
    assert payload["progress"] == 40.0


@pytest.mark.asyncio
async def test_process_csv_file_parses_and_dedupes(
    mock_processing_tasks,
    mock_processing_results,
    mock_processing_queue,
    mock_processing_current_files,
    mock_db_context,
    mocked_nltk,
    tmp_path,
    monkeypatch,
    sample_csv_bytes,
):
    context_manager, mock_db = mock_db_context

    class FakeResult:
        def __init__(self, rows):
            self._rows = rows

        def fetchall(self):
            return self._rows

    async def execute(query, params=None):
        query_text = str(query)
        if "SELECT id, group_id, tokens" in query_text:
            return FakeResult([])
        if "SELECT keyword" in query_text:
            return FakeResult([("gamma",)])
        return FakeResult([])

    mock_db.execute.side_effect = execute
    mock_db.commit = AsyncMock()

    monkeypatch.setattr("app.routes.keyword_processing.get_db_context", lambda: context_manager)
    create_many_mock = AsyncMock()
    monkeypatch.setattr(KeywordService, "create_many", create_many_mock)
    monkeypatch.setattr(
        keyword_processing,
        "group_remaining_ungrouped_keywords",
        AsyncMock(),
    )

    csv_path = tmp_path / "keywords.csv"
    csv_path.write_bytes(sample_csv_bytes)

    await process_csv_file(str(csv_path), project_id=1, file_name="keywords.csv")

    assert mock_processing_results[1]["processed_count"] == 2
    assert mock_processing_results[1]["duplicate_count"] == 2
    assert mock_processing_results[1]["complete"] is True

    create_many_mock.assert_awaited_once()
    _, saved_keywords = create_many_mock.call_args[0]
    assert len(saved_keywords) == 2
    assert {kw["keyword"] for kw in saved_keywords} == {"Alpha", "Beta"}
    assert {kw["project_id"] for kw in saved_keywords} == {1}
    assert all(kw["status"] == KeywordStatus.ungrouped for kw in saved_keywords)
