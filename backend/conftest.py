import pytest
import json
import os
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock
from typing import Dict, List, Any, Generator
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.testclient import TestClient

from app.models.keyword import Keyword, KeywordStatus
from app.models.project import Project
from app.config import settings
from app.main import app
from app.services.processing_queue import processing_queue_service

# Ensure test environment
os.environ["TESTING"] = "True"

# Temporarily set to avoid any side effects during tests
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

# Create global test client
@pytest.fixture
def client():
    """Return a FastAPI TestClient."""
    return TestClient(app)

# Fixtures for common mock data
@pytest.fixture
def mock_project() -> Dict[str, Any]:
    """Return a mock project dict."""
    return {
        "id": 1,
        "name": "Test Project",
        "created_at": "2023-01-01T00:00:00",
        "updated_at": "2023-01-01T00:00:00"
    }

@pytest.fixture
def mock_project_model() -> Project:
    """Return a mock Project model instance."""
    return Project(
        id=1,
        name="Test Project",
        created_at="2023-01-01T00:00:00",
        updated_at="2023-01-01T00:00:00"
    )

@pytest.fixture
def mock_keywords() -> List[Dict[str, Any]]:
    """Return a list of mock keywords as dicts."""
    return [
        {
            "id": 1,
            "project_id": 1,
            "keyword": "python developer",
            "volume": 1000,
            "difficulty": 35.5,
            "tokens": json.dumps(["python", "developer"]),
            "is_parent": True,
            "group_id": None,
            "group_name": None,
            "status": "ungrouped",
            "original_volume": None,
            "original_state": None,
            "child_count": 0,
            "serp_features": json.dumps(["featured_snippet", "people_also_ask"])
        },
        {
            "id": 2,
            "project_id": 1,
            "keyword": "python coding",
            "volume": 800,
            "difficulty": 30.0,
            "tokens": json.dumps(["python", "coding"]),
            "is_parent": True,
            "group_id": None,
            "group_name": None,
            "status": "ungrouped",
            "original_volume": None,
            "original_state": None,
            "child_count": 0,
            "serp_features": json.dumps(["people_also_ask"])
        },
        {
            "id": 3,
            "project_id": 1,
            "keyword": "python programming",
            "volume": 1500,
            "difficulty": 40.0,
            "tokens": json.dumps(["python", "programming"]),
            "is_parent": True,
            "group_id": "group1",
            "group_name": "Python Programming Group",
            "status": "grouped",
            "original_volume": 1500,
            "original_state": None,
            "child_count": 2,
            "serp_features": json.dumps(["featured_snippet", "video_carousel"])
        },
        {
            "id": 4,
            "project_id": 1,
            "keyword": "blocked keyword",
            "volume": 500,
            "difficulty": 25.0,
            "tokens": json.dumps(["blocked", "keyword"]),
            "is_parent": True,
            "group_id": None,
            "group_name": None,
            "status": "blocked",
            "original_volume": None,
            "original_state": None,
            "child_count": 0,
            "serp_features": json.dumps([])
        }
    ]

@pytest.fixture
def mock_keyword_models() -> List[Keyword]:
    """Return a list of mock Keyword model instances."""
    return [
        Keyword(
            id=1,
            project_id=1,
            keyword="python developer",
            volume=1000,
            difficulty=35.5,
            tokens=json.dumps(["python", "developer"]),
            is_parent=True,
            group_id=None,
            status=KeywordStatus.ungrouped.value,
            original_volume=None,
            original_state=None,
            serp_features=json.dumps(["featured_snippet", "people_also_ask"])
        ),
        Keyword(
            id=2,
            project_id=1,
            keyword="python coding",
            volume=800,
            difficulty=30.0,
            tokens=json.dumps(["python", "coding"]),
            is_parent=True,
            group_id=None,
            status=KeywordStatus.ungrouped.value,
            original_volume=None,
            original_state=None,
            serp_features=json.dumps(["people_also_ask"])
        ),
        Keyword(
            id=3,
            project_id=1,
            keyword="python programming",
            volume=1500,
            difficulty=40.0,
            tokens=json.dumps(["python", "programming"]),
            is_parent=True,
            group_id="group1",
            group_name="Python Programming Group",
            status=KeywordStatus.grouped.value,
            original_volume=1500,
            original_state=None,
            serp_features=json.dumps(["featured_snippet", "video_carousel"])
        ),
        Keyword(
            id=4,
            project_id=1,
            keyword="blocked keyword",
            volume=500,
            difficulty=25.0,
            tokens=json.dumps(["blocked", "keyword"]),
            is_parent=True,
            group_id=None,
            status=KeywordStatus.blocked.value,
            original_volume=None,
            original_state=None,
            serp_features=json.dumps([])
        )
    ]

@pytest.fixture
def mock_auth() -> Dict[str, Any]:
    """Return mock authentication data."""
    return {"user_id": 1, "email": "test@example.com"}

