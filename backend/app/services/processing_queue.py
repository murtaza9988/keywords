from collections import deque
from typing import Any, Deque, Dict, List, Optional


class ProcessingQueueService:
    def __init__(self) -> None:
        self.processing_tasks: Dict[int, str] = {}
        self.processing_queue: Dict[int, Deque[Dict[str, Any]]] = {}
        self.processing_results: Dict[int, Dict[str, Any]] = {}
        self.processing_current_files: Dict[int, Dict[str, Any]] = {}
        self.batch_uploads: Dict[int, Dict[str, Dict[str, Any]]] = {}

    def enqueue(
        self,
        project_id: int,
        file_path: str,
        file_name: str,
        *,
        file_names: Optional[List[str]] = None,
    ) -> None:
        queue = self.processing_queue.setdefault(project_id, deque())
        queue.append(
            {
                "file_path": file_path,
                "file_name": file_name,
                "file_names": list(file_names) if file_names else None,
            }
        )
        if self.processing_tasks.get(project_id) not in {"processing", "uploading", "combining"}:
            self.processing_tasks[project_id] = "queued"

    def start_next(self, project_id: int) -> Optional[Dict[str, Any]]:
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

    def get_queue(self, project_id: int) -> List[Dict[str, Any]]:
        queue = self.processing_queue.get(project_id)
        return list(queue) if queue else []

    def get_current_file(self, project_id: int) -> Optional[Dict[str, Any]]:
        return self.processing_current_files.get(project_id)

    def reset_results(self, project_id: int) -> None:
        self.processing_results[project_id] = self._default_result()

    def reset_for_new_batch(self, project_id: int) -> None:
        self.processing_results[project_id] = self._default_result()

    def start_file_processing(self, project_id: int, *, message: Optional[str] = None) -> None:
        existing = self.processing_results.get(project_id, self._default_result())
        result = self._default_result()
        result["uploaded_files"] = existing.get("uploaded_files", [])
        result["processed_files"] = existing.get("processed_files", [])
        result["validation_error"] = None
        if message is not None:
            result["message"] = message
        self.processing_results[project_id] = result
        self.processing_tasks[project_id] = "processing"

    def register_upload(self, project_id: int, file_name: str) -> None:
        result = self.processing_results.setdefault(project_id, self._default_result())
        uploaded_files = result.setdefault("uploaded_files", [])
        if file_name not in uploaded_files:
            uploaded_files.append(file_name)

    def mark_file_processed(
        self, project_id: int, file_name: Optional[str] = None, file_names: Optional[List[str]] = None
    ) -> None:
        target_names = []
        if file_names:
            target_names.extend(file_names)
        elif file_name:
            target_names.append(file_name)
        if not target_names:
            return
        result = self.processing_results.setdefault(project_id, self._default_result())
        processed_files = result.setdefault("processed_files", [])
        for name in target_names:
            if name not in processed_files:
                processed_files.append(name)

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
        file_name: Optional[str] = None,
        file_names: Optional[List[str]] = None,
        has_more_in_queue: bool = False,
        keywords: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        result = self.processing_results.setdefault(project_id, self._default_result())
        self.mark_file_processed(project_id, file_name, file_names)
        result["complete"] = not has_more_in_queue
        result["progress"] = 100.0 if not has_more_in_queue else result.get("progress", 0.0)
        result["message"] = message
        if keywords is not None:
            result["keywords"] = keywords
        self.processing_tasks[project_id] = "complete" if not has_more_in_queue else "queued"

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
        self.batch_uploads.pop(project_id, None)

    def register_batch_upload(self, project_id: int, batch_id: str, total_files: int) -> None:
        project_batches = self.batch_uploads.setdefault(project_id, {})
        batch_info = project_batches.get(batch_id)
        if not batch_info:
            project_batches[batch_id] = {
                "total_files": total_files,
                "files": {},
                "received": set(),
            }
            return
        batch_info["total_files"] = total_files

    def add_batch_file(
        self,
        project_id: int,
        batch_id: str,
        *,
        file_name: str,
        file_path: str,
        file_index: Optional[int] = None,
    ) -> Dict[str, Any]:
        project_batches = self.batch_uploads.setdefault(project_id, {})
        batch_info = project_batches.setdefault(
            batch_id,
            {
                "total_files": 0,
                "files": {},
                "received": set(),
            },
        )
        key = file_index if file_index is not None else file_path
        if key in batch_info["received"]:
            return batch_info
        batch_info["files"][key] = {
            "file_name": file_name,
            "file_path": file_path,
            "file_index": file_index,
        }
        batch_info["received"].add(key)
        return batch_info

    def pop_batch(self, project_id: int, batch_id: str) -> Optional[Dict[str, Any]]:
        project_batches = self.batch_uploads.get(project_id)
        if not project_batches:
            return None
        batch_info = project_batches.pop(batch_id, None)
        if not project_batches:
            self.batch_uploads.pop(project_id, None)
        return batch_info

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
            "uploaded_files": [],
            "processed_files": [],
            "validation_error": None,
        }


processing_queue_service = ProcessingQueueService()
