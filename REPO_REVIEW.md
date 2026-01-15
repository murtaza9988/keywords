# Repository Review: Architecture, Process, and User Flow
_Last updated: 2025-01-13_

## 1) High-Level Architecture
- **Backend:** FastAPI app exposing REST endpoints for authentication, projects, keyword ingestion/processing, grouping, token management, and notes. The main entrypoint wires routers and CORS, and initializes the database at startup.【F:backend/app/main.py†L1-L33】
- **Frontend:** Next.js (App Router) client that renders the login screen, project list, and per-project detail experience. It relies on an API client wrapper for backend interactions and stores state in Redux slices for project data and keyword caches.【F:frontend/src/app/page.tsx†L1-L200】【F:frontend/src/app/projects/page.tsx†L1-L200】【F:frontend/src/store/projectSlice.ts†L1-L200】

## 2) Backend: Core Components and Flow

### 2.1 Configuration & Startup
- Environment-driven configuration lives in `app/config.py` and includes API path prefix, DB URL, JWT secrets, and file upload settings.【F:backend/app/config.py†L1-L29】
- `app/main.py` registers routers and initializes DB tables at startup.【F:backend/app/main.py†L1-L33】

### 2.2 Data Model (SQLAlchemy)
- **Project:** top-level container for keywords and related resources.【F:backend/app/models/project.py†L1-L21】
- **Keyword:** stores keyword text, tokens, grouping metadata, and status (ungrouped/grouped/confirmed/blocked).【F:backend/app/models/keyword.py†L1-L60】
- **CSVUpload:** tracks CSV uploads by project for audit/history views.【F:backend/app/models/csv_upload.py†L1-L17】
- **Notes:** two per-project note fields used in the UI’s note editor area.【F:backend/app/models/notes.py†L1-L20】
- **Merge operations:** captures token merge history and per-keyword snapshots for merge behavior.【F:backend/app/models/merge_operation.py†L1-L45】

### 2.3 Authentication
- `/api/token` and `/api/login` issue JWT access tokens; `/api/refresh` issues new access/refresh tokens via refresh token validation.【F:backend/app/routes/auth.py†L1-L92】
- Authorization is applied to all project/keyword endpoints via `get_current_user` dependency in `app/utils/security.py` (JWT validation).【F:backend/app/utils/security.py†L1-L69】

### 2.4 Projects and Stats
- `/api/projects` handles create/read/update/delete with `ProjectService` and uses background tasks for delete operations.【F:backend/app/routes/projects.py†L1-L120】
- `/api/projects/with-stats` uses a single aggregate SQL query for project-level keyword counts (ungrouped/grouped/confirmed/blocked) to drive UI stats in the project list view.【F:backend/app/routes/projects.py†L27-L101】

### 2.5 CSV Upload & Keyword Processing
- `POST /api/projects/{project_id}/upload` supports **chunked** and **non-chunked** CSV uploads; it assembles chunks and stores file metadata in `CSVUpload`, then starts a background task for processing.【F:backend/app/routes/keyword_routes.py†L42-L202】
- `/api/projects/{project_id}/processing-status` exposes server-side progress tracking for CSV ingestion jobs so the UI can poll and show progress.【F:backend/app/routes/keyword_routes.py†L26-L80】
- The processing pipeline performs NLP tokenization, stop-word removal, and lemmatization using NLTK, and then writes keyword records to the database with deduping and grouping logic.【F:backend/app/routes/keyword_processing.py†L1-L210】

### 2.6 Keyword Retrieval and Filtering
- `/api/projects/{project_id}/keywords` implements server-side pagination, filtering, and sorting. It selectively fetches parents/children and applies additional in-memory filtering when include/exclude/serp filters are used.【F:backend/app/routes/keyword_routes.py†L208-L472】
- `/api/projects/{project_id}/initial-data` prefetches counts and initial keyword data for first render to power the project detail dashboard and statistics widgets.【F:backend/app/routes/keyword_routes.py†L520-L604】
- `/api/projects/{project_id}/groups/{group_id}/children` fetches child keywords for a group when the user expands a grouped keyword in the UI.【F:backend/app/routes/keyword_routes.py†L666-L684】

### 2.7 Grouping, Regrouping, and Blocking
- **Grouping:** `/api/projects/{project_id}/group` stores original state, assigns a group, and sets a group representative as the parent keyword for a group.【F:backend/app/routes/keyword_routes.py†L692-L862】
- **Regrouping:** `/api/projects/{project_id}/regroup` allows moving keywords between groups and updates parent stats/volume/difficulty accordingly.【F:backend/app/routes/keyword_routes.py†L864-L1012】
- **Block by token:** `/api/projects/{project_id}/block-token` marks keywords as blocked if they contain a token, and updates blocked metadata if supported by the schema.【F:backend/app/routes/keyword_routes.py†L1014-L1075】
- **Unblock:** `/api/projects/{project_id}/unblock` moves keywords back to ungrouped status from blocked.【F:backend/app/routes/keyword_routes.py†L1077-L1137】
- **Ungroup:** `/api/projects/{project_id}/ungroup` restores keywords (and children) to original state based on stored snapshots in `original_state` field.【F:backend/app/routes/keyword_routes.py†L1139-L1360】

