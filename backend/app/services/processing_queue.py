"""
Processing Queue Service - First Principles Design

This service manages the CSV processing queue with a simple, robust state machine.

STATE MACHINE:
    IDLE -> UPLOADING -> PROCESSING -> COMPLETE
                |            |
                v            v
              ERROR  <----  ERROR

INVARIANTS:
1. If status is PROCESSING, current_file must exist
2. If status is IDLE, queue must be empty and current_file must be None
3. All uploaded files must eventually be processed or the error state is entered
4. Any state can transition to IDLE via reset()

SINGLE SOURCE OF TRUTH:
All state for a project is stored in ONE ProjectState object, not spread across
multiple dictionaries. This prevents state from getting out of sync.
"""

import json
import os
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

from app.config import settings

# Timeout in seconds - if processing hasn't updated in this time, consider stuck
PROCESSING_TIMEOUT_SECONDS = 300  # 5 minutes


@dataclass
class FileInfo:
    """Information about a file to be processed."""
    file_path: str
    file_name: str
    file_names: Optional[List[str]] = None
    # For batch uploads, we may accept a file as "received" but skip processing
    # (e.g. user re-uploads an identical CSV that was already imported).
    is_duplicate: bool = False


@dataclass
class BatchInfo:
    """Information about a batch upload in progress."""
    total_files: int = 0
    files: Dict[Any, FileInfo] = field(default_factory=dict)
    received_keys: set = field(default_factory=set)


