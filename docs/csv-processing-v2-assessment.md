# CSV Processing v2 - Detailed Assessment

**Date**: 2026-01-15  
**Reviewer**: AI Code Review  
**Status**: Approved with Recommendations

---

## Executive Summary

After thorough review of the proposed **CSV Processing v2** document against the current codebase, I conclude:

**✅ AGREE - The document correctly identifies critical problems and proposes sound architectural solutions.**

However, there are **important gaps and considerations** that should be addressed before implementation.

---

## Current State Analysis

### What Exists Today

The current implementation has these components:

1. **ProcessingQueueService** (`app/services/processing_queue.py`)
   - In-memory/disk-persisted state machine
   - ProjectState dataclass (single source of truth per project)
   - Queue management with state transitions
   - Progress tracking and reporting

2. **CSV Upload Flow** (`app/routes/keyword_routes.py`)
   - File upload handling (chunked + batch support)
   - SHA256-based duplicate detection
   - CSVUpload model for tracking uploads
   - Sequential file processing

3. **Keyword Processing** (`app/routes/keyword_processing.py`)
   - Async background processing via `asyncio.create_task`
   - Tokenization and normalization
   - In-import grouping (cross-file + intra-file)
   - Post-import grouping pass
   - Application-level duplicate detection

### Problems Confirmed ✅

All five problems identified in the document **are real and accurately described**:

| Problem | Current Evidence | Impact |
|---------|-----------------|--------|
| **P1: Non-safe kickoff** | `asyncio.create_task` at line 159 | Multiple concurrent processors |
| **P2: Disk state not atomic** | JSON file persistence | Multi-worker conflicts |
| **P3: No durable queue** | In-memory deque + disk JSON | Lost work on restart |
| **P4: Grouping conflicts** | Grouping during import (L472-488) + after (L582-596) | Nondeterministic results |
| **P5: No DB-level idempotency** | Application-level deduplication only | Duplicates under concurrency |

---

## What the Document Gets RIGHT ✅

### 1. Architecture Approach
- **DB-backed job queue**: Correct solution for durability and multi-worker safety
- **Per-project lease**: Prevents concurrent processing (solves P1)
- **Idempotent imports**: DB-level constraints prevent duplicates (solves P5)
- **Deterministic grouping**: Post-import-only eliminates races (solves P4)

### 2. Service Layer Design
- Proper separation: JobService, LeaseService, RunnerService
- Follows existing service pattern (aligns with AGENTS.md)
- Clear responsibility boundaries

### 3. Policy A (Grouping Lock)
- Backend 409 enforcement is robust
- UI remains accessible but non-interactive
- Clear error messages for users

### 4. State Machine
- Explicit transitions: `queued → running → succeeded/failed`
- No ambiguous states
- Recovery strategy for stale jobs

### 5. Observability
- Structured logging recommendations
- Metrics for monitoring
- Admin endpoints for debugging

---

## What's MISSING or Needs Clarification ⚠️

### 1. Migration Path ❌ CRITICAL MISSING

**Problem**: No guidance on migrating from v1 to v2

**Questions**:
- What happens to in-progress processing when deploying v2?
- How do we backfill idempotency keys for existing CSVUpload rows?
- Can v1 and v2 coexist during rollout?
- What's the rollback plan if v2 has issues?

**Recommendation**: Add section covering:
```markdown
## Migration Strategy

### Pre-Migration
1. Audit all projects in "processing" state
2. Allow existing processing to complete or reset
3. Backfill idempotency_key for CSVUpload table

### Migration Script
```sql
-- Add new columns to existing tables
ALTER TABLE csv_uploads ADD COLUMN idempotency_key VARCHAR(64);
UPDATE csv_uploads SET idempotency_key = sha256(storage_path) WHERE idempotency_key IS NULL;
CREATE UNIQUE INDEX idx_csv_uploads_project_idempotency ON csv_uploads(project_id, idempotency_key);

-- Create new tables
CREATE TABLE csv_processing_jobs (...);
CREATE TABLE project_processing_leases (...);
```

### Deployment
1. Deploy v2 with feature flag OFF
2. Test with 1-2 pilot projects
3. Gradually enable for all projects
4. Monitor for 48 hours before cleanup

### Rollback
1. Disable v2 via feature flag
2. Revert to v1 code
3. Clear any v2-created locks
```

### 2. Keyword Deduplication Strategy ⚠️

**Document Says**: Add UNIQUE constraint on `(project_id, keyword_normalized)`

**Questions**:
- What is "keyword_normalized"? Lowercase? NFKC normalized? Trimmed?
- Should we use `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE`?
- What happens when a user edits a keyword and creates a duplicate?

