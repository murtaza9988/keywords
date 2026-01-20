"""
Keyword routes - Combined router for all keyword-related endpoints.

This module serves as the main entry point for keyword routes, combining
domain-specific routers for better code organization:

- keyword_query_routes: GET endpoints for querying keywords
- keyword_mutation_routes: Grouping and blocking operations
- csv_routes: CSV upload and download
- keyword_export_routes: Export and import operations
- keyword_admin_routes: Stats and admin operations

The combined router maintains backwards compatibility with existing code
that imports from keyword_routes.
"""

import os

from fastapi import APIRouter

from app.config import settings
from app.routes.csv_routes import router as csv_router
from app.routes.keyword_admin_routes import router as admin_router
from app.routes.keyword_export_routes import router as export_router
from app.routes.keyword_mutation_routes import router as mutation_router

# Import domain-specific routers
from app.routes.keyword_query_routes import router as query_router

# Create the combined router
router = APIRouter(tags=["keywords"])

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# Include all domain routers
# Note: All routers use the same tag "keywords" and share the same prefix
# when included in main.py, so routes will be registered at the same paths
router.include_router(query_router)
router.include_router(mutation_router)
router.include_router(csv_router)
router.include_router(export_router)
router.include_router(admin_router)

# Re-export helper functions for backwards compatibility

# Re-export endpoint functions for backwards compatibility with tests




