# Keyword Project Manager - Application Flow & Feature Documentation

> **Purpose**: This document provides a complete overview of all application flows, features, and their current implementation status versus intended behavior.

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Complete User Journey](#complete-user-journey)
3. [Authentication Flow](#authentication-flow)
4. [Project Management](#project-management)
5. [CSV Upload & Processing](#csv-upload--processing)
6. [Keyword Management](#keyword-management)
7. [Token Management](#token-management)
8. [Grouping Operations](#grouping-operations)
9. [Notes & Export](#notes--export)
10. [Activity Logs](#activity-logs)
11. [Known Issues & Gaps](#known-issues--gaps)
12. [Quick Reference Tables](#quick-reference-tables)

---

## Application Overview

**Keyword Project Manager** is a full-stack SEO keyword management and analysis platform.

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.10+, SQLAlchemy (async) |
| Database | PostgreSQL 14+ |
| State | Redux Toolkit (client), JWT (auth) |

### Core Capabilities

```
┌─────────────────────────────────────────────────────────────────┐
│                    KEYWORD PROJECT MANAGER                       │
├─────────────────────────────────────────────────────────────────┤
│  • Upload & process large CSV files with keyword data           │
│  • Intelligent keyword grouping via NLP tokenization            │
│  • Manage keyword lifecycle (ungrouped → grouped → confirmed)   │
│  • Analyze metrics: volume, difficulty, rating, SERP features   │
│  • Token merging, blocking, and custom token creation           │
│  • Project notes, activity logs, and data export                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Complete User Journey

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   1. LOGIN   │────▶│  2. PROJECTS │────▶│  3. PROJECT  │
│              │     │   DASHBOARD  │     │    DETAIL    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
         ┌───────────────────────────────────────┼───────────────────────────────────────┐
         │                                       │                                       │
         ▼                                       ▼                                       ▼
┌──────────────┐                        ┌──────────────┐                        ┌──────────────┐
│  4. UPLOAD   │                        │  5. MANAGE   │                        │  6. MANAGE   │
│     CSV      │                        │   KEYWORDS   │                        │    TOKENS    │
└──────────────┘                        └──────────────┘                        └──────────────┘
         │                                       │                                       │
         └───────────────────────────────────────┼───────────────────────────────────────┘
                                                 │
         ┌───────────────────────────────────────┼───────────────────────────────────────┐
         │                                       │                                       │
         ▼                                       ▼                                       ▼
┌──────────────┐                        ┌──────────────┐                        ┌──────────────┐
│   7. GROUP   │                        │   8. NOTES   │                        │  9. EXPORT   │
│   KEYWORDS   │                        │   & LOGS     │                        │    DATA      │
└──────────────┘                        └──────────────┘                        └──────────────┘
```

---

## Authentication Flow

### Current Implementation

| Step | Action | Details |
|------|--------|---------|
| 1 | Navigate to `/login` | User lands on login page |
| 2 | Enter credentials | Hardcoded: `admin` / `password123` |
| 3 | Submit form | Frontend calls `POST /api/login` |
| 4 | Receive tokens | Backend returns `access_token` + `refresh_token` (JWT) |
| 5 | Store tokens | Saved to `localStorage` |
| 6 | Redirect | User sent to `/projects` dashboard |

### Token Management

```
┌─────────────────────────────────────────────────────────────────┐
│                        TOKEN LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   LOGIN ──▶ [Access Token] ──▶ API Requests                     │
│                  │                   │                           │
│                  │              401 Error?                       │
│                  │                   │                           │
│                  │                   ▼                           │
│                  │         [Refresh Token] ──▶ New Access Token  │
│                  │                                               │
│   Token Expiry: 30 days (both access & refresh)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Current vs. Should Work

| Aspect | Current State | Should Be |
|--------|---------------|-----------|
| **Credentials** | Hardcoded (`admin`/`password123`) | User registration, hashed passwords, database storage |
| **Token Expiry** | 30 days (very long) | Access: 15-60 min, Refresh: 7 days |
| **Multi-user** | Single user only | Multiple users with roles/permissions |
| **Session Management** | localStorage only | httpOnly cookies for better security |
| **Logout** | Clears localStorage | Server-side token invalidation |

---

## Project Management

### Projects Dashboard (`/projects`)

#### Features

| Feature | Description | Status |
|---------|-------------|--------|
| **List Projects** | Display all projects in sortable table | Working |
| **Real-time Stats** | Show keyword counts per status | Working |
| **Create Project** | Add new project with name | Working |
| **Edit Project** | Rename existing project | Working |
| **Delete Project** | Remove project (cascades to keywords) | Working |

#### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROJECTS DASHBOARD                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   GET /api/projects/with-stats                                  │
│         │                                                        │
│         ▼                                                        │
│   ┌─────────────────────────────────────────────────────┐       │
│   │  Single optimized SQL query (CTE + FILTER clauses)  │       │
│   │  Returns: project + ungrouped/grouped/confirmed/    │       │
│   │           blocked counts in ONE query               │       │
│   └─────────────────────────────────────────────────────┘       │
│         │                                                        │
│         ▼                                                        │
│   Redux Store ──▶ ProjectsTable Component                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Project Stats Display

```
┌──────────────────────────────────────────────────────────────────┐
│  PROJECT: "SEO Campaign Q1"                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│   │ UNGROUPED│  │ GROUPED │  │CONFIRMED│  │ BLOCKED │            │
│   │   245    │  │   150   │  │    75   │  │    30   │            │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Current vs. Should Work

| Aspect | Current State | Should Be |
|--------|---------------|-----------|
| **Delete Operation** | Background task (session issues) | Synchronous or proper async session handling |
| **Project Duplication** | Not implemented | Clone project with all keywords |
| **Project Archives** | Not implemented | Soft delete / archive functionality |
| **Project Sharing** | Not implemented | Share with other users (when multi-user) |

---

## CSV Upload & Processing

### Upload Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      CSV UPLOAD PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   USER                                                           │
│     │                                                            │
│     │  1. Select/Drop CSV file                                  │
│     ▼                                                            │
│   ┌─────────────────────────────────────────┐                   │
│   │         FRONTEND CHUNKING               │                   │
│   │  • File > threshold? Split into chunks  │                   │
│   │  • Progress tracking per chunk          │                   │
│   └─────────────────────────────────────────┘                   │
│     │                                                            │
│     │  2. POST /api/projects/{id}/upload (multipart)            │
│     ▼                                                            │
│   ┌─────────────────────────────────────────┐                   │
│   │         BACKEND STORAGE                 │                   │
│   │  • Save file to UPLOAD_DIR              │                   │
│   │  • Create CSVUpload record              │                   │
│   │  • Queue processing job                 │                   │
│   └─────────────────────────────────────────┘                   │
│     │                                                            │
│     │  3. Background async processing                           │
│     ▼                                                            │
│   ┌─────────────────────────────────────────┐                   │
│   │         NLP PROCESSING                  │                   │
│   │  • Parse CSV rows                       │                   │
│   │  • Tokenize keywords (NLTK)             │                   │
│   │  • Remove stop words                    │                   │
│   │  • Lemmatize tokens                     │                   │
│   │  • Normalize compounds                  │                   │
│   │  • Deduplicate per project              │                   │
│   │  • Auto-group by token matching         │                   │
│   └─────────────────────────────────────────┘                   │
│     │                                                            │
│     │  4. Frontend polls /processing-status                     │
│     ▼                                                            │
│   ┌─────────────────────────────────────────┐                   │
│   │         COMPLETION                      │                   │
│   │  • Keywords visible in table            │                   │
│   │  • Stats updated                        │                   │
│   │  • Activity log created                 │                   │
│   └─────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Expected CSV Format

```csv
Keyword,Volume,Difficulty,Rating,SERP Features
best seo tools,12000,45,4.5,"featured snippet, video"
keyword research,8500,38,4.2,"people also ask"
```

| Column | Required | Type | Description |
|--------|----------|------|-------------|
| Keyword | Yes | string | The keyword text |
| Volume | No | integer | Monthly search volume |
| Difficulty | No | integer (0-100) | SEO difficulty score |
| Rating | No | float | Custom rating |
| SERP Features | No | string (comma-separated) | Google SERP features |

### NLP Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    NLP TOKENIZATION FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Input: "best seo tools for small businesses"                  │
│                                                                  │
│   Step 1: TOKENIZATION (NLTK word_tokenize)                     │
│   ────────────────────────────────────────────                  │
│   Result: ["best", "seo", "tools", "for", "small", "businesses"]│
│                                                                  │
│   Step 2: STOP WORD REMOVAL                                     │
│   ────────────────────────────────────────────                  │
│   Removed: "for"                                                 │
│   Result: ["best", "seo", "tools", "small", "businesses"]       │
│                                                                  │
│   Step 3: LEMMATIZATION (WordNetLemmatizer)                     │
│   ────────────────────────────────────────────                  │
│   Result: ["best", "seo", "tool", "small", "business"]          │
│                                                                  │
│   Step 4: COMPOUND NORMALIZATION                                │
│   ────────────────────────────────────────────                  │
│   Maps: "seo tool" → "seo_tool" (if compound exists)            │
│   Result: ["best", "seo_tool", "small", "business"]             │
│                                                                  │
│   Final tokens stored in keywords.tokens (JSONB)                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Current vs. Should Work

| Aspect | Current State | Should Be |
|--------|---------------|-----------|
| **NLTK Downloads** | Downloads at module import (blocks startup) | Pre-download in setup script or lazy load |
| **Non-English Keywords** | Auto-blocked flag removed during import | Proper non-English handling with flag preservation |
| **Chunk Throttling** | Artificial 0.5ms delay per chunk | Remove throttling or make configurable |
| **Large File Handling** | Works but no streaming | True streaming for very large files (>100MB) |
| **Duplicate Detection** | Per-project only | Option for cross-project duplicate alerts |
| **Error Recovery** | Basic error handling | Partial import recovery, row-level error reporting |

---

## Keyword Management

### Keyword States

```
┌─────────────────────────────────────────────────────────────────┐
│                    KEYWORD STATE MACHINE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────┐                                                  │
│   │ UNGROUPED │ ◀──────────────────────────────────────┐        │
│   └─────┬─────┘                                        │        │
│         │                                              │        │
│         │ group()                             ungroup()│        │
│         ▼                                              │        │
│   ┌───────────┐                              ┌────────┴──┐      │
│   │  GROUPED  │ ────────── confirm() ──────▶│ CONFIRMED │      │
│   └─────┬─────┘                              └───────────┘      │
│         │                                          │            │
│         │                               unconfirm()│            │
│         │                                          │            │
│         ◀──────────────────────────────────────────┘            │
│                                                                  │
│   ANY STATE                                                      │
│       │                                                          │
│       │ block_token()                                           │
│       ▼                                                          │
│   ┌───────────┐                                                  │
│   │  BLOCKED  │                                                  │
│   └─────┬─────┘                                                  │
│         │                                                          │
│         │ unblock()                                              │
│         ▼                                                          │
│   Returns to UNGROUPED                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Keyword Table Features

| Feature | Description | Current State |
|---------|-------------|---------------|
| **Pagination** | Server-side, configurable page size | Working (1000+ per page supported) |
| **Status Filter** | Filter by ungrouped/grouped/confirmed/blocked | Working |
| **Token Filter** | Include/exclude specific tokens | Working |
| **SERP Filter** | Filter by SERP features | Working |
| **Text Search** | Search keyword text | Working (but in-memory, inefficient) |
| **Sorting** | Sort by volume, difficulty, rating | Working |
| **Row Selection** | Multi-select for bulk operations | Working |
| **Expandable Rows** | Show child keywords for groups | Working |

### Keyword Table Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  KEYWORDS                                           Filter: [Ungrouped ▼]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ [Search keywords...]  [Include tokens: ▼]  [Exclude tokens: ▼]      │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──┬─────────────────────────┬────────┬────────┬────────┬─────────────┐ │
│  │☐ │ KEYWORD                 │ VOLUME │ DIFF.  │ RATING │ SERP        │ │
│  ├──┼─────────────────────────┼────────┼────────┼────────┼─────────────┤ │
│  │☐ │ best seo tools          │ 12,000 │   45   │  4.5   │ snippet,vid │ │
│  │☐ │ keyword research tips   │  8,500 │   38   │  4.2   │ paa         │ │
│  │☐ │ ▶ seo strategies (3)    │ 15,000 │   52   │  4.7   │ -           │ │
│  │  │   └─ seo strategy 2024  │  5,000 │   48   │  4.6   │ snippet     │ │
│  │  │   └─ best seo strategy  │  6,000 │   55   │  4.8   │ -           │ │
│  │  │   └─ seo strategy guide │  4,000 │   50   │  4.5   │ video       │ │
│  └──┴─────────────────────────┴────────┴────────┴────────┴─────────────┘ │
│                                                                            │
│  Showing 1-50 of 500 keywords                    [◀] [1] [2] [3] ... [▶]  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Current vs. Should Work

| Aspect | Current State | Should Be |
|--------|---------------|-----------|
| **Text Search** | In-memory filtering (slow at scale) | Database full-text search (PostgreSQL tsvector) |
| **`is_parent` Flag** | Forced `True` for all filtered keywords | Proper conditional logic based on actual state |
| **Bulk Selection** | Select visible page only | "Select all matching filter" option |
| **Column Customization** | Fixed columns | User-configurable visible columns |
| **Keyboard Navigation** | Not implemented | Arrow keys, Enter to expand, shortcuts |

---

## Token Management

### Token Operations

```
┌─────────────────────────────────────────────────────────────────┐
│                      TOKEN MANAGEMENT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   VIEW MODES:                                                    │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│   │ Current  │ │   All    │ │ Blocked  │ │  Merged  │          │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│   OPERATIONS:                                                    │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    MERGE TOKENS                          │   │
│   │                                                          │   │
│   │   Parent Token: [seo_tool        ]                      │   │
│   │                                                          │   │
│   │   Child Tokens:                                          │   │
│   │   ☑ seo                                                  │   │
│   │   ☑ tool                                                 │   │
│   │   ☐ software                                             │   │
│   │                                                          │   │
│   │   [Merge Selected]                                       │   │
│   │                                                          │   │
│   │   Result: All keywords with "seo" or "tool" tokens      │   │
│   │           will have those replaced with "seo_tool"       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    BLOCK BY TOKEN                        │   │
│   │                                                          │   │
│   │   Select token "spam" → All keywords containing          │   │
│   │   "spam" token marked as BLOCKED                         │   │
│   │                                                          │   │
│   │   Block reason: "user" | "system" | "merge_hidden"       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                  CREATE CUSTOM TOKEN                     │   │
│   │                                                          │   │
│   │   New Token: [my_custom_token    ]                      │   │
│   │   Apply to keywords: [Selected keywords]                 │   │
│   │                                                          │   │
│   │   [Create Token]                                         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Token Table Display

```
┌────────────────────────────────────────────────────────────────────────────┐
│  TOKENS                                              View: [Current ▼]     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────┬──────────┬────────────┬──────────┬─────────────┐ │
│  │ TOKEN               │ KEYWORDS │ AVG VOLUME │ AVG DIFF │ ACTIONS     │ │
│  ├─────────────────────┼──────────┼────────────┼──────────┼─────────────┤ │
│  │ seo                 │    156   │   8,500    │    42    │ [Block][+]  │ │
│  │ tool                │     89   │   6,200    │    38    │ [Block][+]  │ │
│  │ keyword             │    234   │  12,000    │    55    │ [Block][+]  │ │
│  │ ▶ seo_tool (merged) │     45   │   7,350    │    40    │ [Unmerge]   │ │
│  │   └─ seo (child)    │          │            │          │             │ │
│  │   └─ tool (child)   │          │            │          │             │ │
│  └─────────────────────┴──────────┴────────────┴──────────┴─────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Merge Operation Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    MERGE OPERATION STORAGE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   merge_operations table:                                        │
│   ┌───────────────────────────────────────────────────────┐     │
│   │ id | project_id | parent_token | child_tokens | op_id │     │
│   ├───────────────────────────────────────────────────────┤     │
│   │ 1  │     5      │  "seo_tool"  │ ["seo","tool"]│ uuid │     │
│   └───────────────────────────────────────────────────────┘     │
│                                                                  │
│   keyword_merge_operations table (for rollback):                │
│   ┌───────────────────────────────────────────────────────┐     │
│   │ id | keyword_id | merge_op_id | original_tokens_snap  │     │
│   ├───────────────────────────────────────────────────────┤     │
│   │ 1  │    101     │      1      │ ["seo","tool","best"] │     │
│   │ 2  │    102     │      1      │ ["seo","guide"]       │     │
│   └───────────────────────────────────────────────────────┘     │
│                                                                  │
│   Enables: Full rollback of merge operations                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Current vs. Should Work

| Aspect | Current State | Should Be |
|--------|---------------|-----------|
| **Token Caching** | In-memory with TTL | Redis or database-level caching for scale |
| **Merge Preview** | Not implemented | Show affected keywords before merge confirmation |
| **Batch Merge** | One merge at a time | Queue multiple merges, process sequentially |
| **Merge Undo** | Full unmerge only | Step-by-step undo with history |

---

## Grouping Operations

### Grouping Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      GROUPING WORKFLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   STEP 1: SELECT KEYWORDS                                        │
│   ───────────────────────                                        │
│   User selects ungrouped keywords from table                    │
│                                                                  │
│   STEP 2: INITIATE GROUP                                         │
│   ──────────────────────                                         │
│   Click "Group Selected" button                                  │
│                                                                  │
│   STEP 3: NAME THE GROUP                                         │
│   ──────────────────────                                         │
│   ┌─────────────────────────────────────────┐                   │
│   │ Group Name: [seo tools              ▼]  │                   │
│   │                                          │                   │
│   │ Suggestions:                             │                   │
│   │ • seo tools (from tokens)                │                   │
│   │ • keyword research (existing group)      │                   │
│   │ • [Create new...]                        │                   │
│   └─────────────────────────────────────────┘                   │
│                                                                  │
│   STEP 4: BACKEND PROCESSING                                     │
│   ──────────────────────────                                     │
│   POST /api/projects/{id}/group                                 │
│   {                                                              │
│     "keyword_ids": [1, 2, 3],                                   │
│     "group_name": "seo tools"                                   │
│   }                                                              │
│                                                                  │
│   Backend actions:                                               │
│   • Create parent keyword (is_parent=true)                      │
│   • Aggregate volume/difficulty from children                   │
│   • Assign group_id to all selected keywords                    │
│   • Update status to "grouped"                                  │
│   • Save original_state snapshot for ungroup                    │
│   • Log activity                                                 │
│                                                                  │
│   STEP 5: RESULT                                                 │
│   ──────────────                                                 │
│   ┌─────────────────────────────────────────┐                   │
│   │ ▶ seo tools (3)          15,000   45    │                   │
│   │   └─ best seo tools       5,000   42    │                   │
│   │   └─ seo tools review     6,000   48    │                   │
│   │   └─ free seo tools       4,000   45    │                   │
│   └─────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Available Grouping Operations

| Operation | Input | Output | Notes |
|-----------|-------|--------|-------|
| **Group** | Ungrouped keywords + name | New group with parent | Creates hierarchy |
| **Regroup** | Grouped keywords + new name | Keywords moved to different group | Recalculates metrics |
| **Ungroup** | Grouped keywords | Keywords return to ungrouped | Uses saved snapshots |
| **Confirm** | Grouped keywords | Status → confirmed | Marks as finalized |
| **Unconfirm** | Confirmed keywords | Status → grouped | Reverts confirmation |

### Parent Keyword Metrics Calculation

```
┌─────────────────────────────────────────────────────────────────┐
│              PARENT METRICS AGGREGATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Parent "seo tools" aggregates from children:                  │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Child Keyword          │ Volume │ Difficulty │ Rating   │   │
│   ├─────────────────────────────────────────────────────────┤   │
│   │ best seo tools         │  5,000 │    42      │   4.5    │   │
│   │ seo tools review       │  6,000 │    48      │   4.2    │   │
│   │ free seo tools         │  4,000 │    45      │   4.3    │   │
│   ├─────────────────────────────────────────────────────────┤   │
│   │ PARENT TOTAL/AVG       │ 15,000 │    45      │   4.33   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   Formulas:                                                      │
│   • Volume = SUM(child_volumes)                                 │
│   • Difficulty = AVG(child_difficulties)                        │
│   • Rating = AVG(child_ratings)                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Current vs. Should Work

| Aspect | Current State | Should Be |
|--------|---------------|-----------|
| **Difficulty on Regroup** | Ignores existing children when adding | Recalculate including all children |
| **Parent-only Regroup** | Can zero-out metrics | Prevent or warn when moving parents without children |
| **Group Suggestions** | Basic autocomplete | ML-based suggestions from token analysis |
| **Bulk Confirm** | One at a time | Select multiple groups, confirm all |
| **Group Splitting** | Not implemented | Split one group into multiple |

---

## Notes & Export

### Notes Feature

```
┌─────────────────────────────────────────────────────────────────┐
│                      PROJECT NOTES                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  NOTE 1 (Strategy Notes)                                │   │
│   │  ─────────────────────────────────────────────────────  │   │
│   │  [B] [I] [U] [Link] [List] [H1] [H2]                    │   │
│   │  ───────────────────────────────────────────────────    │   │
│   │                                                          │   │
│   │  Focus keywords for Q1:                                  │   │
│   │  • SEO tools - high volume, medium difficulty           │   │
│   │  • Keyword research - evergreen content                 │   │
│   │                                                          │   │
│   │  ✓ Autosaved 2 seconds ago                              │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  NOTE 2 (Implementation Notes)                          │   │
│   │  ─────────────────────────────────────────────────────  │   │
│   │  [B] [I] [U] [Link] [List] [H1] [H2]                    │   │
│   │  ───────────────────────────────────────────────────    │   │
│   │                                                          │   │
│   │  Content calendar:                                       │   │
│   │  Week 1: SEO tools roundup article                      │   │
│   │  Week 2: Keyword research guide                         │   │
│   │                                                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Export Options

| Export Type | Endpoint | Format | Contents |
|-------------|----------|--------|----------|
| **All Keywords** | `GET /export-csv` | CSV | All keywords with metrics |
| **Parent Keywords** | `GET /export-parent-keywords` | CSV | Parent keywords summary |
| **Import Parents** | `POST /import-parent-keywords` | CSV | Import parent mappings |

### Export CSV Format

```csv
Keyword,Volume,Difficulty,Rating,Status,Group Name,Is Parent,SERP Features
best seo tools,5000,42,4.5,grouped,seo tools,false,"featured snippet"
seo tools,15000,45,4.33,grouped,seo tools,true,""
```

### Current vs. Should Work

| Aspect | Current State | Should Be |
|--------|---------------|-----------|
| **Note Fields** | 2 fixed note fields | Unlimited notes with titles |
| **Note Formatting** | Basic HTML | Full rich text (images, tables, code blocks) |
| **Export Filters** | All or parents only | Export filtered view, custom column selection |
| **Export Formats** | CSV only | CSV, Excel (.xlsx), JSON |
| **Scheduled Exports** | Not implemented | Auto-export to email/cloud on schedule |

---

## Activity Logs

### Activity Log Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                      ACTIVITY LOGS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Filters: [All Actions ▼] [All Users ▼] [Date Range ▼]        │
│                                                                  │
│   ┌───────────┬─────────┬─────────────────────────┬───────────┐ │
│   │ TIMESTAMP │ USER    │ ACTION                  │ DETAILS   │ │
│   ├───────────┼─────────┼─────────────────────────┼───────────┤ │
│   │ 2024-01-15│ admin   │ project_created         │ "SEO Q1"  │ │
│   │ 10:30:00  │         │                         │           │ │
│   ├───────────┼─────────┼─────────────────────────┼───────────┤ │
│   │ 2024-01-15│ admin   │ csv_uploaded            │ 500 rows  │ │
│   │ 10:32:15  │         │                         │           │ │
│   ├───────────┼─────────┼─────────────────────────┼───────────┤ │
│   │ 2024-01-15│ admin   │ keywords_grouped        │ 25 kws →  │ │
│   │ 10:45:00  │         │                         │ "seo"     │ │
│   ├───────────┼─────────┼─────────────────────────┼───────────┤ │
│   │ 2024-01-15│ admin   │ tokens_merged           │ seo+tool  │ │
│   │ 11:00:00  │         │                         │ →seo_tool │ │
│   └───────────┴─────────┴─────────────────────────┴───────────┘ │
│                                                                  │
│   Page 1 of 5                              [◀] [1] [2] [3] [▶]  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Logged Actions

| Action | Trigger | Details Captured |
|--------|---------|------------------|
| `project_created` | New project | Project name |
| `project_renamed` | Edit project | Old name, new name |
| `project_deleted` | Delete project | Project name |
| `csv_uploaded` | CSV upload complete | File name, row count |
| `keywords_grouped` | Group operation | Keyword count, group name |
| `keywords_regrouped` | Regroup operation | From group, to group, count |
| `keywords_ungrouped` | Ungroup operation | Keyword count |
| `keywords_blocked` | Block by token | Token, keyword count |
| `keywords_unblocked` | Unblock operation | Keyword count |
| `keywords_confirmed` | Confirm operation | Keyword count |
| `tokens_merged` | Token merge | Parent token, child tokens |
| `tokens_unmerged` | Token unmerge | Parent token |

### Current vs. Should Work

| Aspect | Current State | Should Be |
|--------|---------------|-----------|
| **User Tracking** | Single user ("admin") | Multi-user with real usernames |
| **Log Retention** | Unlimited | Configurable retention period |
| **Export Logs** | Not implemented | Export to CSV/JSON |
| **Undo from Log** | Not implemented | Click log entry to undo action |
| **Real-time Updates** | Polling | WebSocket for live updates |

---

## Known Issues & Gaps

### Critical Issues

| Issue | Location | Impact | Should Be |
|-------|----------|--------|-----------|
| **Hardcoded Auth** | `backend/app/routers/auth.py` | Security vulnerability | Proper user management, hashed passwords |
| **DB Config Mismatch** | `backend/app/config.py` | Defaults to MySQL, uses Postgres JSONB | Fix default or validate at startup |
| **Background Task Sessions** | `backend/app/routers/projects.py` | Delete tasks fail silently | Use task-scoped sessions |
| **`is_parent` Corruption** | `backend/app/routers/keyword_routes.py` | UI state corruption | Conditional logic based on actual state |

### Performance Issues

| Issue | Location | Impact | Should Be |
|-------|----------|--------|-----------|
| **In-memory Search** | Keyword text search | Slow at scale (1000+ keywords) | PostgreSQL full-text search |
| **NLTK Import Time** | `backend/app/services/nlp/` | Blocks server startup | Lazy load or pre-download |
| **Chunk Throttle** | Frontend upload | Unnecessary slowdown | Remove or make configurable |
| **Token Recalculation** | Token management | Expensive repeated queries | Better caching strategy |

### Functional Gaps

| Gap | Description | Priority |
|-----|-------------|----------|
| **Multi-user Support** | Only single hardcoded user | High |
| **Project Archiving** | No soft delete/archive | Medium |
| **Keyboard Shortcuts** | No keyboard navigation | Medium |
| **Undo/Redo** | No undo for most operations | Medium |
| **Bulk Operations** | Limited bulk actions | Medium |
| **Search Improvements** | No fuzzy search, no advanced queries | Medium |
| **Data Validation** | Limited CSV validation | Low |
| **Internationalization** | English only | Low |

### API Issues

| Endpoint | Issue | Should Be |
|----------|-------|-----------|
| `/keywords-for-cache` | Returns timestamp/status instead of keyword data | Return actual keyword data or rename |
| `/processing-status` | Polling-based | WebSocket for real-time updates |
| Difficulty calculation | Skewed when adding to existing groups | Include all children in calculation |
| Regrouping | Can zero metrics if only parents moved | Validate or auto-include children |

---

## Quick Reference Tables

### API Endpoints Summary

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Login with credentials |
| POST | `/api/refresh` | Refresh access token |

#### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/with-stats` | List with keyword stats |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/{id}` | Get project |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project |

#### Keywords
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/{id}/keywords` | List keywords (paginated) |
| GET | `/api/projects/{id}/initial-data` | Initial data load |
| POST | `/api/projects/{id}/upload` | Upload CSV |
| GET | `/api/projects/{id}/processing-status` | Check processing status |
| POST | `/api/projects/{id}/group` | Group keywords |
| POST | `/api/projects/{id}/regroup` | Move keywords to group |
| POST | `/api/projects/{id}/ungroup` | Ungroup keywords |
| POST | `/api/projects/{id}/block-token` | Block by token |
| POST | `/api/projects/{id}/unblock` | Unblock keywords |
| POST | `/api/projects/{id}/confirm` | Confirm keywords |

#### Tokens
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/{id}/tokens` | List tokens |
| POST | `/api/projects/{id}/merge-tokens` | Merge tokens |
| POST | `/api/projects/{id}/unmerge-token` | Unmerge tokens |
| POST | `/api/projects/{id}/create-token` | Create custom token |

#### Export/Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/{id}/export-csv` | Export keywords |
| GET | `/api/projects/{id}/export-parent-keywords` | Export parents |
| POST | `/api/projects/{id}/import-parent-keywords` | Import parents |

### Keyboard Shortcuts (Proposed)

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate table rows |
| `Enter` | Expand/collapse group |
| `Space` | Toggle row selection |
| `Ctrl+A` | Select all visible |
| `Ctrl+G` | Group selected |
| `Ctrl+B` | Block selected |
| `Ctrl+F` | Focus search |
| `Esc` | Clear selection |

### Status Badge Colors

| Status | Color | Meaning |
|--------|-------|---------|
| Ungrouped | Gray | Not yet categorized |
| Grouped | Blue | Assigned to a group |
| Confirmed | Green | Finalized/approved |
| Blocked | Red | Excluded from analysis |

---

## Document Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-20 | Initial comprehensive documentation |

---

*This document is auto-generated based on codebase analysis. For the most current implementation details, refer to the source code and inline documentation.*
