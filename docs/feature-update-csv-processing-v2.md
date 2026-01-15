# CSV Processing v2 — Durable, Deterministic, Multi-Upload Safe

**Repo:** `Vibe-coding-nvm-delete-repo/keywords`\
**Scope:** Backend + Frontend changes to guarantee correct processing of all uploaded CSV rows/keywords under all realistic user upload patterns (single file, batch, back-to-back uploads, retries), and to make grouping deterministic.

***

## 0) Executive Summary

The current CSV pipeline uses an in-process async kickoff (`create_task`) and a disk-persisted JSON state machine for progress. This is not sufficient to guarantee correctness under concurrent uploads, multi-worker deployments, restarts, or races between user grouping actions and background grouping.

**CSV Processing v2** introduces:

1. **DB-backed durable job queue** per uploaded CSV
2. **DB-backed per-project lease** ensuring only one runner executes per project at a time
3. **Idempotent import** at the database level (exactly-once effect)
4. **Deterministic grouping**: run grouping only **after all queued CSV jobs are finished**
5. **Policy A UI/Backend lock**: grouping remains viewable but non-interactive while processing is active; backend returns 409 on grouping mutations.

This ensures: If combined uploads contain 9,000 keywords/rows, the system processes all 9,000 (subject to filtering rules), no matter if uploaded simultaneously, sequentially, or with retries.

***

## 1) Current Problems (Observed + Risk Analysis)

### P1: Processing kickoff is not concurrency-safe

* The backend starts processing via background async tasks (fire-and-forget).
* Multiple requests can call kickoff concurrently, leading to **multiple processing tasks** for the same `project_id`.

**Symptoms:**

* Interleaved progress updates
* Wrong `current_file` / inconsistent status
* Two CSVs processed simultaneously even if intended sequentially

### P2: Progress/state persistence is not a correctness mechanism

* Current `processing_queue_service` persists state to disk (`processing_state/{project_id}.json`).
* Disk state is not an atomic lock, and it does not protect against multi-worker concurrency.

**Symptoms:**

* Two workers can both believe they should process
* State can be overwritten or become stale under races

### P3: No durable queue for “must process everything”

* Upload routes enqueue to an in-memory/disk state queue, not a DB durable job list.
* Restarts or crashes can orphan work.

**Symptoms:**

* Files uploaded but never processed after crash/restart
* User sees “complete” but some files never imported

### P4: Grouping conflicts with user actions

* Background pipeline may mutate grouping while user tries to merge tokens / edit groups.
* Even if we move grouping to post-import, there is still a critical window where grouping can override user intent unless prevented.

**Symptoms:**

* “Groups changed under me”
* Nondeterministic final grouping depending on timing

### P5: Duplicate processing/retries can double-insert without strong DB guarantees

* Application-level dedupe is helpful but not sufficient under concurrency/retries.

**Symptoms:**

* Duplicate keyword rows or inconsistent counts after retry

***

## 2) Goals / Invariants (Non-Negotiable)

### G1: Single runner per project (hard guarantee)

At most one active processing runner may execute for a given `project_id` at any time, regardless of:

* concurrent uploads
* multiple API workers
* restarts/retries

### G2: Durable job queue (no lost work)

Every uploaded CSV results in a durable job that eventually transitions to:

* `succeeded` or `failed`\
  …and is not lost on restart.

### G3: Exactly-once effect (idempotent import)

Jobs may run more than once (crashes/retries), but the **result in the DB** must be as if each keyword was imported once.

### G4: Deterministic grouping

Grouping is performed only after all queued import jobs complete, and results are deterministic for a given project state.

### G5: Policy A — Lock grouping interactions while processing

* Grouping UI remains visible/clickable
* All grouping mutations are blocked while processing is active
* Backend enforces 409 for mutation endpoints during active processing

### G6: Explicit state transitions (no ambiguous states)

All CSV job and project processing states must follow a strict, documented transition graph with no “implicit” transitions or hidden side effects.

***

## 3) Proposed Architecture (CSV Processing v2)

### 3.1 DB tables (durable queue + lease)

#### Table: `csv_processing_jobs`

Tracks one job per uploaded CSV (or per upload record).

**Suggested columns:**

* `id` (PK)
* `project_id` (indexed)
* `csv_upload_id` (FK to `CSVUpload`, preferred) OR `storage_path`
* `status` enum: `queued | running | succeeded | failed`
* `source_filename` (string, for UI display)
* `idempotency_key` (UNIQUE): recommended `sha256(file_bytes)` or deterministic signature of the upload
* `attempts` int
* `error` text nullable
* `created_at`, `started_at`, `finished_at`

**Key behaviors:**

* Create job at upload completion.
* If the same CSV content is re-uploaded, the UNIQUE `idempotency_key` prevents duplicate job creation.
* Jobs can be retried by incrementing `attempts` and re-queuing.
* Job ordering defaults to `created_at` asc unless explicitly overridden (deterministic processing order).

#### Table: `project_processing_leases`

