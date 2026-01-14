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
