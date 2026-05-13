# CF Tracker — Data Models

**v1.0 — Locked May 2026**

---

## Overview

Sixteen MongoDB collections. Mongoose ODM is assumed; references use ObjectId.

| # | Collection | Purpose |
|---|---|---|
| 1 | User | Auth + onboarding state |
| 2 | CFProfile | Codeforces-specific user data |
| 3 | Contest | Master catalog of CF contests |
| 4 | Problem | Master catalog of CF problems |
| 5 | Submission | Raw ingested submission data |
| 6 | TopicBucketScore | Computed per-user gap scores |
| 7 | DailyPlan | One per user per day |
| 8 | UpsolveQueue | Problems failed in real contests |
| 9 | ContestResult | Per-user contest outcomes |
| 10 | ContestProblemResult | Per-user per-problem outcomes |
| 11 | ReliabilityScore | Cached success-metric state |
| 12 | BenchmarkCohort | Versioned cohort user list |
| 13 | BenchmarkTargetCount | Per-bucket median target counts |
| 14 | IngestJob | Background ingest job tracking |
| 15 | VirtualContest | System-scheduled virtual contests |
| 16 | ValidationBaseline | Pre-tool snapshot for validation |

---

## 1. User

```
_id
name
email
passwordHash
onboardingCompleted: Boolean
onboardingStep: Number              // 0, 1, 2
coldStartComplete: Boolean          // false until ≥20 in-system solves
createdAt
```

**Indexes:**
- `email` (unique)

**Why:** Auth and onboarding state only. `codeforcesHandle` is **not** stored here — CFProfile is the single source of truth for the CF identifier. `coldStartComplete` tracks when to switch from tag-distribution plan to gap-driven plan.

---

## 2. CFProfile

```
_id
user                  → ref: User (unique)
handle
currentRating
maxRating
rank                              // "newbie", "specialist", etc.
lastIngestedSubmissionId          // for incremental sync
ingestStatus                      // pending / processing / complete / failed
ingestCompletedAt
lastSyncedAt
createdAt
```

**Indexes:**
- `user` (unique)
- `handle` (unique)

**Why:** Separate from User so CF data can be re-synced independently. CFProfile owns the canonical handle.

`stretchZoneLow` / `stretchZoneHigh` are **not** stored — they're computed inline as `currentRating` and `currentRating + 200`. Denormalization cost (atomic 3-field updates on every rating change) exceeded the benefit.

`ingestStatus` is the user-facing high-level sync state. It is **distinct** from `IngestJob.status`, which tracks individual job lifecycle. A completed IngestJob does not automatically mean `ingestStatus = complete` — the orchestrator updates CFProfile separately after verifying the full pipeline succeeded.

---

## 3. Contest

```
_id
cfContestId           // CF contest number (unique)
name
division              // "Div1" / "Div2" / "Div3" / "Educational"
startTime             // UTC
durationMinutes
problems: [
  {
    problemIndex      // "A", "A2", "B"
    problem           → ref: Problem
  }
]
createdAt
```

**Indexes:**
- `cfContestId` (unique)
- `(division, startTime)` — filter Div2 by date for virtual selection

**Why:** Master catalog of all CF contests. Required for three flows:

1. **Virtual contest selection** — enumerate past Div2 contests, score against user gap, pick best un-attempted.
2. **`contestOpportunities` calculation** — for each (topic, bucket), know which contests had a matching A/B problem, even for contests the user never entered.
3. **Cohort filters** — authoritative definition of what counts as a contest (`≥30 contests`).

`isDiv2` flags on ContestResult and ContestProblemResult are **denormalizations** of `Contest.division` for read speed, not primary signals. Contest is the source of truth.

Populated by a system-level ingest track (not user-triggered).

---

## 4. Problem

```
_id
cfContestId           // CF contest number
cfIndex               // "A", "A2", "B"
name
rating                // 800 - 3500
tags: []              // actual CF tags, e.g. ["dp", "greedy", "graphs"]
ratingBucket          // "800-1000", "1000-1200", etc. — DENORMALIZED from rating
url
isDiv2A: Boolean      // precomputed flag
isDiv2B: Boolean      // precomputed flag
createdAt
```

**Indexes:**
- `(cfContestId, cfIndex)` (unique)
- `(ratingBucket, tags)` — multikey index for daily plan queries
- `rating` — stretch zone filtering