Guarantees one runner per project across workers.

**Suggested columns:**

* `project_id` (PK)
* `lease_owner` (string: hostname/pid/uuid)
* `lease_expires_at` (timestamp)
* `updated_at`

**Key behaviors:**

* Lease acquisition is atomic in DB.
* Lease is renewed (“heartbeat”) while running.
* Lease expiry allows recovery if a worker dies.

> Alternative: a single row lock using `SELECT ... FOR UPDATE` can work, but lease with expiry is more resilient.

***

## 4) Backend: Runner + Claiming Logic

### 4.1 Services (per AGENTS.md)

* Routers only call services.
* Business logic lives in `app/services`.

#### Service: `CsvProcessingJobService`

Responsibilities:

* `enqueue_upload(project_id, csv_upload_id, idempotency_key)` -> creates job row `queued` (idempotent)
* `get_processing_lock_state(project_id)` -> returns `locked` if any queued/running jobs OR active lease

#### Service: `ProjectProcessingLeaseService`

Responsibilities:

* `try_acquire(project_id, owner, ttl_seconds)` -> atomic acquire if none exists or expired
* `renew(project_id, owner, ttl_seconds)`
* `release(project_id, owner)`
* `is_locked(project_id)` -> active lease not expired

#### Service: `ProjectCsvRunnerService`

Responsibilities:

* `kick(project_id)` -> safe to call many times; starts runner only if lease acquired
* `run(project_id)` -> loop:

  1. claim next queued job (transaction + row lock / SKIP LOCKED)
  2. mark job running
  3. execute `process_csv_file` for that job
  4. mark succeeded/failed
  5. repeat until none queued
  6. run final grouping pass once
  7. release lease

#### Explicit state transitions (CSV job)

```
queued -> running -> succeeded
queued -> running -> failed
failed -> queued (optional retry)
```

* No other transitions allowed.
* `running` jobs on crash must be moved to `queued` or `failed` by a recovery step.

### 4.2 Job claiming (multi-worker safe)

Use a DB transaction to:

* select the next job in `queued` status for the project
* lock the row (SKIP LOCKED if supported)
* update it to `running` with `started_at=now`
* commit\
  Then run the processing outside the transaction.

### 4.3 Failure/retry strategy

* On exception: mark job `failed` with error message and `finished_at`.
* Optional: auto retry up to `attempts < N` by moving back to queued.
* Provide admin endpoint: “retry failed jobs”.
* Recovery sweep (on runner start): detect `running` jobs whose lease expired and move to `queued` with `attempts += 1`, or mark `failed` if max retries exceeded.

### 4.4 Integrating with existing `processing_queue_service`

The existing JSON state machine can remain for **progress reporting** and UI compatibility, but MUST NOT be used for correctness.\
Runner should:

* update the progress state as it processes each job
* set appropriate stage/message
* list which file currently processing

***

## 5) Import Logic: Idempotency + Correctness

### 5.1 DB-level idempotency for keywords

Add a UNIQUE constraint on a canonical keyword identity, e.g.:

* `(project_id, keyword_normalized)` or `(project_id, keyword_lower)`

Update `KeywordService.create_many` to:

* use an upsert / `ON CONFLICT DO NOTHING` insert strategy
* return counts of inserted vs skipped vs duplicates as needed

### 5.2 File-level idempotency

Jobs are deduped by `idempotency_key`:

* recommended `sha256(file bytes)` computed during/after upload
* store it in `CSVUpload` row and use it to dedupe job creation

### 5.3 Deterministic normalization (input canonicalization)

Before insert:

* lowercase + trim + Unicode normalize (NFKC or repo standard)
* tokenize/dedupe tokens deterministically
* ensure keyword identity uses the canonicalized value only

***

## 6) Grouping: Deterministic Post-Import Only (Chosen Strategy A)

### 6.1 Rule

* Do **not** group during import.
* Only after ALL queued jobs for a project are complete, run:

  * `group_remaining_ungrouped_keywords(project_id)` exactly once.

### 6.2 Benefits

* Deterministic outcomes regardless of upload ordering/timing
* Simpler concurrency story
* Easier to reason about final state

***

## 7) Policy A Locking: Backend + Frontend

### 7.1 Backend enforcement (409 Conflict)

All endpoints that mutate grouping state must check:

* if project has queued/running jobs OR active lease
* if yes: return **HTTP 409** with message:

  * "CSV processing in progress. Grouping is temporarily locked until import completes."

**Examples of endpoints to guard:**

* token merge / unmerge
* rename group
* confirm group
* manual regroup
* any group\_id/parent mutation endpoints

### 7.1.1 Error payload (consistent contract)

```
{
  "error": "processing_locked",
  "message": "CSV processing in progress. Grouping is temporarily locked until import completes.",
  "project_id": 123
}
```

### 7.2 Frontend UI lock behavior

* Grouping tab remains accessible (user can click it)
* While locked:

  * show small lock icon + label (“Processing…”) in the Grouping tab header
  * disable all interactive controls (buttons/inputs/drags)
  * optionally show tooltip and/or callout explaining why