### 2.8 Token Management
- `/api/projects/{project_id}/tokens` aggregates tokens for token management UI, with caching to reduce repeated expensive queries. The UI supports “current”, “all”, “blocked”, and “merged” token views and server-side pagination for block/merged views.【F:backend/app/routes/keyword_tokens.py†L1-L260】

### 2.9 Notes
- `/api/projects/{project_id}/notes` supports fetching and updating two notes fields. If notes don’t exist, the API returns a blank note object so the UI always has editable content.【F:backend/app/routes/notes.py†L1-L62】

### 2.10 Maintenance: Token Backfill
- `app/scripts/backfill_compounds.py` reprocesses keyword text with the compound normalization pipeline, updates `keywords.tokens`, reapplies merge mappings, and then regroups affected keywords. Run it per project after tokenization changes to keep grouping consistent.【F:backend/app/scripts/backfill_compounds.py†L1-L140】

## 3) Frontend: Core Components and Flow

### 3.1 Login Flow
- The root page (`/`) renders the login UI. It posts credentials to the API, stores tokens, fetches initial project data, and then redirects to `/projects` on success.【F:frontend/src/app/page.tsx†L1-L200】

### 3.2 Projects List (Home After Login)
- `/projects` fetches all projects with stats (`fetchProjectsWithStats`) and stores the results locally + in Redux. It supports create/update/delete of projects, with modals and inline edit flows.【F:frontend/src/app/projects/page.tsx†L1-L200】

### 3.3 Project Detail Dashboard
- `/projects/[id]` mounts `ProjectDetail`, which acts as the central dashboard for keyword workflows (upload, filter, group, block, export).【F:frontend/src/app/projects/[id]/page.tsx†L1-L12】【F:frontend/src/app/projects/[id]/components/ProjectDetail.tsx†L1-L220】
- `ProjectDetail` drives table pagination, filters, keyword selection, grouping actions, and tracks progress from CSV processing (polling status). It also caches API calls locally for faster navigation in the detail view.【F:frontend/src/app/projects/[id]/components/ProjectDetail.tsx†L62-L220】

### 3.4 Token Management
- The token management panel is embedded within the project detail view. It allows searching, blocking/unblocking, and merging tokens, with client-side fallbacks for “current view” token lists.【F:frontend/src/app/projects/[id]/components/token/TokenManagement.tsx†L1-L220】

### 3.5 Notes and Rich Text Inputs
- Notes are stored as HTML strings and persisted to the backend via debounced saves. The UI uses contenteditable divs with a lightweight toolbar for formatting.【F:frontend/src/app/projects/[id]/components/TextAreaInputs.tsx†L1-L220】

### 3.6 Client State and Caching
- The Redux slice tracks project data, keyword lists per view (ungrouped/grouped/blocked/confirmed), child keyword caches, and metadata counts to avoid refetching on navigation and to speed up filtering/pagination workflows.【F:frontend/src/store/projectSlice.ts†L1-L200】

## 4) End-to-End User Flow (Step-by-Step)

1. **Login:** User enters credentials, frontend calls `/api/login` to obtain tokens, then fetches project list and redirects to `/projects`.【F:frontend/src/app/page.tsx†L1-L200】【F:backend/app/routes/auth.py†L1-L92】
2. **Projects list:** User sees project list with stats and can create/edit/delete projects. Stats are loaded via `/api/projects/with-stats`.【F:frontend/src/app/projects/page.tsx†L1-L200】【F:backend/app/routes/projects.py†L27-L101】
3. **Open project:** Selecting a project routes to `/projects/[id]`, where the detail dashboard loads counts, keywords, and processing status in a single initial fetch path, and supports additional sorting/filtering. 【F:frontend/src/app/projects/[id]/components/ProjectDetail.tsx†L1-L220】【F:backend/app/routes/keyword_routes.py†L520-L604】
4. **Upload CSV:** User uploads a CSV; the backend stores the file and starts background processing while the UI polls status and updates progress. 【F:backend/app/routes/keyword_routes.py†L42-L202】
5. **Review keywords:** User filters, sorts, and paginates keywords. The backend handles parent/child views and server-side filtering to keep the UI responsive. 【F:backend/app/routes/keyword_routes.py†L208-L472】
6. **Group/regroup:** User selects keywords to group or regroup, which updates parent/child relationships and volume/difficulty summaries server-side. 【F:backend/app/routes/keyword_routes.py†L692-L1012】
7. **Block/unblock tokens:** Users can block tokens (bulk status change) and unblock selected keywords. 【F:backend/app/routes/keyword_routes.py†L1014-L1137】
8. **Token management:** Users open token views to search or merge tokens; the backend supplies counts/volume/difficulty stats for each token and uses caching to avoid expensive recalculations. 【F:frontend/src/app/projects/[id]/components/token/TokenManagement.tsx†L1-L220】【F:backend/app/routes/keyword_tokens.py†L1-L260】
9. **Notes:** Users maintain per-project notes in the right rail, with debounced save to `/api/projects/{project_id}/notes`.【F:frontend/src/app/projects/[id]/components/TextAreaInputs.tsx†L1-L220】【F:backend/app/routes/notes.py†L1-L62】