@pytest.fixture
def mock_db() -> Generator[AsyncMock, None, None]:
    """Return a mock AsyncSession."""
    mock = AsyncMock(spec=AsyncSession)
    yield mock

# Fixtures for processing state management
# These provide access to the internal state for testing purposes

class MockProcessingTasks(dict):
    """Dict-like object that reads/writes status from ProjectState."""
    def __init__(self, service):
        super().__init__()
        self._service = service
    
    def __getitem__(self, project_id):
        return self._service.get_status(project_id)
    
    def __setitem__(self, project_id, value):
        state = self._service._get_or_create(project_id)
        state.status = value
        self._service._save_state_to_disk(project_id)
    
    def get(self, project_id, default=None):
        try:
            return self[project_id]
        except (KeyError, AttributeError):
            return default
    
    def clear(self):
        """Clear all project states."""
        self._service._projects.clear()


class MockProcessingResults(dict):
    """Dict-like object that reads/writes results from ProjectState."""
    def __init__(self, service):
        super().__init__()
        self._service = service
    
    def __getitem__(self, project_id):
        return self._service.get_result(project_id)
    
    def __setitem__(self, project_id, value):
        # Allow setting result values for tests
        state = self._service._get_or_create(project_id)
        if isinstance(value, dict):
            state.processed_count = value.get("processed_count", 0)
            state.skipped_count = value.get("skipped_count", 0)
            state.duplicate_count = value.get("duplicate_count", 0)
            state.total_rows = value.get("total_rows", 0)
            state.progress = value.get("progress", 0.0)
            state.message = value.get("message", "")
            state.keywords = value.get("keywords", [])
            state.complete = value.get("complete", False)
            state.uploaded_files = value.get("uploaded_files", [])
            state.processed_files = value.get("processed_files", [])
            self._service._save_state_to_disk(project_id)
    
    def get(self, project_id, default=None):
        return self._service.get_result(project_id)


class MockProcessingQueue(dict):
    """Dict-like object that reads queues from ProjectState."""
    def __init__(self, service):
        super().__init__()
        self._service = service
    
    def __getitem__(self, project_id):
        # Return list of dicts, not deque of FileInfo
        return self._service.get_queue(project_id)
    
    def __contains__(self, project_id):
        return len(self._service.get_queue(project_id)) > 0


class MockCurrentFiles(dict):
    """Dict-like object that reads current files from ProjectState."""
    def __init__(self, service):
        super().__init__()
        self._service = service
    
    def __getitem__(self, project_id):
        return self._service.get_current_file(project_id)
    
    def get(self, project_id, default=None):
        return self._service.get_current_file(project_id)


@pytest.fixture
def mock_processing_tasks(monkeypatch) -> Dict[int, str]:
    """Mock and return processing_tasks-like dict."""
    # Clean up before each test
    processing_queue_service._projects.clear()
    state_dir = Path(settings.UPLOAD_DIR) / "processing_state"
    if state_dir.exists():
        for state_file in state_dir.glob("*.json"):
            state_file.unlink()
    return MockProcessingTasks(processing_queue_service)

@pytest.fixture
def mock_processing_results(monkeypatch) -> Dict[int, Dict[str, Any]]:
    """Mock and return processing_results-like dict."""
    return MockProcessingResults(processing_queue_service)

@pytest.fixture
def mock_processing_queue(monkeypatch) -> Dict[int, List[Dict[str, Any]]]:
    """Mock and return processing_queue-like dict."""
    return MockProcessingQueue(processing_queue_service)

@pytest.fixture
def mock_processing_current_files(monkeypatch) -> Dict[int, Dict[str, str]]:
    """Mock and return processing_current_files-like dict."""
    return MockCurrentFiles(processing_queue_service)

# Fixtures for file handling
@pytest.fixture
def temp_upload_dir(monkeypatch, tmp_path):
    """Set up a temporary upload directory."""
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(upload_dir))
    return upload_dir

# Mock for database context manager
@pytest.fixture
def mock_db_context():
    """Create a mock database context manager."""
    mock_db = AsyncMock(spec=AsyncSession)
    
    # Modern async context manager pattern (works in Python 3.12+)
    class AsyncContextManager:
        async def __aenter__(self):
            return mock_db
            
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
    
    return AsyncContextManager(), mock_db

# Test API client with mocked dependencies
@pytest.fixture
def test_api_client(client, mock_db, mock_auth):
    """Return a test client with mocked dependencies."""

    # Create mock functions for dependencies
    async def mock_get_db():
        yield mock_db
    
    def mock_get_current_user():
        return mock_auth

    from app.database import get_db
    from app.utils.security import get_current_user

    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides[get_current_user] = mock_get_current_user
    try:
        yield client
    finally:
        app.dependency_overrides = {}
