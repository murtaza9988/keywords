# Documentation Index

> **Central navigation for all project documentation.**
> Start here to find the right document for your task.

---

## Start Here

| Your Task | Start With |
|-----------|------------|
| **Any work** | [CLAUDE.md](../CLAUDE.md) → [AGENTS.md](../AGENTS.md) |
| **Bug fix** | → [BUG_HANDLING_PLAYBOOK.md](BUG_HANDLING_PLAYBOOK.md) → [BUG_REGISTRY.md](BUG_REGISTRY.md) |
| **New feature** | → [AI_INSTRUCTION_INDEX.md](AI_INSTRUCTION_INDEX.md) → [feature-implementation.md](agents/feature-implementation.md) |
| **Refactoring** | → [AI_INSTRUCTION_INDEX.md](AI_INSTRUCTION_INDEX.md) → [refactor-steward.md](agents/refactor-steward.md) |
| **Security** | → [security-auditor.md](agents/security-auditor.md) → [SECURITY.md](../SECURITY.md) |
| **Testing** | → [test-harness-builder.md](agents/test-harness-builder.md) |
| **Database** | → [migration-gatekeeper.md](agents/migration-gatekeeper.md) |
| **API changes** | → [api-contract-auditor.md](agents/api-contract-auditor.md) |

---

