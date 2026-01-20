# Claude Code Configuration

> **This file is automatically read by Claude Code when working in this repository.**
> It establishes the mandatory protocols, constraints, and workflows for all AI-assisted development.

---

## Quick Reference

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [AGENTS.md](AGENTS.md) | Coding standards, patterns, incident log | Every session |
| [docs/AI_INSTRUCTION_INDEX.md](docs/AI_INSTRUCTION_INDEX.md) | Master instruction list by task type | Before any task |
| [docs/BUG_HANDLING_PLAYBOOK.md](docs/BUG_HANDLING_PLAYBOOK.md) | Bug fix process | Fixing bugs |
| [docs/BUG_REGISTRY.md](docs/BUG_REGISTRY.md) | Known bugs catalog | Before fixing bugs |
| [REPO_REVIEW.md](REPO_REVIEW.md) | Architecture overview | Understanding codebase |
| [BACKLOG.md](BACKLOG.md) | Prioritized work items | Planning work |

---

## Core Principles

### 1. Conservative by Default

```
STOP → THINK → VERIFY → ACT → VALIDATE
```

- **Never assume** - Always verify current state before making changes
- **Never guess** - If uncertain, investigate or ask
- **Minimal changes** - Change only what is necessary
- **Preserve behavior** - Existing functionality must not break
- **Reversibility** - Design changes that can be rolled back

### 2. First Principles Thinking

Before ANY code change, answer these questions:

```markdown
## Pre-Change Analysis (Required)

1. **WHAT** is the exact problem or requirement?
2. **WHERE** in the codebase is this handled?
3. **WHY** does the current behavior exist?
4. **HOW** will the change affect:
   - Upstream callers?
   - Downstream dependencies?
   - Shared state?
   - Error handling?
   - Performance?
   - Security?
5. **WHAT IF** this change fails?
   - Rollback plan?
   - Detection mechanism?
   - User impact?
```

### 3. Zero Assumptions Policy

| Instead of... | Do this... |
|---------------|------------|
| Assuming file content | Read the file first |
| Assuming API shape | Check the schema/types |
| Assuming test passes | Run the test |
| Assuming no side effects | Trace the data flow |
| Assuming user intent | Ask clarifying questions |

---

## Mandatory Protocols

### Before ANY Change

```markdown
## Pre-Change Checklist

- [ ] Read ALL files that will be modified
- [ ] Read files that CALL the code being modified
- [ ] Read files that ARE CALLED by the code being modified
- [ ] Check for existing tests covering this code
- [ ] Review AGENTS.md for relevant patterns/anti-patterns
- [ ] Check BUG_REGISTRY.md for related known issues
- [ ] Document the expected outcome BEFORE making changes
```

### During Changes

```markdown
## Change Protocol

- [ ] Make ONE logical change at a time
- [ ] Verify each change compiles/lints before proceeding
- [ ] Keep changes minimal and focused
- [ ] Add comments for non-obvious logic
- [ ] Never introduce new warnings or errors
- [ ] Preserve existing code style
```

### After Changes

```markdown
## Post-Change Checklist

- [ ] Run linting: `npm run lint` (frontend), `ruff check .` (backend)
- [ ] Run type checking: `npm run typecheck` (frontend), `mypy .` (backend)
- [ ] Run tests: `npm test` (frontend), `pytest` (backend)
- [ ] Manually verify the change works as expected
- [ ] Check for unintended side effects
- [ ] Update documentation if behavior changed
```

---

## Task-Specific Instructions

### Bug Fixes

**Required reading before starting:**
- [docs/BUG_HANDLING_PLAYBOOK.md](docs/BUG_HANDLING_PLAYBOOK.md)
- [docs/BUG_REGISTRY.md](docs/BUG_REGISTRY.md)

**Protocol:**
1. **Reproduce** the bug first - if you can't reproduce it, stop
2. **Understand** the root cause - explain it in plain language
3. **Document** expected vs actual behavior
4. **Plan** the minimal fix with contingency analysis
5. **Implement** the fix (minimal changes only)
6. **Add** regression test
7. **Validate** fix and check for side effects
8. **Update** BUG_REGISTRY.md if significant

