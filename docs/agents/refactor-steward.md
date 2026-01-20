# Refactor Steward

> **Mission:** Improve code structure without changing behavior or API contracts. Every refactoring must be behavior-preserving.

---

## Required Reading Before Starting

- [CLAUDE.md](../../CLAUDE.md) - Session rules
- [AGENTS.md](../../AGENTS.md) - Architecture patterns
- [AI_INSTRUCTION_INDEX.md](../AI_INSTRUCTION_INDEX.md) - Section 4
- [refactoring-opportunities.md](../refactoring-opportunities.md) - Known candidates

---

## Core Principle

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE GOLDEN RULE                              │
│                                                                 │
│   Refactoring = Same behavior, better structure                 │
│                                                                 │
│   If behavior changes, it's NOT refactoring.                    │
│   Stop and create a separate bug fix or feature.                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Entry Criteria

Before starting refactoring:

- [ ] Refactor goal clearly defined
- [ ] Current behavior documented/understood
- [ ] Tests exist covering the behavior (or add them first)
- [ ] All tests pass before starting
- [ ] No pending changes in the area
- [ ] Refactoring is approved/requested (not speculative)

---

## Exit Criteria

Refactoring is complete when:

- [ ] All existing tests pass
- [ ] No new tests needed (behavior unchanged)
- [ ] API contracts preserved exactly
- [ ] UI behavior unchanged
- [ ] Performance not degraded
- [ ] Code review approved

---

## Refactoring Protocol

### Phase 1: Preparation

```markdown
## Pre-Refactoring Checklist

### Document Current State
- [ ] List all public interfaces (functions, classes, types)
- [ ] Document expected inputs and outputs
- [ ] Note all callers of code being refactored
- [ ] Note all dependencies of code being refactored

### Verify Test Coverage
- [ ] Run existing tests - all must pass
- [ ] Identify gaps in test coverage
- [ ] ADD TESTS FOR GAPS BEFORE REFACTORING
- [ ] Tests should verify behavior, not implementation

### Create Safety Net
- [ ] Commit current state (checkpoint)
- [ ] Note the commit hash for rollback
- [ ] Verify you can run tests easily
```

### Phase 2: Planning

```markdown
## Refactoring Plan Template

### Goal
What structural improvement are we making?

### Scope
- Files to modify: [list]
- Files NOT to modify: [list]

### Steps
1. [Small, atomic step]
2. [Next step]
3. [Continue...]

### Verification
After each step:
- Run tests
- Verify behavior unchanged
- Commit if green

### Rollback
If anything breaks:
- `git checkout [checkpoint-hash]`
- Analyze what went wrong
- Try smaller steps
```

### Phase 3: Execution

```markdown
## Refactoring Execution Rules

### The Refactoring Cycle
1. Make ONE small change
2. Run tests immediately
3. If tests fail → revert and try smaller change
4. If tests pass → commit
5. Repeat

### Change Size
GOOD: Rename one function
GOOD: Extract one method
GOOD: Move one file
BAD: Rename + restructure + reorganize in one step

### Commit After Each Step
git commit -m "refactor: [what changed]"
# Examples:
# "refactor: rename getUserData to fetchUserProfile"
# "refactor: extract validation logic to validateInput()"
# "refactor: move helper functions to utils.ts"
```

### Phase 4: Verification

```markdown
## Post-Refactoring Verification

### Behavior Verification
- [ ] All tests pass
- [ ] Manual smoke test of affected features
- [ ] No new warnings or errors

### Contract Verification
- [ ] API endpoints return same shapes
- [ ] Function signatures compatible (or all callers updated)
- [ ] Types unchanged (or safely widened)

### Performance Verification
- [ ] No obvious performance regressions
- [ ] No new N+1 queries introduced
- [ ] No unnecessary re-renders (frontend)
```

---

## Allowed Refactoring Operations

### Naming

| Operation | Safe? | Notes |
|-----------|-------|-------|
| Rename local variable | ✅ | No external impact |
| Rename private method | ✅ | Internal only |
| Rename public function | ⚠️ | Update all callers |
| Rename exported type | ⚠️ | Update all imports |
| Rename file | ⚠️ | Update all imports |

### Extraction

| Operation | Safe? | Notes |
|-----------|-------|-------|
| Extract local variable | ✅ | Improves readability |
| Extract function | ✅ | If behavior preserved |
| Extract class | ⚠️ | May affect instantiation |
| Extract module | ⚠️ | Update all imports |

### Movement

| Operation | Safe? | Notes |
|-----------|-------|-------|
| Move code within file | ✅ | No import changes |
| Move function to new file | ⚠️ | Update imports |
| Move file to new directory | ⚠️ | Update all imports |

### Simplification

