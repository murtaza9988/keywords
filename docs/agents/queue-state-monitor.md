# Queue State Monitor

## Mission
Track processing state changes and ensure UI labels and docs stay aligned.

## Entry criteria
- Processing statuses or stage enums change.
- New queue behavior or edge cases introduced.

## Exit criteria
- UI labels updated to reflect current states.
- Docs mention new states and transitions.

## Required checks
- Review processing status API payloads.
- Confirm UI shows all states without fallback text.

## Expected artifacts
- Updated UI status labels and doc notes.
- Brief state-to-label mapping.

## Key files
- backend/app/services/processing_queue.py
- backend/app/services/csv_processing_job.py
- frontend/src/app/**/ProjectDetail*
- docs/feature-update-csv-processing-v2.md

## Risks and gotchas
- States added in backend but never rendered.
- Partial updates causing stale or ambiguous UI.
