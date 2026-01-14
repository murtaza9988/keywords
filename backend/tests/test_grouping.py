import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.models.keyword import Keyword, KeywordStatus
from app.routes.keyword_routes import (
    block_keywords_by_token,
    group_keywords,
    regroup_keywords,
    unblock_keywords,
    ungroup_keywords,
)
from app.schemas.keyword import BlockTokenRequest, GroupRequest, UnblockRequest


class DummyMappings:
    def __init__(self, first=None, all_=None):
        self._first = first
        self._all = all_ or []

    def first(self):
        return self._first

    def all(self):
        return self._all


class DummyResult:
    def __init__(self, mappings_first=None, mappings_all=None, fetchall=None, scalar_one=None, scalar_one_or_none=None):
        self._mappings_first = mappings_first
        self._mappings_all = mappings_all
        self._fetchall = fetchall
        self._scalar_one = scalar_one
        self._scalar_one_or_none = scalar_one_or_none

    def mappings(self):
        return DummyMappings(first=self._mappings_first, all_=self._mappings_all)

    def fetchall(self):
        return self._fetchall or []

    def scalar_one(self):
        return self._scalar_one

    def scalar_one_or_none(self):
        return self._scalar_one_or_none


class ExecuteRecorder:
    def __init__(self):
        self.calls = []

    async def __call__(self, statement, params=None):
        self.calls.append((statement, params))
        statement_text = str(statement)
        if "SELECT keyword, status, group_id, group_name, original_state" in statement_text:
            return DummyResult(
                mappings_first={
                    "keyword": "kw",
                    "status": "grouped",
                    "group_id": "group",
                    "group_name": "Group",
                    "original_state": "{}",
                }
            )
        if "SELECT EXISTS" in statement_text and "blocked_token" in statement_text:
            return DummyResult(scalar_one=True)
        if "RETURNING id" in statement_text:
            return DummyResult(fetchall=[(1,), (2,)])
        if "SELECT volume FROM keywords" in statement_text:
            return DummyResult(scalar_one_or_none=200)
        if "SELECT id, keyword, volume, difficulty, is_parent" in statement_text and "status = 'grouped'" in statement_text:
            return DummyResult(
                mappings_all=[
                    {
                        "id": 99,
                        "keyword": "parent",
                        "volume": 0,
                        "difficulty": 0.8,
                        "is_parent": True,
                    },
                    {
                        "id": 100,
                        "keyword": "child",
                        "volume": 120,
                        "difficulty": 0.4,
                        "is_parent": False,
                    },
                ]
            )
        return DummyResult()


@pytest.mark.asyncio
async def test_group_keywords_updates_parent_stats(monkeypatch):
    keywords = [
        Keyword(
            id=1,
            project_id=1,
            keyword="alpha",
            volume=100,
            difficulty=0.6,
            tokens="[]",
            is_parent=True,
            status=KeywordStatus.ungrouped.value,
        ),
        Keyword(
            id=2,
            project_id=1,
            keyword="beta",
            volume=50,
            difficulty=0.4,
            tokens="[]",
            is_parent=True,
            status=KeywordStatus.ungrouped.value,
        ),
    ]

    monkeypatch.setattr(
        "app.routes.keyword_routes.KeywordService.find_by_ids_and_status",
        AsyncMock(return_value=keywords),
    )
    monkeypatch.setattr(
        "app.routes.keyword_routes.KeywordService.find_group_by_name",
        AsyncMock(return_value=None),
    )

    recorder = ExecuteRecorder()
    db = AsyncMock()
    db.execute.side_effect = recorder

    response = await group_keywords(
        1,
        GroupRequest(keywordIds=[1, 2], groupName="Group A"),
        current_user={"user_id": 1},
        db=db,
    )

    assert response["count"] == 2
    assert response["totalVolume"] == 150

    state_calls = [
        call for call in recorder.calls if "SET original_state" in str(call[0])
    ]
    representative_state = json.loads(state_calls[0][1]["original_state"])
    assert representative_state["child_ids"] == [2]

    update_calls = [call for call in recorder.calls if "SET status" in str(call[0])]
    parent_update = next(call for call in update_calls if "volume" in call[1])
    assert parent_update[1]["is_parent"] is True
    assert parent_update[1]["volume"] == 150
    assert parent_update[1]["difficulty"] == 0.5


