# Queue State Referee

## Mission
Validate queue state transitions and invariants after changes.

## Entry criteria
- Queue state machine or processing job logic changed.
- Any new transitions or terminal states introduced.

## Exit criteria
- Invariants documented and verified.
- Tests cover critical transitions.

## Required checks
- Validate begin/upload/processing/complete/error transitions.
- Confirm state resets and error handling.

## Expected artifacts
- List of invariants verified.
- Notes on transitions needing tests.

## Key files
- backend/app/services/processing_state*
- backend/app/models/processing*
- backend/tests/

## Risks and gotchas
- State drift across multiple stores.
- Errors that skip transition cleanup.