**Forbidden:**
- Fixing symptoms without understanding root cause
- Refactoring while fixing bugs
- Bundling unrelated changes
- Skipping regression tests for P0/P1 bugs

### Feature Implementation

**Required reading before starting:**
- [docs/agents/feature-implementation.md](docs/agents/feature-implementation.md)
- [AGENTS.md](AGENTS.md) - Architecture section

**Protocol:**
1. **Clarify** requirements - ask questions if ambiguous
2. **Design** the solution - document before coding
3. **Identify** all touchpoints (backend routes, services, frontend components)
4. **Implement** backend first, then frontend
5. **Add** tests for new functionality
6. **Validate** end-to-end user flow
7. **Update** documentation

**Architecture rules:**
- Backend: Routes (HTTP only) → Services (logic) → Models (DB)
- Frontend: Server Components (default) → Client Components (interactivity only)
- Never put business logic in routes
- Never use `any` type in TypeScript

### Refactoring

**Required reading before starting:**
- [docs/agents/refactor-steward.md](docs/agents/refactor-steward.md)

**Protocol:**
1. **Document** current behavior contracts
2. **Ensure** comprehensive test coverage exists
3. **Make** behavior-preserving changes only
4. **Verify** all tests still pass
5. **Verify** API contracts unchanged

**Forbidden:**
- Changing behavior during refactoring
- Refactoring without tests
- Mixing refactoring with bug fixes or features

### Security Changes

**Required reading before starting:**
- [docs/agents/security-auditor.md](docs/agents/security-auditor.md)
- [SECURITY.md](SECURITY.md)

**Protocol:**
1. **Audit** auth coverage on all routes
2. **Verify** no secrets in code or logs
3. **Check** for injection vulnerabilities (SQL, XSS, command)
4. **Validate** input at system boundaries
5. **Review** CORS and authentication configuration

**Critical rules:**
- All protected routes MUST use `Depends(get_current_user)`
- Never log sensitive values (passwords, tokens, PII)
- Always use ORM or parameterized queries
- Validate all user input

---

## Git Workflow

### Branch Rules

```bash
# NEVER push directly to main
# Always create a feature/fix branch
git checkout -b fix/description-of-fix

# Branch naming
feat/short-description   # New features
fix/issue-description    # Bug fixes
docs/update-description  # Documentation
refactor/area-name       # Refactoring
```

### Commit Messages

```bash
# Format: type: description
feat: add user authentication system
fix: resolve JWT expiration bug
docs: update API documentation
refactor: extract keyword service methods
chore: update dependencies
test: add grouping unit tests
```

### Pre-Commit Requirements

```bash
# Frontend
cd frontend
npm run lint        # Must pass
npm run typecheck   # Must pass
npm test            # Must pass

# Backend
cd backend
ruff check .        # Must pass
black --check .     # Must pass
mypy .              # Should pass (warnings OK)
pytest              # Must pass
```

### Pull Request Protocol

1. Create branch from main
2. Make changes following protocols above
3. Run all pre-commit checks
4. Push branch to origin
5. Create PR using template
6. Never merge your own PR without review

---

## Technology Constraints

### Backend (FastAPI + SQLAlchemy)

| Rule | Reason |
|------|--------|
| PostgreSQL only | Code uses JSONB operators |
| Async everywhere | Consistency, performance |
| Pydantic for validation | Type safety, serialization |
| Services for logic | Separation of concerns |
| Alembic for migrations | Schema version control |

### Frontend (Next.js + React)

| Rule | Reason |
|------|--------|
| Server Components default | Performance, SEO |
| Client Components for interactivity | Hydration, bundle size |
| Redux for global state | Cross-page state sharing |
| Tailwind for styling | Consistency, no CSS files |
| TypeScript strict mode | Type safety |

---

## Known Risks and Anti-Patterns

### Critical Known Issues (Fix These)

| Issue | Location | Impact |
|-------|----------|--------|
| Hardcoded auth | `backend/app/utils/security.py` | Security vulnerability |
| DB engine mismatch | `backend/app/config.py` | Runtime failures |
| Request-scoped session in background task | `backend/app/routes/projects.py` | Data integrity |

See [docs/BUG_REGISTRY.md](docs/BUG_REGISTRY.md) for full list.

