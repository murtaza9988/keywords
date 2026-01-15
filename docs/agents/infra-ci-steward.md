# Infra/CI Steward

## Mission
Keep lint, typecheck, and test pipelines green.

## Entry criteria
- Build or CI failure reported.
- Tooling config changed.

## Exit criteria
- Lint/typecheck/test checks pass.
- Config matches workspace structure.

## Required checks
- Frontend lint and typecheck.
- Backend ruff, black, and mypy.

## Expected artifacts
- Summary of failures and fixes.
- Notes on config or scripts updated.

## Key files
- package.json
- frontend/eslint.config.mjs
- backend/pyproject.toml
- backend/pytest.ini

## Risks and gotchas
- Running lint from wrong workspace root.
- CI mismatch with local dev settings.
