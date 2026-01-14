import asyncio
import logging
from typing import Any, Awaitable, Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.keyword import KeywordService
from app.services.merge_token import TokenMergeService

logger = logging.getLogger(__name__)

class BackgroundTaskManager:
    _tasks: Dict[str, Dict[str, Any]] = {}
    
    @classmethod
    def start_task(cls, task_id: str, coroutine: Awaitable[Any]) -> str:
        """Start a background task and store its reference."""
        task = asyncio.create_task(cls._run_task(task_id, coroutine))
        cls._tasks[task_id] = {
            "task": task,
            "status": "running",
            "result": None,
            "error": None
        }
        return task_id
    
    @classmethod
    async def _run_task(cls, task_id: str, coroutine: Awaitable[Any]) -> None:
        """Run the coroutine and store its result or error."""
        try:
            result = await coroutine
            cls._tasks[task_id]["status"] = "completed"
            cls._tasks[task_id]["result"] = result
        except Exception as e:
            logger.exception(f"Background task {task_id} failed")
            cls._tasks[task_id]["status"] = "failed"
            cls._tasks[task_id]["error"] = str(e)
    
    @classmethod
    def get_task_status(cls, task_id: str) -> Dict[str, Any]:
        """Get the status of a task."""
        if task_id not in cls._tasks:
            return {"status": "not_found"}
        
        task_info = cls._tasks[task_id].copy()
        task_info.pop("task")
        return task_info
    
    @classmethod
    def clean_completed_tasks(cls, max_age_seconds: int = 3600) -> None:
        """Clean up completed tasks older than the specified age."""
        pass

async def merge_tokens_background(
    project_id: int,
    parent_token: str,
    child_tokens: List[str],
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Background task for merging tokens."""
    try:
        db_gen = get_db()
        db = await anext(db_gen)
        try:
            affected_count, merged_groups = await TokenMergeService.merge_tokens(db, project_id, parent_token, child_tokens, user_id)
            await db.commit()
            return {
                "success": True,
                "message": f"Successfully merged {len(child_tokens)} tokens into '{parent_token}'",
                "count": len(child_tokens),
                "parent_token": parent_token,
                "affected_keywords": affected_count,
                "merged_groups": merged_groups
            }
        except Exception as e:
            await db.rollback()
            logger.exception(f"Error in merge_tokens_background: {e}")
            return {
                "success": False,
                "message": f"Failed to merge tokens: {str(e)}"
            }
        finally:
            await db.close()
    except Exception as e:
        logger.exception(f"Database session error in merge_tokens_background: {e}")
        return {
            "success": False,
            "message": f"Database session error: {str(e)}"
        }

async def unmerge_token_background(project_id: int, parent_token: str) -> Dict[str, Any]:
    """Background task for unmerging tokens."""
    try:
        db_gen = get_db()
        db = await anext(db_gen)
        try:
            affected_count, unmerged_groups = await TokenMergeService.unmerge_token(
                db, project_id, parent_token
            )
            await db.commit()
            return {
                "success": True,
                "message": f"Successfully unmerged token '{parent_token}'",
                "affected_keywords": affected_count,
                "unmerged_groups": unmerged_groups
            }
        except Exception as e:
            await db.rollback()
            logger.exception(f"Error in unmerge_token_background: {e}")
            return {
                "success": False,
                "message": f"Failed to unmerge token: {str(e)}"
            }
        finally:
            await db.close()
    except Exception as e:
        logger.exception(f"Database session error in unmerge_token_background: {e}")
        return {
            "success": False,
            "message": f"Database session error: {str(e)}"
        }
