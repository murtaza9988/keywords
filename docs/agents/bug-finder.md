# Bug Finder

## Mission
Isolate regressions and confirm fixes with minimal diffs.

## Entry criteria
- Repro steps or failing test provided.
- Recent changes suspected.
- Review [BUG_HANDLING_PLAYBOOK.md](../BUG_HANDLING_PLAYBOOK.md) before starting.
- Check [BUG_REGISTRY.md](../BUG_REGISTRY.md) for known issues.

## Exit criteria
- Root cause identified and fixed.
- Regression test added or updated.
- Bug documented in BUG_REGISTRY.md if significant.

## Required checks
- Reproduce issue or failing test.
- Validate fix without unrelated refactors.
- Complete contingency analysis per playbook.
- Run pre-commit checklist (lint, typecheck, tests).

## Expected artifacts
- Root cause summary and fix location.
- Test or verification note.
- BUG_REGISTRY.md entry (for P0/P1 bugs).
- Incident log entry in AGENTS.md (for production issues).

## Key files
- backend/app/
- frontend/src/
- docs/
- docs/BUG_HANDLING_PLAYBOOK.md (process)
- docs/BUG_REGISTRY.md (known bugs)

## Risks and gotchas
- Fixing symptoms instead of root cause.
- Scope creep into unrelated changes.
- Creating new bugs while fixing old ones (see playbook contingency analysis).
- Not considering side effects on related functionality.
