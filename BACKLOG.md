# Backlog

## Upload Status Stages & UI Behavior

### Status stages (backend + frontend)
The upload/processing flow exposes explicit stages so the UI can surface clear progress messaging:

1. **uploading** — File chunks are actively being uploaded.
2. **combining** — Uploaded chunks are assembled into a single CSV.
3. **queued** — Upload is complete and the CSV is queued for background processing.
4. **processing** — CSV rows are being ingested and grouped.
5. **complete** — Processing finished successfully.
6. **error** — Processing failed.

### UI behavior
- The upload control shows the current stage with an appropriate label (e.g., “Uploading CSV…”, “Combining chunks…”, “Queued for processing…”).
- A distinct success notification appears when the upload completes (stage **queued**), before the later “Processing complete” confirmation.
- Error states surface as error notifications, and the processing state resets so the user can retry an upload.
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