### 7.3 Frontend data source

* Use existing processing status polling if available
* Otherwise add a minimal endpoint: `GET /projects/{id}/processing/status`

  * returns `{ locked: boolean, status: ..., current_file: ..., progress: ... }`

### 7.3.1 Polling requirement (continuous while backend active)

* The UI **must continue polling** processing status if the backend reports any active work (queued/running jobs or locked lease),
  even if the current UI state believes processing is idle or complete.
* Do **not** stop polling based solely on stale client-side flags; only stop when the backend reports no active processing and
  the uploaded/processed file counts match.

### 7.4 Processing status contract (explicit fields)

```
{
  "locked": true,
  "status": "processing",
  "current_file": "jan_upload.csv",
  "queued_jobs": 3,
  "running_jobs": 1,
  "succeeded_jobs": 4,
  "failed_jobs": 0,
  "progress": {
    "rows_total": 9000,
    "rows_processed": 4500
  }
}
```

### 7.5 File count + per-file status mapping (UI contract)

Backend response fields for Process visualization **must** be mapped as follows:

* `uploadedFiles` → total list of files uploaded for the project (source of `uploadedFileCount`).
* `processedFiles` → list of files that have completed processing (source of `processedFileCount`).
* `processedFileCount` → server-authoritative count displayed as `processedFileCount / uploadedFileCount`.

Process visualization requirements:

* Display **`processedFileCount / uploadedFileCount`** at all times.
* Show per-file status by checking each uploaded file against `processedFiles`
  (or per-file status metadata where available) to avoid assuming completion from UI-only state.
* If counts diverge or backend reports active processing, continue polling and keep UI in “processing” state.

***

## 8) Upload Scenarios & Expected Behavior (Acceptance Criteria)

### S1: Single CSV upload

* Job created queued
* Runner acquires lease and processes
* On completion: grouping runs once
* UI unlocks grouping

### S2: Multiple CSVs uploaded in one batch

* N jobs created queued
* Single runner processes sequentially (or controlled concurrency if ever added later)
* After all succeed: grouping runs once
* Total processed rows equals sum of all files’ rows (minus invalid rows), with no “lost” files

### S3: Upload CSV A, then CSV B shortly after

* CSV B enqueues while runner may already be running
* Runner continues and eventually processes B
* No second runner starts (lease prevents it)

### S4: Client retries upload request / duplicate uploads

* Duplicate file content does not create duplicate job (idempotency key)
* Even if job runs twice, keyword inserts are idempotent and final DB state is correct

### S5: Crash during processing

* Lease expires
* A later kick reacquires lease
* Remaining queued jobs are processed
* Running job may be retried depending on policy
* Recovery sweep resets stale `running` jobs

### S6: User attempts grouping during processing

* Frontend controls disabled
* Backend mutation endpoints return 409
* After processing complete, controls re-enable and endpoints succeed

***

## 9) Observability / Debugging

* Log runner lifecycle per project: lease acquire/release, job claim, job finish
* Log job errors with trace IDs where possible
* Provide admin endpoint to view job table for a project (optional)
* Emit metrics: jobs queued/running/succeeded/failed, lease acquisition failures, avg job runtime

***

## 10) Implementation Checklist

### Backend

* [x] Create models + migrations for `csv_processing_jobs`, `project_processing_leases`
* [x] Implement services: job service, lease service, runner service
* [x] Update upload routes to create `CSVUpload` rows and enqueue jobs
* [x] Replace direct `asyncio.create_task(process_csv_file)` kickoff logic with `runner.kick(project_id)`
* [x] Remove grouping during import; add grouping after all jobs complete
* [x] Add DB unique constraint + upsert logic for keywords
* [x] Add 409 checks to grouping mutation endpoints
* [x] Add processing lock status endpoint for UI
* [x] Add recovery sweep for stale `running` jobs
* [x] Add consistent error payload for 409 responses
* [x] Add deterministic ordering for job claiming

### Frontend

* [ ] Add lock indicator to Grouping tab/header
* [ ] Disable interactions when locked
* [ ] Keep tab viewable
* [ ] Hook to processing status polling

### Tests

* [ ] Concurrent kick -> one lease owner
* [ ] Multi-file -> all jobs processed
* [ ] Retry/idempotency -> no duplicate keywords
* [ ] 409 grouping mutations during processing
* [ ] recovery sweep re-queues stale running jobs
* [ ] deterministic ordering of job processing

***

## 11) Non-Goals (for this phase)

* Parallel processing of CSVs within a project (can be added later with careful partitioning)
* Real distributed job queue (Celery/RQ) — DB queue is sufficient for now

***

## 12) Notes on Existing Components

* Existing `processing_queue_service` should remain for UI progress reporting, but correctness must rely on DB job state + lease.
* File hashing (`sha256`) is already used for duplicate detection; reuse it to generate `idempotency_key`.