**Why:** `ratingBucket` and `isDiv2A/B` are denormalized because every daily plan query filters on them. Recomputing from rating on every query would be wasteful.

---

## 5. Submission

```
_id
user                  → ref: User
problem               → ref: Problem
cfSubmissionId        // CF's own ID (unique per user)
verdict               // OK / WA / TLE / RE / MLE
                      // CE and SKIPPED are filtered out at ingest
participantType       // CONTESTANT / VIRTUAL / PRACTICE
cfContestId           // null if PRACTICE
timeConsumed          // ms
language
submittedAt           // from CF API, UTC normalized
createdAt
```

**Indexes:**
- `(user, cfSubmissionId)` (unique) — dedup on incremental sync
- `(user, problem)` compound — `seen_problems` dedup check, O(1)
- `(user, submittedAt)` — pre/post validation date ranges
- `(user, participantType, verdict)` — `contestFails` counting

**Why:** Raw source of truth. Every computed score is derived from this collection. `participantType` is critical — it separates diagnostic real-contest signal from practice exposure.

Submission does **not** store denormalized `topic` or `bucket`. All (topic, bucket) queries go through TopicBucketScore. Ad-hoc analytics requires JOIN through Problem.

---

## 6. TopicBucketScore

```
_id
user                  → ref: User
topic                 // "dp", "greedy" — actual CF tag names only
bucket                // "800-1000", "1000-1200", etc.
solves                // AC count in this (topic, bucket)
targetCount           // from BenchmarkTargetCount — DENORMALIZED for read speed

// Gap formula components (all stored)
baseGap               // 1 - (solves / targetCount)
contestFails          // real CONTESTANT non-AC submissions for this (topic, bucket)
contestOpportunities  // contests where a problem of this (topic, bucket) appeared
                      // and the user participated (NOT total contests)
penalty               // β × (contestFails / contestOpportunities)
                      // 0 if contestOpportunities = 0
finalGap              // clamp(baseGap + penalty, 0, 1) — β = 0.4

lastCalculated
createdAt
```

**Write semantics:**

On AC ingest, `solves` is incremented for **all** (topic, bucket) pairs matching the problem's `tags` array. Same all-tags rule applies to `contestFails` on a non-AC CONTESTANT submission. Slight count inflation is acceptable and consistent — cohort medians use the same all-tags attribution rule, so comparisons remain unbiased.

**Indexes:**
- `(user, topic, bucket)` (unique) — point lookups when updating
- `(user, finalGap desc)` — daily plan generation sorts by gap descending

**Why:** Most-read collection in the system. Every daily plan generation queries it. All formula components stored separately for interview defensibility and future debugging. `targetCount` is denormalized from BenchmarkTargetCount because the benchmark refreshes weekly — acceptable staleness.

---

## 7. DailyPlan

```
_id
user                  → ref: User
date                  // date only, no time (UTC)
planType              // "cold_start" / "gap_driven"
problems: [
  {
    problem           → ref: Problem
    type              // "gap" / "upsolve"
    status            // pending / solved / failed / skipped
    verdict           // OK / WA / TLE if submitted
    solvedAt
  }
]
completed: Boolean    // true when all pending = solved
replacedProblems: [   // audit trail when a problem was swapped
  {
    original          → ref: Problem
    replacement       → ref: Problem
    replacedAt
  }
]
createdAt
```

**Indexes:**
- `(user, date)` (unique) — fetch today's plan O(1)

**Why:** One document per user per day. Problems are embedded because they're always read together with the plan. `replacedProblems` is tracked for audit — "replaced by next-highest-priority gap problem in stretch zone."

---

## 8. UpsolveQueue

```
_id
user                  → ref: User
problem               → ref: Problem
sourceContestId       // contest where they failed
addedAt
scheduledFor          // earliest date this upsolve may surface
                      // set to addedAt + 1 day
                      // a problem added today appears tomorrow at the earliest
status                // pending / completed / skipped
completedAt
```

**Indexes:**
- `(user, status, scheduledFor)` — fetch today's pending upsolves
- `(user, problem)` (unique) — prevent duplicate queue entries

**Why:** Starts empty at signup. Only populated from CONTESTANT contest fails **after signup date**. Historical contest fails do NOT seed this queue — stale learning value.

