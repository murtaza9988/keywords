# Feature Doc: Project Activity Logs (Real-Time, Project-Level)

## 0) Purpose (First Principles)
We need a reliable, real-time record of **user actions at the project level**. The system must:
- Capture **who** did **what**, **when**, **where** (project), and **details** that explain the action.
- Persist logs **server-side** and **surface them immediately** in the project Logs subtab.
- Provide consistent, queryable data for UI filtering, auditing, and debugging.

**Primary Outcome:** The Logs tab shows accurate, near-real-time actions for a project without 404s, missing entries, or stale UI.

## 1) Problem Statement
Current behavior:
- `/api/logs?projectId=...` returns **404 Not Found** in the UI.
- The Logs tab does not update in real time.
- Some project-level actions are not captured in logs (e.g., project create/rename/delete; notes add/edit/remove).

## 2) Non-Goals
- No third-party audit log vendor integration.
- No user-configurable retention policy in this iteration.
- No advanced analytics/insight dashboards yet (this is a logs table only).

## 3) Requirements (Complete)

### 3.1 Functional Requirements
**Backend**
1. Provide `GET /api/logs` to list activity logs with filtering and pagination.
2. Provide `GET /api/projects/{projectId}/logs` to list logs for a project.
3. Persist logs for all **project-level actions** across backend routes.
4. Each log entry must include:
   - `id` (unique)
   - `projectId`
   - `user` (actor)
   - `action` (normalized string)
   - `details` (JSON; optional)
   - `createdAt` (timestamp)
5. Ensure authentication is enforced on log endpoints.

**Frontend**
1. Logs subtab must render logs with search and filters.
2. Logs must refresh in **near real time**:
   - Option A: Polling (default)
   - Option B: SSE/WebSocket (optional upgrade)
3. UI must handle:
   - Loading state
   - Empty state
   - Error state with actionable text

### 3.2 Non-Functional Requirements
- **Consistency:** Logs should appear within a defined freshness window (e.g., 5–10 seconds with polling).
- **Reliability:** No 404s or endpoint mismatches; frontend and backend must agree on base URLs.
- **Performance:** Logs fetch should be paginated and not block UI interactions.
- **Security:** Logs must respect authentication and should not leak sensitive data.

## 4) API Contract (Backend)

### 4.1 `GET /api/logs`
**Query params:**
- `projectId` (optional)
- `user` (optional)
- `action` (optional)
- `startDate` (optional, ISO 8601)
- `endDate` (optional, ISO 8601)
- `page` (default 1)
- `limit` (default 100)

**Response:**
```json
{
  "logs": [
    {
      "id": 123,
      "projectId": 151,
      "user": "admin",
      "action": "project.rename",
      "details": { "from": "Old", "to": "New" },
      "createdAt": "2025-02-15T12:00:00Z"
    }
  ],
  "pagination": { "total": 250, "page": 1, "limit": 100, "pages": 3 }
}
```

### 4.2 `GET /api/projects/{projectId}/logs`
**Query params:**
- `page`, `limit` (optional)

**Response:**
```json
[
  {
    "id": 123,
    "projectId": 151,
    "user": "admin",
    "action": "project.rename",
    "details": { "from": "Old", "to": "New" },
    "createdAt": "2025-02-15T12:00:00Z"
  }
]
```

### 4.3 Action Taxonomy (Required)
Define a consistent action naming convention.
- `project.create`
- `project.rename`
- `project.delete`
- `note.create`
- `note.update`
- `note.delete`
- `keyword.*`
- `token.*`

**Invariant:** Every project-level action must write exactly one log entry.

## 5) Data Model
**ActivityLog**
- `id`: int (PK)
- `project_id`: int (FK)
- `user`: string
- `action`: string
- `details`: JSON
- `created_at`: datetime

**Retention:** No explicit retention policy in this version.

## 6) Real-Time Strategy
**Default:** Polling every 5–10 seconds while Logs tab is active.
- Must stop polling when tab is inactive to save resources.
- Must dedupe log entries by `id`.

**Optional Upgrade:** Server-sent events (SSE) or WebSockets.
- SSE endpoint with `Last-Event-ID` support for resuming.

## 7) Error Handling & Observability
- If `GET /api/logs` fails:
  - UI shows error state with a **diagnostic message** and a retry button.
