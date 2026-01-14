# Backlog

Structured backlog for normalization and upload work.

## Compound normalization rules

- **Problem statement:** Compound keywords and multi-token phrases normalize inconsistently, causing duplicate clusters and unstable rollups when users compare grouped vs. ungrouped views.
- **Definition of done:** Compound normalization applies deterministic token ordering, preserves semantic modifiers, and ships with regression tests covering clustered keyword rollups and UI counts.
- **Scope:** **Full stack** — Requires backend normalization logic, persisted field updates, and front-end display consistency checks.
- **Impacted areas:**
  - backend keyword normalization pipeline
  - keyword grouping + cluster score modules
  - frontend keyword table aggregation logic
- **Dependencies:**
  - Normalization rules approved by SEO team
  - Test fixtures from sample projects
- **Risks:**
  - May change existing cluster IDs
  - Requires careful communication to avoid user confusion
- **Status:** Planned

## Numeric normalization for volume & difficulty

- **Problem statement:** Volume and difficulty values are inconsistent (string vs. number), leading to sorting inaccuracies and display drift across tables and exports.
- **Definition of done:** All numeric inputs are parsed, validated, and stored as numbers with consistent rounding rules; UI tables sort and format identically.
- **Scope:** **Back-end + Front-end** — Needs backend parsing + schema updates and frontend formatting/sorting updates.
- **Impacted areas:**
  - backend ingestion + validation layer
  - database schema numeric fields
  - frontend keyword/token table renderers
- **Dependencies:**
  - Schema migration plan
  - Updated export formatting requirements
- **Risks:**
  - Potential mismatch with historical exports
  - Migration errors if invalid legacy values exist
- **Status:** In discovery

## Upload notification staging

- **Problem statement:** Users do not receive clear feedback during large uploads, which causes double submissions and uncertainty around processing.
- **Definition of done:** Upload events emit staged notifications (queued → processing → completed/failed) with timestamps and clear retry paths.
- **Scope:** **Full stack** — Requires job queue hooks, API status endpoints, and UI notification rendering.
- **Impacted areas:**
  - backend upload job worker
  - notifications/event status API
  - frontend upload flow + toast/notification surface
- **Dependencies:**
  - Queue event taxonomy finalized
  - Notification design tokens
- **Risks:**
  - Notification spam if debounce rules are missing
  - State mismatch on refresh
- **Status:** Planned

## Backfill + migration playbook

- **Problem statement:** Normalization changes require a safe backfill and migration path; without a playbook, historical data consistency cannot be guaranteed.
- **Definition of done:** Documented, automated backfill steps exist with dry-run mode, verification reports, and rollback procedures.
- **Scope:** **Back-end** — Focuses on data migrations, backfill scripts, and operational checks.
- **Impacted areas:**
  - migration scripts
  - data verification reports
  - operations runbook
- **Dependencies:**
  - Normalized schema finalized
  - Access to staging data snapshots
- **Risks:**
  - Long-running migrations
  - Unexpected data drift across environments
- **Status:** Proposed

