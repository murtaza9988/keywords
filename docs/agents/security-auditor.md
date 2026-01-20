# Security Auditor

> **Mission:** Verify auth coverage, secrets handling, injection risks, and overall security posture.

---

## Required Reading Before Starting

- [CLAUDE.md](../../CLAUDE.md) - Session rules
- [SECURITY.md](../../SECURITY.md) - Security policy
- [BUG_REGISTRY.md](../BUG_REGISTRY.md) - Known security issues (BUG-001)
- [AI_INSTRUCTION_INDEX.md](../AI_INSTRUCTION_INDEX.md) - Section 5

---

## Entry Criteria

- [ ] New or modified protected routes
- [ ] Config changes touching secrets or auth
- [ ] User input handling changes
- [ ] Database query changes
- [ ] File upload handling
- [ ] Any external API integration

---

## Exit Criteria

- [ ] All protected routes enforce `Depends(get_current_user)`
- [ ] No secrets in code, logs, or error messages
- [ ] All user input validated at system boundary
- [ ] All database queries use ORM or parameterization
- [ ] CORS properly configured
- [ ] Security audit checklist completed

---

## Security Audit Protocol

### Phase 1: Authentication Audit

```markdown
## Authentication Checklist

### Route Protection
For EVERY route in backend/app/routes/:
- [ ] Is this route protected? Should it be?
- [ ] If protected, does it use `Depends(get_current_user)`?
- [ ] Are there any bypass conditions?

### Token Security
- [ ] JWT tokens have appropriate expiration (check config.py)
- [ ] Refresh token rotation implemented
- [ ] Token revocation possible
- [ ] Tokens not logged

### Password Security
- [ ] Passwords hashed with bcrypt/argon2 (NOT in codebase - BUG-001)
- [ ] Passwords never logged
- [ ] Passwords never returned in responses
- [ ] Password requirements enforced
```

### Phase 2: Authorization Audit

```markdown
## Authorization Checklist

### Data Access
- [ ] Users can only access their own projects
- [ ] Admin functions properly gated
- [ ] No horizontal privilege escalation possible
- [ ] No vertical privilege escalation possible

### API Keys (if applicable)
- [ ] API keys not exposed in client code
- [ ] API keys rotatable
- [ ] API keys scoped appropriately
```

### Phase 3: Input Validation Audit

```markdown
## Input Validation Checklist

### All Endpoints
For EVERY endpoint that accepts input:
- [ ] Input validated via Pydantic schema
- [ ] Validation happens server-side (not just client)
- [ ] Invalid input returns 400 with safe error message
- [ ] No raw user input in SQL queries
- [ ] No raw user input in shell commands
- [ ] No raw user input in file paths

### File Uploads
- [ ] File type validated (not just extension)
- [ ] File size limited
- [ ] Filename sanitized
- [ ] Upload directory outside web root
- [ ] No path traversal possible
```

### Phase 4: Injection Prevention Audit

```markdown
## Injection Prevention Checklist

### SQL Injection
For EVERY database query:
- [ ] Uses SQLAlchemy ORM (preferred)
- [ ] OR uses parameterized queries
- [ ] NEVER uses string concatenation/f-strings for queries

### XSS Prevention
- [ ] User content is escaped in templates
- [ ] Content-Security-Policy header set
- [ ] No dangerouslySetInnerHTML with user content

### Command Injection
- [ ] No shell commands with user input
- [ ] If shell needed, use subprocess with array args
- [ ] No eval() or exec() with user input
```

### Phase 5: Data Protection Audit

```markdown
## Data Protection Checklist

### Sensitive Data Handling
- [ ] PII identified and documented
- [ ] PII encrypted at rest (if applicable)
- [ ] PII not logged
- [ ] PII retention policy defined

### Logging
- [ ] Passwords NEVER logged
- [ ] Tokens NEVER logged
- [ ] PII NEVER logged
- [ ] Stack traces not exposed to users
- [ ] Error messages don't leak internals
```

### Phase 6: Infrastructure Audit

```markdown
## Infrastructure Checklist

### CORS
- [ ] CORS not set to allow_origins=["*"] in production
- [ ] Only legitimate frontend domains allowed
- [ ] Credentials handling correct

### HTTPS
- [ ] HTTPS enforced in production
- [ ] HSTS header set
- [ ] Secure cookie flags set

### Rate Limiting
- [ ] Login endpoint rate limited
- [ ] API endpoints rate limited
- [ ] Rate limit headers returned
```

---

## Known Security Issues

| ID | Issue | Status | Notes |
|----|-------|--------|-------|
| BUG-001 | Hardcoded credentials | Open | Critical - must fix |
| - | CORS allows all origins | Open | Check config.py |

---

## Expected Artifacts

After completing security audit:

```markdown
## Security Audit Report

### Date: [Date]
### Scope: [What was audited]

### Findings

#### Critical
1. [Finding with location and recommendation]

#### High
1. [Finding]

#### Medium
1. [Finding]

#### Low
1. [Finding]

### Recommendations
1. [Prioritized fix list]

### Files Reviewed
- [List of files]
```

---

## Key Files to Audit

| File | What to Check |
|------|---------------|
| `backend/app/utils/security.py` | Auth implementation |
| `backend/app/config.py` | Secrets, CORS config |
| `backend/app/routes/*.py` | Auth decorators on routes |
| `backend/app/services/*.py` | Data access controls |
| `backend/app/schemas/*.py` | Input validation |
| `frontend/src/lib/authService.ts` | Token handling |

---

## Security Anti-Patterns

```python
# ❌ WRONG: Hardcoded credentials
if username == "admin" and password == "password123":
    return True

# ❌ WRONG: SQL injection risk
query = f"SELECT * FROM users WHERE name = '{user_input}'"

# ❌ WRONG: Logging sensitive data
logger.info(f"User {username} logged in with password {password}")

# ❌ WRONG: Returning password in response
return {"user": user.username, "password": user.hashed_password}

# ❌ WRONG: Command injection risk
os.system(f"process_file {user_provided_filename}")
```

---

## Risks and Gotchas

- Missing auth on new endpoints (easy to forget `Depends`)
- Logging sensitive values accidentally
- CORS misconfiguration allowing any origin
- JWT token not properly validated
- Error messages leaking stack traces
- Forgetting to validate nested input objects
- File path traversal in uploads
- SSRF in URL fetching features

---

## Contingencies

### If Security Issue Found

1. **Assess severity** using CVSS or internal scale
2. **Document immediately** in BUG_REGISTRY.md
3. **For Critical/High**: Notify team, prioritize fix
4. **Create fix plan** with timeline
5. **Monitor** for exploitation attempts

### If Fix Could Break Functionality

1. Document the trade-off
2. Implement with feature flag if possible
3. Have rollback plan ready
4. Monitor after deployment

---

_Last updated: 2026-01-20_
