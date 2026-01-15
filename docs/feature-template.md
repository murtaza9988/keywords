# Feature Template (First Principles, Assume Nothing)

> Use this template for **every** new feature, bugfix, or refactor. Fill every section. If a section is not applicable, explain why.

## 0) One-Sentence Mission
- **Mission:**

## 1) First Principles (Why are we doing this?)
- **User outcome:**
- **System outcome:**
- **Success metric(s):**

## 2) Scope
- **In scope:**
- **Out of scope:**
- **Dependencies:**

## 3) Existing System Summary
- **Current behavior:**
- **Pain points / failures:**
- **Relevant files:**

## 4) Requirements (Exhaustive)
### 4.1 Functional Requirements (Backend)
- [ ] Endpoints to add/update:
- [ ] Request/response schema:
- [ ] Auth/permissions:
- [ ] Error handling:
- [ ] Data validation:
- [ ] Logging/telemetry:

### 4.2 Functional Requirements (Frontend)
- [ ] UI states (loading/empty/error/success):
- [ ] Data fetching strategy:
- [ ] Sorting/filtering/search:
- [ ] Accessibility requirements:
- [ ] Real-time expectations:

### 4.3 Non-Functional Requirements
- [ ] Performance budgets:
- [ ] Reliability targets:
- [ ] Security constraints:
- [ ] Compatibility constraints:

## 5) Data & API Contracts
- **Models involved:**
- **Schema definitions (Pydantic/TS):**
- **Backward/forward compatibility:**
- **Migration needs:**

## 6) State & Invariants
- **Invariants:** (must always be true)
- **State transitions:**
- **Failure modes:**

## 7) UI/UX Details
- **Wireframe or description:**
- **Exact copy:**
- **Empty states:**
- **Error copy:**
- **Interaction details:**

## 8) Real-Time / Streaming (if applicable)
- **Polling vs SSE vs WebSocket:**
- **Update frequency / latency:**
- **De-duplication strategy:**
- **Offline handling:**

## 9) Security & Privacy
- **Auth strategy:**
- **PII / sensitive data handling:**
- **Audit requirements:**

## 10) Testing Plan (Required)
### Backend
- [ ] Unit tests:
- [ ] Integration tests:
- [ ] Auth tests:

### Frontend
- [ ] Component tests:
- [ ] E2E checks (if applicable):
- [ ] Visual regression (if applicable):

## 11) Performance & Load
- **Expected request volume:**
- **Pagination/caching strategy:**
- **Timeout/retry strategy:**

## 12) Rollout Plan
- **Feature flags:**
- **Migration steps:**
- **Rollback plan:**

## 13) Monitoring & Observability
- **Logs:**
- **Metrics:**
- **Alerts:**

## 14) Risks & Mitigations
- **Risks:**
- **Mitigations:**

## 15) Open Questions
- **List every unanswered question:**

## 16) Definition of Done
- [ ] Requirements implemented
- [ ] Tests passing
- [ ] Lint/typecheck passing
- [ ] Docs updated

---

## Reviewer Checklist (Must be answered)
- [ ] API contract confirmed across backend + frontend
- [ ] Error states fully specified
- [ ] Real-time expectations clear
- [ ] Data model and migrations accounted for
- [ ] Auth and permissions reviewed
- [ ] Invariants explicitly stated
- [ ] Docs and tests updated
