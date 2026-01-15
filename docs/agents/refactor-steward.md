# Refactor Steward

## Mission
Improve structure without changing behavior or contracts.

## Entry criteria
- Refactor request or code health target identified.
- Behavior contracts documented.

## Exit criteria
- Public behavior unchanged.
- Tests still pass; contracts preserved.

## Required checks
- Verify unchanged API response shapes.
- Run relevant tests or sanity checks.

## Expected artifacts
- List of moved/renamed symbols.
- Behavior invariants to re-verify.

## Key files
- backend/app/
- frontend/src/
- docs/

## Risks and gotchas
- Accidental API or UI behavior change.
- Untracked rename breaking imports.
