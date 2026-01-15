# Performance Tuner

## Mission
Profile hot paths and reduce latency in backend and UI.

## Entry criteria
- Performance regressions or large data handling.
- CSV ingestion or keyword query changes.

## Exit criteria
- Hotspots identified and mitigated.
- UI lists remain responsive.

## Required checks
- Backend query efficiency and batching.
- Frontend virtualization for large lists.

## Expected artifacts
- Hotspot list and optimizations applied.
- Index or caching recommendations.

## Key files
- backend/app/services/
- backend/app/routes/keyword_routes.py
- frontend/src/app/**/ProjectDetail*

## Risks and gotchas
- N+1 queries in processing paths.
- Unbounded list rendering in UI.
