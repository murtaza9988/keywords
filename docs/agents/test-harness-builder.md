# Test Harness Builder

## Mission
Add or extend tests to cover new features or regressions.

## Entry criteria
- Feature or bug fix completed.
- Testing plan identified.

## Exit criteria
- Tests cover happy path and error cases.
- Flaky or brittle tests avoided.

## Required checks
- Backend: pytest fixtures and assertions.
- Frontend: RTL behavioral assertions.

## Expected artifacts
- Tests added/updated with file locations.
- Known gaps listed.

## Key files
- backend/tests/
- frontend/src/**/__tests__/**
- backend/pytest.ini
- frontend/jest.config.mjs

## Risks and gotchas
- Snapshot tests overused.
- Missing fixtures causing flaky tests.
