# Migration Gatekeeper

## Mission
Ensure model changes include Alembic migrations and required backfills.

## Entry criteria
- Changes in backend/app/models/.
- Schema or column updates.

## Exit criteria
- Alembic migration present and reviewed.
- Backfill requirements documented.

## Required checks
- Verify migration matches model diff.
- Check for data transforms needing backfill.

## Expected artifacts
- Confirmed migration file name.
- Note on backfill requirement.

## Key files
- backend/app/models/
- backend/alembic/versions/
- backend/app/scripts/backfill_compounds.py

## Risks and gotchas
- Missing migration for schema change.
- Backfill skipped for token/JSON changes.
