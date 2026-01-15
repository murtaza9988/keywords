import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, Mock

from app.main import app
from app.database import get_db
from app.utils.security import get_current_user
from app.models.keyword import Keyword
from app.services.keyword import KeywordService
from app.services.project import ProjectService


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def mock_auth():
    return {"user_id": 1, "email": "tester@example.com"}


def test_keyword_children_response_uses_aliases(client, mock_auth, monkeypatch):
    child = Keyword(
        id=10,
        project_id=1,
        keyword="child keyword",
        volume=100,
        difficulty=0.2,
        rating=None,
        tokens=["child"],
        is_parent=False,
        group_id="group-1",
        group_name="Group 1",
        status="grouped",
        original_volume=100,
        serp_features=["faq"],
    )

    async def _override_get_db():
        yield Mock()

    def _override_get_current_user():
        return mock_auth

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user
    monkeypatch.setattr(ProjectService, "get_by_id", AsyncMock(return_value=Mock()))
    monkeypatch.setattr(
        KeywordService,
        "get_children_by_group",
        AsyncMock(return_value=[child]),
    )

    response = client.get("/api/projects/1/groups/group-1/children")

    app.dependency_overrides = {}

    assert response.status_code == 200
    payload = response.json()
    assert payload["children"][0]["isParent"] is False
    assert payload["children"][0]["groupId"] == "group-1"
    assert payload["children"][0]["groupName"] == "Group 1"
    assert payload["children"][0]["serpFeatures"] == ["faq"]
    assert "is_parent" not in payload["children"][0]
    assert "group_id" not in payload["children"][0]