## Document Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAUDE.md                                │
│                (Session rules - READ FIRST)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AGENTS.md                                │
│           (Coding standards, architecture, patterns)            │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ AI_INSTRUCTION  │  │  BUG_HANDLING   │  │  REPO_REVIEW    │
│    _INDEX.md    │  │   _PLAYBOOK.md  │  │      .md        │
│ (Task protocols)│  │ (Bug fix rules) │  │ (Architecture)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│  Agent Runbooks │  │  BUG_REGISTRY   │
│  (agents/*.md)  │  │      .md        │
│ (Task-specific) │  │ (Known bugs)    │
└─────────────────┘  └─────────────────┘
```

---

## Core Documents

### Configuration & Standards

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [CLAUDE.md](../CLAUDE.md) | Claude Code session configuration | Every session |
| [AGENTS.md](../AGENTS.md) | Development best practices, coding standards | Every session |
| [SECURITY.md](../SECURITY.md) | Security policy and vulnerability reporting | Security work |

### Process & Protocols

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [AI_INSTRUCTION_INDEX.md](AI_INSTRUCTION_INDEX.md) | Master instruction reference by task type | Before any task |
| [BUG_HANDLING_PLAYBOOK.md](BUG_HANDLING_PLAYBOOK.md) | Complete bug fix methodology | Bug fixes |
| [BUG_REGISTRY.md](BUG_REGISTRY.md) | Catalog of known bugs with fixes | Bug fixes, reviews |

### Architecture & Planning

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [REPO_REVIEW.md](../REPO_REVIEW.md) | System architecture overview | Understanding codebase |
| [BACKLOG.md](../BACKLOG.md) | Prioritized work items | Planning work |

---

## Agent Runbooks

Detailed playbooks for specific task types. Located in `docs/agents/`.

### Primary Agents

| Agent | When to Use |
|-------|-------------|
| [bug-finder.md](agents/bug-finder.md) | Isolating and fixing bugs |
| [feature-implementation.md](agents/feature-implementation.md) | Building new features end-to-end |
| [refactor-steward.md](agents/refactor-steward.md) | Restructuring code without behavior changes |
| [security-auditor.md](agents/security-auditor.md) | Security review and vulnerability assessment |
| [test-harness-builder.md](agents/test-harness-builder.md) | Adding and extending tests |

### Specialized Agents

| Agent | Focus Area |
|-------|------------|
| [api-contract-auditor.md](agents/api-contract-auditor.md) | API request/response shapes |
| [migration-gatekeeper.md](agents/migration-gatekeeper.md) | Database migrations |
| [performance-tuner.md](agents/performance-tuner.md) | Performance optimization |
| [processing-pipeline-steward.md](agents/processing-pipeline-steward.md) | CSV processing pipeline |
| [keyword-ux-curator.md](agents/keyword-ux-curator.md) | Keyword table UX |

### Support Agents

| Agent | Focus Area |
|-------|------------|
| [accessibility-auditor.md](agents/accessibility-auditor.md) | A11y compliance |
| [data-consistency-backfill-agent.md](agents/data-consistency-backfill-agent.md) | Data migration and backfills |
| [data-privacy-compliance-agent.md](agents/data-privacy-compliance-agent.md) | PII and privacy |
| [dependency-license-auditor.md](agents/dependency-license-auditor.md) | License compliance |
| [documentation-ux-copy-curator.md](agents/documentation-ux-copy-curator.md) | Documentation quality |
| [infra-ci-steward.md](agents/infra-ci-steward.md) | CI/CD pipeline |
| [localization-i18n-curator.md](agents/localization-i18n-curator.md) | Internationalization |
| [observability-logging-steward.md](agents/observability-logging-steward.md) | Logging and metrics |
| [processing-ui-sync.md](agents/processing-ui-sync.md) | Processing status UI |
| [queue-state-monitor.md](agents/queue-state-monitor.md) | Queue state tracking |
| [queue-state-referee.md](agents/queue-state-referee.md) | Queue invariants |
| [release-deployment-manager.md](agents/release-deployment-manager.md) | Release process |

See [agents/README.md](agents/README.md) for the complete index.

---

## Feature Documentation

| Document | Description |
|----------|-------------|
| [feature-template.md](feature-template.md) | Template for new feature specifications |
| [feature-project-logs.md](feature-project-logs.md) | Activity logging feature design |
| [feature-update-csv-processing-v2.md](feature-update-csv-processing-v2.md) | CSV processing v2 spec |
| [features-left.md](features-left.md) | Summary of remaining work |
| [refactoring-opportunities.md](refactoring-opportunities.md) | Code improvement candidates |

---

## Quick Reference

### Task Type → Documents

```
Bug Fix:
  1. CLAUDE.md (session rules)
  2. AGENTS.md (standards)
  3. BUG_HANDLING_PLAYBOOK.md (process)
  4. BUG_REGISTRY.md (check existing)
  5. agents/bug-finder.md (runbook)

Feature:
  1. CLAUDE.md (session rules)
  2. AGENTS.md (standards)
  3. AI_INSTRUCTION_INDEX.md (protocol)
  4. agents/feature-implementation.md (runbook)
  5. REPO_REVIEW.md (architecture)

Refactoring:
  1. CLAUDE.md (session rules)
  2. AGENTS.md (standards)
  3. AI_INSTRUCTION_INDEX.md (protocol)
  4. agents/refactor-steward.md (runbook)

Security:
  1. CLAUDE.md (session rules)
  2. SECURITY.md (policy)
  3. agents/security-auditor.md (runbook)
  4. BUG_REGISTRY.md (known issues)
```

### File Location → Document

| Looking for... | Go to... |
|----------------|----------|
| Coding standards | AGENTS.md |
| Known bugs | docs/BUG_REGISTRY.md |
| How to fix bugs | docs/BUG_HANDLING_PLAYBOOK.md |
| Task instructions | docs/AI_INSTRUCTION_INDEX.md |
| Architecture overview | REPO_REVIEW.md |
| Work items | BACKLOG.md |
| Agent playbooks | docs/agents/*.md |

---

## Document Maintenance

| Document | Update When |
|----------|-------------|
| CLAUDE.md | Session rules change |
| AGENTS.md | Standards or patterns change |
| BUG_REGISTRY.md | Bugs found or fixed |
| BUG_HANDLING_PLAYBOOK.md | Process improvements |
| AI_INSTRUCTION_INDEX.md | New task types or protocol changes |
| Agent runbooks | Process improvements |
| BACKLOG.md | Priorities change |

---

## Missing Something?

If you can't find what you need:

1. Check [AI_INSTRUCTION_INDEX.md](AI_INSTRUCTION_INDEX.md) for task-specific guidance
2. Search the `docs/agents/` folder for specialized runbooks
3. Review [AGENTS.md](../AGENTS.md) for general patterns
4. Check [REPO_REVIEW.md](../REPO_REVIEW.md) for architecture questions

---

_Last updated: 2026-01-20_
