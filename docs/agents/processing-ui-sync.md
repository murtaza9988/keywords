# Processing UI Sync

## Mission
Ensure processing status labels, stages, and progress UI match backend pipeline changes.

## Entry criteria
- Backend pipeline stages or status payloads changed.
- Process tab UI updated.

## Exit criteria
- UI labels/stages match backend definitions.
- Documentation references updated.

## Required checks
- Compare API status payload to UI rendering logic.
- Validate stage transitions display correctly.

## Expected artifacts
- Updated UI components and docs.
- Mapping of stages to UI labels.

## Key files
- frontend/src/app/**/ProjectDetail*
- backend/app/services/processing*
- docs/

## Risks and gotchas
- UI showing fallback or unknown stage names.
- Stage order mismatch causing confusing progress.
