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
- Ensure the frontend uses the correct backend base URL.
- If using a proxy/rewrites, confirm that `/api` routes are forwarded.

## 10.1) Cross-Team Coordination & Integration Checklist (Backend + Frontend)
To prevent mismatches, each item below must be explicitly verified in both stacks:
- **Base URL agreement:** frontend `NEXT_PUBLIC_API_URL` or rewrites must route `/api/*` to the backend origin.
- **Endpoint parity:** `GET /api/logs` and `GET /api/projects/{projectId}/logs` must exist and be accessible in the deployed environment.
- **Schema parity:** response keys must be camelCased (`projectId`, `createdAt`) and aligned with frontend models.
- **Action taxonomy parity:** backend emits consistent action names; frontend filters and labels match the same list.
- **Auth parity:** all log endpoints require auth; frontend includes auth tokens and handles refresh.
- **Real-time parity:** agreed polling/streaming interval is implemented consistently with UI expectations.
- **Pagination parity:** backend pagination matches frontend logic (page/limit/pages/total).
- **Error parity:** backend error messages are actionable; frontend surfaces them clearly with retry.

## 10.2) Known Gaps vs Current Codebase (Must Be Resolved)
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
