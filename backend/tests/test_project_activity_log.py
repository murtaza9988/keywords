import pytest

from app.database import engine, get_db_context
from app.models.project import Project
from app.models.project_activity_log import ProjectActivityLog
from app.services.project import ProjectService
from app.services.project_activity_log import ProjectActivityLogService


@pytest.mark.asyncio
async def test_record_and_list_project_logs():
    async with engine.begin() as conn:
        await conn.run_sync(ProjectActivityLog.__table__.drop, checkfirst=True)
        await conn.run_sync(Project.__table__.drop, checkfirst=True)
        await conn.run_sync(Project.__table__.create)
        await conn.run_sync(ProjectActivityLog.__table__.create)

    async with get_db_context() as db:
        project = await ProjectService.create(db, "Log Test Project")
        await ProjectActivityLogService.record_action(
            db=db,
            project_id=project.id,
            username="tester",
            action="project_created",
            entity_type="project",
            entity_id=str(project.id),
            details={"name": project.name},
        )

    async with get_db_context() as db:
        logs, total = await ProjectActivityLogService.list_logs(
            db=db,
            project_id=project.id,
            page=1,
            limit=10,
            sort="created_at",
            direction="desc",
        )

    assert total == 1
    assert logs[0].action == "project_created"
    assert logs[0].username == "tester"
