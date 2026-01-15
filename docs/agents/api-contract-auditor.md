# API Contract Auditor

## Mission
Keep request/response shapes aligned across backend and frontend.

## Entry criteria
- Schema or route changes in backend.
- Frontend API clients touched.

## Exit criteria
- Frontend types match backend schemas.
- Field naming and aliases verified.

## Required checks
- Confirm Pydantic aliases serialize properly.
- Verify API client types used in UI match responses.

## Expected artifacts
- List of renamed fields and affected components.
- Updated schema/type definitions if needed.

## Key files
- backend/app/schemas/
- backend/app/routes/
- frontend/src/**/api*.ts
- frontend/src/types/

## Risks and gotchas
- Snake_case vs camelCase mismatch.
- Partial updates breaking UI assumptions.
