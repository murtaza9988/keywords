# Features Left (Master List)

This is a review-friendly dump of everything we believe is still "left" to build/fix.

- Canonical backlog (scored + prioritized): ../BACKLOG.md
- In-app backlog view: `/backlog`

## List

The items below match the canonical backlog table IDs.

1. Upload stages in UI (uploading/combining/queued/processing/complete/error)
2. Upload notification staging (queued → processing → completed/failed)
3. CSV Processing v2: DB-backed durable job queue (csv_processing_jobs)
4. CSV Processing v2: DB-backed per-project lease (project_processing_leases)
5. CSV Processing v2: idempotent imports (exactly-once effect)
6. CSV Processing v2: deterministic grouping after all jobs finish
7. CSV Processing v2: lock grouping mutations during active processing (Policy A)
8. CSV Processing v2: explicit state transitions + recovery for stuck running jobs
9. Per-file progress + errors + retry failed files
10. Processing center (queue + history + logs per project)
11. Compound normalization rules (deterministic, test-backed)
12. Numeric normalization for volume & difficulty (types + UI)
13. Document numeric tokenization behavior
14. Token backfill guidance after tokenizer/compound changes
15. Backfill + migration playbook (dry-run + reports + rollback)
16. Backend: GET /api/logs with filters + pagination
17. Backend: GET /api/projects/{projectId}/logs endpoint
18. Emit logs for all project-level actions
19. Frontend: Logs tab renders + filters + polling refresh
20. Real-time logs via SSE/WebSocket (optional)
21. Replace hardcoded auth with real user accounts
22. RBAC / roles (admin vs member)
23. Fix background tasks to not use request-scoped DB sessions
24. Fail fast / enforce Postgres where JSONB is required
25. Fix /keywords-for-cache endpoint to return actual keyword data
26. Fix is_parent being forced true in filtered results
27. Fix grouping difficulty aggregation
28. Fix regrouping zeroing volume/difficulty
29. Preserve blocked status for non-English keywords during import
30. Move in-memory keyword filtering into SQL
31. Full-text search / trigram indexing for keywords/tokens
32. Avoid NLTK downloads at module import time
33. Make chunk upload throttling configurable
34. Avoid repeated temp index creation per ingestion
35. Virtualize large keyword lists + interaction polish
36. Saved filters/views per project
37. Export improvements (current view vs all + metadata)
38. Undo/redo for grouping/regrouping + audit trail
39. Auto-group suggestions with confidence + “why” explanation
