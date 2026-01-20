import os
from pydantic_settings import BaseSettings
from pydantic import field_validator
from dotenv import load_dotenv
load_dotenv()

class Settings(BaseSettings):
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "SEO Project Manager"

    # Database settings - PostgreSQL required (uses JSONB, GIN indexes, FILTER clauses)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost/seo_project_manager")

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_postgresql_url(cls, v: str) -> str:
        """Enforce PostgreSQL since the codebase uses PostgreSQL-specific features."""
        if not v.startswith(("postgresql", "postgres")):
            raise ValueError(
                "This application requires PostgreSQL due to JSONB operators, GIN indexes, "
                f"and FILTER clauses. Got: {v.split('://')[0]}. "
                "Please use a postgresql+asyncpg:// connection string."
            )
        return v
    SQL_ECHO: bool = os.getenv("SQL_ECHO", "False").lower() == "true"
    
    # JWT settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key") 
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # File upload settings
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024

    class Config:
        case_sensitive = True

settings = Settings()
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)