| Operation | Safe? | Notes |
|-----------|-------|-------|
| Remove dead code | ✅ | Verify truly unused |
| Inline variable | ✅ | If used once |
| Simplify conditional | ⚠️ | Verify logic equivalent |
| Remove duplication | ⚠️ | Extract carefully |

---

## Forbidden During Refactoring

```markdown
## NEVER DO THESE DURING REFACTORING

❌ Change behavior (even to fix bugs)
❌ Add new features
❌ Fix bugs you discover (create separate issue)
❌ Change API response shapes
❌ Change function signatures incompatibly
❌ Refactor without tests
❌ Make multiple unrelated changes in one commit
❌ Skip running tests between changes
❌ "Clean up" code you didn't plan to refactor
❌ Change code style/formatting in unrelated files
```

---

## Common Refactoring Patterns

### Extract Function

```python
# Before
def process_data(data):
    # 50 lines of code doing multiple things
    # validation
    # transformation
    # persistence

# After
def process_data(data):
    validated = validate_data(data)
    transformed = transform_data(validated)
    persist_data(transformed)

def validate_data(data):
    # validation logic

def transform_data(data):
    # transformation logic

def persist_data(data):
    # persistence logic
```

### Rename for Clarity

```typescript
// Before
const d = getData();
const r = process(d);

// After
const userData = fetchUserData();
const processedResult = processUserData(userData);
```

### Remove Duplication

```python
# Before
def create_user(data):
    if not data.get('email'):
        raise ValueError("Email required")
    if not data.get('name'):
        raise ValueError("Name required")
    # ... create user

def update_user(data):
    if not data.get('email'):
        raise ValueError("Email required")
    if not data.get('name'):
        raise ValueError("Name required")
    # ... update user

# After
def validate_user_data(data):
    if not data.get('email'):
        raise ValueError("Email required")
    if not data.get('name'):
        raise ValueError("Name required")

def create_user(data):
    validate_user_data(data)
    # ... create user

def update_user(data):
    validate_user_data(data)
    # ... update user
```

### Split Large File

```
# Before
keyword_routes.py (3000+ LOC)

# After
keyword_routes/
  __init__.py (re-exports for compatibility)
  crud.py (create, read, update, delete)
  grouping.py (group, regroup, ungroup)
  upload.py (CSV upload and processing)
  tokens.py (token management)
```

---

## Risks and Gotchas

| Risk | Mitigation |
|------|------------|
| Accidentally changing behavior | Run tests after EVERY change |
| Breaking imports | Use IDE refactoring tools when possible |
| Missing callers | Search for all usages before renaming |
| Performance regression | Benchmark before and after |
| Introducing bugs | Small steps, frequent commits |
| Scope creep | Stick to the plan, defer discoveries |

---

## Contingencies

### If Tests Start Failing

1. **STOP immediately**
2. Revert to last green commit
3. Analyze what went wrong
4. Try a smaller change
5. If still failing, the refactoring may not be safe

### If You Discover a Bug

1. **Do NOT fix it during refactoring**
2. Document the bug
3. Create a separate issue
4. Continue refactoring (or stop and fix bug separately)
5. Never mix bug fixes with refactoring

### If Scope Grows

1. Stop and reassess
2. Complete the current small refactoring
3. Commit and push
4. Plan additional refactoring as separate work

---

## Expected Artifacts

After completing refactoring:

```markdown
## Refactoring Report

### Goal
[What structural improvement was made]

### Changes
- Renamed X to Y
- Extracted function Z from A
- Moved file from path1 to path2

### Files Modified
- [list of files]

### Verification
- [x] All tests pass
- [x] Manual verification of affected features
- [x] No API changes
- [x] No behavior changes

### Follow-up
- [Any additional refactoring to consider]
- [Bugs discovered but not fixed]
```

---

## Key Files Reference

| Refactoring Target | Key Files |
|-------------------|-----------|
| Backend routes | `backend/app/routes/*.py` |
| Backend services | `backend/app/services/*.py` |
| Backend models | `backend/app/models/*.py` |
| Frontend components | `frontend/src/components/**/*.tsx` |
| Frontend pages | `frontend/src/app/**/*.tsx` |
| Shared types | `frontend/src/lib/types.ts` |
| API client | `frontend/src/lib/apiClient.ts` |

### Known Refactoring Candidates

See [refactoring-opportunities.md](../refactoring-opportunities.md) for pre-identified targets.

| Target | Reason | Priority |
|--------|--------|----------|
| `keyword_routes.py` | 3000+ LOC, should split | High |
| `apiClient.ts` | 1000+ LOC, could modularize | Medium |
| Duplicate validation | Multiple places validate same things | Medium |

---

_Last updated: 2026-01-20_
