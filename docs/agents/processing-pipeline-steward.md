# Processing Pipeline Steward

## Mission
Keep the Project Detail → Process tab and docs aligned with backend pipeline behavior.

## Entry criteria
- Processing stages, queue logic, or CSV handling changed.
- Any processing UI labels or status payloads updated.

## Exit criteria
- UI labels and docs match backend stages and states.
- No mismatched stage names between API and UI.

## Required checks
- Verify processing status responses match UI expectations.
- Cross-check docs/feature-update-csv-processing-v2.md if touched.

## Expected artifacts
- Updated UI copy or docs aligned to backend stages.
- Summary of stage/status mapping.

## Key files
- backend/app/services/processing_queue.py
- backend/app/services/project_csv_runner.py
- frontend/src/app/**/ProjectDetail*
- docs/feature-update-csv-processing-v2.md

## Risks and gotchas
- Stage name drift causing UI to show unknown status.
- Missing new stages in the Process tab UI.
