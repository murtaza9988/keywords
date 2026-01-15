# What's Missing - Explained Simply

## 1. Migration Path from v1 to v2 ⚠️ CRITICAL

**What it means**: How do we switch from the old system to the new system without breaking things?

**Why it matters**: Right now, projects might be in the middle of processing CSVs. If we just deploy the new code, what happens to them?

**What's needed**:

### Example Problem:
```
Project 123 is currently processing "january_keywords.csv"
We deploy v2 code
❌ What happens to that file? Does it get lost? Processed twice?
```

### What the document should add:

**A. Pre-deployment checklist:**
```markdown
Before deploying v2:
1. Check all projects - list any that are currently "processing"
2. Either:
   - Wait for them to finish, OR
   - Reset them to "idle" (user can retry)
3. Run a script to add idempotency_key to existing csv_uploads
```

**B. Database migration script:**
```sql
-- Example of what needs to run
ALTER TABLE csv_uploads ADD COLUMN idempotency_key VARCHAR(64);

-- Go through every old upload and create a hash for it
UPDATE csv_uploads 
SET idempotency_key = sha256(storage_path) 
WHERE idempotency_key IS NULL;
```

**C. Deployment plan:**
```markdown
Day 1: Deploy v2 with it turned OFF (feature flag)
Day 2: Test with 1 project manually
Day 3-4: Enable for 10% of projects
Day 5-6: Enable for 50% of projects
Day 7: Enable for everyone
```

**D. "Oh no!" rollback plan:**
```markdown
If v2 breaks:
1. Turn off feature flag (back to v1)
2. Check if any jobs are stuck
3. Reset stuck projects
4. Investigate the bug
```

---

## 2. File Size and Validation Limits ⚠️

**What it means**: How big can uploaded CSV files be?

**Why it matters**: Someone might try to upload a 5GB file with 10 million keywords and crash the server.

**What's needed**:

### Real-world example:
```
User uploads "huge_keywords.csv" - 500 MB, 2 million rows
❌ Current: Server tries to process it, runs out of memory, crashes
✅ Need: Reject it immediately with a clear error
```

### What the document should add:

```markdown
## Upload Limits

**File Size:**
- Maximum: 100 MB per file
- Maximum batch: 1 GB total across all files
- Why: Prevents memory issues

**Row Count:**
- Maximum: 500,000 rows per CSV
- Why: Processing takes too long beyond this

**Validation:**
- Check file size BEFORE accepting upload
- Return error: "File too large. Maximum 100 MB."
- Return error: "Too many rows. Maximum 500,000."

**Error Responses:**
HTTP 413 Payload Too Large
{
  "error": "file_too_large",
  "message": "File 'keywords.csv' is 250 MB. Maximum allowed is 100 MB.",
  "max_size": 104857600,
  "actual_size": 262144000
}
```

---

## 3. Keyword Normalization Strategy Details ⚠️

**What it means**: When checking if a keyword is a duplicate, how do we compare them?

**Why it matters**: Are "iPhone 15" and "iphone 15" the same keyword?

**What's needed**:

### Example problem:
```csv
Row 1: iPhone 15
Row 2: iphone 15
Row 3: IPHONE 15
Row 4: iPhone  15  (extra spaces)
```

**Are these all the same keyword? Or 4 different ones?**

### Current situation:
The code does `keyword.lower()` but the document doesn't specify what database constraint to use.

### What the document should add:

```markdown
## Keyword Deduplication Rules

**Normalization steps:**
1. Convert to lowercase: "iPhone" → "iphone"
2. Trim whitespace: " iphone " → "iphone"
3. Collapse multiple spaces: "iphone  15" → "iphone 15"

**Database constraint:**
```sql
-- Add a unique index on lowercase keyword
CREATE UNIQUE INDEX ON keywords(project_id, LOWER(TRIM(keyword)));
```

**Conflict resolution:**
When a duplicate is found:

Option A - Skip it:
```sql
INSERT INTO keywords (...) 
ON CONFLICT (project_id, LOWER(TRIM(keyword))) 
DO NOTHING;
```

Option B - Merge the metrics (RECOMMENDED):
```sql
INSERT INTO keywords (...) 
ON CONFLICT (project_id, LOWER(TRIM(keyword))) 
DO UPDATE SET 
  volume = GREATEST(keywords.volume, EXCLUDED.volume),
  difficulty = (keywords.difficulty + EXCLUDED.difficulty) / 2;
