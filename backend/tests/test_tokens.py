import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, Mock

from app.main import app
from app.database import get_db
from app.utils.security import get_current_user
from app.routes import keyword_tokens
from app.services.merge_token import TokenMergeService


class DummyResult:
    def __init__(self, scalar=None, rows=None):
        self._scalar = scalar
        self._rows = rows or []

    def scalar_one(self):
        return self._scalar

    def fetchall(self):
        return self._rows

    def fetchone(self):
        return self._rows[0] if self._rows else None


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_auth():
    return {"user_id": 1, "email": "tester@example.com"}


@pytest.fixture(autouse=True)
def clear_token_cache():
    keyword_tokens._token_cache.clear()


def test_tokens_all_view_pagination_and_counts(client, mock_auth, monkeypatch):
    mock_db = Mock()
    mock_db.execute = AsyncMock(
        side_effect=[
            DummyResult(scalar=3),
            DummyResult(rows=[("alpha", 2, 100, 0.5), ("beta", 1, 50, 0.2)]),
        ]
    )

    async def _override_get_db():
        yield mock_db

    def _override_get_current_user():
        return mock_auth

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user
    monkeypatch.setattr(TokenMergeService, "get_token_relationships", AsyncMock(return_value={}))

    response = client.get("/api/projects/1/tokens?view=all&limit=2&page=1")

    app.dependency_overrides = {}

    assert response.status_code == 200
    payload = response.json()
    assert payload["pagination"] == {"total": 3, "page": 1, "limit": 2, "pages": 2}
    assert payload["tokens"][0]["tokenName"] == "alpha"
    assert payload["tokens"][0]["count"] == 2
    assert payload["tokens"][1]["tokenName"] == "beta"
    assert payload["tokens"][1]["count"] == 1


def test_tokens_current_view_second_page(client, mock_auth, monkeypatch):
    mock_db = Mock()
    mock_db.execute = AsyncMock(
        side_effect=[
            DummyResult(scalar=3),
            DummyResult(rows=[("gamma", 1, 20, 0.1)]),
        ]
    )

    async def _override_get_db():
        yield mock_db

    def _override_get_current_user():
        return mock_auth

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user
    monkeypatch.setattr(TokenMergeService, "get_token_relationships", AsyncMock(return_value={}))

    response = client.get("/api/projects/1/tokens?view=current&limit=2&page=2")

    app.dependency_overrides = {}

    assert response.status_code == 200
    payload = response.json()
    assert payload["pagination"] == {"total": 3, "page": 2, "limit": 2, "pages": 2}
    assert payload["tokens"][0]["tokenName"] == "gamma"
    assert payload["tokens"][0]["count"] == 1


def test_tokens_blocked_view_pagination_and_counts(client, mock_auth):
    mock_db = Mock()
    mock_db.execute = AsyncMock(
        side_effect=[
            DummyResult(scalar=True),
            DummyResult(scalar=3),
            DummyResult(rows=[("blocked-a", 2, 100, 0.4), ("blocked-b", 1, 50, 0.2)]),
        ]
    )

    async def _override_get_db():
        yield mock_db

    def _override_get_current_user():
        return mock_auth

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    response = client.get("/api/projects/1/tokens?view=blocked&limit=2&page=1")

    app.dependency_overrides = {}

    assert response.status_code == 200
    payload = response.json()
    assert payload["pagination"] == {"total": 3, "page": 1, "limit": 2, "pages": 2}
    assert payload["tokens"][0]["tokenName"] == "blocked-a"
    assert payload["tokens"][0]["count"] == 2
    assert payload["tokens"][1]["tokenName"] == "blocked-b"
    assert payload["tokens"][1]["count"] == 1


def test_tokens_merged_view_cache_hit(client, mock_auth, monkeypatch):
    mock_db = Mock()
    mock_db.execute = AsyncMock(
        side_effect=[
            DummyResult(scalar=2),
            DummyResult(rows=[("parent", 2, 120, 0.3), ("child", 1, 40, 0.1)]),
        ]
    )

    async def _override_get_db():
        yield mock_db

    def _override_get_current_user():
        return mock_auth

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user
    monkeypatch.setattr(
        TokenMergeService,
        "get_token_relationships",
        AsyncMock(return_value={"parent": ["child"]}),
    )

    first_response = client.get(
        "/api/projects/1/tokens?view=all&limit=2&page=1&show_merged=true"
    )
    second_response = client.get(
        "/api/projects/1/tokens?view=all&limit=2&page=1&show_merged=true"
    )

    app.dependency_overrides = {}

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    payload = first_response.json()
    assert payload["pagination"] == {"total": 2, "page": 1, "limit": 2, "pages": 1}
    assert payload["tokens"] == [
        {
            "tokenName": "parent",
            "volume": 120,
            "difficulty": 0.3,
            "count": 2,
            "isParent": True,
            "hasChildren": True,
            "childTokens": ["child"],
        }
    ]
    assert mock_db.execute.call_count == 2
