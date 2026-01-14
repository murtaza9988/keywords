from unittest.mock import AsyncMock

import pytest

from app.services.project import ProjectService


def test_upload_keywords_batch_enqueues_all_files(
    test_api_client,
    mock_project_model,
    mock_processing_tasks,
    mock_processing_queue,
    temp_upload_dir,
    monkeypatch,
):
    """
    Regression test: uploading 3 CSVs as a batch should enqueue all files for processing.
    We intentionally avoid relying on brittle CSV header combining.
    """
    monkeypatch.setattr(
        ProjectService,
        "get_by_id",
        AsyncMock(return_value=mock_project_model),
    )
    # Avoid actually processing in background tasks
    monkeypatch.setattr("app.routes.keyword_processing.process_csv_file", AsyncMock())

    # First 2 files: server should wait for remaining
    r1 = test_api_client.post(
        "/api/projects/1/upload",
        data={"batchId": "batch-3", "fileIndex": 0, "totalFiles": 3},
        files={"file": ("a.csv", b"Keyword,Volume\nalpha,10\n", "text/csv")},
    )
    assert r1.status_code == 202
    assert r1.json()["status"] == "uploading"

    r2 = test_api_client.post(
        "/api/projects/1/upload",
        data={"batchId": "batch-3", "fileIndex": 1, "totalFiles": 3},
        files={"file": ("b.csv", b"Keyword,Volume\nbeta,20\n", "text/csv")},
    )
    assert r2.status_code == 202
    assert r2.json()["status"] == "uploading"

    # Third file: server should enqueue all and start processing
    r3 = test_api_client.post(
        "/api/projects/1/upload",
        data={"batchId": "batch-3", "fileIndex": 2, "totalFiles": 3},
        files={"file": ("c.csv", b"Keyword,Volume\ngamma,30\n", "text/csv")},
    )
    assert r3.status_code == 202
    assert r3.json()["status"] == "processing"
    assert mock_processing_tasks[1] == "processing"

    # After start_next_processing, one item is current and remaining are queued.
    assert 1 in mock_processing_queue
    assert len(list(mock_processing_queue[1])) == 2