- Backend logs should include request context for 404s and auth issues.
- Add UI telemetry event (optional): `logs.fetch.failure`.

## 8) Authentication & Permissions
- Use `Depends(get_current_user)` on all log endpoints.
- The `user` value should come from the authenticated user context.
- No logs should be visible to unauthenticated users.

## 9) UI/UX Requirements (Logs Subtab)
- Filters: user, action, date range, search text.
- Sorting: timestamp (default desc), user, action, project.
- Pagination or infinite scrolling.
- Clear empty state text: “No activity logs for this project yet.”

## 10) Compatibility & Environment

This feature depends on a single non-negotiable invariant:

**Invariant (Routing Ownership):** Every browser request to `/api/*` must be handled by exactly one of:
1) a Next.js Route Handler under `frontend/src/app/api/**`, OR
2) a Next.js rewrite/proxy rule that forwards `/api/*` to the backend.

If neither is true, `GET /api/logs` will return **404 Not Found** from the frontend origin by design.

### 10.1) Backend Origin vs Frontend Origin (First Principles)
- The browser calls **an origin**.
- A path like `/api/logs` is **origin-relative**.
  - If the origin is the frontend, then the frontend must either implement `/api/logs` or proxy it.
  - If the origin is the backend, then the backend must implement `/api/logs`.

### 10.2) Supported Integration Modes (Choose One)

#### Mode A: Same-origin `/api/*` via Next rewrites
**Goal:** UI calls `/api/...` and Next forwards to the backend.

**Status in this repo:** Not used. This repository now relies on a Route Handler proxy instead (Mode B).

#### Mode B: Implement `/api/*` in Next Route Handlers (current implementation)
**Goal:** UI calls `/api/...` and Next serves it directly.

**Required conditions:**
1) Implement a route handler under `frontend/src/app/api/**` that handles `/api/*`.
2) Route handler forwards to the backend and must explicitly forward authentication.

**Repo truth:** This repository includes a catch-all proxy route handler at:
- `frontend/src/app/api/[...path]/route.ts`

This means browser calls to `/api/logs` are handled by Next and then forwarded to the backend.

#### Mode C: Direct-to-backend API calls (cross-origin)
**Goal:** UI calls `https://<backend-origin>/api/...` directly.

**Required conditions:**
1) The API client must build absolute URLs to the backend origin (not origin-relative `/api/...`).
2) Backend CORS must allow the frontend origin and required headers.
3) Authentication tokens must be sent and accepted cross-origin.

### 10.3) Next rewrites source of truth (repo truth)
This repo does not rely on Next rewrites for `/api/*`.

**Repo truth:** `frontend/next.config.ts` intentionally does not define `/api` rewrites because `/api/*` is handled by the Next Route Handler proxy in Mode B.

### 10.4) Frontend API client base URL source of truth (repo truth)
The frontend API client (`frontend/src/lib/apiClient.ts`) uses origin-relative URLs:

- It uses `baseURL = ''` and calls paths like `/api/logs?...`.
- Those requests are handled by the Next Route Handler proxy (`frontend/src/app/api/[...path]/route.ts`).

**Invariant (Single Path):** UI → `/api/*` (frontend origin) → Next Route Handler proxy → backend `/api/*`.

### 10.5) Auth refresh endpoint URL invariant (repo truth)
The backend refresh endpoint is `POST /api/refresh` (mounted under the `/api` prefix).

The frontend token refresh helper (`frontend/src/lib/authService.ts`) calls:
- `POST /api/refresh`

**Invariant (Refresh URL):** Refresh must go through the same proxy path as all other API calls.

### 10.6) Backend endpoint source of truth (repo truth)
The backend serves logs under the API prefix `settings.API_V1_STR` (currently `/api`).

Routes (from `backend/app/routes/activity_logs.py`):
- `GET /api/logs`
- `GET /api/projects/{project_id}/logs`

Routers are mounted in `backend/app/main.py` via:
- `app.include_router(activity_logs.router, prefix=settings.API_V1_STR)`

### 10.7) Query param casing (no silent mismatch)
The backend expects specific camelCase query param names for some filters:
- `projectId` (alias of `project_id`)
- `startDate` (alias of `start_date`)
- `endDate` (alias of `end_date`)

