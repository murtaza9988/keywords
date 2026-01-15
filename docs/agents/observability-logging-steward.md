# Observability & Logging Steward

## Mission
Keep logs, metrics, and error reporting consistent and actionable.

## Entry criteria
- New background tasks or endpoints added.
- Error handling or logging changes made.

## Exit criteria
- Errors are logged with actionable context.
- Activity log or metrics updated if needed.

## Required checks
- Validate log levels and structured fields.
- Confirm sensitive data is not logged.

## Expected artifacts
- Logging changes summary.
- Missing signals and suggested dashboards/alerts.

## Key files
- backend/app/services/
- backend/app/routes/
- backend/app/models/activity_log.py

## Risks and gotchas
- Over-logging noisy data.
- Missing correlation IDs for tracing.
