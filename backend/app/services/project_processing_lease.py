from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class ProjectProcessingLeaseService:
    @staticmethod
    async def try_acquire(db: AsyncSession, *, project_id: int, owner: str, ttl_seconds: int) -> bool:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=ttl_seconds)
        result = await db.execute(
            text(
                """
                INSERT INTO project_processing_leases (project_id, lease_owner, lease_expires_at, updated_at)
                VALUES (:project_id, :lease_owner, :lease_expires_at, :updated_at)
                ON CONFLICT (project_id)
                DO UPDATE SET
                    lease_owner = EXCLUDED.lease_owner,
                    lease_expires_at = EXCLUDED.lease_expires_at,
                    updated_at = EXCLUDED.updated_at
                WHERE project_processing_leases.lease_expires_at < :now
                """
            ),
            {
                "project_id": project_id,
                "lease_owner": owner,
                "lease_expires_at": expires_at,
                "updated_at": now,
                "now": now,
            },
        )
        await db.commit()
        return bool(getattr(result, "rowcount", 0))

    @staticmethod
    async def renew(db: AsyncSession, *, project_id: int, owner: str, ttl_seconds: int) -> None:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=ttl_seconds)
        await db.execute(
            text(
                """
                UPDATE project_processing_leases
                SET lease_expires_at = :lease_expires_at,
                    updated_at = :updated_at
                WHERE project_id = :project_id
                  AND lease_owner = :lease_owner
                """
            ),
            {
                "project_id": project_id,
                "lease_owner": owner,
                "lease_expires_at": expires_at,
                "updated_at": now,
            },
        )
        await db.commit()

    @staticmethod
    async def release(db: AsyncSession, *, project_id: int, owner: str) -> None:
        await db.execute(
            text(
                """
                DELETE FROM project_processing_leases
                WHERE project_id = :project_id AND lease_owner = :lease_owner
                """
            ),
            {
                "project_id": project_id,
                "lease_owner": owner,
            },
        )
        await db.commit()

    @staticmethod
    async def is_locked(db: AsyncSession, *, project_id: int) -> bool:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            text(
                """
                SELECT 1
                FROM project_processing_leases
                WHERE project_id = :project_id
                  AND lease_expires_at > :now
                """
            ),
            {"project_id": project_id, "now": now},
        )
        return result.first() is not None
