# Bug Handling Playbook

> **This document establishes the canonical approach to identifying, analyzing, fixing, and validating bugs in this codebase.**
> All contributors must follow these guidelines to ensure fixes are safe, complete, and do not introduce regressions.

---

## Table of Contents

1. [Core Philosophy](#1-core-philosophy)
2. [First Principles Framework](#2-first-principles-framework)
3. [Bug Lifecycle](#3-bug-lifecycle)
4. [Investigation Protocol](#4-investigation-protocol)
5. [Fix Implementation Standards](#5-fix-implementation-standards)
6. [Validation Requirements](#6-validation-requirements)
7. [Contingency Analysis](#7-contingency-analysis)
8. [Backend-Specific Guidelines](#8-backend-specific-guidelines)
9. [Frontend-Specific Guidelines](#9-frontend-specific-guidelines)
10. [Post-Fix Monitoring](#10-post-fix-monitoring)
11. [Anti-Patterns](#11-anti-patterns)
12. [Checklists](#12-checklists)

---

## 1. Core Philosophy

### 1.1 Conservative by Default

> **"First, do no harm."**

- **Minimal changes**: Fix only what is broken. Resist the urge to refactor, clean up, or "improve" adjacent code.
- **Preserve behavior**: Every line not directly related to the bug should behave exactly as before.
- **Reversibility**: Design fixes that can be rolled back quickly if something goes wrong.
- **Measured approach**: A working system with a known bug is better than a broken system with an attempted fix.

### 1.2 Understand Before Acting

- **Never fix what you don't understand**: If you cannot explain the bug's root cause in plain language, you are not ready to fix it.
- **Read before write**: Always read the full context of affected code before making changes.
- **Trace the data flow**: Follow the data from input to output to understand how the bug manifests.

### 1.3 Evidence-Based Decisions

- **Reproduce first**: A bug that cannot be reproduced cannot be verified as fixed.
- **Measure impact**: Quantify the bug's severity and scope before prioritizing.
- **Test the fix, not the assumption**: Your theory about the fix may be wrong; let tests prove it right.

---

## 2. First Principles Framework

Before touching any code, answer these questions explicitly:

### 2.1 The Five Whys

Ask "Why?" at least five times to reach the true root cause:

```
Bug: Users see deleted projects reappear
Why? → Background delete task fails silently
Why? → Database session is closed when task runs
Why? → Task receives request-scoped session
Why? → Session is passed by reference, not created fresh
Why? → Original implementation didn't account for async task lifecycle
Root Cause: Architectural mismatch between request lifecycle and background task lifecycle
```

### 2.2 First Principles Questions

| Question | Purpose |
|----------|---------|
| **What is the expected behavior?** | Define the correct state clearly |
| **What is the actual behavior?** | Document the deviation precisely |
| **When does it occur?** | Identify trigger conditions |
| **Where does it occur?** | Isolate the component/layer |
| **Who is affected?** | Understand impact scope |
| **What changed recently?** | Identify potential regression source |

### 2.3 System Boundary Analysis

Identify which boundaries the bug crosses:

- [ ] Frontend ↔ Backend (API contract)
- [ ] Backend ↔ Database (query/model)
- [ ] Sync ↔ Async (lifecycle mismatch)
- [ ] Request ↔ Background task (scope leakage)
- [ ] Client state ↔ Server state (sync issues)
- [ ] User input ↔ System processing (validation)

---

## 3. Bug Lifecycle

### 3.1 States

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  REPORTED   │ →  │ CONFIRMED   │ →  │ IN PROGRESS │ →  │   REVIEW    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│   CLOSED    │ ←  │  VERIFIED   │ ←  │   MERGED    │ ←─────────┘
└─────────────┘    └─────────────┘    └─────────────┘
```

### 3.2 State Transitions

| From | To | Required Evidence |
|------|-----|-------------------|
| Reported → Confirmed | Reproduction steps verified |
| Confirmed → In Progress | Root cause identified, fix approach documented |
| In Progress → Review | Fix implemented, tests added, local validation passed |
| Review → Merged | PR approved, CI green, no regressions |
| Merged → Verified | Production verification (if applicable) |
| Verified → Closed | Documented in incident log (if significant) |

---

## 4. Investigation Protocol

### 4.1 Reproduction Requirements

**A bug is not understood until it can be reliably reproduced.**

1. **Document exact steps**: Number each step explicitly
2. **Note environment**: OS, browser, database state, user role
3. **Identify frequency**: Always, sometimes, rarely, or only under specific conditions
4. **Capture evidence**: Screenshots, logs, network traces, database state

### 4.2 Investigation Steps

```markdown
1. READ the reported symptoms and any error messages
2. REPRODUCE the bug in a controlled environment
3. ISOLATE the failing component (frontend/backend/database)
4. TRACE the data flow through the system
5. IDENTIFY the exact line(s) where behavior diverges from expectation
6. DOCUMENT the root cause before proceeding
```

### 4.3 Logging and Tracing

- Add temporary logging if needed to understand flow
- Remove or convert to proper logging levels before committing
- Use structured logging (JSON) for machine-parseable traces

### 4.4 Git Archaeology

When the bug is a regression:

```bash
# Find when a file was last modified
git log --oneline -10 -- path/to/file.py

# Find commits that touched a specific function
git log -p --all -S 'function_name' -- '*.py'

# Binary search to find the breaking commit
git bisect start
git bisect bad HEAD
git bisect good <known-good-commit>
```

---

## 5. Fix Implementation Standards

### 5.1 The Minimal Fix Principle

> **Change the minimum amount of code necessary to fix the bug.**

- One bug = one fix = one PR
- Do not bundle unrelated changes
- Do not refactor while fixing (create a separate PR if needed)
- Do not add features while fixing

### 5.2 Fix Categories

| Category | Approach | Risk Level |
|----------|----------|------------|
| **Data fix** | Correct data transformation/validation | Medium |
| **Logic fix** | Correct conditional/algorithmic error | Medium |
| **State fix** | Correct state management/lifecycle | High |
| **Race condition** | Add synchronization/ordering | Very High |
| **API contract** | Fix request/response shape | High (breaking change risk) |
| **Configuration** | Correct environment/settings | Low |

### 5.3 Code Change Guidelines

1. **Add comments explaining the fix** if the bug was subtle:
   ```python
   # Fix: Create fresh session for background task to avoid
   # request-scoped session being closed before task executes.
   # See: docs/BUG_REGISTRY.md#BUG-002
   ```

2. **Preserve existing behavior for unaffected paths**:
   - Add new code paths rather than modifying existing ones when possible
   - Use feature flags for risky changes

3. **Handle edge cases explicitly**:
   ```python
   # Before (bug)
   return items[0]

   # After (fix)
   if not items:
       return None  # Explicit empty case handling
   return items[0]
   ```

### 5.4 Database Changes

- **Never modify production data directly** without a migration script
- **Always include rollback instructions** for data migrations
- **Test migrations on a copy of production data** before applying

---

## 6. Validation Requirements

### 6.1 Test Requirements

| Bug Severity | Test Requirement |
|--------------|------------------|
| Critical (P0) | Integration test + unit test + manual verification |
| High (P1) | Unit test + manual verification |
| Medium (P2) | Unit test |
| Low | Manual verification (test encouraged) |

### 6.2 Test Structure

```python
def test_bug_XXX_description_of_bug():
    """
    Regression test for BUG-XXX: [Brief description]

    Root cause: [One sentence explanation]
    Fix: [One sentence explanation of fix]
    """
    # Arrange: Set up the conditions that trigger the bug
    # Act: Perform the action that previously caused the bug
    # Assert: Verify the correct behavior now occurs
```

### 6.3 Validation Checklist

- [ ] Bug is reproducible before the fix
- [ ] Bug is not reproducible after the fix
- [ ] All existing tests pass
- [ ] New regression test added
- [ ] No new linting errors
- [ ] No new type errors
- [ ] Related functionality manually tested
- [ ] Edge cases considered and tested

---

## 7. Contingency Analysis

> **Every fix has the potential to introduce new bugs. Anticipate them.**

### 7.1 Pre-Fix Risk Assessment

Before implementing a fix, document:

| Risk Category | Questions to Answer |
|---------------|---------------------|
| **Scope creep** | Could this fix accidentally change behavior elsewhere? |
| **Data integrity** | Could this fix corrupt existing data? |
| **Performance** | Could this fix degrade performance? |
| **Security** | Could this fix open a security hole? |
| **API contract** | Could this fix break existing clients? |
| **State consistency** | Could this fix cause state desync? |

### 7.2 Side Effect Checklist

For each change, verify:

- [ ] **Upstream dependencies**: What calls this code? Will they still work?
- [ ] **Downstream dependencies**: What does this code call? Are those contracts unchanged?
- [ ] **Shared state**: Does this code modify shared state? Who else reads/writes it?
- [ ] **Timing assumptions**: Does this code assume execution order? Is that still valid?
- [ ] **Error handling**: If this code fails, what happens to the caller?

### 7.3 Unknown Unknowns

Things we might not have considered:

| Category | Watch For |
|----------|-----------|
| **Concurrency** | Race conditions, deadlocks, stale reads |
| **Boundary conditions** | Empty lists, null values, max/min values |
| **Time-based** | Timezone issues, DST, leap seconds, clock skew |
| **Encoding** | Unicode, emoji, special characters, RTL text |
| **Scale** | Behavior at 10x, 100x, 1000x current load |
| **Network** | Timeouts, retries, partial failures, ordering |
| **Cache** | Stale data, invalidation timing, cold cache behavior |
| **Third-party** | API changes, rate limits, outages |

### 7.4 Rollback Plan

Document before merging:

```markdown
## Rollback Plan for BUG-XXX Fix

1. **Revert commit**: `git revert <commit-hash>`
2. **Database rollback** (if applicable): `alembic downgrade -1`
3. **Data fix** (if applicable): [SQL or script to restore data]
4. **Verification**: [Steps to confirm rollback worked]
5. **Communication**: [Who to notify if rollback is needed]
```

---

## 8. Backend-Specific Guidelines

### 8.1 FastAPI / Python

| Issue Type | Common Causes | Fix Pattern |
|------------|---------------|-------------|
| **Request-scoped resource in background task** | Passing `db` session to `BackgroundTasks` | Create new session inside task |
| **Async/sync mismatch** | Calling sync code in async context | Use `run_in_executor` or async version |
| **JSONB query failure** | Using Postgres operators on MySQL | Validate DB engine at startup |
| **Pydantic serialization** | Missing `by_alias=True` or incorrect schema | Check response model config |
| **SQLAlchemy lazy load** | Accessing relationship outside session | Use `selectinload` or `joinedload` |

### 8.2 Database Safety

```python
# WRONG: Request-scoped session in background task
@router.delete("/projects/{id}")
async def delete_project(id: int, db: Session, background_tasks: BackgroundTasks):
    background_tasks.add_task(delete_heavy_data, db, id)  # ❌ Session will be closed

# RIGHT: Create session inside task
@router.delete("/projects/{id}")
async def delete_project(id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(delete_heavy_data, id)  # ✅ Task creates own session

async def delete_heavy_data(project_id: int):
    async with get_async_session() as db:  # Fresh session
        await ProjectService.delete(db, project_id)
```

### 8.3 Query Safety

- Always use parameterized queries (ORM or bound parameters)
- Validate input types before query construction
- Use database-level constraints as a safety net

---

## 9. Frontend-Specific Guidelines

### 9.1 React / Next.js

| Issue Type | Common Causes | Fix Pattern |
|------------|---------------|-------------|
| **Stale state** | Closure capturing old value | Use functional updates or refs |
| **Race condition** | Multiple async updates | Use abort controller or sequence tokens |
| **Hydration mismatch** | Server/client render difference | Use `useEffect` for client-only logic |
| **Redux desync** | Optimistic update without rollback | Implement rollback on error |
| **Prop drilling bug** | Wrong prop passed down chain | Verify prop names at each level |

### 9.2 State Management Safety

```typescript
// WRONG: Stale closure
const handleClick = () => {
  setCount(count + 1);  // ❌ Uses stale count
};

// RIGHT: Functional update
const handleClick = () => {
  setCount(prev => prev + 1);  // ✅ Uses latest value
};
```

### 9.3 API Call Safety

```typescript
// WRONG: No cancellation
useEffect(() => {
  fetchData().then(setData);  // ❌ May set state on unmounted component
}, []);

// RIGHT: With cleanup
useEffect(() => {
  const controller = new AbortController();
  fetchData({ signal: controller.signal })
    .then(setData)
    .catch(err => {
      if (err.name !== 'AbortError') throw err;
    });
  return () => controller.abort();  // ✅ Cleanup
}, []);
```

---

## 10. Post-Fix Monitoring

### 10.1 Verification Period

| Severity | Monitoring Period | Metrics to Watch |
|----------|-------------------|------------------|
| Critical | 7 days | Error rates, user reports, data integrity |
| High | 3 days | Error rates, related functionality |
| Medium | 1 day | Automated test results |
| Low | CI/CD pipeline | Test pass/fail |

### 10.2 Signals to Watch

- Error rate changes (increase = potential regression)
- Performance degradation (latency, throughput)
- User behavior changes (drop-offs, complaints)
- Database anomalies (constraint violations, deadlocks)

### 10.3 Incident Documentation

For significant bugs (P0/P1), add to `AGENTS.md` incident log:

```markdown
- YYYY-MM-DD: [Brief description]. Root cause: [explanation].
  Fix: [what was done]. Prevention: [how to avoid in future].
```

---

## 11. Anti-Patterns

### 11.1 Investigation Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Approach |
|--------------|--------------|-----------------|
| **Guessing at the cause** | Leads to wrong fixes | Reproduce and trace first |
| **Fixing the symptom** | Bug will recur differently | Find and fix root cause |
| **Adding defensive code everywhere** | Masks real issues, adds complexity | Fix the source of bad data |
| **Blaming the user** | Ignores UX issues | Understand user's mental model |

### 11.2 Fix Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Approach |
|--------------|--------------|-----------------|
| **Refactoring while fixing** | Introduces risk, obscures the fix | Separate PRs |
| **Silent error swallowing** | Hides failures, causes data corruption | Log and handle explicitly |
| **Copy-paste fix** | Creates duplication, spreads bugs | Extract and reuse |
| **Magic constants** | Hard to understand and maintain | Use named constants |
| **Catch-all exception handler** | Hides specific errors | Catch specific exceptions |

### 11.3 Testing Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Approach |
|--------------|--------------|-----------------|
| **Testing the fix, not the bug** | Doesn't prevent regression | Test the original bug condition |
| **Skipping edge cases** | Bug may recur at boundaries | Test boundaries explicitly |
| **Mocking too much** | Test doesn't reflect reality | Integration test critical paths |

---

## 12. Checklists

### 12.1 Pre-Investigation Checklist

- [ ] Bug report has clear reproduction steps
- [ ] Bug has been reproduced locally
- [ ] Severity and impact have been assessed
- [ ] Recent changes reviewed for potential regression source

### 12.2 Pre-Fix Checklist

- [ ] Root cause documented
- [ ] Fix approach reviewed
- [ ] Risk assessment completed
- [ ] Rollback plan documented
- [ ] Test plan documented

### 12.3 Pre-Commit Checklist

- [ ] Fix is minimal and focused
- [ ] All tests pass locally
- [ ] Regression test added
- [ ] Linting passes (`npm run lint`, `ruff check .`)
- [ ] Type checking passes (`npm run typecheck`, `mypy .`)
- [ ] No unrelated changes included

### 12.4 Pre-Merge Checklist

- [ ] PR reviewed and approved
- [ ] CI pipeline green
- [ ] Documentation updated (if behavior changed)
- [ ] Monitoring plan in place (for critical bugs)
- [ ] Rollback plan verified

### 12.5 Post-Merge Checklist

- [ ] Deployed to staging and verified
- [ ] Deployed to production (if applicable)
- [ ] Monitoring verified for configured period
- [ ] Incident log updated (for significant bugs)
- [ ] Related backlog items updated

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                     BUG FIX DECISION TREE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Can you reproduce the bug?                                  │
│     NO  → Get more information, do not proceed                  │
│     YES → Continue                                              │
│                                                                 │
│  2. Do you understand the root cause?                           │
│     NO  → Investigate more, do not write fix yet                │
│     YES → Continue                                              │
│                                                                 │
│  3. Is your fix minimal and focused?                            │
│     NO  → Reduce scope, separate unrelated changes              │
│     YES → Continue                                              │
│                                                                 │
│  4. Have you considered side effects?                           │
│     NO  → Complete contingency analysis                         │
│     YES → Continue                                              │
│                                                                 │
│  5. Do you have a regression test?                              │
│     NO  → Write test first                                      │
│     YES → Continue                                              │
│                                                                 │
│  6. Does CI pass?                                               │
│     NO  → Fix failures before merging                           │
│     YES → Ready to merge                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Related Documents

- [AGENTS.md](../AGENTS.md) - Development best practices and incident log
- [Bug Finder Agent](agents/bug-finder.md) - Agent-specific bug finding runbook
- [BUG_REGISTRY.md](BUG_REGISTRY.md) - Catalog of known bugs and their status
- [REPO_REVIEW.md](../REPO_REVIEW.md) - Architecture review and known risks
- [BACKLOG.md](../BACKLOG.md) - Prioritized work items

---

_Last updated: 2026-01-20_