```

**Example with Option B:**
- Existing: "iPhone 15" volume=1000
- New: "iphone 15" volume=1500
- Result: Keep "iPhone 15" (first version) but update volume to 1500
```

---

## 4. Batch Upload Semantics Clarification ⚠️

**What it means**: When uploading multiple CSVs at once, how do failures work?

**Why it matters**: User uploads 5 files. 3 succeed, 2 fail. What happens?

**What's needed**:

### Example scenario:
```
User uploads batch:
- file1.csv ✅ Success
- file2.csv ✅ Success  
- file3.csv ❌ Error: corrupted file
- file4.csv ⏸️  Still in queue
- file5.csv ⏸️  Still in queue
```

**Question**: Do we:
- A) Stop everything when file3 fails? (Atomic)
- B) Continue processing file4 and file5? (Partial success)

### What the document should add:

```markdown
## Batch Upload Behavior

**Non-Atomic Processing:**
- Each file in a batch is processed independently
- Some files can succeed while others fail
- Processing continues even if one file fails

**Example:**
User uploads 5 files:
1. keywords_jan.csv → ✅ Success (3000 keywords)
2. keywords_feb.csv → ✅ Success (2500 keywords)
3. keywords_mar.csv → ❌ Failed (corrupted)
4. keywords_apr.csv → ✅ Success (2800 keywords)
5. keywords_may.csv → ✅ Success (3200 keywords)

**Result:**
- Total keywords imported: 11,500 (from 4 files)
- User sees detailed status for each file
- Failed file can be re-uploaded separately

**UI Display:**
Batch Status: Partial Success (4/5 files)
✅ keywords_jan.csv - 3000 keywords
✅ keywords_feb.csv - 2500 keywords
❌ keywords_mar.csv - Error: Unable to parse CSV
✅ keywords_apr.csv - 2800 keywords
✅ keywords_may.csv - 3200 keywords
```

---

## 5. Recovery Sweep Trigger Specification ⚠️

**What it means**: What happens when a job gets "stuck"?

**Why it matters**: Server crashes mid-processing. Jobs left in "running" state forever. Who unsticks them?

**What's needed**:

### Example problem:
```
10:00 AM - Job starts processing keywords.csv
10:05 AM - Server crashes
10:10 AM - Server restarts

Job is still marked as "running" in database
But nothing is actually processing it!
It's stuck forever...
```

### What the document should add:

```markdown
## Recovery Sweep - Automatic Cleanup

**What is a "sweep"?**
A background task that finds stuck jobs and fixes them.

**When does it run?**
1. Every time the server starts up
2. Before trying to acquire a project lease
3. Every 5 minutes in the background (optional)

**What does it do?**
```python
# Pseudo-code
def recovery_sweep():
    # Find jobs that have been "running" for too long
    stuck_jobs = find_jobs_where(
        status == "running" AND 
        started_at < now() - 5_minutes
    )
    
    for job in stuck_jobs:
        if job.attempts < 3:
            # Try again
            job.status = "queued"
            job.attempts += 1
        else:
            # Give up after 3 tries
            job.status = "failed"
            job.error = "Exceeded maximum retry attempts"
```

**Example:**
```
10:00 AM - Job starts processing
10:05 AM - Server crashes
10:10 AM - Server restarts
10:10:01 AM - Recovery sweep runs
           - Finds job stuck in "running" for 10 minutes
           - Changes status to "queued"
           - Job will be picked up and processed again
```

**Admin Tools:**
```
POST /admin/recovery/sweep
- Manually trigger recovery for all projects

POST /admin/projects/123/reset-processing  
- Reset stuck processing for specific project
```
```

---

## 6. Expanded Testing Scenarios ⚠️

**What it means**: What specific situations should we test?

**Why it matters**: "Add tests" is vague. What EXACTLY should we test?

**What's needed**:

### What the document should add:

```markdown
## Testing Scenarios (Specific Cases)

### Test 1: Concurrent Uploads
**Setup:**
- Two users upload to Project 123 at the SAME TIME
- Both click upload within 1 second

**Expected behavior:**
- Only ONE processing job starts
- Second upload gets queued
- Both files eventually get processed
- No duplicate keywords

**How to test:**
```python
# Pseudo-test code
async def test_concurrent_uploads():
    project = create_test_project()
    
    # Start both uploads simultaneously
    result1, result2 = await asyncio.gather(
        upload_csv(project.id, "file1.csv"),
        upload_csv(project.id, "file2.csv")
    )
    
    # Check only one job is running
    running_jobs = get_running_jobs(project.id)
    assert len(running_jobs) == 1
    
    # Wait for both to complete
    await wait_for_completion(project.id)
    
    # Verify both files processed
    assert keywords_from_file1_exist()
    assert keywords_from_file2_exist()
