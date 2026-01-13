import pytest

from app.routes import keyword_processing as kp


@pytest.fixture(autouse=True)
def reset_processing_state():
    kp.processing_tasks.clear()
    kp.processing_results.clear()
    kp.processing_queue.clear()
    kp.processing_queue_running.clear()
    kp.processing_stage.clear()
    kp.processing_current_file.clear()
    yield
    kp.processing_tasks.clear()
    kp.processing_results.clear()
    kp.processing_queue.clear()
    kp.processing_queue_running.clear()
    kp.processing_stage.clear()
    kp.processing_current_file.clear()


@pytest.mark.asyncio
async def test_process_csv_queue_runs_in_order(monkeypatch, tmp_path):
    processed = []

    async def fake_process(file_path: str, project_id: int):
        processed.append((file_path, project_id))
        kp.processing_results[project_id] = {
            "processed_count": 0,
            "skipped_count": 0,
            "duplicate_count": 0,
            "keywords": [],
            "complete": True,
            "total_rows": 0,
            "progress": 100.0,
            "stage": "complete",
        }
        kp.processing_tasks[project_id] = "complete"
        kp.processing_stage[project_id] = "complete"

    monkeypatch.setattr(kp, "process_csv_file", fake_process)

    file_one = tmp_path / "one.csv"
    file_one.write_text("Keyword\nfirst")
    file_two = tmp_path / "two.csv"
    file_two.write_text("Keyword\nsecond")

    should_start = kp.enqueue_csv_processing(1, str(file_one), "one.csv")
    assert should_start is True

    should_start_again = kp.enqueue_csv_processing(1, str(file_two), "two.csv")
    assert should_start_again is False

    await kp.process_csv_queue(1)

    assert processed == [(str(file_one), 1), (str(file_two), 1)]
    assert kp.processing_current_file.get(1) is None
    assert 1 not in kp.processing_queue
