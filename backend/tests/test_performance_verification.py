
import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.keyword import KeywordService
from app.services.merge_token import TokenMergeService
from app.models.keyword import Keyword, KeywordStatus

@pytest.mark.asyncio
async def test_bulk_status_update_small_batch(mock_db):
    """Test updating status with a small list of IDs (single query optimization)."""
    mock_db.execute = AsyncMock()
    mock_result = MagicMock()
    mock_result.rowcount = 100
    mock_db.execute.return_value = mock_result

    keyword_ids = list(range(100))
    result = await KeywordService.update_status_by_ids_batched(
        db=mock_db,
        project_id=1,
        keyword_ids=keyword_ids,
        update_data={"status": "blocked"},
        required_current_status=KeywordStatus.ungrouped
    )

    assert result == 100
    # Should be called once because list size < 10000
    assert mock_db.execute.call_count == 1

    # Check that 'id = ANY(:ids)' was used in the query
    call_args = mock_db.execute.call_args[0][0]
    assert "id = ANY(:ids)" in str(call_args)
    assert mock_db.execute.call_args[0][1]["ids"] == keyword_ids

@pytest.mark.asyncio
async def test_bulk_status_update_large_batch(mock_db):
    """Test updating status with a large list of IDs (batching fallback)."""
    mock_db.execute = AsyncMock()
    mock_result = MagicMock()
    mock_result.rowcount = 5000
    mock_db.execute.return_value = mock_result

    # Create 15000 IDs to trigger batching (batch size default is 5000)
    keyword_ids = list(range(15000))

    result = await KeywordService.update_status_by_ids_batched(
        db=mock_db,
        project_id=1,
        keyword_ids=keyword_ids,
        update_data={"status": "blocked"},
        required_current_status=KeywordStatus.ungrouped
    )

    # 3 batches of 5000
    assert result == 15000
    assert mock_db.execute.call_count == 3

    # Check that 'id = ANY(:batch_ids)' was used
    call_args = mock_db.execute.call_args_list[0][0][0]
    assert "id = ANY(:batch_ids)" in str(call_args)

@pytest.mark.asyncio
async def test_merge_tokens_bulk_logic(mock_db):
    """
    Test the structure of merge_tokens to ensure it uses bulk operations.
    We are mocking the DB so we just verify the call structure.
    """
    project_id = 1
    parent_token = "software"
    child_tokens = ["program", "app"]

    # Mock return values for the sequence of DB calls

    # 1. Existing parent operations (none)
    mock_result_empty = MagicMock()
    mock_result_empty.fetchall.return_value = []

    # 2. Existing merge op (none)
    mock_result_merge_op = MagicMock()
    mock_result_merge_op.fetchone.return_value = None

    # 3. Find keywords (return 2 keywords)
    mock_result_keywords = MagicMock()
    mock_result_keywords.fetchall.return_value = [
        (101, json.dumps(["program", "developer"])),
        (102, json.dumps(["app", "design"]))
    ]

    # 4. Check existing keyword ops (none)
    mock_result_existing_kw_ops = MagicMock()
    mock_result_existing_kw_ops.fetchall.return_value = []

    # Sequence of returns for db.execute calls
    # We need to be careful with the order or use side_effect based on query content
    # For simplicity, we'll use side_effect with a list

    # Mocking restructure to avoid complex internal logic
    with patch.object(TokenMergeService, '_restructure_affected_keywords', new_callable=AsyncMock) as mock_restructure, \
         patch.object(TokenMergeService, '_handle_ungrouped_matching_grouped_parents', new_callable=AsyncMock) as mock_handle_hidden:

        mock_restructure.return_value = 1
        mock_handle_hidden.return_value = 0

        # Configure execute mock
        mock_db.execute = AsyncMock()
        mock_db.execute.side_effect = [
            mock_result_empty,      # Check existing parent ops
            mock_result_merge_op,   # Check existing merge op
            # Add merge op (db.add used, no execute)
            mock_result_keywords,   # Find keywords
            mock_result_existing_kw_ops, # Check existing keyword ops
            MagicMock(),            # Bulk insert keyword ops (internally handled by SQLAlchemy or we check calls)
            MagicMock(),            # Bulk update keywords
        ]

        # We need to mock db.add and db.flush
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()

        affected, grouped = await TokenMergeService.merge_tokens(
            mock_db, project_id, parent_token, child_tokens
        )

        # Verify bulk update was called
        # The update query should contain the complex CASE statement or JSON processing
        update_calls = [
            call for call in mock_db.execute.call_args_list
            if "UPDATE keywords" in str(call[0][0])
        ]

        assert len(update_calls) > 0
        update_query = str(update_calls[0][0][0])
        assert "SET tokens =" in update_query
        # Ensure it's using the bulk logic we implemented
        assert "jsonb_agg" in update_query or "CASE" in update_query

@pytest.mark.asyncio
async def test_unmerge_tokens_bulk_logic(mock_db):
    """Test the structure of unmerge_token to ensure bulk operations."""
    project_id = 1
    parent_token = "software"

    # 1. Get merge ops (return 1 op)
    mock_result_ops = MagicMock()
    mock_result_ops.fetchall.return_value = [(999, json.dumps(["program"]))]

    # 2. Bulk restore (return count)
    mock_result_update = MagicMock()
    mock_result_update.rowcount = 50

    with patch.object(TokenMergeService, '_unhide_children_of_grouped_parents', new_callable=AsyncMock) as mock_unhide, \
         patch.object(TokenMergeService, '_restructure_affected_keywords', new_callable=AsyncMock) as mock_restructure:

        mock_unhide.return_value = 5
        mock_restructure.return_value = 1

        mock_db.execute = AsyncMock()
        mock_db.execute.side_effect = [
            mock_result_ops,      # Get merge ops
            mock_result_update,   # Bulk restore UPDATE
            MagicMock(),          # DELETE keyword_merge_ops
            MagicMock(),          # DELETE merge_ops
        ]

        restored, grouped = await TokenMergeService.unmerge_token(
            mock_db, project_id, parent_token
        )

        assert restored == 55  # 50 + 5

        # Verify Bulk UPDATE
        update_call = mock_db.execute.call_args_list[1]
        query = str(update_call[0][0])
        assert "UPDATE keywords k" in query
        assert "FROM keyword_merge_operations kmo" in query