```

### Test 2: Server Crash During Processing
**Setup:**
- Start processing a CSV
- Kill the server process mid-processing
- Restart server

**Expected behavior:**
- Job moves from "running" to "queued"
- Processing resumes automatically
- No duplicate keywords created

### Test 3: Duplicate File Upload
**Setup:**
- Upload "keywords.csv"
- Wait for it to complete
- Upload the EXACT SAME FILE again

**Expected behavior:**
- Second upload detected as duplicate
- No new job created
- Return message: "File already processed"
- No duplicate keywords

### Test 4: Grouping During Processing (409 Test)
**Setup:**
- Start uploading large CSV (takes 30 seconds)
- While still processing, try to merge keywords

**Expected behavior:**
- Merge request returns HTTP 409
- Error message: "Processing in progress"
- Grouping is locked until processing completes

### Test 5: Empty CSV File
**Setup:**
- Upload CSV with headers only, no data rows

**Expected behavior:**
- Upload succeeds
- Job completes with message: "No keywords found"
- No error, no crash

### Test 6: 500,000 Row CSV
**Setup:**
- Upload maximum-size CSV (at the limit)

**Expected behavior:**
- File processes successfully
- Takes several minutes
- Shows progress: "45% complete"
- All keywords imported

### Test 7: Multiple Projects Simultaneously
**Setup:**
- Upload to Project 1
- Upload to Project 2  
- Upload to Project 3
- All at the same time

**Expected behavior:**
- All three process in parallel
- No interference between projects
- Each has its own lease
```

---

## 7. Monitoring and Alerting Details ⚠️

**What it means**: How do we know if something is broken?

**Why it matters**: System could be failing silently. We need alerts!

**What's needed**:

### Real-world scenario:
```
Production system
Jobs are failing: 50% failure rate
BUT: Nobody notices for 3 days
Result: Users angry, data not processing
```

### What the document should add:

```markdown
## Monitoring & Alerts

### Metrics to Track

**Job Metrics:**
```
csv.jobs.queued{project_id}     - How many jobs waiting (gauge)
csv.jobs.running{project_id}    - How many currently processing (gauge)
csv.jobs.succeeded              - Total successful (counter)
csv.jobs.failed                 - Total failed (counter)
csv.jobs.duration               - How long jobs take (histogram)
```

**Example Dashboard:**
```
Current Status:
- Queued: 5 jobs
- Running: 3 jobs
- Success rate: 97%
- Avg duration: 45 seconds
```

**Lease Metrics:**
```
csv.leases.acquired             - Leases acquired (counter)
csv.leases.failures             - Failed to get lease (counter)
csv.leases.expired              - Leases that expired (counter)
```

**Keyword Metrics:**
```
csv.keywords.created            - Keywords added (counter)
csv.keywords.duplicates         - Duplicates skipped (counter)
csv.rows.processed              - Total rows processed (counter)
```

### Alerts (When to Notify Team)

**CRITICAL Alerts (Page someone immediately):**
```
Alert 1: Lease Acquisition Failures
- Trigger: More than 5 failures in 5 minutes
- Meaning: System can't acquire locks - major issue
- Action: Check database, check for deadlocks

Alert 2: Jobs Stuck in Running
- Trigger: Any job in "running" for > 10 minutes
- Meaning: Processing hung or crashed
- Action: Run recovery sweep, check logs
```

**WARNING Alerts (Check soon):**
```
Alert 3: High Failure Rate
- Trigger: > 10% of jobs failing in last hour
- Meaning: Something wrong with processing
- Action: Check error logs, look for pattern

Alert 4: Slow Processing
- Trigger: Average job duration > 5 minutes
- Meaning: Performance degradation
- Action: Check server resources, database load
```

### Example Alert Message:
```
🚨 CRITICAL: CSV Processing Lease Failures

Project: 123
Failures: 8 in the last 5 minutes
Last error: "Could not acquire lease - already owned by worker-2"

