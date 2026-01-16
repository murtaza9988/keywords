export type BacklogPriority = 'P0' | 'P1' | 'P2';
export type BacklogStatus = 'Proposed' | 'Planned' | 'In discovery';

export interface BacklogItem {
  id: number;
  category:
    | 'CSV Processing'
    | 'Normalization'
    | 'Activity Logs'
    | 'Security/Auth'
    | 'Reliability'
    | 'Performance'
    | 'UX/Workflow';
  priority: BacklogPriority;
  area: 'Backend' | 'Frontend' | 'Full stack' | 'Infra/Docs';
  type:
    | 'Security'
    | 'Reliability'
    | 'Data quality'
    | 'Performance'
    | 'UX'
    | 'Product'
    | 'Ops';
  name: string;
  status: BacklogStatus;
  impact: number; // 1–10
  complexity: number; // 1–10
  problemStatement: string;
  definitionOfDone: string;
  scope: { type: string; why: string };
  impactedAreas: string[];
  dependencies: string[];
  risks: string[];
}

export const backlogItems: BacklogItem[] = [
  {
    id: 1,
    category: 'CSV Processing',
    priority: 'P0',
    area: 'Full stack',
    type: 'UX',
    name: 'Upload stages in UI (uploading/combining/queued/processing/complete/error)',
    status: 'Planned',
    impact: 9,
    complexity: 5,
    problemStatement:
      'Users don\'t get clear, trustworthy feedback during multi-step uploads and long-running processing, causing confusion and duplicate submissions.',
    definitionOfDone:
      'UI always shows canonical stage labels, distinguishes upload completion (queued) from processing completion, and surfaces actionable errors.',
    scope: {
      type: 'Full stack',
      why: 'Requires stable backend stage taxonomy and frontend progress UI that survives refresh.',
    },
    impactedAreas: ['backend processing status API', 'frontend upload/progress UI', 'error/retry UX'],
    dependencies: ['Canonical stage taxonomy finalized', 'Status endpoint returns all required fields'],
    risks: ['State mismatch on refresh', 'UI regressions during uploads'],
  },
  {
    id: 2,
    category: 'CSV Processing',
    priority: 'P1',
    area: 'Full stack',
    type: 'UX',
    name: 'Upload notification staging (queued → processing → completed/failed)',
    status: 'Planned',
    impact: 7,
    complexity: 4,
    problemStatement:
      'Large uploads provide weak feedback, leading to uncertainty and repeat uploads.',
    definitionOfDone:
      'Notifications show staged events with timestamps, debounce rules, and clear retry paths.',
    scope: {
      type: 'Full stack',
      why: 'Requires backend event emission and frontend toast/notification rendering.',
    },
    impactedAreas: ['upload flow', 'notifications/toasts', 'processing status polling'],
    dependencies: ['Queue event taxonomy finalized', 'Notification design tokens'],
    risks: ['Notification spam without debounce', 'Missed events on refresh'],
  },
  {
    id: 3,
    category: 'CSV Processing',
    priority: 'P0',
    area: 'Backend',
    type: 'Reliability',
    name: 'CSV Processing v2: DB-backed durable job queue (csv_processing_jobs)',
    status: 'Proposed',
    impact: 10,
    complexity: 8,
    problemStatement:
      'Current processing kickoff/state mechanisms are not sufficient under concurrency, restarts, or multi-worker deployments; uploaded work can be lost.',
    definitionOfDone:
      'Each uploaded CSV produces a durable DB job that transitions queued/running/succeeded/failed and is never lost on restart.',
    scope: {
      type: 'Back-end',
      why: 'Requires new DB model + service layer and changes to upload pipeline to enqueue jobs.',
    },
    impactedAreas: ['backend models', 'processing services', 'upload routes'],
    dependencies: ['Alembic migration for new tables', 'Job idempotency key strategy'],
    risks: ['Migration complexity', 'Race conditions if job claiming is not transactional'],
  },
  {
    id: 4,
    category: 'CSV Processing',
    priority: 'P0',
    area: 'Backend',
    type: 'Reliability',
    name: 'CSV Processing v2: DB-backed per-project lease (project_processing_leases)',
    status: 'Proposed',
    impact: 9,
    complexity: 7,
    problemStatement:
      'Multiple runners can process the same project concurrently, producing nondeterministic outcomes.',
    definitionOfDone:
      'At most one active runner exists per project across workers; lease has renewal + expiry recovery.',
    scope: {
      type: 'Back-end',
      why: 'Requires atomic lease acquisition and runner coordination.',
    },
    impactedAreas: ['processing runner', 'DB lease table', 'status/lock checks'],
    dependencies: ['Durable jobs table exists', 'Lease TTL/heartbeat policy'],
    risks: ['Lease stuck/expired edge cases', 'Clock skew if timestamps mishandled'],
  },
  {
    id: 5,
    category: 'CSV Processing',
    priority: 'P0',
    area: 'Backend',
    type: 'Reliability',
    name: 'CSV Processing v2: idempotent imports (exactly-once effect)',
    status: 'Proposed',
    impact: 10,
    complexity: 9,
    problemStatement:
      'Retries/crashes can cause double-inserts or inconsistent counts without strong DB guarantees.',
    definitionOfDone:
      'Jobs may run more than once, but final DB state reflects each keyword imported once.',
    scope: {
      type: 'Back-end',
      why: 'Requires database-level idempotency/constraints and safe upsert patterns.',
    },
    impactedAreas: ['keyword ingestion', 'DB constraints/indexes', 'runner retry handling'],
    dependencies: ['Idempotency key defined', 'Ingestion code supports upserts/dedup'],
    risks: ['Performance regressions if constraints are wrong', 'Hard-to-debug partial failures'],
  },
  {
    id: 6,
    category: 'CSV Processing',
    priority: 'P0',
    area: 'Backend',
    type: 'Reliability',
    name: 'CSV Processing v2: deterministic grouping after all jobs finish',
    status: 'Proposed',
    impact: 9,
    complexity: 7,
    problemStatement:
      'Grouping can run while uploads are still being processed, producing timing-dependent results.',
    definitionOfDone:
      'Grouping executes once after the project job queue drains and produces deterministic output.',
    scope: {
      type: 'Back-end',
      why: 'Requires runner orchestration and grouping pass scheduling.',
    },
    impactedAreas: ['processing runner', 'grouping service', 'project lock rules'],
    dependencies: ['Durable queue + lease in place'],
    risks: ['Long-running final grouping pass', 'User confusion if grouping appears delayed'],
  },
  {
    id: 7,
    category: 'CSV Processing',
    priority: 'P0',
    area: 'Full stack',
    type: 'Reliability',
    name: 'CSV Processing v2: lock grouping mutations during active processing (Policy A)',
    status: 'Proposed',
    impact: 8,
    complexity: 6,
    problemStatement:
      'User grouping/token actions can conflict with background processing and get overridden by timing.',
    definitionOfDone:
      'UI remains viewable but disables grouping mutations; backend returns 409 for mutation endpoints while locked.',
    scope: {
      type: 'Full stack',
      why: 'Requires backend enforcement + frontend affordances and messaging.',
    },
    impactedAreas: ['grouping routes', 'token routes', 'frontend action buttons'],
    dependencies: ['Lock state exposed via status API'],
    risks: ['Blocking too much UX', 'Inconsistent lock detection'],
  },
  {
    id: 8,
    category: 'CSV Processing',
    priority: 'P1',
    area: 'Backend',
    type: 'Reliability',
    name: 'CSV Processing v2: explicit state transitions + recovery for stuck running jobs',
    status: 'Proposed',
    impact: 8,
    complexity: 6,
    problemStatement:
      'Ambiguous or implicit processing states lead to stuck jobs and unclear UI.',
    definitionOfDone:
      'Documented transition graph enforced in code; crash recovery resets or fails stuck jobs safely.',
    scope: {
      type: 'Back-end',
      why: 'Requires consistent state machine and recovery routines.',
    },
    impactedAreas: ['runner', 'job model', 'status API'],
    dependencies: ['Durable jobs + lease'],
    risks: ['Incorrect recovery could reprocess unexpectedly', 'Edge cases on partial imports'],
  },
  {
    id: 9,
    category: 'CSV Processing',
    priority: 'P0',
    area: 'Full stack',
    type: 'UX',
    name: 'Per-file progress visibility + actionable errors + retry failed files',
    status: 'Planned',
    impact: 9,
    complexity: 6,
    problemStatement:
      'Batch uploads need per-file clarity: what succeeded, what failed, and what to do next.',
    definitionOfDone:
      'Status view shows each file with stage + error details, and supports retrying failed file(s) without full reload.',
    scope: {
      type: 'Full stack',
      why: 'Backend must report per-file outcomes; frontend must render and provide retry controls.',
    },
    impactedAreas: ['processing status API', 'frontend Process tab', 'upload retry flow'],
    dependencies: ['Backend tracks per-file records (upload/job)'],
    risks: ['Partial retry semantics (avoid double-import)', 'Complex UI state'],
  },
  {
    id: 10,
    category: 'CSV Processing',
    priority: 'P2',
    area: 'Full stack',
    type: 'UX',
    name: 'Processing center (queue + history + logs per project)',
    status: 'Proposed',
    impact: 6,
    complexity: 6,
    problemStatement:
      'Users want a single place to see what\'s running, what ran, durations, and failures.',
    definitionOfDone:
      'A project page shows active queue, recent uploads/jobs, durations, row counts, warnings, and rerun actions.',
    scope: {
      type: 'Full stack',
      why: 'Requires backend history endpoints and a new frontend view.',
    },
    impactedAreas: ['backend job history endpoints', 'frontend project detail UI'],
    dependencies: ['Durable jobs model'],
    risks: ['Scope creep into observability', 'Large payloads without pagination'],
  },

  {
    id: 11,
    category: 'Normalization',
    priority: 'P1',
    area: 'Backend',
    type: 'Data quality',
    name: 'Compound normalization rules (deterministic, test-backed)',
    status: 'Planned',
    impact: 8,
    complexity: 7,
    problemStatement:
      'Compound keywords normalize inconsistently, causing duplicate clusters and unstable rollups.',
    definitionOfDone:
      'Compound normalization is deterministic, preserves semantic modifiers, and ships with regression tests.',
    scope: {
      type: 'Full stack',
      why: 'Backend normalization affects persisted tokens and frontend counts/rollups.',
    },
    impactedAreas: ['tokenization pipeline', 'grouping/clustering', 'keyword table aggregation'],
    dependencies: ['Rule set approval', 'Test fixtures from real projects'],
    risks: ['Cluster IDs change', 'User confusion if rollups shift'],
  },
  {
    id: 12,
    category: 'Normalization',
    priority: 'P1',
    area: 'Full stack',
    type: 'Data quality',
    name: 'Numeric normalization for volume & difficulty (parse/validate/store consistently)',
    status: 'In discovery',
    impact: 7,
    complexity: 7,
    problemStatement:
      'Volume/difficulty values can be mixed types and formats, breaking sorting and exports.',
    definitionOfDone:
      'All numeric values are stored consistently, validated, and formatted/sorted identically in the UI and exports.',
    scope: {
      type: 'Back-end + Front-end',
      why: 'Requires backend parsing + schema alignment and frontend formatting changes.',
    },
    impactedAreas: ['ingestion/validation', 'DB schema', 'frontend sorting/formatting'],
    dependencies: ['Migration plan', 'Legacy data cleanup strategy'],
    risks: ['Migration failures on invalid legacy data', 'Historical export diffs'],
  },
  {
    id: 13,
    category: 'Normalization',
    priority: 'P2',
    area: 'Infra/Docs',
    type: 'Ops',
    name: 'Document numeric tokenization behavior (currency stripping, suffix expansion)',
    status: 'Proposed',
    impact: 4,
    complexity: 2,
    problemStatement:
      'Tokenizer behavior is surprising without clear documentation, especially for numeric tokens.',
    definitionOfDone:
      'Docs list canonical examples and remain aligned with the tokenizer implementation.',
    scope: {
      type: 'Docs',
      why: 'Docs update only, but must be kept in sync with code changes.',
    },
    impactedAreas: ['docs', 'tokenization rules'],
    dependencies: ['Tokenizer rules finalized'],
    risks: ['Docs drift as tokenizer changes'],
  },
  {
    id: 14,
    category: 'Normalization',
    priority: 'P1',
    area: 'Backend',
    type: 'Ops',
    name: 'Token backfill guidance after tokenizer/compound changes (per project)',
    status: 'Proposed',
    impact: 6,
    complexity: 3,
    problemStatement:
      'After tokenizer changes, existing projects can become inconsistent without a backfill run.',
    definitionOfDone:
      'Backfill process is documented and easy to run, with dry-run and batch sizing guidance.',
    scope: {
      type: 'Back-end',
      why: 'Focus on operational guidance and safe script usage.',
    },
    impactedAreas: ['backfill scripts', 'docs/runbooks'],
    dependencies: ['Backfill script supports dry-run and reporting'],
    risks: ['Long runs on large projects'],
  },
  {
    id: 15,
    category: 'Normalization',
    priority: 'P1',
    area: 'Backend',
    type: 'Ops',
    name: 'Backfill + migration playbook (dry-run + verification reports + rollback)',
    status: 'Proposed',
    impact: 6,
    complexity: 4,
    problemStatement:
      'Data migrations/backfills are risky without repeatable steps and verification.',
    definitionOfDone:
      'A playbook exists with dry-run mode, verification queries, summary reports, and rollback steps.',
    scope: {
      type: 'Back-end',
      why: 'Operational tooling and documentation around schema/token changes.',
    },
    impactedAreas: ['scripts', 'docs', 'ops runbook'],
    dependencies: ['Schema changes finalized'],
    risks: ['Unexpected drift across environments'],
  },

  {
    id: 16,
    category: 'Activity Logs',
    priority: 'P1',
    area: 'Backend',
    type: 'Product',
    name: 'Backend: GET /api/logs with filters + pagination',
    status: 'Proposed',
    impact: 7,
    complexity: 5,
    problemStatement:
      'Logs UI can\'t load data reliably without a stable list endpoint.',
    definitionOfDone:
      'GET /api/logs returns paginated, filterable logs with camelCased keys and auth enforced.',
    scope: {
      type: 'Back-end',
      why: 'Requires route + service + schema alignment and pagination.',
    },
    impactedAreas: ['routes', 'services', 'schemas'],
    dependencies: ['ActivityLog model exists', 'Auth dependency applied'],
    risks: ['Endpoint mismatch with frontend base URL', 'Large tables without indexes'],
  },
  {
    id: 17,
    category: 'Activity Logs',
    priority: 'P1',
    area: 'Backend',
    type: 'Product',
    name: 'Backend: GET /api/projects/{projectId}/logs endpoint',
    status: 'Proposed',
    impact: 6,
    complexity: 4,
    problemStatement:
      'Project detail needs a project-scoped logs endpoint to avoid client-side filtering overhead.',
    definitionOfDone:
      'GET /api/projects/{projectId}/logs returns project logs with pagination and auth.',
    scope: {
      type: 'Back-end',
      why: 'Requires routing and a query path optimized for project filter.',
    },
    impactedAreas: ['routes', 'services'],
    dependencies: ['GET /api/logs contract agreed'],
    risks: ['Duplication if both endpoints diverge'],
  },
  {
    id: 18,
    category: 'Activity Logs',
    priority: 'P1',
    area: 'Backend',
    type: 'Product',
    name: 'Emit logs for all project-level actions (projects, notes, keywords, tokens, uploads)',
    status: 'Proposed',
    impact: 7,
    complexity: 6,
    problemStatement:
      'Even with endpoints, logs are incomplete if actions don\'t emit entries consistently.',
    definitionOfDone:
      'All project-level mutations write exactly one log entry with stable action taxonomy.',
    scope: {
      type: 'Back-end',
      why: 'Requires adding log calls across routes/services and ensuring taxonomy parity with UI.',
    },
    impactedAreas: ['projects routes', 'notes routes', 'keyword routes', 'token routes', 'upload routes'],
    dependencies: ['Action taxonomy defined', 'Auth user identity available'],
    risks: ['Missing/duplicate logs', 'PII leakage in details'],
  },
  {
    id: 19,
    category: 'Activity Logs',
    priority: 'P1',
    area: 'Frontend',
    type: 'UX',
    name: 'Frontend: Logs tab renders + supports filters + polling refresh',
    status: 'Proposed',
    impact: 6,
    complexity: 5,
    problemStatement:
      'Users need near-real-time visibility into project actions for debugging and auditing.',
    definitionOfDone:
      'Logs UI shows loading/empty/error states, filters, and refreshes via polling while visible.',
    scope: {
      type: 'Front-end',
      why: 'Requires API client integration, filters UI, and polling strategy.',
    },
    impactedAreas: ['logs page', 'api client', 'auth handling'],
    dependencies: ['Backend endpoints available and stable'],
    risks: ['Over-polling load', 'Endpoint base URL mismatch'],
  },
  {
    id: 20,
    category: 'Activity Logs',
    priority: 'P2',
    area: 'Full stack',
    type: 'Product',
    name: 'Real-time logs via SSE/WebSocket (optional upgrade)',
    status: 'Proposed',
    impact: 5,
    complexity: 7,
    problemStatement:
      'Polling can be stale and wasteful at scale; real-time streaming may be needed later.',
    definitionOfDone:
      'Logs update via SSE/WebSocket with auth, reconnection, and fallback to polling.',
    scope: {
      type: 'Full stack',
      why: 'Requires backend streaming endpoint and frontend subscription handling.',
    },
    impactedAreas: ['backend infra', 'frontend logs UI'],
    dependencies: ['Base logs endpoints complete'],
    risks: ['Infra complexity', 'Auth + deployment pitfalls'],
  },

  {
    id: 21,
    category: 'Security/Auth',
    priority: 'P0',
    area: 'Backend',
    type: 'Security',
    name: 'Replace hardcoded auth with real user accounts (DB-backed, hashed passwords)',
    status: 'Proposed',
    impact: 10,
    complexity: 8,
    problemStatement:
      'Hardcoded credentials are a production blocker and prevent multi-user support.',
    definitionOfDone:
      'Users are stored in DB, passwords hashed, login works with JWT, and protected routes enforce auth.',
    scope: {
      type: 'Back-end',
      why: 'Requires user model, migrations, auth service changes, and potential UI tweaks.',
    },
    impactedAreas: ['auth routes', 'security utils', 'DB models', 'docs/.env guidance'],
    dependencies: ['Migration strategy', 'Admin bootstrap story'],
    risks: ['Breaking existing deployments', 'Credential reset flows'],
  },
  {
    id: 22,
    category: 'Security/Auth',
    priority: 'P2',
    area: 'Full stack',
    type: 'Security',
    name: 'RBAC / roles (admin vs member) for sensitive actions',
    status: 'Proposed',
    impact: 6,
    complexity: 6,
    problemStatement:
      'Once multi-user exists, we need role boundaries to prevent accidental destructive actions.',
    definitionOfDone:
      'Role-aware authorization is enforced server-side and reflected in UI affordances.',
    scope: {
      type: 'Full stack',
      why: 'Requires roles in user model + authorization checks + UI gating.',
    },
    impactedAreas: ['auth/claims', 'protected routes', 'frontend UI controls'],
    dependencies: ['Real users feature'],
    risks: ['Complex policy design', 'Backwards compatibility'],
  },

  {
    id: 23,
    category: 'Reliability',
    priority: 'P0',
    area: 'Backend',
    type: 'Reliability',
    name: 'Fix background tasks to not use request-scoped DB sessions',
    status: 'Proposed',
    impact: 8,
    complexity: 5,
    problemStatement:
      'Background tasks may receive DB sessions that are closed after the request ends, causing silent failures.',
    definitionOfDone:
      'Background work creates its own DB session or runs through a proper worker/task pattern.',
    scope: {
      type: 'Back-end',
      why: 'Requires refactor of background task kickoff paths.',
    },
    impactedAreas: ['projects delete flow', 'background tasks'],
    dependencies: ['Agreed pattern for background work'],
    risks: ['Hard-to-reproduce race conditions'],
  },
  {
    id: 24,
    category: 'Reliability',
    priority: 'P0',
    area: 'Infra/Docs',
    type: 'Reliability',
    name: 'Fail fast / enforce Postgres where JSONB is required',
    status: 'Proposed',
    impact: 8,
    complexity: 4,
    problemStatement:
      'DB engine mismatches cause runtime failures due to Postgres-specific JSONB behavior.',
    definitionOfDone:
      'App rejects unsupported DB URLs in non-test env and docs clearly require Postgres.',
    scope: {
      type: 'Infra/Docs',
      why: 'Requires startup validation + doc updates.',
    },
    impactedAreas: ['backend config/startup', 'docs'],
    dependencies: ['Decide supported dev DB story'],
    risks: ['Blocking local dev if envs vary'],
  },
  {
    id: 25,
    category: 'Reliability',
    priority: 'P1',
    area: 'Backend',
    type: 'Reliability',
    name: 'Fix /keywords-for-cache endpoint to return actual keyword data',
    status: 'Proposed',
    impact: 6,
    complexity: 3,
    problemStatement:
      'Endpoint appears to omit data it\'s supposed to return, making caching ineffective.',
    definitionOfDone:
      'Endpoint returns keyword payload consistently and is used by frontend caching logic.',
    scope: {
      type: 'Back-end',
      why: 'Requires route response correction and potential frontend integration check.',
    },
    impactedAreas: ['keyword routes', 'frontend caching'],
    dependencies: ['Confirm intended consumer behavior'],
    risks: ['Breaking clients if shape changes'],
  },
  {
    id: 26,
    category: 'Reliability',
    priority: 'P1',
    area: 'Backend',
    type: 'Reliability',
    name: 'Fix is_parent being forced true in filtered keyword results',
    status: 'Proposed',
    impact: 6,
    complexity: 4,
    problemStatement:
      'Filtered keyword results can mislabel children as parents, breaking UI state and actions.',
    definitionOfDone:
      'Keyword responses reflect true parent/child status under all filters.',
    scope: {
      type: 'Back-end',
      why: 'Requires correcting response mapping logic in keyword fetch paths.',
    },
    impactedAreas: ['keyword list endpoint', 'frontend row rendering'],
    dependencies: ['Test cases for filtered views'],
    risks: ['Subtle regressions in grouping views'],
  },
  {
    id: 27,
    category: 'Reliability',
    priority: 'P1',
    area: 'Backend',
    type: 'Reliability',
    name: 'Fix grouping difficulty aggregation to account for children correctly',
    status: 'Proposed',
    impact: 6,
    complexity: 6,
    problemStatement:
      'Difficulty summaries can drift because aggregation ignores existing children when adding to groups.',
    definitionOfDone:
      'Group difficulty is computed from all members consistently and remains stable after repeated operations.',
    scope: {
      type: 'Back-end',
      why: 'Requires adjusting grouping math and adding regression tests.',
    },
    impactedAreas: ['grouping endpoints', 'keyword stats'],
    dependencies: ['Define desired aggregation semantics'],
    risks: ['Visible changes to metrics in existing groups'],
  },
  {
    id: 28,
    category: 'Reliability',
    priority: 'P1',
    area: 'Backend',
    type: 'Reliability',
    name: 'Fix regrouping zeroing volume/difficulty when groups have no children',
    status: 'Proposed',
    impact: 6,
    complexity: 6,
    problemStatement:
      'Regrouping can write 0 volume/difficulty if only parents are moved or group has no children.',
    definitionOfDone:
      'Regrouping preserves/derives metrics correctly for edge cases (no children, parent-only moves).',
    scope: {
      type: 'Back-end',
      why: 'Requires edge-case handling and tests.',
    },
    impactedAreas: ['regrouping endpoint', 'keyword stats'],
    dependencies: ['Clarify desired behavior for parent-only regroup'],
    risks: ['Metric changes for some groups'],
  },
  {
    id: 29,
    category: 'Reliability',
    priority: 'P1',
    area: 'Backend',
    type: 'Reliability',
    name: 'Preserve blocked status for non-English keywords during import',
    status: 'Proposed',
    impact: 5,
    complexity: 5,
    problemStatement:
      'Import logic can override blocked status and allow non-English keywords into grouping.',
    definitionOfDone:
      'Non-English keywords remain blocked per policy throughout import and subsequent grouping passes.',
    scope: {
      type: 'Back-end',
      why: 'Requires import pipeline to respect the block decision consistently.',
    },
    impactedAreas: ['keyword processing', 'import route'],
    dependencies: ['Language detection policy'],
    risks: ['Behavior change may surprise existing users'],
  },

  {
    id: 30,
    category: 'Performance',
    priority: 'P1',
    area: 'Backend',
    type: 'Performance',
    name: 'Move in-memory keyword filtering (include/exclude/serp) into SQL where feasible',
    status: 'Proposed',
    impact: 8,
    complexity: 6,
    problemStatement:
      'Some filters force large fetches and Python-side filtering, which won\'t scale.',
    definitionOfDone:
      'Heavy filters are expressed in SQL with appropriate indexes; performance improves on large projects.',
    scope: {
      type: 'Back-end',
      why: 'Requires query refactors and indexing.',
    },
    impactedAreas: ['keyword query endpoints', 'DB indexing'],
    dependencies: ['Filter semantics clarified'],
    risks: ['Behavior drift between SQL and in-memory filtering'],
  },
  {
    id: 31,
    category: 'Performance',
    priority: 'P2',
    area: 'Backend',
    type: 'Performance',
    name: 'Full-text search / trigram indexing for keywords/tokens',
    status: 'Proposed',
    impact: 7,
    complexity: 7,
    problemStatement:
      'Search needs to remain fast as datasets grow.',
    definitionOfDone:
      'Search endpoints use Postgres FTS/trigram indexes and stay fast under large datasets.',
    scope: {
      type: 'Back-end',
      why: 'Requires Postgres extensions/indexes and query changes.',
    },
    impactedAreas: ['keyword search', 'token search', 'DB indexes/extensions'],
    dependencies: ['Postgres-only enforcement'],
    risks: ['Migration complexity', 'Index bloat'],
  },
  {
    id: 32,
    category: 'Performance',
    priority: 'P2',
    area: 'Backend',
    type: 'Performance',
    name: 'Avoid NLTK downloads at module import time (move to setup or lazy load)',
    status: 'Proposed',
    impact: 5,
    complexity: 3,
    problemStatement:
      'Downloading datasets at import time can slow startup or block worker spawn.',
    definitionOfDone:
      'NLTK downloads happen in setup path only; app start does not download at import time.',
    scope: {
      type: 'Back-end',
      why: 'Requires refactor of processing module imports.',
    },
    impactedAreas: ['processing module', 'startup performance'],
    dependencies: ['Setup script path available'],
    risks: ['Runtime errors if datasets missing'],
  },
  {
    id: 33,
    category: 'Performance',
    priority: 'P2',
    area: 'Backend',
    type: 'Performance',
    name: 'Make chunk upload throttling configurable or remove when safe',
    status: 'Proposed',
    impact: 4,
    complexity: 2,
    problemStatement:
      'Per-chunk sleeps can slow large uploads unnecessarily.',
    definitionOfDone:
      'Throttle is configurable and default behavior is documented; uploads remain stable under load.',
    scope: {
      type: 'Back-end',
      why: 'Small config change and guardrails.',
    },
    impactedAreas: ['upload route'],
    dependencies: ['Backpressure strategy agreed'],
    risks: ['DoS risk if removed without safeguards'],
  },
  {
    id: 34,
    category: 'Performance',
    priority: 'P2',
    area: 'Backend',
    type: 'Performance',
    name: 'Avoid repeated temporary index creation per ingestion (make permanent or guard)',
    status: 'Proposed',
    impact: 5,
    complexity: 3,
    problemStatement:
      'Repeated index creation can add overhead and cause lock contention.',
    definitionOfDone:
      'Index behavior is deterministic (permanent or created once) and ingestion avoids repeated work.',
    scope: {
      type: 'Back-end',
      why: 'Requires schema/index strategy and ingestion refactor.',
    },
    impactedAreas: ['ingestion pipeline', 'DB indexes'],
    dependencies: ['Index strategy decided'],
    risks: ['Migration timing/locking'],
  },
  {
    id: 35,
    category: 'Performance',
    priority: 'P2',
    area: 'Frontend',
    type: 'UX',
    name: 'Virtualize large keyword lists (react-virtuoso) + interaction polish',
    status: 'Proposed',
    impact: 6,
    complexity: 3,
    problemStatement:
      'Large keyword lists become sluggish and hurt usability.',
    definitionOfDone:
      'Lists over ~50 rows are virtualized; scrolling and selection remain smooth.',
    scope: {
      type: 'Front-end',
      why: 'Requires table rendering changes and careful row measurement.',
    },
    impactedAreas: ['keyword table', 'selection UX'],
    dependencies: ['UI patterns for virtualization'],
    risks: ['Row height issues', 'Selection bugs with virtualization'],
  },

  {
    id: 36,
    category: 'UX/Workflow',
    priority: 'P1',
    area: 'Frontend',
    type: 'UX',
    name: 'Saved filters/views per project',
    status: 'Proposed',
    impact: 7,
    complexity: 4,
    problemStatement:
      'Users repeatedly recreate the same filters/sorts, wasting time.',
    definitionOfDone:
      'Users can save, rename, delete, and apply views that restore table state reliably.',
    scope: {
      type: 'Full stack',
      why: 'Needs persistence per project/user plus UI for managing views.',
    },
    impactedAreas: ['frontend filters UI', 'backend persistence', 'project state'],
    dependencies: ['User story (single-user vs multi-user)'],
    risks: ['State drift between saved view and UI capabilities'],
  },
  {
    id: 37,
    category: 'UX/Workflow',
    priority: 'P1',
    area: 'Full stack',
    type: 'UX',
    name: 'Export improvements (current view vs all, include group metadata)',
    status: 'Proposed',
    impact: 7,
    complexity: 5,
    problemStatement:
      'Exports often don\'t match what users see (grouping, filters, statuses), reducing trust.',
    definitionOfDone:
      'Exports can reflect current view (filters/sorts) or all keywords, including group/parent metadata.',
    scope: {
      type: 'Full stack',
      why: 'Requires backend export generation and frontend export UX options.',
    },
    impactedAreas: ['export logic', 'keyword query layer', 'frontend export UI'],
    dependencies: ['Decide synchronous vs background export'],
    risks: ['Timeouts on large exports', 'CSV formatting edge cases'],
  },
  {
    id: 38,
    category: 'UX/Workflow',
    priority: 'P2',
    area: 'Full stack',
    type: 'UX',
    name: 'Undo/redo for grouping/regrouping + audit trail',
    status: 'Proposed',
    impact: 8,
    complexity: 8,
    problemStatement:
      'Grouping mistakes are expensive; users need safe experimentation and recovery.',
    definitionOfDone:
      'User can undo recent grouping/regrouping operations and audit what changed.',
    scope: {
      type: 'Full stack',
      why: 'Requires immutable operation history and rollback endpoints + UI.',
    },
    impactedAreas: ['grouping services', 'DB models for ops', 'frontend UX'],
    dependencies: ['Define operation model + retention'],
    risks: ['Data integrity bugs', 'Complex rollback semantics'],
  },
  {
    id: 39,
    category: 'UX/Workflow',
    priority: 'P2',
    area: 'Full stack',
    type: 'Product',
    name: 'Auto-group suggestions with confidence + “why” explanation',
    status: 'Proposed',
    impact: 7,
    complexity: 8,
    problemStatement:
      'Manual grouping doesn\'t scale; users need guidance to accelerate clustering.',
    definitionOfDone:
      'System suggests groups with confidence + explanation; users can accept/reject with minimal friction.',
    scope: {
      type: 'Full stack',
      why: 'Requires similarity/rules engine plus UI to review suggestions.',
    },
    impactedAreas: ['backend grouping logic', 'UI suggestions workflow'],
    dependencies: ['Rules/thresholds defined', 'Evaluation set for quality'],
    risks: ['Low trust if suggestions are noisy', 'Performance costs'],
  },
];
