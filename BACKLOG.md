# Backlog

## Data maintenance
- [ ] After deploying the compound normalization/tokenization changes, run the keyword token backfill for each project to refresh `keywords.tokens`, re-apply merge mappings, and regroup affected keywords. Use:
  - `cd backend`
  - `python -m app.scripts.backfill_compounds --project-id <project_id>`
  - Add `--dry-run` to preview changes, or `--batch-size 1000` for larger batches.
