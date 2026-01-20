# AI Instruction Index

> **Master reference for all AI-assisted development instructions.**
> This document provides precise, task-specific guidance for Claude Code and other AI assistants.

---

## How to Use This Document

1. **Identify your task type** from the categories below
2. **Read ALL required documents** listed for that task
3. **Follow the step-by-step protocol** exactly
4. **Complete ALL checklists** before marking work done
5. **Never skip steps** - each exists for a reason

---

## Table of Contents

1. [Universal Principles](#1-universal-principles)
2. [Bug Fixing Instructions](#2-bug-fixing-instructions)
3. [Feature Development Instructions](#3-feature-development-instructions)
4. [Refactoring Instructions](#4-refactoring-instructions)
5. [Security Work Instructions](#5-security-work-instructions)
6. [Database/Migration Instructions](#6-databasemigration-instructions)
7. [API Development Instructions](#7-api-development-instructions)
8. [Frontend Development Instructions](#8-frontend-development-instructions)
9. [Testing Instructions](#9-testing-instructions)
10. [Documentation Instructions](#10-documentation-instructions)
11. [Code Review Instructions](#11-code-review-instructions)
12. [Emergency/Hotfix Instructions](#12-emergencyhotfix-instructions)

---

## 1. Universal Principles

### The Cardinal Rules

These rules apply to EVERY task, without exception:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CARDINAL RULES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. READ BEFORE WRITE                                           │
│     Never modify code you haven't read and understood           │
│                                                                 │
│  2. UNDERSTAND BEFORE CHANGING                                  │
│     If you can't explain why code exists, don't change it       │
│                                                                 │
│  3. MINIMAL CHANGES ONLY                                        │
│     Change the least amount of code necessary                   │
│                                                                 │
│  4. VERIFY EVERY ASSUMPTION                                     │
│     Assumptions are bugs waiting to happen                      │
│                                                                 │
│  5. TEST EVERYTHING                                             │
│     If it's not tested, it's broken                             │
│                                                                 │
│  6. DOCUMENT SIDE EFFECTS                                       │
│     Every change has consequences - identify them               │
│                                                                 │
│  7. PLAN FOR FAILURE                                            │
│     What happens when this doesn't work?                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### First Principles Framework

Apply to EVERY decision:

```markdown
## First Principles Analysis Template

### 1. Define the Problem
- What exactly needs to change?
- What is the expected outcome?
- How will we verify success?

### 2. Map the System
- What components are involved?
- What calls this code?
- What does this code call?
- What state does it read/write?

### 3. Identify Constraints
- Performance requirements?
- Security requirements?
- Compatibility requirements?
- Resource constraints?

### 4. Consider Alternatives
- What are the options?
- What are the trade-offs?
- Why is Option X better than Option Y?

### 5. Anticipate Problems
- What could go wrong?
- How would we detect failure?
- How would we recover?

### 6. Plan Verification
- How will we test this?
- What edge cases exist?
- What regression tests are needed?
```

### Pre-Task Universal Checklist

Complete BEFORE starting ANY task:

```markdown
## Pre-Task Checklist

### Context Gathering
- [ ] Read CLAUDE.md for current session rules
- [ ] Read AGENTS.md for coding standards
- [ ] Identify task type and read task-specific instructions below
- [ ] Check BUG_REGISTRY.md for related known issues
- [ ] Review recent commits in affected areas: `git log --oneline -10 -- path/to/file`

### File Understanding
- [ ] Read ALL files that will be modified
- [ ] Read files that IMPORT the code being modified
- [ ] Read files that ARE IMPORTED by the code being modified
- [ ] Read related test files

### Impact Assessment
- [ ] List all components that could be affected
- [ ] Identify potential breaking changes
- [ ] Document rollback strategy
```

---

## 2. Bug Fixing Instructions

### Required Reading

| Document | Purpose |
|----------|---------|
| [BUG_HANDLING_PLAYBOOK.md](BUG_HANDLING_PLAYBOOK.md) | Complete bug fix methodology |
| [BUG_REGISTRY.md](BUG_REGISTRY.md) | Check if bug is already documented |
| [agents/bug-finder.md](agents/bug-finder.md) | Agent-specific runbook |

### Step-by-Step Protocol

```markdown
## Bug Fix Protocol

### Phase 1: Reproduction (DO NOT SKIP)
1. Read the bug report completely
2. Identify exact reproduction steps
3. Reproduce the bug locally
4. Document: environment, steps, expected vs actual
5. IF CANNOT REPRODUCE → STOP. Get more information.

### Phase 2: Investigation
1. Trace the code path from user action to bug manifestation
2. Add temporary logging if needed to understand flow
3. Apply the "Five Whys" to find root cause
4. Document the root cause in plain language
5. Verify your understanding by predicting behavior

### Phase 3: Planning
1. Design the minimal fix
2. Identify ALL files that need changes
3. Complete contingency analysis:
   - What could go wrong?
   - What side effects are possible?
   - What's the rollback plan?
4. Plan the regression test

### Phase 4: Implementation
1. Make the fix (minimal changes only)
2. Add regression test FIRST, verify it fails
3. Apply fix, verify test passes
4. Run full test suite
5. Remove temporary logging

### Phase 5: Validation
1. Reproduce original bug scenario - should be fixed
2. Test adjacent functionality - should work
3. Run linting and type checking
4. Test edge cases

### Phase 6: Documentation
1. Update BUG_REGISTRY.md if P0/P1
2. Add to AGENTS.md incident log if production issue
3. Write clear commit message explaining fix
```

### Bug Fix Forbidden Actions

```markdown
## NEVER DO THESE WHEN FIXING BUGS

❌ Fix without reproducing first
❌ Fix symptoms without understanding root cause
❌ Refactor adjacent code while fixing
❌ Bundle multiple bug fixes in one commit
❌ Skip regression test for P0/P1 bugs
❌ Ignore potential side effects
❌ Use quick hacks that create tech debt
❌ Silence errors without handling them
❌ Change behavior beyond the fix scope
```

### Bug Fix Checklist

```markdown
## Bug Fix Completion Checklist

### Before Committing
- [ ] Bug reproduced before fix
- [ ] Root cause documented
- [ ] Fix is minimal and focused
- [ ] Regression test added and passes
- [ ] All existing tests pass
- [ ] Linting passes
- [ ] Type checking passes
- [ ] Manual verification complete
- [ ] Side effects checked
- [ ] No unrelated changes included

### After Committing
- [ ] BUG_REGISTRY.md updated (if applicable)
- [ ] AGENTS.md incident log updated (if applicable)
- [ ] PR created with clear description
```

---

## 3. Feature Development Instructions

### Required Reading

| Document | Purpose |
|----------|---------|
| [AGENTS.md](../AGENTS.md) | Architecture patterns |
| [agents/feature-implementation.md](agents/feature-implementation.md) | Feature runbook |
| [REPO_REVIEW.md](../REPO_REVIEW.md) | System architecture |
| [BACKLOG.md](../BACKLOG.md) | Feature context and priority |

### Step-by-Step Protocol

```markdown
## Feature Development Protocol

### Phase 1: Requirements Clarification
1. Read the feature request/spec completely
2. Identify ambiguities and unknowns
3. Ask clarifying questions BEFORE coding
4. Document the expected user flow
5. Define acceptance criteria

### Phase 2: Design
1. Identify all system components involved:
   - Backend: routes, services, models, schemas
   - Frontend: pages, components, state, API calls
   - Database: tables, columns, migrations
2. Design API contracts (request/response shapes)
3. Design database schema changes (if any)
4. Design UI state management
5. Document the design BEFORE coding

### Phase 3: Backend Implementation
1. Create/update database models
2. Create Alembic migration
3. Create/update Pydantic schemas
4. Implement service layer logic
5. Implement route handlers
6. Add backend tests

### Phase 4: Frontend Implementation
1. Update TypeScript types to match API
2. Add API client functions
3. Implement UI components (Server Components default)
4. Add Client Components only where needed
5. Connect to Redux state if cross-page
6. Add frontend tests

### Phase 5: Integration
1. Test end-to-end user flow
2. Verify error handling
3. Test loading and edge states
4. Verify performance is acceptable

### Phase 6: Documentation
1. Update API documentation
2. Update any affected user-facing docs
3. Write clear PR description
```

### Feature Architecture Rules

```markdown
## Architecture Constraints

### Backend Rules
- Routes: HTTP handling ONLY (no business logic)
- Services: ALL business logic goes here
- Models: Database schema definition
- Schemas: Pydantic validation and serialization

### Frontend Rules
- Server Components: Default for all non-interactive UI
- Client Components: ONLY for hooks, event handlers, browser APIs
- Redux: ONLY for state needed across pages
- Local state: For component-specific UI state

### Database Rules
- Always create migration for schema changes
- Never modify production data without migration
- Use JSONB for flexible data (PostgreSQL only)
- Add indexes for frequently queried columns
```

### Feature Forbidden Actions

```markdown
## NEVER DO THESE WHEN BUILDING FEATURES

❌ Start coding before requirements are clear
❌ Put business logic in route handlers
❌ Use "any" type in TypeScript
❌ Create Client Components for static content
❌ Skip database migration for schema changes
❌ Hardcode configuration values
❌ Add features without tests
❌ Ignore error states in UI
❌ Forget loading states
❌ Mix feature work with bug fixes or refactoring
```

---

## 4. Refactoring Instructions

### Required Reading

| Document | Purpose |
|----------|---------|
| [agents/refactor-steward.md](agents/refactor-steward.md) | Refactoring runbook |
| [refactoring-opportunities.md](refactoring-opportunities.md) | Known refactoring candidates |

### Step-by-Step Protocol

```markdown
## Refactoring Protocol

### Phase 1: Preparation
1. Document current behavior contracts
2. Ensure comprehensive test coverage EXISTS
3. If tests are missing, ADD THEM FIRST
4. Run all tests - they must pass

### Phase 2: Planning
1. Define the refactoring goal
2. Plan small, incremental steps
3. Each step should keep tests passing
4. Document what will change and what won't

### Phase 3: Execution
1. Make ONE small change
2. Run tests
3. Verify behavior unchanged
4. Commit
5. Repeat

### Phase 4: Verification
1. All tests still pass
2. API contracts unchanged
3. UI behavior unchanged
4. Performance not degraded
```

### Refactoring Rules

```markdown
## Refactoring Constraints

✅ ALLOWED:
- Renaming for clarity
- Extracting functions/methods
- Moving code to better locations
- Improving structure
- Reducing duplication
- Simplifying complexity

❌ NOT ALLOWED:
- Changing behavior
- Changing API contracts
- Adding features
- Fixing bugs (do separately)
- Changing without tests
```

---

## 5. Security Work Instructions

### Required Reading

| Document | Purpose |
|----------|---------|
| [agents/security-auditor.md](agents/security-auditor.md) | Security runbook |
| [SECURITY.md](../SECURITY.md) | Security policy |
| [BUG_REGISTRY.md](BUG_REGISTRY.md) | Security-related bugs |

### Security Audit Checklist

```markdown
## Security Audit Checklist

### Authentication
- [ ] All protected routes use `Depends(get_current_user)`
- [ ] JWT tokens have appropriate expiration
- [ ] Refresh token rotation is implemented
- [ ] Password hashing uses bcrypt or argon2
- [ ] No hardcoded credentials anywhere

### Authorization
- [ ] Users can only access their own data
- [ ] Admin functions are properly protected
- [ ] API keys are not exposed in client code

### Input Validation
- [ ] All user input is validated
- [ ] Validation happens at API boundary
- [ ] File uploads are validated (type, size)
- [ ] SQL queries use ORM or parameterization

### Data Protection
- [ ] Sensitive data is encrypted at rest
- [ ] PII is not logged
- [ ] Passwords are never logged or returned
- [ ] Tokens are not logged

### Infrastructure
- [ ] CORS is properly configured
- [ ] HTTPS is enforced
- [ ] Rate limiting is in place
- [ ] Error messages don't leak internals
```

### Security Forbidden Actions

```markdown
## NEVER DO THESE IN SECURITY CONTEXT

❌ Log passwords, tokens, or PII
❌ Return sensitive data in error messages
❌ Use string concatenation for SQL
❌ Trust client-side validation alone
❌ Store secrets in code or environment variables in repo
❌ Use weak password hashing
❌ Allow unlimited login attempts
❌ Expose stack traces to users
```

---

## 6. Database/Migration Instructions

### Required Reading

| Document | Purpose |
|----------|---------|
| [agents/migration-gatekeeper.md](agents/migration-gatekeeper.md) | Migration runbook |
| [agents/data-consistency-backfill-agent.md](agents/data-consistency-backfill-agent.md) | Data integrity |

### Migration Protocol

```markdown
## Database Migration Protocol

### Phase 1: Planning
1. Document current schema
2. Document desired schema
3. Identify all code that queries affected tables
4. Plan for backwards compatibility
5. Plan rollback strategy

### Phase 2: Migration Creation
1. Generate migration: `alembic revision --autogenerate -m "description"`
2. REVIEW the generated migration carefully
3. Test migration on copy of production data
4. Test rollback: `alembic downgrade -1`

### Phase 3: Code Updates
1. Update SQLAlchemy models
2. Update Pydantic schemas
3. Update queries
4. Update tests

### Phase 4: Deployment
1. Take database backup
2. Run migration in staging
3. Verify application works
4. Run migration in production
5. Monitor for issues
```

### Migration Rules

```markdown
## Migration Constraints

### ALWAYS:
- Back up before migrating
- Test rollback procedure
- Review auto-generated migrations
- Consider data migration needs
- Update related code together

### NEVER:
- Modify production data directly
- Deploy code before migration
- Drop columns without deprecation period
- Change column types without data migration
- Skip testing on realistic data
```

---

## 7. API Development Instructions

### Required Reading

| Document | Purpose |
|----------|---------|
| [agents/api-contract-auditor.md](agents/api-contract-auditor.md) | API contract rules |
| [REPO_REVIEW.md](../REPO_REVIEW.md) | Existing API patterns |

### API Development Checklist

```markdown
## API Development Checklist

### Design
- [ ] Endpoint follows REST conventions
- [ ] Request schema defined (Pydantic)
- [ ] Response schema defined (Pydantic)
- [ ] Error responses defined
- [ ] Authentication requirement specified

### Implementation
- [ ] Route handler is thin (HTTP only)
- [ ] Business logic in service layer
- [ ] Proper HTTP status codes used
- [ ] Input validation via Pydantic
- [ ] Errors return structured JSON

### Documentation
- [ ] OpenAPI docs updated
- [ ] Request/response examples provided
- [ ] Error cases documented

### Testing
- [ ] Happy path tested
- [ ] Error cases tested
- [ ] Auth enforcement tested
- [ ] Validation tested
```

---

## 8. Frontend Development Instructions

### Required Reading

| Document | Purpose |
|----------|---------|
| [AGENTS.md](../AGENTS.md) | Frontend patterns |
| [agents/keyword-ux-curator.md](agents/keyword-ux-curator.md) | UX guidelines |

### Component Development Rules

```markdown
## Frontend Component Rules

### Server vs Client Components
┌─────────────────────────────────────────────────────────────┐
│ USE SERVER COMPONENT (default) when:                        │
│ - Fetching data                                             │
│ - Accessing backend resources                               │
│ - Rendering static content                                  │
│ - Keeping sensitive info on server                          │
├─────────────────────────────────────────────────────────────┤
│ USE CLIENT COMPONENT ("use client") ONLY when:              │
│ - Using React hooks (useState, useEffect, etc.)             │
│ - Using event listeners (onClick, onChange, etc.)           │
│ - Using browser APIs (localStorage, etc.)                   │
│ - Using third-party client libraries                        │
└─────────────────────────────────────────────────────────────┘

### State Management
┌─────────────────────────────────────────────────────────────┐
│ USE LOCAL STATE (useState) for:                             │
│ - UI state (modals, dropdowns, form inputs)                 │
│ - Component-specific data                                   │
├─────────────────────────────────────────────────────────────┤
│ USE REDUX for:                                              │
│ - State needed across multiple pages                        │
│ - Cached API data                                           │
│ - User preferences                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Testing Instructions

### Required Reading

| Document | Purpose |
|----------|---------|
| [agents/test-harness-builder.md](agents/test-harness-builder.md) | Testing runbook |

### Test Writing Rules

```markdown
## Test Writing Guidelines

### Test Structure
def test_[unit]_[scenario]_[expected_result]():
    """
    Description of what is being tested.
    """
    # Arrange: Set up test data and conditions

    # Act: Perform the action being tested

    # Assert: Verify the expected outcome

### Coverage Requirements
- P0/P1 bugs: Integration test + unit test
- New features: Unit tests for logic, integration for flows
- Refactoring: Must have tests BEFORE refactoring

### What to Test
- Happy paths
- Error conditions
- Edge cases (empty, null, max, min)
- Boundary conditions
- Permission/auth checks
```

---

## 10. Documentation Instructions

### When to Update Documentation

| Change Type | Update Required |
|-------------|-----------------|
| New feature | API docs, user docs |
| Bug fix (P0/P1) | BUG_REGISTRY.md, incident log |
| API change | API docs, TypeScript types |
| Architecture change | REPO_REVIEW.md |
| New pattern | AGENTS.md |

---

## 11. Code Review Instructions

### Review Checklist

```markdown
## Code Review Checklist

### Correctness
- [ ] Logic is correct
- [ ] Edge cases handled
- [ ] Error handling appropriate

### Style
- [ ] Follows coding standards
- [ ] No unnecessary complexity
- [ ] Clear naming

### Testing
- [ ] Tests included
- [ ] Tests are meaningful
- [ ] Edge cases tested

### Security
- [ ] No vulnerabilities introduced
- [ ] Auth properly enforced
- [ ] Input validated

### Performance
- [ ] No obvious performance issues
- [ ] No N+1 queries
- [ ] Appropriate caching
```

---

## 12. Emergency/Hotfix Instructions

### Hotfix Protocol

```markdown
## Emergency Hotfix Protocol

### Still Required Even in Emergency:
1. Create branch (never push to main)
2. Minimal fix only
3. Run tests
4. Get review (can be expedited)
5. Monitor after deploy

### Can Be Abbreviated:
- Full documentation (update after)
- Comprehensive testing (add after)
- Code review depth (faster review OK)

### Never Skip:
- Testing the fix works
- Basic lint/type check
- Creating a branch
- Monitoring after deploy
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    TASK TYPE QUICK REFERENCE                    │
├───────────────┬─────────────────────────────────────────────────┤
│ Bug Fix       │ Reproduce → Investigate → Plan → Fix → Test     │
│ Feature       │ Clarify → Design → Backend → Frontend → Test    │
│ Refactor      │ Document → Test → Change → Test → Verify        │
│ Security      │ Audit → Identify → Fix → Verify → Document      │
│ Migration     │ Plan → Backup → Test → Deploy → Monitor         │
├───────────────┴─────────────────────────────────────────────────┤
│ ALWAYS: Read first, understand, minimal changes, test, verify   │
│ NEVER: Assume, guess, skip tests, bundle unrelated changes      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Document Cross-References

| Task | Primary Doc | Supporting Docs |
|------|-------------|-----------------|
| Any task | CLAUDE.md | AGENTS.md |
| Bug fix | BUG_HANDLING_PLAYBOOK.md | BUG_REGISTRY.md, bug-finder.md |
| Feature | feature-implementation.md | REPO_REVIEW.md |
| Refactor | refactor-steward.md | refactoring-opportunities.md |
| Security | security-auditor.md | SECURITY.md |
| Database | migration-gatekeeper.md | data-consistency-backfill-agent.md |
| API | api-contract-auditor.md | REPO_REVIEW.md |
| Frontend | keyword-ux-curator.md | AGENTS.md |
| Testing | test-harness-builder.md | conftest.py |

---

_Last updated: 2026-01-20_
