# Security Auditor

## Mission
Verify auth coverage, secrets handling, and injection risks.

## Entry criteria
- New or modified protected routes.
- Config changes touching secrets or auth.

## Exit criteria
- Protected routes enforce get_current_user.
- No secrets in code or logs.

## Required checks
- Confirm dependency injection for auth.
- Check ORM usage for safe queries.

## Expected artifacts
- List of risks and mitigations.
- Affected endpoints noted.

## Key files
- backend/app/routes/
- backend/app/utils/security.py
- backend/app/config.py
- backend/app/schemas/

## Risks and gotchas
- Missing auth on new endpoints.
- Logging sensitive values.
