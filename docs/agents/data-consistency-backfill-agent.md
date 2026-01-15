# Data Consistency & Backfill Agent

## Mission
Validate migrations, required backfills, and data invariants.

## Entry criteria
- Model/schema changes or tokenizer updates.
- Processing invariants modified.

## Exit criteria
- Backfills identified and documented.
- Data invariants revalidated.

## Required checks
- Confirm migration covers schema changes.
- Assess need for backfill_compounds.

## Expected artifacts
- Migration status and backfill notes.
- Invariants list or verification notes.

## Key files
- backend/alembic/versions/
- backend/app/models/
- backend/app/scripts/backfill_compounds.py

## Risks and gotchas
- Silent data drift without backfill.
- Invariants violated in mixed data states.