One per day drawn into the daily plan: 2 gap + 1 upsolve. If queue empty, plan becomes 3 gap problems. Queue drains 1 per day.

---

## 9. ContestResult

```
_id
user                  → ref: User
cfContestId
contestName
isDiv2: Boolean       // only Div2 counts toward success metric
rank
oldRating
newRating
ratingChange
participatedAt
```

**Indexes:**
- `(user, cfContestId)` (unique)
- `(user, isDiv2, participatedAt)` — last 6 Div2 contests query

**Why:** Per-user contest outcomes. `isDiv2` denormalized from `Contest.division` for fast reliability queries.

---

## 10. ContestProblemResult

```
_id
user                  → ref: User
contestResult         → ref: ContestResult
cfContestId
problemIndex          // "A", "A2", "B"
problem               → ref: Problem
status                // solved / failed / unattempted
firstACTime           // minutes from contest start, null if not solved
failCount             // WA/TLE/RE before AC, or before contest end
isDiv2A: Boolean      // A2 treated as A (canonical)
isDiv2B: Boolean
```

**Indexes:**
- `(user, isDiv2A, status)` — reliability score A calculation
- `(user, isDiv2B, status)` — reliability score B calculation
- `(user, cfContestId, problemIndex)` (unique)

**Why:** Separated from ContestResult because problem-level data is queried independently from contest-level data. `isDiv2A/B` denormalized for fast reliability queries.

---

## 11. ReliabilityScore

```
_id
user                  → ref: User (unique)
last6Contests: [
  {
    contestId
    solvedA: Boolean
    solvedB: Boolean
    timeA                 // minutes, null if not solved
    timeB                 // minutes, null if not solved
    aReliable             // solvedA && timeA < 15
    bReliable             // solvedB && timeB < 40
  }
]
aReliableCount        // of last 6 contests
bReliableCount        // of last 6 contests
totalReal             // total real Div2 contests (may be < 6 for new users)
reliabilityProgress   // min(aReliableCount, bReliableCount) / 4
                      // bounded 0-1, UI progress indicator
                      // success metric = aReliableCount >= 4 AND bReliableCount >= 4
                      // evaluated inline as Boolean — not stored
lastCalculated
```

**Indexes:**
- `user` (unique)

**Why:** Fully denormalized cache. Recalculating from ContestProblemResult on every dashboard load is expensive. Refresh after every new contest ingest. TTL 5 min in Redis.

---

## 12. BenchmarkCohort

```
_id
filters: {
  country: "IN"
  minRating: 1300
  maxRating: 1500
  minContests: 30
  minSolves: 500
  lastContestWithinDays: 180
}
users: [
  {
    handle
    currentRating
    contestCount
    solveCount
    lastContestDate
  }
]
N                     // actual cohort size
fallbackUsed          // null / "1300-1700_IN" / "1300-1500_global" / "1300-1700_global"
lastRefreshed
version: Number       // increments on each refresh
```

**Indexes:**
- `version desc` — get latest version

**Why:** Cohort refreshed weekly. Raw user list stored for reproducibility and audit. `fallbackUsed` tracks when primary filter failed. Hard floor: N ≥ 15.

**Fallback order (upward only):**
1. IN, 1300–1500 (primary)
2. IN, 1300–1700
3. Global, 1300–1500
4. Global, 1300–1700
5. If still N < 15: hold previous version

---

## 13. BenchmarkTargetCount

```
_id
topic                 // "dp", "greedy" etc.
bucket                // "800-1000" etc.
p50                   // median — what gap function uses
cohortN               // N used to compute
cohortVersion         → ref: BenchmarkCohort.version
lastCalculated
```

**Indexes:**
- `(topic, bucket)` (unique) — gap function lookups

**Why:** Computed once from BenchmarkCohort, read thousands of times per day. Separating from cohort avoids recomputing medians on every TopicBucketScore update. Cached in Redis with TTL 7 days, invalidate on weekly cron.

---

## 14. IngestJob

```
_id
user                  → ref: User
type                  // "initial" / "daily_refresh"
status                // queued / processing / complete / failed
lastIngestedSubmissionId
submissionsIngested: Number
rateLimitHits: Number
error: String
startedAt
completedAt
createdAt
```

**Indexes:**
- `(user, status)` — check if ingest already running
- `(status, createdAt)` — queue processing order

