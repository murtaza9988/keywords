from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.config import settings
from app.database import init_db
from app.routes import (
    activity_logs,
    auth,
    keyword_routes,
    keyword_tokens,
    notes,
    projects,
)
from app.scripts.setup_nltk import ensure_nltk_resources
from app.utils.compound_normalization import load_compound_variants

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    ensure_nltk_resources()
    await init_db()
    load_compound_variants()

# Include routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(projects.router, prefix=settings.API_V1_STR)
app.include_router(keyword_routes.router, prefix=settings.API_V1_STR)
app.include_router(keyword_tokens.router, prefix=settings.API_V1_STR)
app.include_router(notes.router, prefix=settings.API_V1_STR)
app.include_router(activity_logs.router, prefix=settings.API_V1_STR)
@app.get("/")
async def root():
    return {
        "message": "Welcome to SEO Project Manager API. See /docs for API documentation."
    }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
