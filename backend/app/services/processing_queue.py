from collections import deque
from typing import Any, Deque, Dict, List, Optional


class ProcessingQueueService:
    def __init__(self) -> None:
        self.processing_tasks: Dict[int, str] = {}
        self.processing_queue: Dict[int, Deque[Dict[str, str]]] = {}
        self.processing_results: Dict[int, Dict[str, Any]] = {}
        self.processing_current_files: Dict[int, Dict[str, str]] = {}

    def enqueue(self, project_id: int, file_path: str, file_name: str) -> None:
        queue = self.processing_queue.setdefault(project_id, deque())
        queue.append({
            "file_path": file_path,
            "file_name": file_name,
        })
        if self.processing_tasks.get(project_id) not in {"processing", "uploading", "combining"}:
            self.processing_tasks[project_id] = "queued"

    def start_next(self, project_id: int) -> Optional[Dict[str, str]]:
        if self.processing_tasks.get(project_id) == "processing":
            return None
        queue = self.processing_queue.get(project_id)
        if queue and len(queue) > 0:
            next_item = queue.popleft()
            self.processing_current_files[project_id] = next_item
            self.processing_tasks[project_id] = "processing"
            return next_item

        self.processing_current_files.pop(project_id, None)
        if self.processing_tasks.get(project_id) not in {"complete", "error"}:
            self.processing_tasks[project_id] = "idle"
        return None

    def get_status(self, project_id: int) -> str:
        return self.processing_tasks.get(project_id, "not_started")

    def get_result(self, project_id: int) -> Dict[str, Any]:
        return self.processing_results.get(project_id, self._default_result())

    def get_queue(self, project_id: int) -> List[Dict[str, str]]:
        queue = self.processing_queue.get(project_id)
        return list(queue) if queue else []

    def get_current_file(self, project_id: int) -> Optional[Dict[str, str]]:
        return self.processing_current_files.get(project_id)

    def reset_results(self, project_id: int) -> None:
        self.processing_results[project_id] = self._default_result()

    def update_progress(
        self,
        project_id: int,
        *,
        processed_count: int,
        skipped_count: int,
        duplicate_count: int,
        progress: float,
        total_rows: Optional[int] = None,
        keywords: Optional[List[Dict[str, Any]]] = None,
        message: Optional[str] = None,
    ) -> None:
        result = self.processing_results.setdefault(project_id, self._default_result())
        result["processed_count"] = processed_count
        result["skipped_count"] = skipped_count
        result["duplicate_count"] = duplicate_count
        result["progress"] = progress
        if total_rows is not None:
            result["total_rows"] = total_rows
        if keywords is not None:
            result["keywords"] = keywords
        if message is not None:
            result["message"] = message

    def mark_complete(
        self,
        project_id: int,
        *,
        message: str,
        keywords: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        result = self.processing_results.setdefault(project_id, self._default_result())
        result["complete"] = True
        result["progress"] = 100.0
        result["message"] = message
        if keywords is not None:
            result["keywords"] = keywords
        self.processing_tasks[project_id] = "complete"

    def mark_error(self, project_id: int, *, message: str) -> None:
        result = self.processing_results.setdefault(project_id, self._default_result())
        result["complete"] = True
        result["progress"] = 0.0
        result["message"] = message
        self.processing_tasks[project_id] = "error"

    def set_status(self, project_id: int, status: str) -> None:
        self.processing_tasks[project_id] = status

    def cleanup(self, project_id: int) -> None:
        self.processing_tasks.pop(project_id, None)
        self.processing_results.pop(project_id, None)
        self.processing_queue.pop(project_id, None)
        self.processing_current_files.pop(project_id, None)

    def _default_result(self) -> Dict[str, Any]:
        return {
            "processed_count": 0,
            "skipped_count": 0,
            "duplicate_count": 0,
            "keywords": [],
            "complete": False,
            "total_rows": 0,
            "progress": 0.0,
            "message": "",
        }


processing_queue_service = ProcessingQueueService()