@dataclass
class ProjectState:
    """
    All state for a single project's processing queue.
    This is the SINGLE SOURCE OF TRUTH for the project's processing state.
    """
    # Core state
    status: str = "idle"
    queue: Deque[FileInfo] = field(default_factory=deque)
    current_file: Optional[FileInfo] = None
    
    # Results/progress tracking
    processed_count: int = 0
    skipped_count: int = 0
    duplicate_count: int = 0
    total_rows: int = 0
    progress: float = 0.0
    message: str = ""
    stage: Optional[str] = None
    stage_detail: Optional[str] = None
    keywords: List[Dict[str, Any]] = field(default_factory=list)
    complete: bool = False
    file_errors: List[Dict[str, Any]] = field(default_factory=list)
    
    # File tracking for validation
    uploaded_files: List[str] = field(default_factory=list)
    processed_files: List[str] = field(default_factory=list)
    
    # Batch upload tracking
    batches: Dict[str, BatchInfo] = field(default_factory=dict)
    
    # Timestamp for staleness detection
    last_update: float = field(default_factory=time.time)
    
    def touch(self) -> None:
        """Update the last activity timestamp."""
        self.last_update = time.time()
    
    def is_stale(self) -> bool:
        """Check if this project's processing appears stuck."""
        return (time.time() - self.last_update) > PROCESSING_TIMEOUT_SECONDS
    
    def reset_results(self) -> None:
        """Reset processing results but keep file tracking."""
        self.processed_count = 0
        self.skipped_count = 0
        self.duplicate_count = 0
        self.total_rows = 0
        self.progress = 0.0
        self.message = ""
        self.stage = None
        self.stage_detail = None
        self.keywords = []
        self.complete = False
        self.file_errors = []
    
    def to_result_dict(self) -> Dict[str, Any]:
        """Convert to the result dictionary format expected by the API."""
        return {
            "processed_count": self.processed_count,
            "skipped_count": self.skipped_count,
            "duplicate_count": self.duplicate_count,
            "keywords": self.keywords,
            "complete": self.complete,
            "total_rows": self.total_rows,
            "progress": self.progress,
            "message": self.message,
            "stage": self.stage,
            "stage_detail": self.stage_detail,
            "uploaded_files": list(self.uploaded_files),
            "processed_files": list(self.processed_files),
            "validation_error": None,
            "file_errors": list(self.file_errors),
        }

    def to_dict(self) -> Dict[str, Any]:
        """Serialize state for persistence."""
        return {
            "status": self.status,
            "queue": [
                {
                    "file_path": f.file_path,
                    "file_name": f.file_name,
                    "file_names": f.file_names,
                    "is_duplicate": f.is_duplicate,
                }
                for f in self.queue
            ],
            "current_file": {
                "file_path": self.current_file.file_path,
                "file_name": self.current_file.file_name,
                "file_names": self.current_file.file_names,
                "is_duplicate": self.current_file.is_duplicate,
            }
            if self.current_file
            else None,
            "processed_count": self.processed_count,
            "skipped_count": self.skipped_count,
            "duplicate_count": self.duplicate_count,
            "total_rows": self.total_rows,
            "progress": self.progress,
            "message": self.message,
            "stage": self.stage,
            "stage_detail": self.stage_detail,
            "keywords": self.keywords,
            "complete": self.complete,
            "uploaded_files": self.uploaded_files,
            "processed_files": self.processed_files,
            "file_errors": self.file_errors,
            "batches": {
                batch_id: {
                    "total_files": batch.total_files,
                    "files": [
                        {
                            "key": key,
                            "key_type": "int" if isinstance(key, int) else "str",
                            "file_path": info.file_path,
                            "file_name": info.file_name,
                            "file_names": info.file_names,
                            "is_duplicate": info.is_duplicate,
                        }
                        for key, info in batch.files.items()
                    ],
                    "received_keys": [
                        {
                            "key": key,
                            "key_type": "int" if isinstance(key, int) else "str",
                        }
                        for key in batch.received_keys
                    ],
                }
                for batch_id, batch in self.batches.items()
            },
            "last_update": self.last_update,
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> "ProjectState":
        """Restore state from persisted data."""
        state = ProjectState()
        state.status = data.get("status", "idle")
        state.queue = deque(
            FileInfo(
                file_path=item.get("file_path", ""),
                file_name=item.get("file_name", ""),
                file_names=item.get("file_names"),
                is_duplicate=bool(item.get("is_duplicate", False)),
            )
            for item in data.get("queue", [])
        )
        current_file = data.get("current_file")
        if current_file:
            state.current_file = FileInfo(
                file_path=current_file.get("file_path", ""),
                file_name=current_file.get("file_name", ""),
                file_names=current_file.get("file_names"),
                is_duplicate=bool(current_file.get("is_duplicate", False)),
            )
        state.processed_count = data.get("processed_count", 0)
        state.skipped_count = data.get("skipped_count", 0)
        state.duplicate_count = data.get("duplicate_count", 0)
        state.total_rows = data.get("total_rows", 0)
        state.progress = data.get("progress", 0.0)
        state.message = data.get("message", "")
        state.stage = data.get("stage")
        state.stage_detail = data.get("stage_detail")
        state.keywords = data.get("keywords", [])
        state.complete = data.get("complete", False)
        state.uploaded_files = data.get("uploaded_files", [])
        state.processed_files = data.get("processed_files", [])
        state.file_errors = data.get("file_errors", [])
        batches: Dict[str, BatchInfo] = {}
        for batch_id, batch_data in data.get("batches", {}).items():
            batch = BatchInfo(total_files=batch_data.get("total_files", 0))
            files_data = batch_data.get("files", [])
            if isinstance(files_data, dict):
                iterable_files = []
                for key, info in files_data.items():
                    parsed_key: Any = int(key) if isinstance(key, str) and key.isdigit() else key
                    iterable_files.append(
                        {
                            "key": parsed_key,
                            "key_type": "int" if isinstance(parsed_key, int) else "str",
                            "file_path": info.get("file_path", ""),
                            "file_name": info.get("file_name", ""),
                            "file_names": info.get("file_names"),
                            "is_duplicate": info.get("is_duplicate", False),
                        }
                    )
                files_data = iterable_files

            for item in files_data:
                key_type = item.get("key_type", "str")
                key_value = item.get("key")
                if key_type == "int" and isinstance(key_value, str) and key_value.isdigit():
                    key_value = int(key_value)
                batch.files[key_value] = FileInfo(
                    file_path=item.get("file_path", ""),
                    file_name=item.get("file_name", ""),
                    file_names=item.get("file_names"),
                    is_duplicate=bool(item.get("is_duplicate", False)),
                )

            received_keys_data = batch_data.get("received_keys", [])
            received_keys: set = set()
            if isinstance(received_keys_data, list):
                for entry in received_keys_data:
                    if isinstance(entry, dict):
                        entry_type = entry.get("key_type", "str")
                        entry_key = entry.get("key")
                        if entry_type == "int" and isinstance(entry_key, str) and entry_key.isdigit():
                            entry_key = int(entry_key)
                        received_keys.add(entry_key)
                    else:
                        parsed_key = int(entry) if isinstance(entry, str) and entry.isdigit() else entry
                        received_keys.add(parsed_key)
            batch.received_keys = received_keys
            batches[batch_id] = batch
        state.batches = batches
        state.last_update = data.get("last_update", time.time())
        return state


class ProcessingQueueService:
    """
    Manages processing queues for all projects.
    
    Design Principles:
    1. Single source of truth - all state in ProjectState
    2. Clear state transitions - only valid transitions allowed
    3. Fail-safe - any error leads to a recoverable state
    4. Idempotent reset - reset always brings system to clean state
    """
    
    def __init__(self) -> None:
        self._projects: Dict[int, ProjectState] = {}

    def _state_dir(self) -> Path:
        state_dir = Path(settings.UPLOAD_DIR) / "processing_state"
        state_dir.mkdir(parents=True, exist_ok=True)
        return state_dir

    def _state_path(self, project_id: int) -> Path:
        return self._state_dir() / f"{project_id}.json"

    def _load_state_from_disk(self, project_id: int) -> Optional[ProjectState]:
        path = self._state_path(project_id)
        if not path.exists():
            return self._projects.get(project_id)
        try:
            data = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError):
            return self._projects.get(project_id)
        state = ProjectState.from_dict(data)
        self._projects[project_id] = state
        return state

    def _save_state_to_disk(self, project_id: int) -> None:
        state = self._projects.get(project_id)
        if not state:
            return
        path = self._state_path(project_id)
        tmp_path = path.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(state.to_dict(), default=str))
        os.replace(tmp_path, path)
    
    def _get_or_create(self, project_id: int) -> ProjectState:
        """Get project state, creating if needed."""
        state = self._load_state_from_disk(project_id)
        if not state:
            self._projects[project_id] = ProjectState()
        return self._projects[project_id]
    
    def _ensure_invariants(self, project_id: int) -> None:
        """
        Ensure state invariants are maintained.
        This is called before returning from public methods to catch bugs.
        """
        state = self._projects.get(project_id)
        if not state:
            return
        
        # Invariant 1: If PROCESSING, must have current_file
        if state.status == "processing" and state.current_file is None:
            # This shouldn't happen - fix it
            if state.queue:
                state.current_file = state.queue.popleft()
            else:
                state.status = "idle"
        
        # Invariant 2: If IDLE, no queue and no current_file
        if state.status == "idle":
            state.current_file = None
            # Don't clear queue here - might be intentionally queued
        self._save_state_to_disk(project_id)
    
    # =========================================================================
    # PUBLIC API - Upload Phase
    # =========================================================================
    
    def begin_upload(self, project_id: int) -> None:
        """
        Signal that an upload is starting.
        If there's stale state from a previous failed upload, clear it.
        """
        state = self._get_or_create(project_id)
        
        # If we're in a terminal/error state, reset for the new upload.
        # IMPORTANT: Do NOT clobber an active processing/queued state, otherwise
        # we can accidentally start multiple processing tasks concurrently.
        if state.status in ("error", "idle", "complete", "not_started"):
            self._full_reset(project_id)
            state = self._get_or_create(project_id)

        # Only transition to uploading if we are not already in an active state.
        if state.status not in ("processing", "queued"):
            state.status = "uploading"
        state.touch()
        self._save_state_to_disk(project_id)
    
    def register_upload(self, project_id: int, file_name: str) -> None:
        """Register that a file has been uploaded (for validation tracking)."""
        state = self._get_or_create(project_id)
        if file_name and file_name not in state.uploaded_files:
            state.uploaded_files.append(file_name)
        state.touch()
        self._save_state_to_disk(project_id)
    
    def enqueue(
        self,
        project_id: int,
        file_path: str,
        file_name: str,
        *,
        file_names: Optional[List[str]] = None,
    ) -> None:
        """Add a file to the processing queue."""
        state = self._get_or_create(project_id)
        
        file_info = FileInfo(
            file_path=file_path,
            file_name=file_name,
            file_names=list(file_names) if file_names else None,
        )
        state.queue.append(file_info)
        
        # Update status if not actively processing
        if state.status not in ("processing",):
            state.status = "queued"
        
        state.touch()
        self._ensure_invariants(project_id)
        self._save_state_to_disk(project_id)
    
    # =========================================================================
    # PUBLIC API - Batch Upload Support
    # =========================================================================
    
    def register_batch_upload(
        self, project_id: int, batch_id: str, total_files: int
    ) -> None:
        """Register a new batch upload."""
        state = self._get_or_create(project_id)
        if batch_id not in state.batches:
            state.batches[batch_id] = BatchInfo(total_files=total_files)
        else:
            state.batches[batch_id].total_files = total_files
        state.touch()
        self._save_state_to_disk(project_id)
    
    def add_batch_file(
        self,
        project_id: int,
        batch_id: str,
        *,
        file_name: str,
        file_path: str,
        file_index: Optional[int] = None,
        is_duplicate: bool = False,
    ) -> Dict[str, Any]:
        """Add a file to a batch. Returns batch info."""
        state = self._get_or_create(project_id)
        
        if batch_id not in state.batches:
            state.batches[batch_id] = BatchInfo()
        
        batch = state.batches[batch_id]
        key = file_index if file_index is not None else file_path
        
        if key not in batch.received_keys:
            batch.files[key] = FileInfo(
                file_path=file_path,
                file_name=file_name,
                is_duplicate=is_duplicate,
            )
            batch.received_keys.add(key)
        
        state.touch()
        self._save_state_to_disk(project_id)
        # Return dict format for compatibility
        return {
            "total_files": batch.total_files,
            "files": {k: {"file_name": v.file_name, "file_path": v.file_path, 
                         "file_index": k if isinstance(k, int) else None,
                         "is_duplicate": bool(v.is_duplicate)}
                     for k, v in batch.files.items()},
            "received": batch.received_keys,
        }
    
    def pop_batch(
        self, project_id: int, batch_id: str
    ) -> Optional[Dict[str, Any]]:
        """Remove and return a batch. Returns None if not found."""
        state = self._load_state_from_disk(project_id)
        if not state or batch_id not in state.batches:
            return None
        
        batch = state.batches.pop(batch_id)
        self._save_state_to_disk(project_id)
        
        return {
            "total_files": batch.total_files,
            "files": {k: {"file_name": v.file_name, "file_path": v.file_path,
                         "file_index": k if isinstance(k, int) else None,
                         "is_duplicate": bool(v.is_duplicate)}
                     for k, v in batch.files.items()},
            "received": batch.received_keys,
        }
    
    # =========================================================================
    # PUBLIC API - Processing Phase
    # =========================================================================
    
    def start_next(self, project_id: int) -> Optional[Dict[str, Any]]:
        """
        Start processing the next file in the queue.
        Returns the file info dict, or None if nothing to process.
        
        This is the KEY state transition: queued/error -> processing
        """
        state = self._get_or_create(project_id)
        
        # If already processing AND has a current file, don't interrupt
        # (unless the processing is stale/stuck)
        if state.status == "processing" and state.current_file is not None:
            if not state.is_stale():
                return None  # Actually busy processing, don't interrupt
        
        # Reset status if we were "processing" but current_file was cleared
        # This happens after mark_complete() clears current_file
        if state.status == "processing" and state.current_file is None:
            state.status = "queued"
        
        # Try to get next file from queue
        if not state.queue:
            # Nothing to process
            if state.status not in ("complete", "error"):
                state.status = "idle"
            state.current_file = None
            self._save_state_to_disk(project_id)
            return None
        
        # Dequeue and start processing
        file_info = state.queue.popleft()
        state.current_file = file_info
        state.status = "processing"
        state.touch()
        
        self._ensure_invariants(project_id)
        self._save_state_to_disk(project_id)
        
        return {
            "file_path": file_info.file_path,
            "file_name": file_info.file_name,
            "file_names": file_info.file_names,
        }
    
    def start_file_processing(
        self, project_id: int, *, message: Optional[str] = None
    ) -> None:
        """Signal that processing of the current file has started."""
        state = self._get_or_create(project_id)
        state.status = "processing"
        state.reset_results()
        # Preserve file tracking
        if message:
            state.message = message
        state.stage = "start"
        state.touch()
        self._save_state_to_disk(project_id)
    
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
        stage: Optional[str] = None,
        stage_detail: Optional[str] = None,
    ) -> None:
        """Update processing progress."""
        state = self._get_or_create(project_id)
        state.processed_count = processed_count
        state.skipped_count = skipped_count
        state.duplicate_count = duplicate_count
        state.progress = progress
        if total_rows is not None:
            state.total_rows = total_rows
        if keywords is not None:
            state.keywords = keywords
        if message is not None:
            state.message = message
        if stage is not None:
            state.stage = stage
        if stage_detail is not None:
            state.stage_detail = stage_detail
        state.touch()
        self._save_state_to_disk(project_id)
    
    def mark_file_processed(
        self,
        project_id: int,
        file_name: Optional[str] = None,
        file_names: Optional[List[str]] = None,
    ) -> None:
        """Mark file(s) as processed for validation tracking."""
        state = self._get_or_create(project_id)
        
        names_to_add = []
        if file_names:
            names_to_add.extend(file_names)
        elif file_name:
            names_to_add.append(file_name)
        
        for name in names_to_add:
            if name and name not in state.processed_files:
                state.processed_files.append(name)
        self._save_state_to_disk(project_id)
    
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
        """
        Mark current file as complete.
        If has_more_in_queue, transition to queued. Otherwise, complete.
        """
        state = self._get_or_create(project_id)
        
        # Mark file(s) as processed
        self.mark_file_processed(project_id, file_name, file_names)
        state = self._get_or_create(project_id)
        
        # Update results
        state.message = message
        state.stage = "complete"
        state.stage_detail = None
        if keywords is not None:
            state.keywords = keywords
        
        if has_more_in_queue:
            state.status = "queued"
            state.complete = False
        else:
            state.status = "complete"
            state.complete = True
            state.progress = 100.0
        
        # CRITICAL: Clear current file so next file can be processed
        state.current_file = None
        state.touch()
        
        self._ensure_invariants(project_id)
        self._save_state_to_disk(project_id)
    
    def mark_error(
        self,
        project_id: int,
        *,
        message: str,
        file_name: Optional[str] = None,
        file_names: Optional[List[str]] = None,
    ) -> None:
        """
        Mark current processing as failed.
        The error state allows new uploads to reset and try again.
        """
        state = self._get_or_create(project_id)
        
        # Mark file as processed (even though it failed) for count matching
        self.mark_file_processed(project_id, file_name, file_names)
        state = self._get_or_create(project_id)
        
        names = []
        if file_names:
            names.extend([name for name in file_names if name])
        elif file_name:
            names.append(file_name)
        elif state.current_file and state.current_file.file_name:
            names.append(state.current_file.file_name)

        if names:
            existing_keys = {
                (
                    entry.get("file_name"),
                    entry.get("message"),
                    entry.get("stage"),
                    entry.get("stage_detail"),
                )
                for entry in state.file_errors
                if isinstance(entry, dict)
            }
            for name in names:
                error_entry = {
                    "file_name": name,
                    "message": message,
                    "stage": state.stage,
                    "stage_detail": state.stage_detail,
                }
                entry_key = (
                    error_entry["file_name"],
                    error_entry["message"],
                    error_entry["stage"],
                    error_entry["stage_detail"],
                )
                if entry_key not in existing_keys:
                    state.file_errors.append(error_entry)
                    existing_keys.add(entry_key)

        state.status = "error"
        state.message = message
        state.stage = "error"
        state.complete = True
        state.progress = 0.0
        
        # CRITICAL: Clear current file
        state.current_file = None
        state.touch()
        
        self._ensure_invariants(project_id)
        self._save_state_to_disk(project_id)
    
    # =========================================================================
    # PUBLIC API - Status & Results
    # =========================================================================
    
    def get_status(self, project_id: int) -> str:
        """
        Get current status, with automatic stuck detection.
        """
        state = self._load_state_from_disk(project_id)
        if not state:
            return "not_started"
        
        # Auto-detect stuck processing
        if state.status in ("processing", "uploading", "queued"):
            if state.is_stale():
                self.mark_error(
                    project_id,
                    message="Processing timed out. Please try uploading again."
                )
                return "error"
        
        return state.status
    
    def get_result(self, project_id: int) -> Dict[str, Any]:
        """Get processing results as a dictionary."""
        state = self._load_state_from_disk(project_id)
        if not state:
            return self._default_result()
        return state.to_result_dict()
    
    def get_queue(self, project_id: int) -> List[Dict[str, Any]]:
        """Get list of queued files."""
        state = self._load_state_from_disk(project_id)
        if not state:
            return []
        return [
            {"file_path": f.file_path, "file_name": f.file_name, 
             "file_names": f.file_names}
            for f in state.queue
        ]
    
    def get_current_file(self, project_id: int) -> Optional[Dict[str, Any]]:
        """Get the currently processing file."""
        state = self._load_state_from_disk(project_id)
        if not state or not state.current_file:
            return None
        f = state.current_file
        return {
            "file_path": f.file_path,
            "file_name": f.file_name,
            "file_names": f.file_names,
        }
    
    def get_last_update_time(self, project_id: int) -> float:
        """Get last update timestamp."""
        state = self._load_state_from_disk(project_id)
        return state.last_update if state else 0
    
    def is_stale(self, project_id: int) -> bool:
        """Check if processing appears stuck."""
        state = self._load_state_from_disk(project_id)
        return state.is_stale() if state else False
    
    # =========================================================================
    # PUBLIC API - Reset & Cleanup
    # =========================================================================
    
    def set_status(self, project_id: int, status: str) -> None:
        """Set status directly (for uploading/combining phases)."""
        state = self._get_or_create(project_id)
        state.status = status
        state.touch()
        self._save_state_to_disk(project_id)
    
    def reset_results(self, project_id: int) -> None:
        """Reset just the results (keep queue and file tracking)."""
        state = self._load_state_from_disk(project_id)
        if state:
            state.reset_results()
            self._save_state_to_disk(project_id)
    
    def reset_for_new_batch(self, project_id: int) -> None:
        """
        FULL RESET for a new batch upload.
        This clears EVERYTHING and starts fresh.
        """
        self._full_reset(project_id)
    
    def _full_reset(self, project_id: int) -> None:
        """Internal full reset implementation."""
        # Simply create a new fresh state
        self._projects[project_id] = ProjectState()
        self._save_state_to_disk(project_id)
    
    def reset_processing(self, project_id: int) -> Dict[str, Any]:
        """
        Reset stuck processing state.
        Returns info about what was cleared.
        """
        state = self._load_state_from_disk(project_id)
        
        cleared_info = {
            "had_status": state.status if state else None,
            "had_queue": len(state.queue) if state else 0,
            "had_current_file": state.current_file is not None if state else False,
        }
        
        self._full_reset(project_id)
        
        return cleared_info
    
    def cleanup(self, project_id: int) -> None:
        """Remove all state for a project."""
        self._projects.pop(project_id, None)
        path = self._state_path(project_id)
        if path.exists():
            path.unlink()
    
    # =========================================================================
    # Compatibility Methods (for existing code)
    # =========================================================================
    
    def _default_result(self) -> Dict[str, Any]:
        """Default result dictionary for compatibility."""
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
            "file_errors": [],
        }
    
    def _touch(self, project_id: int) -> None:
        """Update timestamp - compatibility wrapper."""
        state = self._load_state_from_disk(project_id)
        if state:
            state.touch()
            self._save_state_to_disk(project_id)


# Singleton instance
processing_queue_service = ProcessingQueueService()
