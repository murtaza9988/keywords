# Documentation Index

> **Central navigation for all project documentation.**

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [AGENTS.md](../AGENTS.md) | Development best practices, coding standards, incident log |
| [BACKLOG.md](../BACKLOG.md) | Prioritized work items and feature requests |
| [REPO_REVIEW.md](../REPO_REVIEW.md) | Architecture overview and system design |

---

## Documentation by Category

### Bug Management

| Document | Description |
|----------|-------------|
| [BUG_HANDLING_PLAYBOOK.md](BUG_HANDLING_PLAYBOOK.md) | Comprehensive guide for identifying, fixing, and validating bugs. Includes first principles framework, checklists, and contingency analysis. |
| [BUG_REGISTRY.md](BUG_REGISTRY.md) | Catalog of all known bugs with root causes, suggested fixes, and priority levels. |

### Feature Development

| Document | Description |
|----------|-------------|
| [feature-template.md](feature-template.md) | Template for new feature specifications |
| [feature-project-logs.md](feature-project-logs.md) | Activity logging feature design |
| [feature-update-csv-processing-v2.md](feature-update-csv-processing-v2.md) | CSV processing v2 pipeline specification |
| [features-left.md](features-left.md) | Summary of remaining work |

### Technical Reference

| Document | Description |
|----------|-------------|
| [refactoring-opportunities.md](refactoring-opportunities.md) | Code improvement candidates and tech debt |
| [backlog.md](backlog.md) | Pointer to canonical backlog (../BACKLOG.md) |

### Agent Runbooks

See [agents/README.md](agents/README.md) for the complete index of agent playbooks.

Key agents for common tasks:

| Agent | When to Use |
|-------|-------------|
| [bug-finder.md](agents/bug-finder.md) | Isolating and fixing bugs |
| [feature-implementation.md](agents/feature-implementation.md) | Building new features |
| [security-auditor.md](agents/security-auditor.md) | Security review and auth coverage |
| [test-harness-builder.md](agents/test-harness-builder.md) | Adding/extending tests |
| [performance-tuner.md](agents/performance-tuner.md) | Optimizing hot paths |

---

## Document Relationships

```
                    ┌─────────────────┐
                    │   AGENTS.md     │ ◄── Start here for coding standards
                    │ (Best Practices)│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  REPO_REVIEW.md │  │   BACKLOG.md    │  │ docs/agents/*   │
│  (Architecture) │  │   (Work Items)  │  │  (Runbooks)     │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    docs/ (this folder)                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│ BUG_HANDLING_   │  BUG_REGISTRY   │  feature-*.md           │
│ PLAYBOOK.md     │  .md            │  (Feature specs)        │
│ (Process)       │  (Known bugs)   │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## How to Use This Documentation

### For Bug Fixes

1. Check [BUG_REGISTRY.md](BUG_REGISTRY.md) to see if the bug is already documented
2. Follow [BUG_HANDLING_PLAYBOOK.md](BUG_HANDLING_PLAYBOOK.md) for the fix process
3. Use [agents/bug-finder.md](agents/bug-finder.md) runbook for agent-specific guidance
4. Update BUG_REGISTRY.md and AGENTS.md incident log after fixing

### For New Features

1. Review [BACKLOG.md](../BACKLOG.md) to understand priority and scope
2. Use [feature-template.md](feature-template.md) to document the feature
3. Follow [agents/feature-implementation.md](agents/feature-implementation.md) runbook
4. Reference [REPO_REVIEW.md](../REPO_REVIEW.md) for architecture context

### For Code Reviews

1. Check [AGENTS.md](../AGENTS.md) for coding standards
2. Review [BUG_REGISTRY.md](BUG_REGISTRY.md) for known issue patterns
3. Use relevant agent runbooks for specialized review (security, performance, etc.)

---

## Maintenance

- **BUG_REGISTRY.md**: Update when bugs are discovered or fixed
- **AGENTS.md incident log**: Update after significant bugs are resolved
- **BACKLOG.md**: Update when priorities change or items complete
- **Feature docs**: Archive or mark complete when features ship

---

_Last updated: 2026-01-20_
