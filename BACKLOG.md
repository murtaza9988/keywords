# Backlog (Canonical)

This is the single source of truth for planned work.

- In-app backlog view: `/backlog`
- Backlog data: `frontend/src/app/backlog/backlogData.ts`

## Scoring

- **Impact (1–10):** user value + risk reduction
- **Complexity (1–10):** engineering effort + risk + cross-cutting surface area
- **Priority:** P0 (next), P1 (soon), P2 (later)

## Summary

- **Total items:** 39
- **Priority counts:** P0 = 8, P1 = 15, P2 = 16

## Backlog overview

| ID | Category | Priority | Area | Type | Feature | Status | Impact | Complexity |
|---:|:--|:--:|:--|:--|:--|:--|:--:|:--:|
| 1 | CSV Processing | P0 | Full stack | UX | Upload stages in UI (uploading/combining/queued/processing/complete/error) | Planned | 9 | 5 |
| 2 | CSV Processing | P1 | Full stack | UX | Upload notification staging (queued → processing → completed/failed) | Planned | 7 | 4 |
| 3 | CSV Processing | P0 | Backend | Reliability | CSV Processing v2: DB-backed durable job queue (csv_processing_jobs) | Proposed | 10 | 8 |
| 4 | CSV Processing | P0 | Backend | Reliability | CSV Processing v2: DB-backed per-project lease (project_processing_leases) | Proposed | 9 | 7 |
| 5 | CSV Processing | P0 | Backend | Reliability | CSV Processing v2: idempotent imports (exactly-once effect) | Proposed | 10 | 9 |
| 6 | CSV Processing | P0 | Backend | Reliability | CSV Processing v2: deterministic grouping after all jobs finish | Proposed | 9 | 7 |
| 7 | CSV Processing | P0 | Full stack | Reliability | CSV Processing v2: lock grouping mutations during active processing (Policy A) | Proposed | 8 | 6 |
| 8 | CSV Processing | P1 | Backend | Reliability | CSV Processing v2: explicit state transitions + recovery for stuck running jobs | Proposed | 8 | 6 |
| 9 | CSV Processing | P0 | Full stack | UX | Per-file progress + errors + retry failed files | Planned | 9 | 6 |
| 10 | CSV Processing | P2 | Full stack | UX | Processing center (queue + history + logs per project) | Proposed | 6 | 6 |
| 11 | Normalization | P1 | Backend | Data quality | Compound normalization rules (deterministic, test-backed) | Planned | 8 | 7 |
| 12 | Normalization | P1 | Full stack | Data quality | Numeric normalization for volume & difficulty (types + UI) | In discovery | 7 | 7 |
| 13 | Normalization | P2 | Infra/Docs | Ops | Document numeric tokenization behavior | Proposed | 4 | 2 |
| 14 | Normalization | P1 | Backend | Ops | Token backfill guidance after tokenizer/compound changes | Proposed | 6 | 3 |
| 15 | Normalization | P1 | Backend | Ops | Backfill + migration playbook (dry-run + reports + rollback) | Proposed | 6 | 4 |
| 16 | Activity Logs | P1 | Backend | Product | Backend: GET /api/logs with filters + pagination | Proposed | 7 | 5 |
| 17 | Activity Logs | P1 | Backend | Product | Backend: GET /api/projects/{projectId}/logs endpoint | Proposed | 6 | 4 |
| 18 | Activity Logs | P1 | Backend | Product | Emit logs for all project-level actions | Proposed | 7 | 6 |
| 19 | Activity Logs | P1 | Frontend | UX | Frontend: Logs tab renders + filters + polling refresh | Proposed | 6 | 5 |
| 20 | Activity Logs | P2 | Full stack | Product | Real-time logs via SSE/WebSocket (optional) | Proposed | 5 | 7 |
| 21 | Security/Auth | P0 | Backend | Security | Replace hardcoded auth with real user accounts | Proposed | 10 | 8 |
| 22 | Security/Auth | P2 | Full stack | Security | RBAC / roles (admin vs member) | Proposed | 6 | 6 |
| 23 | Reliability | P0 | Backend | Reliability | Fix background tasks to not use request-scoped DB sessions | Proposed | 8 | 5 |
| 24 | Reliability | P0 | Infra/Docs | Reliability | Fail fast / enforce Postgres where JSONB is required | Proposed | 8 | 4 |
| 25 | Reliability | P1 | Backend | Reliability | Fix /keywords-for-cache endpoint to return actual keyword data | Proposed | 6 | 3 |
| 26 | Reliability | P1 | Backend | Reliability | Fix is_parent being forced true in filtered results | Proposed | 6 | 4 |
| 27 | Reliability | P1 | Backend | Reliability | Fix grouping difficulty aggregation | Proposed | 6 | 6 |
| 28 | Reliability | P1 | Backend | Reliability | Fix regrouping zeroing volume/difficulty | Proposed | 6 | 6 |
| 29 | Reliability | P1 | Backend | Reliability | Preserve blocked status for non-English keywords during import | Proposed | 5 | 5 |
| 30 | Performance | P1 | Backend | Performance | Move in-memory keyword filtering into SQL | Proposed | 8 | 6 |
| 31 | Performance | P2 | Backend | Performance | Full-text search / trigram indexing for keywords/tokens | Proposed | 7 | 7 |
| 32 | Performance | P2 | Backend | Performance | Avoid NLTK downloads at module import time | Proposed | 5 | 3 |
| 33 | Performance | P2 | Backend | Performance | Make chunk upload throttling configurable | Proposed | 4 | 2 |
| 34 | Performance | P2 | Backend | Performance | Avoid repeated temp index creation per ingestion | Proposed | 5 | 3 |
| 35 | Performance | P2 | Frontend | UX | Virtualize large keyword lists + interaction polish | Proposed | 6 | 3 |
| 36 | UX/Workflow | P1 | Frontend | UX | Saved filters/views per project | Proposed | 7 | 4 |
| 37 | UX/Workflow | P1 | Full stack | UX | Export improvements (current view vs all + metadata) | Proposed | 7 | 5 |
| 38 | UX/Workflow | P2 | Full stack | UX | Undo/redo for grouping/regrouping + audit trail | Proposed | 8 | 8 |
| 39 | UX/Workflow | P2 | Full stack | Product | Auto-group suggestions with confidence + “why” | Proposed | 7 | 8 |

## Reference (canonical upload stages)

1. **uploading** — file chunks are actively being uploaded
2. **combining** — uploaded chunks are assembled into a single CSV
3. **queued** — upload is complete and the CSV is queued for background processing
4. **processing** — CSV rows are being ingested and grouped
5. **complete** — processing finished successfully
6. **error** — processing failed