**Current Behavior**: Application deduplicates by `keyword.lower()` in memory

**Recommendation**: Clarify normalization rules and conflict resolution:
```python
# Option A: Skip duplicates
INSERT INTO keywords (...) 
ON CONFLICT (project_id, LOWER(keyword)) DO NOTHING;

# Option B: Merge metrics (better!)
INSERT INTO keywords (...)
ON CONFLICT (project_id, LOWER(keyword)) 
DO UPDATE SET 
  volume = GREATEST(keywords.volume, EXCLUDED.volume),
  difficulty = (keywords.difficulty + EXCLUDED.difficulty) / 2;
```

### 3. Job-to-Upload Relationship ⚠️

**Document Says**: `csv_upload_id` (FK to CSVUpload, preferred) OR `storage_path`

**Recommendation**: **ALWAYS** use FK to CSVUpload. Remove OR option.

**Rationale**:
- Maintains referential integrity
- Enables cascade deletes
- Supports download endpoint
- Cleaner data model

### 4. Batch Upload Semantics ⚠️

**Document Doesn't Specify**:
- Is a batch atomic (all succeed or all fail)?
- Can partial batch failures occur?
- How do we determine "batch complete"?

**Current Implementation**: Files in batch are independent jobs

**Recommendation**: Explicitly document:
```markdown
### Batch Upload Behavior

1. **Non-Atomic**: Files in a batch are processed independently
2. **Partial Success**: Some files may succeed while others fail
3. **Status**: Batch is "complete" when all jobs reach terminal state (succeeded/failed)
4. **User Experience**: Show per-file status in UI, not just batch status
```

### 5. File Size & Validation Limits ❌ MISSING

**Problem**: No limits specified

**Recommendation**: Add section:
```markdown
## Upload Limits & Validation

### File Size Limits
- Maximum single file: 100 MB
- Maximum batch: 1 GB total
- Maximum rows per CSV: 500,000

### Validation Rules
- CSV must have headers
- Must contain 'Keyword' or 'Phrase' column
- Optional: Volume, Difficulty, SERP Features columns
- Reject files with < 1 data row or > 500k rows

### Error Handling
- Return 400 Bad Request for validation failures
- Return 413 Payload Too Large for size violations
- Include specific error messages in response
```

### 6. Recovery Sweep Trigger ⚠️

**Document Mentions**: "Recovery sweep" for stale jobs

**Doesn't Specify**: When/how is sweep triggered?

**Recommendation**:
```markdown
## Recovery Strategy

### Automatic Recovery
- Run sweep on application startup
- Run before acquiring any project lease
- Run on lease acquisition failure (may indicate stale lock)

### Manual Recovery
- Admin endpoint: `POST /admin/recovery/sweep`
- Admin endpoint: `POST /admin/projects/{id}/reset-processing`

### Sweep Algorithm
1. Find all jobs with `status='running'` where `started_at < now() - lease_ttl`
2. Check if lease still exists/valid for that job
3. If lease expired: set job to `status='queued'`, increment `attempts`
4. If `attempts > max_retries`: set job to `status='failed'`
```

### 7. Testing Scenarios ⚠️

**Document**: Mentions tests in checklist but lacks detail

**Recommendation**: Expand test scenarios:

```markdown
## Testing Plan

### Unit Tests
- [ ] JobService: create, claim, mark complete/failed
- [ ] LeaseService: acquire, renew, release, expiry
- [ ] RunnerService: kick, run loop, recovery

### Integration Tests
- [ ] Concurrent kick attempts (only one runner starts)
- [ ] Multi-file upload processes sequentially
- [ ] Worker crash mid-processing (job resets to queued)
- [ ] Lease expiry triggers recovery
- [ ] Duplicate file upload (idempotency key blocks)
- [ ] Grouping mutation during processing returns 409
- [ ] Keyword duplicate inserts (DB constraint enforced)

### Load Tests
- [ ] 10 concurrent upload requests to same project
- [ ] Batch of 20 files
- [ ] 100k row CSV file
- [ ] Multiple projects processing simultaneously

### Edge Cases
- [ ] Empty CSV file
- [ ] CSV with only headers
- [ ] Corrupted CSV file (mid-chunk)
- [ ] Invalid encoding
- [ ] Network interruption during upload
```

### 8. Lease TTL & Heartbeat ⚠️

**Document Mentions**: TTL and heartbeat but no specifics

**Recommendation**:
```markdown
## Lease Configuration

### Defaults
- **Lease TTL**: 300 seconds (5 minutes)
- **Heartbeat Interval**: 30 seconds (10% of TTL)
- **Max Job Runtime**: 600 seconds (10 minutes for huge files)

### Rationale
- 5-minute TTL allows for large file processing
- 30-second heartbeat is frequent enough to detect crashes quickly
- 10-minute max runtime handles 100k+ row CSVs

### Monitoring
- Alert if lease renewals fail
- Alert if job runtime exceeds 90% of max
- Dashboard showing active leases per project
```

