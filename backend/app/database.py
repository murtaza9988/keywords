import logging
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

# Create SQLAlchemy engine for MySQL with aiomysql driver
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# Create async engine
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=settings.SQL_ECHO,
    pool_pre_ping=True,
   
)

logger = logging.getLogger(__name__)

# Session factory
async_session_factory = sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

# Base class for SQLAlchemy models
Base = declarative_base()

# Dependency
async def get_db():
    """Dependency for database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Context manager for database sessions
@asynccontextmanager
async def get_db_context():
    """Context manager for database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Initialize database
async def init_db():
    """Initialize the database with tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created")


async def verify_csv_uploads_storage_path(conn: AsyncConnection | None = None) -> None:
    """Verify csv_uploads.storage_path exists to avoid runtime UndefinedColumnError."""
    query = text(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = :table_name
          AND column_name = :column_name
        LIMIT 1
        """
    )

    async def _column_exists(connection: AsyncConnection) -> bool:
        result = await connection.execute(
            query,
            {"table_name": "csv_uploads", "column_name": "storage_path"},
        )
        return result.scalar_one_or_none() is not None

    if conn is None:
        async with engine.connect() as connection:
            exists = await _column_exists(connection)
    else:
        exists = await _column_exists(conn)

    if not exists:
        message = (
            "Database schema missing column csv_uploads.storage_path. "
            "Run `alembic upgrade head` (migration "
            "20260114_000001_add_csv_upload_storage_path.py) before starting the app."
        )
        logger.error(message)
        raise RuntimeError(message)
