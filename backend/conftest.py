import pytest
import json
import os
import asyncio
from unittest.mock import AsyncMock
from typing import Dict, List, Any, Generator
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.testclient import TestClient

from app.models.keyword import Keyword, KeywordStatus
from app.models.project import Project
from app.config import settings
from app.main import app

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
@pytest.fixture
def mock_processing_tasks(monkeypatch) -> Dict[int, str]:
    """Mock and return processing_tasks dict."""
    mock_tasks = {}
    monkeypatch.setattr("app.routes.keyword_processing.processing_tasks", mock_tasks)
    monkeypatch.setattr("app.routes.keyword_routes.processing_tasks", mock_tasks)
    return mock_tasks

@pytest.fixture
def mock_processing_results(monkeypatch) -> Dict[int, Dict[str, Any]]:
    """Mock and return processing_results dict."""
    mock_results = {}
    monkeypatch.setattr("app.routes.keyword_processing.processing_results", mock_results)
    monkeypatch.setattr("app.routes.keyword_routes.processing_results", mock_results)
    return mock_results

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
    from unittest.mock import patch
    
    # Create mock functions for dependencies
    async def mock_get_db():
        yield mock_db
    
    def mock_get_current_user():
        return mock_auth
    
    # Apply patches
    with patch("app.routes.keyword_routes.get_db", side_effect=mock_get_db), \
         patch("app.routes.keyword_routes.get_current_user", side_effect=mock_get_current_user), \
         patch("app.routes.keyword_tokens.get_db", side_effect=mock_get_db), \
         patch("app.routes.keyword_tokens.get_current_user", side_effect=mock_get_current_user):
        yield client