### 9. Existing Infrastructure Reuse ⚠️

**Document Proposes**: Create entirely new tables and services

**Alternative**: Extend existing infrastructure

**Current Assets**:
- `CSVUpload` model exists
- `ProcessingQueueService` has solid state management
- Disk state could migrate to DB columns on `projects` table

**Recommendation**: Consider hybrid approach:
```markdown
## Leverage Existing Components

### Extend CSVUpload Table
- Add `idempotency_key` column
- Add `processing_status` enum: queued, running, succeeded, failed
- Add `attempts`, `error`, `started_at`, `finished_at` columns

### Extend Projects Table
- Add `processing_lock_owner` VARCHAR
- Add `processing_lock_expires_at` TIMESTAMP

### Migration Path
1. Add new columns to existing tables
2. Backfill idempotency keys
3. Create indices
4. Migrate ProcessingQueueService to read/write DB instead of disk
5. Remove JSON state files after successful migration
```

**Counter-Argument**: Separate tables are cleaner separation of concerns. Both approaches valid.

### 10. Grouping Lock Error Messages ⚠️

**Document Specifies**: 409 with error payload

**Enhancement**: Add more context:
```json
{
  "error": "processing_locked",
  "message": "CSV processing in progress. Grouping is temporarily locked until import completes.",
  "project_id": 123,
  "processing_status": {
    "current_file": "january_keywords.csv",
    "queued_files": 2,
    "progress": 45.5,
    "estimated_completion": "2026-01-15T12:35:00Z"
  },
  "retry_after": 60
}
```

### 11. Monitoring & Alerts ⚠️

**Document**: Mentions metrics but not specific

**Recommendation**:
```markdown
## Observability & Monitoring

### Metrics to Track
- `csv.jobs.queued` (gauge by project)
- `csv.jobs.running` (gauge by project)
- `csv.jobs.succeeded` (counter)
- `csv.jobs.failed` (counter)
- `csv.jobs.duration` (histogram)
- `csv.leases.acquired` (counter)
- `csv.leases.acquisition_failures` (counter)
- `csv.leases.expired` (counter)
- `csv.rows.processed` (counter)
- `csv.keywords.created` (counter)
- `csv.keywords.duplicates` (counter)

### Alerts
- **Critical**: Lease acquisition failures > 5 in 5 minutes
- **Critical**: Jobs stuck in "running" > 10 minutes
- **Warning**: Failed jobs > 10% of total in 1 hour
- **Warning**: Average job duration > 5 minutes

### Dashboards
1. **Processing Overview**: Jobs by status, active leases, throughput
2. **Per-Project**: Current job, queue depth, success rate
3. **System Health**: Error rates, duration percentiles, resource usage
```

### 12. API Versioning ❌ MISSING

**Consideration**: Are we changing any API contracts?

**Analysis**:
- Processing status endpoint: ✅ No breaking changes (add fields only)
- Grouping endpoints: ✅ Backward compatible (add 409 responses)
- Upload endpoint: ✅ No changes to request/response

**Recommendation**: No API versioning needed, but document new error codes.

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal**: DB infrastructure without changing processing logic

- [ ] Create Alembic migrations for new tables
- [ ] Implement JobService (CRUD operations only)
- [ ] Implement LeaseService (acquire/release)
- [ ] Add idempotency_key to CSVUpload
- [ ] Write unit tests for new services
- [ ] **Milestone**: Can create/read jobs and leases

### Phase 2: Runner Integration (Week 3-4)
**Goal**: Replace asyncio.create_task with RunnerService

- [ ] Implement RunnerService.kick() and run()
- [ ] Implement job claiming logic (DB transaction + lock)
- [ ] Update upload endpoint to create jobs instead of calling process_csv_file directly
- [ ] Implement retry logic
- [ ] Add recovery sweep on startup
- [ ] **Milestone**: Single-file uploads use new system

### Phase 3: Grouping Refactor (Week 5)
**Goal**: Move grouping to post-import only

- [ ] Remove grouping logic from import loop
- [ ] Keep only post-import grouping call
- [ ] Add 409 checks to grouping endpoints
- [ ] Update processing status to include lock state
- [ ] **Milestone**: Grouping is deterministic

### Phase 4: UI Updates (Week 6)
**Goal**: Show lock state and disable interactions

- [ ] Add lock indicator to Grouping tab
- [ ] Disable grouping controls when locked
- [ ] Show detailed processing status
- [ ] Add "Why is this locked?" tooltip
- [ ] **Milestone**: Users understand lock state

