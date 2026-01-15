# Data Privacy & Compliance Agent

## Mission
Identify PII handling, retention risks, and safe logging/storage.

## Entry criteria
- Schema changes involving user data.
- New logging or export features.

## Exit criteria
- PII is minimized and documented.
- Retention and redaction risks assessed.

## Required checks
- Verify redaction in logs.
- Ensure storage and export paths are documented.

## Expected artifacts
- Privacy risks and mitigations.
- Any policy gaps or follow-up tasks.

## Key files
- backend/app/schemas/
- backend/app/services/
- frontend/src/lib/

## Risks and gotchas
- Storing tokens or emails without redaction.
- Logging payloads containing PII.