@pytest.mark.asyncio
async def test_regroup_keywords_updates_parent_and_children(monkeypatch):
    parent = Keyword(
        id=10,
        project_id=1,
        keyword="parent",
        volume=0,
        difficulty=0.7,
        tokens="[]",
        is_parent=True,
        group_id="group-a",
        status=KeywordStatus.grouped.value,
    )
    child = Keyword(
        id=11,
        project_id=1,
        keyword="child",
        volume=200,
        difficulty=0.4,
        tokens="[]",
        is_parent=False,
        group_id="group-a",
        status=KeywordStatus.grouped.value,
    )

    monkeypatch.setattr(
        "app.routes.keyword_routes.KeywordService.find_by_ids_and_status",
        AsyncMock(return_value=[parent, child]),
    )
    monkeypatch.setattr(
        "app.routes.keyword_routes.KeywordService.find_children_by_group_id",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        "app.routes.keyword_routes.KeywordService.find_group_by_name",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "app.routes.keyword_routes.KeywordService.store_original_state",
        AsyncMock(),
    )
    update_mock = AsyncMock()
    monkeypatch.setattr("app.routes.keyword_routes.KeywordService.update", update_mock)
    monkeypatch.setattr(
        "app.routes.keyword_routes.KeywordService.find_by_group_id",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        "app.routes.keyword_routes.KeywordService.update_group_parent",
        AsyncMock(),
    )
    monkeypatch.setattr(
        "app.routes.keyword_routes.uuid.uuid4",
        lambda: SimpleNamespace(hex="fixed"),
    )

    recorder = ExecuteRecorder()
    db = AsyncMock()
    db.execute.side_effect = recorder

    response = await regroup_keywords(
        1,
        GroupRequest(keywordIds=[10, 11], groupName="Regrouped"),
        current_user={"user_id": 1},
        db=db,
    )

    assert response["count"] == 2
    assert response["groupId"] == "custom_group_1_fixed"

    update_calls = [call.args for call in update_mock.call_args_list]
    parent_update = next(call for call in update_calls if call[0] == db and call[1] == 10)
    assert parent_update[2]["is_parent"] is True
    assert parent_update[2]["group_id"] == "custom_group_1_fixed"

    volume_update = next(
        call for call in recorder.calls if "UPDATE keywords SET volume" in str(call[0])
    )
    assert volume_update[1]["volume"] == 200


@pytest.mark.asyncio
async def test_ungroup_restores_child_and_updates_group_stats(monkeypatch):
    original_state = json.dumps(
        {
            "keyword": "child",
            "volume": 50,
            "difficulty": 0.3,
            "tokens": "[]",
            "is_parent": False,
            "group_id": None,
            "group_name": None,
            "serp_features": "[]",
        }
    )
    child = Keyword(
        id=2,
        project_id=1,
        keyword="child",
        volume=50,
        difficulty=0.3,
        tokens="[]",
        is_parent=False,
        group_id="group1",
        status=KeywordStatus.grouped.value,
        original_state=original_state,
    )

    monkeypatch.setattr(
        "app.routes.keyword_routes.KeywordService.find_by_ids_and_status",
        AsyncMock(return_value=[child]),
    )
    update_mock = AsyncMock()
    monkeypatch.setattr("app.routes.keyword_routes.KeywordService.update", update_mock)
    monkeypatch.setattr(
        "app.routes.keyword_routes.KeywordService.get_all_by_project",
        AsyncMock(return_value=[child]),
    )

    recorder = ExecuteRecorder()
    db = AsyncMock()
    db.execute.side_effect = recorder

    response = await ungroup_keywords(
        1,
        UnblockRequest(keywordIds=[2]),
        current_user={"user_id": 1},
        db=db,
    )

    assert response["count"] == 1
    update_call = update_mock.call_args[0]
    assert update_call[1] == 2
    assert update_call[2]["is_parent"] is False
    assert update_call[2]["group_id"] is None

    parent_stats_update = next(
        call for call in recorder.calls if "SET volume" in str(call[0])
    )
    assert parent_stats_update[1]["new_volume"] == 120
    assert parent_stats_update[1]["new_difficulty"] == 0.6


@pytest.mark.asyncio
async def test_block_and_unblock_update_status(monkeypatch):
    recorder = ExecuteRecorder()
    db = AsyncMock()
    db.execute.side_effect = recorder

    response = await block_keywords_by_token(
        1,
        BlockTokenRequest(token="Python"),
        current_user={"user_id": 1},
        db=db,
    )

    assert response["count"] == 2
    block_call = next(
        call for call in recorder.calls if "blocked_token" in str(call[0])
    )
    assert block_call[1]["blocked_token"] == "python"

    recorder.calls.clear()

    response = await unblock_keywords(
        1,
        UnblockRequest(keywordIds=[1, 2]),
        current_user={"user_id": 1},
        db=db,
    )

    assert response["count"] == 2
    unblock_call = next(
        call for call in recorder.calls if "blocked_token = NULL" in str(call[0])
    )
    assert unblock_call[1]["keyword_ids"] == [1, 2]
