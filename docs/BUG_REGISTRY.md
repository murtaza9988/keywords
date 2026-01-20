# Bug Registry

> **Canonical catalog of known bugs, their root causes, and recommended fixes.**
> This document tracks all identified bugs from codebase analysis and production incidents.

---

## Table of Contents

1. [Summary Dashboard](#summary-dashboard)
2. [Severity Definitions](#severity-definitions)
3. [Critical Bugs (P0)](#critical-bugs-p0)
4. [High Priority Bugs (P1)](#high-priority-bugs-p1)
5. [Medium Priority Bugs (P2)](#medium-priority-bugs-p2)
6. [Bug Index by Category](#bug-index-by-category)
7. [Fix Dependency Graph](#fix-dependency-graph)

---

## Summary Dashboard

| Severity | Count | Status |
|----------|-------|--------|
| Critical (P0) | 3 | Unfixed |
| High (P1) | 7 | Unfixed |
| Medium (P2) | 4 | Unfixed |
| **Total** | **14** | |

### By Category

| Category | Count | Critical | High | Medium |
|----------|-------|----------|------|--------|
| Security | 1 | 1 | 0 | 0 |
| Data Integrity | 5 | 1 | 4 | 0 |
| Runtime/Infrastructure | 2 | 1 | 1 | 0 |
| API Contract | 2 | 0 | 2 | 0 |
| Performance | 4 | 0 | 0 | 4 |

---

## Severity Definitions

| Level | Definition | User Impact | SLA |
|-------|------------|-------------|-----|
| **P0 - Critical** | System broken, data loss, security vulnerability | Blocks core functionality for all users | Fix immediately |
| **P1 - High** | Feature broken, data corruption, significant UX issue | Impacts user workflows noticeably | Fix within sprint |
| **P2 - Medium** | Degraded performance, minor UX issue, workaround exists | Annoying but not blocking | Fix when capacity allows |
| **P3 - Low** | Cosmetic, edge case, minimal impact | Rarely noticed | Backlog |

---

## Critical Bugs (P0)

### BUG-001: Hardcoded Authentication Credentials

| Field | Value |
|-------|-------|
| **ID** | BUG-001 |
| **Severity** | P0 - Critical |
| **Category** | Security |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #21 |

#### Description

The authentication system uses hardcoded credentials instead of a proper user database with password hashing.

#### Location

`backend/app/utils/security.py:93-96`

```python
def authenticate_user(username: str, password: str) -> bool:
    if username == "admin" and password == "password123":
        return True
    return False
```

#### Root Cause

Initial implementation shortcut that was never replaced with proper authentication.

#### User Impact

- **Security**: Anyone who knows the hardcoded password has full system access
- **Multi-tenancy**: No user isolation - all actions appear as "admin"
- **Audit trail**: Cannot attribute actions to specific users
- **Compliance**: Fails basic security audit requirements

#### Suggested Fix

```python
# 1. Create User model
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# 2. Update authenticate_user
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    user = await db.execute(
        select(User).where(User.username == username, User.is_active == True)
    )
    user = user.scalar_one_or_none()
    if not user or not pwd_context.verify(password, user.hashed_password):
        return None
    return user
```

#### Contingencies

- Migration needed to create users table
- Seed script required for initial admin user
- Password reset flow needs implementation
- Existing JWTs will be invalidated (plan for user re-login)

#### Test Requirements

- Unit test for password hashing/verification
- Integration test for login flow
- Security test for SQL injection in username field

---

### BUG-002: Background Task Uses Request-Scoped DB Session

| Field | Value |
|-------|-------|
| **ID** | BUG-002 |
| **Severity** | P0 - Critical |
| **Category** | Data Integrity |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #23 |

#### Description

Background tasks receive the request-scoped database session, which is closed when the request completes. This causes silent failures in async operations.

#### Location

`backend/app/routes/projects.py:102-120`

```python
@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    # ... validation ...
    background_tasks.add_task(ProjectService.delete, db, project_id)  # BUG: db will be closed
    return {"message": "Project deletion started"}
```

#### Root Cause

Misunderstanding of FastAPI's dependency injection lifecycle. `db` is created per-request and disposed when the request handler returns, but `BackgroundTasks` run after the response is sent.

#### User Impact

- **Data loss illusion**: User sees "deleted" confirmation but data persists
- **Ghost data**: Deleted projects reappear on refresh
- **Orphaned references**: Partial deletes leave inconsistent state
- **Silent failures**: No error reported to user or logs

#### Suggested Fix

```python
# Option A: Create session inside background task
async def delete_project_task(project_id: int):
    """Background task that creates its own session."""
    async with AsyncSessionLocal() as db:
        try:
            await ProjectService.delete(db, project_id)
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to delete project {project_id}: {e}")

@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    # Validate project exists (use short-lived session)
    async with AsyncSessionLocal() as db:
        project = await ProjectService.get(db, project_id)
        if not project:
            raise HTTPException(404, "Project not found")

    background_tasks.add_task(delete_project_task, project_id)
    return {"message": "Project deletion started"}
```

```python
# Option B: Use a task queue (Celery, ARQ, etc.)
from app.tasks import delete_project_task

@router.delete("/{project_id}")
async def delete_project(project_id: int):
    delete_project_task.delay(project_id)  # Queued with own session
    return {"message": "Project deletion queued"}
```

#### Contingencies

- Audit all uses of `BackgroundTasks` in codebase
- Consider adding health check for background task completion
- May need idempotency tokens if task is retried
- Error logging must be robust since no user to notify

#### Test Requirements

- Integration test that verifies deletion completes after request returns
- Test for error handling when deletion fails
- Test for concurrent delete requests on same project

---

### BUG-003: Database Engine Mismatch (MySQL Config, PostgreSQL Code)

| Field | Value |
|-------|-------|
| **ID** | BUG-003 |
| **Severity** | P0 - Critical |
| **Category** | Runtime/Infrastructure |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #24 |

#### Description

Configuration defaults to MySQL but code uses PostgreSQL-specific features (JSONB operators, GIN indexes, FILTER clauses). Running on MySQL causes runtime 500 errors.

#### Locations

**Config (MySQL default):** `backend/app/config.py:8-16`
```python
DATABASE_URL: str = "mysql+aiomysql://root:password@localhost/keywords_db"
```

**Code (PostgreSQL features):** `backend/app/models/keyword.py`
```python
tokens = Column(JSONB, default=list)  # PostgreSQL-specific type

Index('ix_keyword_tokens_gin', tokens, postgresql_using='gin')  # PostgreSQL-specific index
```

**Queries (PostgreSQL operators):** `backend/app/services/keyword.py`
```python
# JSONB containment operator - PostgreSQL only
query = query.where(Keyword.tokens.op('@>')(json.dumps([token])))

# JSONB has-key operator - PostgreSQL only
query = query.where(Keyword.tokens.op('?')(token))
```

#### Root Cause

Initial development on PostgreSQL without updating default config. No runtime validation of database compatibility.

#### User Impact

- **Complete failure**: Application crashes on any keyword operation if MySQL is used
- **Confusing errors**: 500 errors with cryptic SQL syntax messages
- **Deployment failures**: Production may differ from development environment

#### Suggested Fix

```python
# backend/app/config.py - Change default and add validation

class Settings(BaseSettings):
    # Change default to PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost/keywords_db"

    @validator("DATABASE_URL")
    def validate_database_url(cls, v):
        """Enforce PostgreSQL since we use JSONB features."""
        if not v.startswith(("postgresql", "postgres")):
            raise ValueError(
                "This application requires PostgreSQL due to JSONB operators. "
                f"Got: {v.split('://')[0]}. "
                "Please use postgresql+asyncpg:// connection string."
            )
        return v

# backend/app/main.py - Add startup check
@app.on_event("startup")
async def validate_database():
    """Verify database is PostgreSQL with required extensions."""
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT version()"))
        version = result.scalar()
        if "PostgreSQL" not in version:
            raise RuntimeError(
                f"PostgreSQL required but got: {version}"
            )
        logger.info(f"Database validated: {version}")
```

#### Contingencies

- Document PostgreSQL as hard requirement in README
- Update Docker/docker-compose to use PostgreSQL
- Migration script for any existing MySQL data
- CI should run tests against PostgreSQL specifically

#### Test Requirements

- Startup test that validates database engine
- Test that config rejects MySQL URLs
- Integration tests run on PostgreSQL in CI

---

## High Priority Bugs (P1)

### BUG-004: `is_parent` Forced True for Filtered Keywords

| Field | Value |
|-------|-------|
| **ID** | BUG-004 |
| **Severity** | P1 - High |
| **Category** | Data Integrity |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #26 |

#### Description

When filtering keywords with include/exclude/SERP filters, all returned keywords have `is_parent` forced to `True`, even when they are actually children.

#### Location

`backend/app/routes/keyword_routes.py:438-488`

```python
# After filtering in Python
for kw in final_keywords:
    kw["is_parent"] = True  # BUG: Overwrites actual parent/child status
```

#### Root Cause

Simplification assumption that filtered results should be treated as top-level, ignoring actual group relationships.

#### User Impact

- **UI confusion**: Child keywords display as parents with expand controls
- **Grouping errors**: Users may try to group already-grouped keywords
- **Broken hierarchy**: Parent-child relationships invisible in filtered views

#### Suggested Fix

```python
# Preserve actual is_parent status from database
for kw in final_keywords:
    # Remove the forced assignment
    # kw["is_parent"] = True  # DELETE THIS LINE

    # If you need to indicate "shown at top level in this view":
    kw["is_top_level_in_view"] = True  # New field for UI purposes
    # Keep is_parent reflecting actual database state
```

#### Contingencies

- Frontend may rely on `is_parent=True` for rendering logic
- Audit frontend components that check `is_parent`
- May need to update filtering UI to show grouped/ungrouped indicator

#### Test Requirements

- Test that child keywords retain `is_parent=False` in filtered results
- Test that UI correctly displays children with filter active
- Test grouping operations work correctly on filtered children

---

### BUG-005: Non-English Keywords Bypass Blocked Status

| Field | Value |
|-------|-------|
| **ID** | BUG-005 |
| **Severity** | P1 - High |
| **Category** | Data Integrity |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #29 |

#### Description

Non-English keywords are correctly identified and marked as `blocked` during processing, but the CSV import path then overwrites this status to `ungrouped`.

#### Locations

**Correctly marks as blocked:** `backend/app/services/keyword_processing.py:336-355`
```python
if not is_english(keyword_text):
    payload["status"] = KeywordStatus.BLOCKED
```

**Overwrites to ungrouped:** `backend/app/routes/keyword_processing.py:468-485`
```python
# Later in import flow
if not existing_group:
    keyword.status = KeywordStatus.UNGROUPED  # Overwrites blocked status
    keyword.is_parent = True
```

#### Root Cause

Import logic doesn't check current status before setting default ungrouped state.

#### User Impact

- **Workflow pollution**: Non-English keywords appear in grouping workflow
- **Repeated blocking**: Users must manually re-block after every import
- **False positives**: Auto-grouping may create groups with non-English content

#### Suggested Fix

```python
# backend/app/routes/keyword_processing.py
if not existing_group:
    # Preserve blocked status if set by processing
    if keyword.status != KeywordStatus.BLOCKED:
        keyword.status = KeywordStatus.UNGROUPED
        keyword.is_parent = True
    # else: keep the blocked status from processing
```

#### Contingencies

- Existing non-English keywords may already be ungrouped in database
- Consider backfill script to re-identify and block non-English keywords
- Language detection accuracy may have false positives/negatives

#### Test Requirements

- Test that non-English keywords remain blocked after import
- Test that English keywords correctly become ungrouped
- Test re-import of mixed-language CSV

---

### BUG-006: Regrouping Zeros Out Parent Volume/Difficulty

| Field | Value |
|-------|-------|
| **ID** | BUG-006 |
| **Severity** | P1 - High |
| **Category** | Data Integrity |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #28 |

#### Description

When regrouping keywords, volume and difficulty are calculated only from child keywords. If regrouping parents only (no children), metrics become 0.0.

#### Location

`backend/app/routes/keyword_routes.py:1724-1809`

```python
# Only sums children
total_volume = sum(child.volume or 0 for child in children)
avg_difficulty = sum(child.difficulty or 0 for child in children) / len(children) if children else 0

new_parent.volume = total_volume  # 0 if no children
new_parent.difficulty = avg_difficulty  # 0 if no children
```

#### Root Cause

Logic assumes regrouped items always have children, doesn't account for parent-only regroup operations.

#### User Impact

- **Data loss**: Volume and difficulty metrics wiped from keywords
- **SEO impact**: Users lose critical data needed for keyword prioritization
- **Trust erosion**: Users may not notice until decisions are made on bad data

#### Suggested Fix

```python
# Include the keywords being regrouped in calculations
all_keywords_for_metrics = list(children) + keywords_being_regrouped

if not all_keywords_for_metrics:
    # Preserve existing metrics if no data available
    pass
else:
    total_volume = sum(kw.volume or 0 for kw in all_keywords_for_metrics)
    avg_difficulty = sum(kw.difficulty or 0 for kw in all_keywords_for_metrics) / len(all_keywords_for_metrics)

    new_parent.volume = total_volume
    new_parent.difficulty = avg_difficulty
```

#### Contingencies

- Need to handle case where keywords have NULL volume/difficulty
- Existing groups may have incorrect metrics - consider audit/backfill
- UI should warn if regrouping would result in metric loss

#### Test Requirements

- Test regrouping parents-only preserves metrics
- Test regrouping mixed parent/children calculates correctly
- Test regrouping with NULL metric values

---

### BUG-007: Manual Grouping Ignores Existing Children in Difficulty

| Field | Value |
|-------|-------|
| **ID** | BUG-007 |
| **Severity** | P1 - High |
| **Category** | Data Integrity |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #27 |

#### Description

When adding keywords to an existing group, difficulty is averaged using only the parent's current difficulty plus new keywords, ignoring existing children.

#### Location

`backend/app/routes/keyword_routes.py:1531-1659`

```python
# Only considers parent + new keywords
difficulties = [parent.difficulty] + [kw.difficulty for kw in new_keywords]
parent.difficulty = sum(difficulties) / len(difficulties)
# Missing: existing children's difficulties
```

#### Root Cause

Optimization that avoided fetching children, but incorrectly treats aggregated parent difficulty as a single sample.

#### User Impact

- **Metric drift**: Difficulty becomes increasingly inaccurate as group grows
- **Bad decisions**: SEO planning based on wrong difficulty scores
- **Unpredictable**: Same keywords in different addition order = different difficulty

#### Suggested Fix

```python
# Fetch existing children and include in calculation
existing_children = await db.execute(
    select(Keyword).where(
        Keyword.group_id == parent.group_id,
        Keyword.is_parent == False
    )
)
existing_children = existing_children.scalars().all()

# Calculate from all actual keyword difficulties
all_keywords = [parent] + list(existing_children) + new_keywords
difficulties = [kw.difficulty for kw in all_keywords if kw.difficulty is not None]

if difficulties:
    parent.difficulty = sum(difficulties) / len(difficulties)
```

#### Contingencies

- Performance impact of fetching children for every group operation
- Consider caching child count/sum on parent for faster aggregation
- Existing groups may have drifted metrics - consider backfill

#### Test Requirements

- Test adding to group with existing children
- Test difficulty calculation matches manual calculation
- Performance test for groups with many children

---

### BUG-008: `keywords-for-cache` Returns Empty Data

| Field | Value |
|-------|-------|
| **ID** | BUG-008 |
| **Severity** | P1 - High |
| **Category** | API Contract |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #25 |

#### Description

The `/keywords-for-cache` endpoint builds keyword response objects but only returns timestamp and status, omitting the actual keyword data.

#### Location

`backend/app/routes/keyword_routes.py:618-652`

```python
@router.get("/{project_id}/keywords-for-cache")
async def get_keywords_for_cache(...):
    keywords = await KeywordService.get_keywords(...)
    keyword_responses = [KeywordResponse.from_orm(kw) for kw in keywords]

    # BUG: keyword_responses is built but not returned
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "status": "ok"
    }
```

#### Root Cause

Incomplete implementation - likely a work-in-progress that was committed.

#### User Impact

- **Broken caching**: Frontend cache cannot hydrate with data
- **Wasted requests**: Endpoint is called but provides no value
- **Stale UI**: Users may see outdated data if cache fallback is used

#### Suggested Fix

```python
@router.get("/{project_id}/keywords-for-cache")
async def get_keywords_for_cache(...):
    keywords = await KeywordService.get_keywords(...)
    keyword_responses = [KeywordResponse.from_orm(kw) for kw in keywords]

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "status": "ok",
        "keywords": keyword_responses,  # ADD THIS LINE
        "count": len(keyword_responses)
    }
```

#### Contingencies

- Frontend may not expect keyword data - verify client code
- Response size could be large - consider pagination
- Cache invalidation strategy needed

#### Test Requirements

- Test endpoint returns keyword data
- Test response shape matches expected schema
- Test pagination if implemented

---

### BUG-009: In-Memory Filtering for Large Datasets

| Field | Value |
|-------|-------|
| **ID** | BUG-009 |
| **Severity** | P1 - High |
| **Category** | Performance |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #30 |

#### Description

When include/exclude/SERP filters are active, the endpoint fetches all matching keywords into Python memory and filters there instead of using SQL.

#### Location

`backend/app/routes/keyword_routes.py:242-372`

```python
# When filters active, fetches all with limit=0
if include_filter or exclude_filter or serp_filter:
    all_keywords = await KeywordService.get_keywords(db, project_id, limit=0)  # ALL rows
    # Then filters in Python...
    filtered = [kw for kw in all_keywords if matches_filter(kw)]
```

#### Root Cause

Complex filter logic was easier to implement in Python than SQL, but doesn't scale.

#### User Impact

- **Slow responses**: 10+ second loads for projects with 10k+ keywords
- **Memory pressure**: Server may OOM with very large projects
- **Timeout errors**: Requests may timeout before filtering completes

#### Suggested Fix

```python
# Push filtering into SQL where possible
query = select(Keyword).where(Keyword.project_id == project_id)

if include_filter:
    # Use ILIKE or full-text search
    query = query.where(Keyword.keyword.ilike(f"%{include_filter}%"))

if exclude_filter:
    query = query.where(~Keyword.keyword.ilike(f"%{exclude_filter}%"))

if serp_filter:
    # Use JSONB containment for array fields
    query = query.where(Keyword.serp_features.op('@>')(json.dumps([serp_filter])))

# Apply pagination AFTER SQL filtering
query = query.limit(limit).offset(offset)
```

For complex text search, consider:
- PostgreSQL full-text search (`to_tsvector`, `to_tsquery`)
- pg_trgm extension for trigram similarity
- Elasticsearch for advanced search requirements

#### Contingencies

- SQL-based filtering may have different edge case behavior
- Full-text search requires index creation and maintenance
- Complex boolean logic may still need Python post-processing

#### Test Requirements

- Performance test with 10k, 50k, 100k keywords
- Test filter results match between SQL and Python implementations
- Test memory usage under load

---

### BUG-010: CSV Input Validation Missing

| Field | Value |
|-------|-------|
| **ID** | BUG-010 |
| **Severity** | P1 - High |
| **Category** | API Contract |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | N/A (New) |

#### Description

CSV upload accepts files without validating column structure. Malformed CSVs cause silent failures or unexpected behavior during processing.

#### Location

`backend/app/routes/keyword_routes.py:42-202` (upload endpoint)
`backend/app/services/keyword_processing.py` (processing logic)

#### Root Cause

No schema validation step before processing begins.

#### User Impact

- **Silent failures**: Bad CSVs may partially process or fail with cryptic errors
- **Confusion**: Users don't know why their upload "worked" but keywords are missing
- **Support burden**: Investigation needed for each malformed upload

#### Suggested Fix

```python
REQUIRED_COLUMNS = {"keyword", "volume", "difficulty"}
OPTIONAL_COLUMNS = {"serp_features", "cpc", "intent"}

async def validate_csv_structure(file_content: bytes) -> tuple[bool, str | None]:
    """Validate CSV has required columns before processing."""
    try:
        # Read just the header
        df = pd.read_csv(io.BytesIO(file_content), nrows=0)
        columns = set(col.lower().strip() for col in df.columns)

        missing = REQUIRED_COLUMNS - columns
        if missing:
            return False, f"Missing required columns: {', '.join(missing)}"

        return True, None
    except Exception as e:
        return False, f"Invalid CSV format: {str(e)}"

# In upload endpoint
@router.post("/{project_id}/upload")
async def upload_csv(...):
    is_valid, error = await validate_csv_structure(file.file.read())
    if not is_valid:
        raise HTTPException(400, detail=error)
    # Continue with processing...
```

#### Contingencies

- Column name variations (Keyword vs keyword vs KEYWORD)
- Different delimiters (comma, semicolon, tab)
- Encoding issues (UTF-8, Latin-1, etc.)
- Empty files or files with only headers

#### Test Requirements

- Test rejection of CSV missing required columns
- Test acceptance of CSV with extra columns
- Test case-insensitive column matching
- Test various encoding formats

---

## Medium Priority Bugs (P2)

### BUG-011: NLTK Downloads Block Module Import

| Field | Value |
|-------|-------|
| **ID** | BUG-011 |
| **Severity** | P2 - Medium |
| **Category** | Performance |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #32 |

#### Description

NLTK resources are downloaded at module import time, blocking server startup and worker spawning.

#### Location

`backend/app/routes/keyword_processing.py:1-20`

```python
import nltk
nltk.download('punkt')  # Blocks on network I/O
nltk.download('stopwords')
nltk.download('wordnet')
```

#### Suggested Fix

```python
# Option A: Move to startup script (recommended)
# backend/app/scripts/setup_nltk.py
def ensure_nltk_resources():
    """Download NLTK resources if not present. Run during build/deploy."""
    import nltk
    resources = ['punkt', 'stopwords', 'wordnet']
    for resource in resources:
        try:
            nltk.data.find(f'tokenizers/{resource}')
        except LookupError:
            nltk.download(resource, quiet=True)

# Option B: Lazy loading
_nltk_initialized = False

def ensure_nltk():
    global _nltk_initialized
    if not _nltk_initialized:
        import nltk
        nltk.download('punkt', quiet=True)
        # ...
        _nltk_initialized = True
```

#### Contingencies

- Docker builds should pre-download NLTK data
- First request may still be slow if lazy loading used
- Network failures during download need handling

---

### BUG-012: Chunk Upload Throttling

| Field | Value |
|-------|-------|
| **ID** | BUG-012 |
| **Severity** | P2 - Medium |
| **Category** | Performance |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #33 |

#### Description

Per-chunk `asyncio.sleep(0.0005)` adds latency to large uploads without clear benefit.

#### Location

`backend/app/routes/keyword_routes.py:86-120`

```python
for chunk in chunks:
    await save_chunk(chunk)
    await asyncio.sleep(0.0005)  # 0.5ms per chunk
```

#### Suggested Fix

```python
# Make configurable or remove
CHUNK_THROTTLE_MS = float(os.getenv("CHUNK_THROTTLE_MS", "0"))

for chunk in chunks:
    await save_chunk(chunk)
    if CHUNK_THROTTLE_MS > 0:
        await asyncio.sleep(CHUNK_THROTTLE_MS / 1000)
```

---

### BUG-013: Repeated Temp Index Creation

| Field | Value |
|-------|-------|
| **ID** | BUG-013 |
| **Severity** | P2 - Medium |
| **Category** | Performance |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | #34 |

#### Description

Each CSV ingestion creates a temporary index, potentially creating duplicates or wasting resources.

#### Location

`backend/app/routes/keyword_processing.py:170-183`

#### Suggested Fix

```python
# Create index only if it doesn't exist
async def ensure_temp_index(db: AsyncSession, project_id: int):
    index_name = f"ix_temp_keyword_text_{project_id}"
    exists = await db.execute(
        text("""
            SELECT 1 FROM pg_indexes
            WHERE indexname = :name
        """),
        {"name": index_name}
    )
    if not exists.scalar():
        await db.execute(
            text(f"""
                CREATE INDEX CONCURRENTLY IF NOT EXISTS {index_name}
                ON keywords (keyword_text) WHERE project_id = :project_id
            """),
            {"project_id": project_id}
        )
```

---

### BUG-014: Generic 500 Errors Without Context

| Field | Value |
|-------|-------|
| **ID** | BUG-014 |
| **Severity** | P2 - Medium |
| **Category** | API Contract |
| **Status** | Unfixed |
| **Discovered** | 2026-01-20 (Codebase Audit) |
| **Backlog Ref** | N/A (New) |

#### Description

Unexpected exceptions return generic 500 errors without actionable context for debugging.

#### Suggested Fix

```python
# Add global exception handler with request ID
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    logger.error(
        f"Unhandled exception",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "error": str(exc),
            "traceback": traceback.format_exc()
        }
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "request_id": request_id  # For support reference
        }
    )
```

---

## Bug Index by Category

### Security
| ID | Description | Severity |
|----|-------------|----------|
| [BUG-001](#bug-001-hardcoded-authentication-credentials) | Hardcoded authentication credentials | P0 |

### Data Integrity
| ID | Description | Severity |
|----|-------------|----------|
| [BUG-002](#bug-002-background-task-uses-request-scoped-db-session) | Background task DB session | P0 |
| [BUG-004](#bug-004-is_parent-forced-true-for-filtered-keywords) | is_parent forced true | P1 |
| [BUG-005](#bug-005-non-english-keywords-bypass-blocked-status) | Non-English bypass | P1 |
| [BUG-006](#bug-006-regrouping-zeros-out-parent-volumedifficulty) | Regrouping zeros metrics | P1 |
| [BUG-007](#bug-007-manual-grouping-ignores-existing-children-in-difficulty) | Grouping ignores children | P1 |

### Runtime/Infrastructure
| ID | Description | Severity |
|----|-------------|----------|
| [BUG-003](#bug-003-database-engine-mismatch-mysql-config-postgresql-code) | DB engine mismatch | P0 |
| [BUG-009](#bug-009-in-memory-filtering-for-large-datasets) | In-memory filtering | P1 |

### API Contract
| ID | Description | Severity |
|----|-------------|----------|
| [BUG-008](#bug-008-keywords-for-cache-returns-empty-data) | Cache endpoint empty | P1 |
| [BUG-010](#bug-010-csv-input-validation-missing) | CSV validation missing | P1 |
| [BUG-014](#bug-014-generic-500-errors-without-context) | Generic 500 errors | P2 |

### Performance
| ID | Description | Severity |
|----|-------------|----------|
| [BUG-011](#bug-011-nltk-downloads-block-module-import) | NLTK blocking import | P2 |
| [BUG-012](#bug-012-chunk-upload-throttling) | Chunk throttling | P2 |
| [BUG-013](#bug-013-repeated-temp-index-creation) | Repeated temp index | P2 |

---

## Fix Dependency Graph

Some bugs should be fixed in a specific order due to dependencies:

```
BUG-003 (DB Mismatch)
    │
    └──► Must fix first - other fixes assume PostgreSQL

BUG-001 (Auth)
    │
    └──► Independent - can fix anytime, high priority

BUG-002 (Background Tasks)
    │
    └──► Independent - can fix anytime, high priority

BUG-004 (is_parent)
    │
    └──► BUG-006, BUG-007 may be affected by same code paths
         Fix together if touching grouping logic

BUG-005 (Non-English)
    │
    └──► Consider with BUG-010 (validation) for unified import flow

BUG-009 (In-memory filtering)
    │
    └──► Requires BUG-003 (PostgreSQL) for full-text search features
```

### Recommended Fix Order

1. **BUG-003** - Database engine validation (unblocks SQL-based fixes)
2. **BUG-001** - Authentication (security critical)
3. **BUG-002** - Background task sessions (data integrity)
4. **BUG-006 + BUG-007** - Grouping metric calculations (related logic)
5. **BUG-004** - is_parent filtering
6. **BUG-005 + BUG-010** - Import validation flow
7. **BUG-008** - Cache endpoint
8. **BUG-009** - Performance optimization
9. **BUG-011-014** - Remaining P2 items

---

## Related Documents

- [BUG_HANDLING_PLAYBOOK.md](BUG_HANDLING_PLAYBOOK.md) - How to handle bugs
- [BACKLOG.md](../BACKLOG.md) - Prioritized work items
- [REPO_REVIEW.md](../REPO_REVIEW.md) - Architecture and known risks
- [AGENTS.md](../AGENTS.md) - Incident log and best practices

---

_Last updated: 2026-01-20_