### Phase 5: Testing & Refinement (Week 7-8)
**Goal**: Comprehensive testing and bug fixes

- [ ] Integration tests for all scenarios
- [ ] Load testing (concurrent uploads)
- [ ] Fix any discovered issues
- [ ] Performance tuning
- [ ] **Milestone**: Ready for production

### Phase 6: Rollout (Week 9-10)
**Goal**: Gradual production deployment

- [ ] Deploy with feature flag OFF
- [ ] Enable for 5% of projects
- [ ] Monitor for 48 hours
- [ ] Enable for 50% of projects
- [ ] Monitor for 48 hours
- [ ] Enable for 100% of projects
- [ ] **Milestone**: Full production rollout

### Phase 7: Cleanup (Week 11)
**Goal**: Remove old code and documentation

- [ ] Remove old ProcessingQueueService disk state logic
- [ ] Update documentation
- [ ] Clean up feature flags
- [ ] Archive v1 code for reference
- [ ] **Milestone**: v2 is the only system

---

## Risk Assessment

### High Risk Items ⚠️

1. **Data Loss During Migration**
   - **Risk**: In-progress jobs lost during deployment
   - **Mitigation**: Complete all processing before deployment, or implement state transfer

2. **Performance Regression**
   - **Risk**: DB queries slower than in-memory operations
   - **Mitigation**: Add DB indices, benchmark before rollout, implement caching if needed

3. **Lock Contention**
   - **Risk**: Multiple workers competing for same project lease
   - **Mitigation**: Use SKIP LOCKED in Postgres, monitor lock acquisition failures

### Medium Risk Items ⚠️

4. **Incomplete Error Handling**
   - **Risk**: Unexpected errors crash runner, leaving jobs stuck
   - **Mitigation**: Comprehensive try/catch, graceful degradation, recovery sweep

5. **Incorrect Idempotency Key**
   - **Risk**: Different files treated as duplicates (or vice versa)
   - **Mitigation**: Test thoroughly, consider content-based hash

### Low Risk Items ℹ️

6. **UI Complexity**
   - **Risk**: Users confused by lock state
   - **Mitigation**: Clear messaging, tooltips, in-app guidance

7. **Monitoring Gaps**
   - **Risk**: Issues not detected quickly
   - **Mitigation**: Comprehensive metrics and alerts (Phase 5)

---

## Recommended Additions to Document

1. **Add Section**: "Migration from v1 to v2" (detailed above)
2. **Add Section**: "Upload Limits & Validation" (file size, row count)
3. **Expand Section**: "Testing Plan" with specific scenarios
4. **Add Section**: "Monitoring & Observability" with metrics and alerts
5. **Clarify**: Keyword normalization and deduplication strategy
6. **Clarify**: Batch upload semantics (non-atomic)
7. **Specify**: Lease TTL, heartbeat interval, max runtime
8. **Specify**: Recovery sweep triggers and algorithm
9. **Add**: Error message examples with full context
10. **Consider**: Reusing existing CSVUpload table vs new csv_processing_jobs table

---

## Final Verdict

**Status**: ✅ **APPROVED WITH CONDITIONS**

The CSV Processing v2 proposal is **architecturally sound and addresses real problems**. It should move forward to implementation with the following conditions:

### Must Address Before Implementation
1. ✅ Add migration path documentation
2. ✅ Clarify keyword deduplication strategy
3. ✅ Document batch upload semantics
4. ✅ Add file size and validation limits
5. ✅ Expand testing scenarios

### Should Address During Implementation
6. ⚠️ Implement recovery sweep triggers
7. ⚠️ Add comprehensive monitoring
8. ⚠️ Consider leveraging existing tables
9. ⚠️ Specify lease TTL and heartbeat config
10. ⚠️ Add detailed error payloads

### Nice to Have (Post-MVP)
11. ⏭️ Processing history audit table
12. ⏭️ Real-time progress streaming
13. ⏭️ Advanced retry strategies (exponential backoff)
14. ⏭️ Parallel processing within project (future)

---

## Conclusion

The document demonstrates strong understanding of the problem space and proposes a robust solution. With the additions recommended above, this architecture will significantly improve:
- **Reliability**: No lost work, guaranteed progress
- **Consistency**: Deterministic grouping results
- **User Experience**: Clear status, no mysterious failures
- **Maintainability**: Explicit state machine, better observability

**Recommendation**: Proceed with implementation, incorporating the feedback above.

---

**Reviewer**: AI Code Review  
**Date**: 2026-01-15  
**Confidence**: High  
**Estimated Implementation**: 10-11 weeks (including testing and rollout)