**Invariant:** Frontend must send `projectId`, `startDate`, `endDate` exactly as spelled above; snake_case variants will not be parsed into the intended filters.

### 10.8) Diagnosis procedure (no assumptions)
When the Logs tab fails, determine which layer returned the error.

1) **Check the URL actually requested**
   - If the request is to `https://<frontend-origin>/api/logs`, then Mode A or Mode B must be true.
   - If the request is to `https://<backend-origin>/api/logs`, then the backend route must exist.
2) **Differentiate 404 vs 401**
   - 404 typically indicates routing/proxy mismatch (wrong origin or missing route).
   - 401/403 indicates auth is required but missing/invalid.
3) **Confirm rewrites are active (Mode A only)**
   - If `NEXT_PUBLIC_API_URL` and `API_URL` are unset, rewrites are disabled.
4) **Confirm backend actually serves `/api/logs`**
   - Backend must include the activity logs router and must be running with `settings.API_V1_STR` set as expected.

## 10.9) Cross-Team Coordination & Integration Checklist (Backend + Frontend)
To prevent mismatches, each item below must be explicitly verified in both stacks:
- **Routing ownership:** `/api/*` is either proxied by rewrites (Mode A) or implemented by Next Route Handlers (Mode B).
- **Base URL agreement:** `NEXT_PUBLIC_API_URL` or `API_URL` must route `/api/*` to the backend origin when Mode A is used.
- **Endpoint parity:** `GET /api/logs` and `GET /api/projects/{projectId}/logs` must exist and be accessible in the deployed environment.
- **Schema parity:** response keys must be camelCased (`projectId`, `createdAt`) and aligned with frontend models.
- **Action taxonomy parity:** backend emits consistent action names; frontend filters and labels match the same list.
- **Auth parity:** all log endpoints require auth; frontend includes auth tokens and handles refresh.
- **Real-time parity:** agreed polling/streaming interval is implemented consistently with UI expectations.
- **Pagination parity:** backend pagination matches frontend logic (page/limit/pages/total).
- **Error parity:** backend error messages are actionable; frontend surfaces them clearly with retry.

## 10.10) Known Gaps vs Current Codebase (Must Be Resolved)
These are the specific coordination gaps that will prevent the feature from working as described if left unaddressed:
- **Frontend routing mismatch:** ensure `/api/logs` resolves to the backend in the deployed environment (either env base URL or proxy/rewrites).
- **Missing log emission for project/notes actions:** add `ActivityLogService.log_activity` for project and notes routes so actions appear.
- **No real-time refresh:** add polling or SSE/WebSocket updates for the Logs tab.

## 11) Testing Plan (Minimum)
**Backend**
- Unit test `GET /api/logs` with filters and pagination.
- Test `project.*` and `note.*` actions produce log entries.
- Auth-required tests for log endpoints.

**Frontend**
- Component test: Logs tab renders logs and handles errors.
- Polling behavior test: updates after new log entry.

## 12) Rollout Plan
- Deploy backend log endpoints fix first.
- Deploy frontend log fetch + polling changes.
- Verify in staging with real traffic.

## 13) Decisions (Chosen Defaults)
These defaults are selected to unblock implementation and will be treated as the current source of truth unless changed:
- **Real-time delay:** 5–10 seconds polling while Logs tab is active.
- **Visibility:** project members only (admins can see all projects).
- **Project-level actions:** project lifecycle (create/rename/delete), notes CRUD, keyword grouping/confirming/blocking, token block/unblock/merge, CSV import/upload, processing state transitions.
- **Export:** out of scope for this release; add to backlog.
- **Immutability:** logs are append-only; allow redaction of sensitive `details` via admin-only tooling if required.

## 14) Definition of Done
- No 404s on `/api/logs` or `/api/projects/{id}/logs`.
- Logs appear in the UI within the agreed freshness window.
- All required actions emit log entries.
- Tests and linters pass.

---

## Confirmation Checklist (Nothing Missing)
- [ ] Endpoints and responses specified
- [ ] Action taxonomy defined
- [ ] Real-time strategy defined
- [ ] Error states and UX covered
- [ ] Auth requirements documented
- [ ] Data model documented
- [ ] Testing plan included
- [ ] Open questions listed
- [ ] Definition of Done included