**Why:** CF API is ~1 req/sec. Initial ingest for an active user takes 2–5 min wall clock. IngestJob enables async UX: sync `user.info` at signup, queue full submission ingest as background job. Prevents duplicate ingest jobs running simultaneously.

`IngestJob.status` tracks individual job lifecycle. Distinct from `CFProfile.ingestStatus`, which is the user-facing high-level sync state. A completed job does not automatically mean `ingestStatus = complete` — the orchestrator updates CFProfile separately after verifying the full pipeline succeeded.

---

## 15. VirtualContest

```
_id
user                  → ref: User
cfContestId           // which past Div2 contest
scheduledFor          // date assigned
status                // pending / in_progress / completed
startedAt
completedAt
results: [
  {
    problemIndex
    problem           → ref: Problem
    status            // solved / failed / unattempted
    firstACTime       // minutes from virtual start
    failCount
  }
]
selectionReason       // "top gap: dp@1000-1200"
```

**Indexes:**
- `(user, scheduledFor)` — fetch this week's virtual
- `(user, status)` — fetch pending virtuals

**Why:** System-selected based on user's current top gap bucket. Contests selected where A/B problems align with highest `finalGap` (topic, bucket) pair.

Virtual fails count toward training metrics but **NOT** toward the 4/6 success metric. Virtual fails do **NOT** feed `contestFails` in the gap formula (real contests only).

---

## 16. ValidationBaseline

```
_id
user                  → ref: User (unique)
snapshotDate          // date snapshot was taken (= end of initial ingest)
                      // represents "30 days pre-usage" baseline
topicBucketRates: [
  {
    topic
    bucket
    solveRate         // solves / attempts
    solvesCount       // must be >= 10 to be valid for comparison
    attemptsCount
  }
]
createdAt
```

**Indexes:**
- `user` (unique)

**Why:** Snapshot of user state at signup. **Captured at the END of initial ingest** (after `user.status` is fully fetched), not at signup time — at signup there's no submission history to compute against.

Used in post-usage comparison: "DP solve rate before: 32%, after: 51%." Portfolio/interview artifact, not a user-facing feature.

Min-N = 10 problems per (topic, bucket) for the comparison to count.

---

## Write Pipeline

When a new submission arrives via ingest, the fan-out depends on `participantType`:

### PRACTICE submission

1. `Submission.insert`
2. `TopicBucketScore.increment` — one write per tag in `problem.tags[]` (all-tags rule); only `solves` increments

No contest-side updates.

### CONTESTANT submission

1. `Submission.insert` ─┐
2. `ContestResult.upsert` ─┤ wrapped in `session.withTransaction`
3. `ContestProblemResult.insert` ─┘
4. `TopicBucketScore.increment` — `solves` (if AC) or `contestFails` (if non-AC); all-tags rule
5. `TopicBucketScore.increment` — `contestOpportunities` for the (topic, bucket) of A and B problems in this contest, triggered at step 2 (ContestResult upsert), not on every submission
6. `ReliabilityScore.refresh`
7. `UpsolveQueue.insert` if non-AC and after signup date

Steps 2+3 must succeed together or not at all (transactional). Steps 4–7 are best-effort with idempotent retry on failure.

### VIRTUAL submission

1. `Submission.insert`
2. `VirtualContest.results` update — record problem outcome in the embedded array
3. `TopicBucketScore.increment` — `solves` only (virtuals don't feed `contestFails`)

No ContestResult, no ContestProblemResult, no UpsolveQueue, no ReliabilityScore refresh.

### Cross-cutting notes

- **Transactionality:** Steps 2+3 of the CONTESTANT path use `session.withTransaction()`. Atlas M0 free tier provides the required replica set. Driver auto-retries `TransientTransactionError`. See architecture doc for full details.
- **Idempotency:** All inserts dedup on natural keys (`(user, cfSubmissionId)` for Submission, `(user, cfContestId)` for ContestResult, etc.), so retries are safe.
- **Ad-hoc Submission analytics** require a JOIN through Problem to get topic/bucket — Submission does not store these directly. All (topic, bucket) queries should go through TopicBucketScore.
- **DailyPlan ↔ VirtualContest linkage:** Not encoded in the data model. If a virtual is scheduled for today, the daily plan does NOT surface it — it's shown separately in the UI. Revisit if UX requires co-display.