## 5) Bugs / Risks / Performance Improvement Opportunities

> The following items are based on code inspection; no fixes were applied. Each item links to the source of concern.

### 5.1 Potential Bugs & Risks
1. **Hardcoded authentication credentials**: `authenticate_user` accepts only a single hardcoded username/password pair. This is a security risk and does not integrate with user storage or hashing. 【F:backend/app/utils/security.py†L70-L74】
2. **Database engine mismatch (MySQL vs Postgres)**: configuration defaults to MySQL, but the ORM uses `JSONB`, GIN indexes, and query syntax such as `?` (JSONB containment) and `FILTER` or `ANY` clauses that are Postgres-specific. This will break on MySQL without translation/migrations. 【F:backend/app/config.py†L8-L16】【F:backend/app/models/keyword.py†L1-L50】【F:backend/app/services/keyword.py†L96-L170】【F:backend/app/routes/projects.py†L27-L75】
3. **`keywords-for-cache` response omits actual keyword data**: the handler builds keyword responses but returns only timestamp/status, which makes the endpoint ineffective for its intended use. 【F:backend/app/routes/keyword_routes.py†L618-L652】
4. **`is_parent` is forced to `True` for all filtered keywords**: `get_keywords` sets `kw["is_parent"] = True` for every filtered row after additional filtering, even when the list contains children (grouped/confirmed search use cases), which can lead to incorrect UI state. 【F:backend/app/routes/keyword_routes.py†L438-L488】
5. **Background task uses request-scoped DB session**: project deletion is scheduled with `background_tasks.add_task(ProjectService.delete, db, project_id)`, but the `db` session is closed after the request. This can fail silently or cause DB errors in background operations. 【F:backend/app/routes/projects.py†L102-L120】
6. **Auto-processing overrides blocked status for non-English keywords**: `build_keyword_payload` marks non-English keywords as `blocked`, but the CSV import path forces every new keyword to `ungrouped`/parent status when no existing group is found, which removes the block flag and lets non-English keywords flow into grouping. 【F:backend/app/services/keyword_processing.py†L336-L355】【F:backend/app/routes/keyword_processing.py†L468-L485】
7. **Manual grouping recalculates difficulty using only the existing parent**: when adding keywords to an existing group, the average difficulty is computed from the existing parent difficulty plus new keywords, ignoring existing children (and treating the aggregated parent difficulty as a single sample). This skews group difficulty summaries after multiple additions. 【F:backend/app/routes/keyword_routes.py†L1531-L1659】
8. **Regrouping can zero-out parent volume/difficulty**: regrouping totals volume and averages difficulty using only child keywords; if users regroup only parents (or groups without children), the computed totals are 0.0 and written back to the new parent, wiping metrics. 【F:backend/app/routes/keyword_routes.py†L1724-L1809】

### 5.2 Performance Improvement Opportunities
1. **NLTK downloads during import**: `nltk.download(...)` runs at module import time, which can block startup or worker spawn. Consider pre-packaging datasets or moving downloads into a setup script. 【F:backend/app/routes/keyword_processing.py†L1-L20】
2. **In-memory filtering for keyword search**: `get_keywords` fetches all data when include/exclude/serp filters are active (`limit=0` or server-side filtering disabled) and filters in Python. Consider pushing search conditions into SQL or adding full-text indices for scale. 【F:backend/app/routes/keyword_routes.py†L242-L372】
3. **Chunk upload throttling**: per-chunk `asyncio.sleep(0.0005)` can slow large uploads. Consider removing or making this configurable if not required for backpressure. 【F:backend/app/routes/keyword_routes.py†L86-L120】
4. **Repeated temporary index creation per ingestion**: ingestion creates a temp index for each project upload; you may want to pre-create this index or guard against repeated re-creation if it’s intended to be permanent. 【F:backend/app/routes/keyword_processing.py†L170-L183】

---

If you want, I can take any of the above issues and implement fixes with targeted PRs.
