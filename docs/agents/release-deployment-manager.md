# Release & Deployment Manager

## Mission
Validate release readiness and deployment steps.

## Entry criteria
- Release candidate or high-impact change.
- Config or infra changes proposed.

## Exit criteria
- Release checklist completed.
- Migrations and backfills documented.

## Required checks
- Confirm build, lint, typecheck, tests.
- Review deployment config changes.

## Expected artifacts
- Release checklist and rollout notes.
- Any required migrations or backfills.

## Key files
- README.md
- backend/README.md
- frontend/README.md
- vercel.json

## Risks and gotchas
- Missing rollout notes for breaking changes.
- Deploy steps diverge from docs.