Dashboard: https://monitoring/csv-processing
Runbook: https://wiki/csv-troubleshooting
```

### Monitoring Dashboard Layout:
```
┌─────────────────────────────────────────┐
│ CSV Processing Overview                  │
├─────────────────────────────────────────┤
│ Jobs:        ⏳ 5 queued  ▶️ 3 running  │
│ Success:     ✅ 1,234 succeeded          │
│ Failures:    ❌ 12 failed (0.9%)        │
│ Avg Time:    ⏱️  45 seconds              │
├─────────────────────────────────────────┤
│ Active Leases by Project:               │
│ Project 123: worker-1 (2 min remaining) │
│ Project 456: worker-2 (4 min remaining) │
├─────────────────────────────────────────┤
│ Alerts:                                  │
│ ⚠️  High queue depth on Project 789     │
└─────────────────────────────────────────┘
```
```

---

## 8. Lease TTL/Heartbeat Configuration ⚠️

**What it means**: How long does a "lock" last? How often do we renew it?

**Why it matters**: If too short, legitimate processing gets interrupted. If too long, stuck jobs take forever to recover.

**What's needed**:

### Analogy:
Think of a lease like checking out a library book:
- **TTL** = Due date (how long you can keep it)
- **Heartbeat** = Calling to renew (extending the due date)

### Example problem:
```
Bad Config:
TTL = 30 seconds (too short!)
Processing takes 2 minutes
Result: Lease expires mid-processing, another worker starts processing the same file!

Another Bad Config:
TTL = 1 hour (too long!)
Worker crashes after 5 seconds
Result: Job stuck for 1 hour before anyone else can take over!
```

### What the document should add:

```markdown
## Lease Configuration

### Recommended Settings

**TTL (Time To Live): 300 seconds (5 minutes)**
- Why: Gives enough time to process typical CSVs
- Most files process in < 2 minutes
- 5 minutes handles slow/large files
- Not so long that crashes cause big delays

**Heartbeat Interval: 30 seconds**
- Why: 10% of TTL is good rule of thumb
- Frequent enough to detect crashes quickly
- Not so frequent that it creates load

**Max Job Runtime: 600 seconds (10 minutes)**
- Why: Safety cutoff for huge files
- If job takes longer, something is wrong
- Force timeout and mark as failed

### How It Works

**Happy Path (Normal Processing):**
```
00:00 - Acquire lease (expires at 00:05)
00:30 - Heartbeat renew (expires at 00:35)
01:00 - Heartbeat renew (expires at 01:05)
01:30 - Processing complete
01:30 - Release lease
```

**Crash Path (Worker Dies):**
```
00:00 - Acquire lease (expires at 00:05)
00:30 - Heartbeat renew (expires at 00:35)
01:00 - Worker crashes (no more heartbeats)
01:05 - Lease expires (no renewal)
01:06 - Recovery sweep runs
01:06 - Job marked as "queued" again
01:07 - Different worker picks it up
```

**Monitoring:**
```python
# Check if lease is about to expire
if lease.expires_at - now() < 60:
    alert("Lease close to expiring")
    
# Check if job running too long
if job.running_time > MAX_JOB_RUNTIME:
    alert("Job exceeded max runtime")
    force_timeout(job)
```

### Configuration File Example:
```python
# config/settings.py
PROCESSING_LEASE_TTL = 300  # seconds
PROCESSING_HEARTBEAT = 30   # seconds  
PROCESSING_MAX_RUNTIME = 600  # seconds

# Derived settings
assert PROCESSING_HEARTBEAT < PROCESSING_LEASE_TTL / 2
assert PROCESSING_MAX_RUNTIME > PROCESSING_LEASE_TTL
```
```

---

## Summary: Why Each Item Matters

| Missing Item | Without It | With It |
|--------------|-----------|---------|
| **Migration Path** | Deploy breaks everything, lose in-progress work | Smooth transition, no data loss |
| **File Limits** | Server crashes on huge files | Clean rejection with error |
| **Normalization** | "iPhone" and "iphone" treated differently | Consistent duplicate detection |
| **Batch Semantics** | Unclear what happens on partial failure | Users understand the behavior |
| **Recovery Sweep** | Stuck jobs stay stuck forever | Automatic recovery from crashes |
| **Testing Scenarios** | Vague "add tests" - what tests? | Clear test cases to implement |
| **Monitoring** | Failures go unnoticed | Alerts catch problems early |
| **Lease Config** | Jobs stuck too long OR interrupted too soon | Balanced reliability |

---

## Bottom Line

The document is **really good** but these 8 things need to be spelled out in detail **before anyone starts coding**. Otherwise, developers will have to make these decisions themselves, and they might make different choices that cause problems later.

Adding these sections turns the document from "good architecture" to "ready to implement."