### Anti-Patterns to Avoid

```python
# WRONG: Business logic in route
@router.post("/group")
async def group_keywords(db: Session):
    # 50 lines of grouping logic here  ❌

# RIGHT: Logic in service
@router.post("/group")
async def group_keywords(db: Session):
    return await KeywordService.group(db, request)  ✅
```

```python
# WRONG: Request session in background task
background_tasks.add_task(delete_data, db)  ❌

# RIGHT: Create session in task
background_tasks.add_task(delete_data, project_id)  ✅
async def delete_data(project_id):
    async with get_session() as db:
        await do_delete(db, project_id)
```

```typescript
// WRONG: Using 'any' type
const data: any = response;  ❌

// RIGHT: Define types
const data: KeywordResponse = response;  ✅
```

```typescript
// WRONG: Client Component for static content
"use client"
export default function Header() {
  return <h1>Static Header</h1>;  ❌
}

// RIGHT: Server Component for static content
export default function Header() {
  return <h1>Static Header</h1>;  ✅
}
```

---

## Contingency Planning

### Before Every Change, Consider:

```markdown
## Potential Problems Checklist

### Data Integrity
- [ ] Can this corrupt existing data?
- [ ] What happens to in-flight operations?
- [ ] Are there race conditions?

### Performance
- [ ] Does this add N+1 queries?
- [ ] Does this load too much into memory?
- [ ] Does this block the event loop?

### Security
- [ ] Does this expose sensitive data?
- [ ] Is input properly validated?
- [ ] Are auth checks in place?

### Compatibility
- [ ] Does this break existing clients?
- [ ] Are API contracts preserved?
- [ ] Is this backwards compatible?

### Recovery
- [ ] How do we detect if this fails?
- [ ] How do we roll back?
- [ ] What's the user impact of failure?
```

### Intangibles to Watch

| Category | Watch For |
|----------|-----------|
| **Timing** | Race conditions, stale data, async ordering |
| **Boundaries** | Empty arrays, null values, max/min limits |
| **Encoding** | Unicode, special characters, emoji |
| **Scale** | Behavior at 10x, 100x, 1000x current data |
| **Network** | Timeouts, retries, partial failures |
| **Cache** | Stale data, invalidation, cold start |
| **State** | Desync between client/server, Redux/API |

---

## File Reading Requirements

### Files to Read Based on Task Type

| Task | Required Reading |
|------|------------------|
| Any change | AGENTS.md, files being modified |
| Bug fix | + BUG_HANDLING_PLAYBOOK.md, BUG_REGISTRY.md |
| New feature | + feature-implementation.md, relevant existing features |
| Refactoring | + refactor-steward.md, existing tests |
| Security | + security-auditor.md, SECURITY.md |
| Database | + migration-gatekeeper.md, existing migrations |
| API change | + api-contract-auditor.md, schemas |
| UI change | + keyword-ux-curator.md, existing components |
| Tests | + test-harness-builder.md, conftest.py |

---

## Communication Protocol

### When to Ask Questions

- Requirements are ambiguous
- Multiple valid approaches exist
- Change could have significant impact
- Unsure about existing behavior
- Need clarification on priorities

### What to Report

After completing work:
```markdown
## Change Summary

**What changed:**
- [List of files modified]

**Why:**
- [Brief explanation]

**Testing:**
- [How it was validated]

**Risks:**
- [Any concerns or things to watch]

**Follow-up:**
- [Any remaining work or monitoring needed]
```

---

## Quick Commands Reference

```bash
# Frontend
cd frontend
npm run dev          # Start dev server
npm run lint         # Run linter
npm run typecheck    # Run type checker
npm test             # Run tests
npm run build        # Production build

# Backend
cd backend
uvicorn app.main:app --reload  # Start dev server
ruff check .                    # Run linter
black .                         # Format code
mypy .                          # Type check
pytest                          # Run tests
pytest --cov=app               # Tests with coverage

# Git
git status                      # Check state
git diff                        # See changes
git log --oneline -10           # Recent commits
```

---

## Document Maintenance

This file should be updated when:
- New patterns or anti-patterns are discovered
- Technology stack changes
- New critical bugs are identified
- Workflow improvements are made

Last updated: 2026-01-20
