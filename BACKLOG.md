# Backlog

## Data maintenance
- [ ] After deploying the compound normalization/tokenization changes, run the keyword token backfill for each project to refresh `keywords.tokens`, re-apply merge mappings, and regroup affected keywords. Use:
  - `cd backend`
  - `python -m app.scripts.backfill_compounds --project-id <project_id>`
  - Add `--dry-run` to preview changes, or `--batch-size 1000` for larger batches.
## Documentation Updates

### Numeric merging behavior
- Currency symbols are removed before tokenization, so `"$1,200"` becomes `"1200"`.
- Commas and spaces inside digit groups are stripped, so `"1 200"` and `"1,200"` both become `"1200"`.
- Suffixes expand into full numeric values:
  - `"150k"` → `"150000"`
  - `"1.5k"` → `"1500"`
  - `"2m"` → `"2000000"`
  - `"3b"` → `"3000000000"`
