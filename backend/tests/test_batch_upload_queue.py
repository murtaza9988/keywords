from unittest.mock import AsyncMock

import pytest

from app.services.project import ProjectService
from app.services.processing_queue import processing_queue_service


def test_mark_error_marks_file_as_processed():
    """
    Regression test: mark_error should mark the file as processed to avoid
    validation errors where processed_count < uploaded_count.
    """
    project_id = 999
    # Clean up any existing state
    processing_queue_service.cleanup(project_id)
    
    # Register an upload
    processing_queue_service.register_upload(project_id, "test.csv")
    
    # Simulate error during processing
    processing_queue_service.mark_error(
        project_id,
        message="Test error",
        file_name="test.csv",
    )
    
    # Check that the file was marked as processed
    result = processing_queue_service.get_result(project_id)
    assert "test.csv" in result.get("processed_files", [])
    
    # Cleanup
    processing_queue_service.cleanup(project_id)


def test_mark_error_marks_multiple_files_as_processed():
    """
    Test that mark_error can mark multiple files as processed via file_names.
    """
    project_id = 998
    processing_queue_service.cleanup(project_id)
    
    # Register uploads
    processing_queue_service.register_upload(project_id, "a.csv")
    processing_queue_service.register_upload(project_id, "b.csv")
    
    # Simulate combined file error
    processing_queue_service.mark_error(
        project_id,
        message="Test error",
        file_names=["a.csv", "b.csv"],
    )
    
    result = processing_queue_service.get_result(project_id)
    assert "a.csv" in result.get("processed_files", [])
    assert "b.csv" in result.get("processed_files", [])
    
    processing_queue_service.cleanup(project_id)


def test_validation_passes_when_all_files_processed():
    """
    Test that the validation check passes when all uploaded files are processed.
    """
    project_id = 997
    processing_queue_service.cleanup(project_id)
    
    # Register 3 uploads
    processing_queue_service.register_upload(project_id, "a.csv")
    processing_queue_service.register_upload(project_id, "b.csv")
    processing_queue_service.register_upload(project_id, "c.csv")
    
    # Mark all as processed
    processing_queue_service.mark_file_processed(project_id, "a.csv")
    processing_queue_service.mark_file_processed(project_id, "b.csv")
    processing_queue_service.mark_file_processed(project_id, "c.csv")
    
    result = processing_queue_service.get_result(project_id)
    uploaded_count = len(result.get("uploaded_files", []))
    processed_count = len(result.get("processed_files", []))
    
    assert uploaded_count == 3
    assert processed_count == 3
    assert uploaded_count == processed_count
    
    processing_queue_service.cleanup(project_id)


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


def test_reset_for_new_batch_clears_all_state():
    """
    Test that reset_for_new_batch properly clears all processing state.
    This prevents stale state from blocking new uploads.
    """
    project_id = 996
    processing_queue_service.cleanup(project_id)
    
    # Set up various states
    processing_queue_service.enqueue(project_id, "/path/file1.csv", "file1.csv")
    processing_queue_service.enqueue(project_id, "/path/file2.csv", "file2.csv")
    processing_queue_service.set_status(project_id, "processing")
    processing_queue_service.register_upload(project_id, "file1.csv")
    processing_queue_service.register_upload(project_id, "file2.csv")
    
    # Verify state is set
    assert processing_queue_service.get_status(project_id) == "processing"
    assert len(processing_queue_service.get_queue(project_id)) == 2
    
    # Reset for new batch
    processing_queue_service.reset_for_new_batch(project_id)
    
    # Verify all state is cleared
    assert processing_queue_service.get_status(project_id) == "idle"
    assert len(processing_queue_service.get_queue(project_id)) == 0
    assert processing_queue_service.get_current_file(project_id) is None
    result = processing_queue_service.get_result(project_id)
    assert result.get("uploaded_files", []) == []
    assert result.get("processed_files", []) == []
    
    processing_queue_service.cleanup(project_id)


def test_start_next_after_error_continues_queue():
    """
    Test that start_next can continue processing after an error state.
    This ensures the queue doesn't get stuck after failures.
    """
    project_id = 995
    processing_queue_service.cleanup(project_id)
    
    # Enqueue multiple files
    processing_queue_service.enqueue(project_id, "/path/file1.csv", "file1.csv")
    processing_queue_service.enqueue(project_id, "/path/file2.csv", "file2.csv")
    processing_queue_service.enqueue(project_id, "/path/file3.csv", "file3.csv")
    
    # Start processing first file
    first_item = processing_queue_service.start_next(project_id)
    assert first_item is not None
    assert first_item["file_name"] == "file1.csv"
    assert processing_queue_service.get_status(project_id) == "processing"
    
    # Simulate error
    processing_queue_service.mark_error(
        project_id,
        message="Processing failed",
        file_name="file1.csv",
    )
    assert processing_queue_service.get_status(project_id) == "error"
    
    # Should be able to start next file even after error
    second_item = processing_queue_service.start_next(project_id)
    assert second_item is not None
    assert second_item["file_name"] == "file2.csv"
    assert processing_queue_service.get_status(project_id) == "processing"
    
    processing_queue_service.cleanup(project_id)


def test_mark_error_clears_current_file():
    """
    Test that mark_error clears the current file tracking.
    This prevents stale current_file from blocking start_next.
    """
    project_id = 994
    processing_queue_service.cleanup(project_id)
    
    # Enqueue and start a file
    processing_queue_service.enqueue(project_id, "/path/test.csv", "test.csv")
    processing_queue_service.start_next(project_id)
    
    # Verify current file is set
    assert processing_queue_service.get_current_file(project_id) is not None
    
    # Mark error
    processing_queue_service.mark_error(
        project_id,
        message="Test error",
        file_name="test.csv",
    )
    
    # Current file should be cleared
    assert processing_queue_service.get_current_file(project_id) is None
    
    processing_queue_service.cleanup(project_id)


def test_mark_complete_clears_current_file():
    """
    Test that mark_complete clears the current file tracking.
    """
    project_id = 993
    processing_queue_service.cleanup(project_id)
    
    # Enqueue and start a file
    processing_queue_service.enqueue(project_id, "/path/test.csv", "test.csv")
    processing_queue_service.start_next(project_id)
    
    # Verify current file is set
    assert processing_queue_service.get_current_file(project_id) is not None
    
    # Mark complete
    processing_queue_service.mark_complete(
        project_id,
        message="Done",
        file_name="test.csv",
        has_more_in_queue=False,
    )
    
    # Current file should be cleared
    assert processing_queue_service.get_current_file(project_id) is None
    
    processing_queue_service.cleanup(project_id)
