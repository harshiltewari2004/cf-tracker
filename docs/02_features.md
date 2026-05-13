# CF Tracker — Features

**v1.0 — Locked May 2026**

---

## Overview

Five user-facing features comprise the core product. Two supporting capabilities (historical data ingest and validation module) are infrastructure and portfolio artifacts respectively, not user-facing.

| # | Feature | Type |
|---|---|---|
| 1 | Gap-Driven Daily Training Engine | User-facing (CORE) |
| 2 | Population Benchmark Pipeline | User-facing |
| 3 | Contest Performance Tracker + Reliability | User-facing |
| 4 | Upsolving + Virtual Contest Loop | User-facing |
| 5 | Progress Dashboard | User-facing |
| 6 | Historical Data Ingest | Infrastructure |
| 7 | Validation Module | Portfolio defense (not user-facing) |

---

## 1. Gap-Driven Daily Training Engine (CORE)

The central feature. Generates one personalized practice plan per user per day.

### Daily plan composition

Each daily plan contains exactly **3 problems**: 2 "gap" problems + 1 "upsolve" problem.

- **Gap problems** are selected from the user's highest `final_gap` (topic, bucket) rows where the bucket falls within the user's stretch zone.
- **Upsolve problem** is drawn from the UpsolveQueue (problems the user failed in real contests). One per day, FIFO with dedup.

If the UpsolveQueue is empty, the plan becomes 3 gap problems.

### Stretch zone

Defined as `[user_rating, user_rating + 200]`. All gap-problem candidates must fall inside this range.

**Why:** Problems below `user_rating` are too easy to drive growth; problems above `user_rating + 200` produce frustration and skip-rates. The 200-point cap is empirical — it matches the typical span where practice transfers to contest performance.

### Empty-intersection fallback

If the highest-gap (topic, bucket) row has no available problems within the stretch zone (after dedup against `seen_problem_ids`), the system tries the **same topic at the nearest adjacent bucket** within the stretch zone. If still empty, it moves to the next-highest gap row.

The system does not recommend problems outside the stretch zone, even if it means picking a smaller-gap topic.

### Cold start

A user has no meaningful gap data until they've solved at least 20 problems through CF Tracker. During this period:

- `coldStartComplete = false`
- The daily plan switches to a **tag-distribution plan**: 3 problems sampled across the user's currently weakest tags from historical data, regardless of the gap formula.
- Once the user has logged 20 in-system solves, `coldStartComplete` flips to `true` and the gap-driven plan takes over.

The cold start exists because the gap formula's `base_gap` term needs reliable per-bucket solve counts, which require some user activity to stabilize.

### Completion tracking and rollover

A daily plan has `completed: true` when all 3 problems are solved. If a problem remains unsolved at end of day, it rolls over **once** to the next day's plan, replacing the next day's lowest-priority gap slot. After one rollover, an unsolved problem is dropped from the rotation.

### Replacement

If the user marks a problem "I can't solve this," the system swaps it for the next-highest-priority gap problem from the same stretch-zone search. The original is recorded in `replacedProblems` for audit. Replacement does not count as a fail.

---

## 2. Population Benchmark Pipeline

Computes the cohort-derived `target_count` per (topic, bucket) used by the gap function.

### Behavior

- Refreshed on a **weekly cron** (Sunday 03:00 UTC).
- Pulls cohort users matching the locked filters (see problem statement).
- Computes p50 (median) of solves per (topic, bucket) across cohort users.
- Stores the raw user list and cohort version for audit.
- Versioning: each refresh increments a version number; the previous version remains queryable.

### Fallback behavior

If the primary cohort filter yields N < 20, the system widens filters in a fixed order (see problem statement, "Fallback order"). If even the broadest fallback yields N < 15, the system **holds the previous version** rather than refreshing below the floor.

### Why weekly

Cohort populations shift gradually. Daily recomputation is unnecessary expense; quarterly is too stale to capture meta shifts. Weekly is the standard cadence for cohort-based benchmarks in education products.

---

## 3. Contest Performance Tracker + Reliability

Tracks the user's real Div 2 contest history and computes the success metric.

### Scope

- **Div 2 only.** Div 1, Div 3, Educational, and other rounds are tracked but not used for the success metric.
- **Real contests only.** Virtual participations are tracked separately and do not feed the success metric.
- **A2 problems are canonically treated as A.** When a Div 2 contest has both A and A2 (rare), A2 maps to A for reliability calculation.

### Reliability calculation

For the user's last 6 real Div 2 contests:

- `aReliable` = solved A in under 15 minutes
- `bReliable` = solved B in under 40 minutes
- `aReliableCount` = count of `aReliable = true` across the 6 contests
- `bReliableCount` = count of `bReliable = true` across the 6 contests
- **Success metric:** `aReliableCount >= 4 AND bReliableCount >= 4` (Boolean)
- **Progress indicator:** `min(aReliableCount, bReliableCount) / 4` for UI bars

### Contest feedback into gap function

When a real Div 2 contest concludes:

- Each user's contest fails (non-AC submissions on A or B) increment `contestFails` for the matching (topic, bucket) rows of the failed problem(s) — using the all-tags attribution rule.
- `contestOpportunities` increments for the (topic, bucket) of the A and B problems that appeared, regardless of solve status.
- The gap function is recomputed; weak topics surface in the next daily plan.

This is the closed-loop feedback that distinguishes CF Tracker from a stats dashboard.

---

## 4. Upsolving + Virtual Contest Loop

Two sub-features tied to closing contest-derived weaknesses.

### Upsolving

Every problem the user **fails in a real contest** is added to the UpsolveQueue automatically (CONTESTANT participantType, non-AC verdict). One upsolve problem per day surfaces in the daily plan.

- **Queue ordering:** FIFO from when added.
- **Dedup:** `(user, problem)` unique. A problem can only sit in the queue once.
- **Status states:** pending / completed / skipped.
- **Historical contest fails do NOT seed the queue.** Only contests *after signup* populate UpsolveQueue. Stale fails from a year ago have no learning value.

### Virtual contests

The system selects one past Div 2 contest per week for the user to attempt as a virtual.

- **Selection rule (Option B):** The system picks the past Div 2 contest whose A and B problems' (topic, bucket) align most closely with the user's current top gap. The virtual is not random — it reinforces what the user is currently weak at.
- **Cadence:** One per week. Scheduled but not enforced — the user can skip.
- **Virtual results feed training metrics.** They update `solves` in TopicBucketScore and inform plan generation.
- **Virtual results do NOT feed `contestFails` or the success metric.** Only real CONTESTANT participations do.

The asymmetric treatment of virtuals is deliberate: practice exposure (volume) yes, mastery evidence (contest_fails / success metric) no.

---

## 5. Progress Dashboard

The home screen the user opens daily. Aggregates state from all other features.

### What it shows

- **Today's plan** (3 problems with status)
- **Reliability summary** (`aReliableCount` and `bReliableCount`, with progress bars toward 4/6)
- **Recent contests** (last 3 with rank, rating change, A/B status)
- **Top gaps** (top 3 weakest (topic, bucket) pairs)
- **Ingest status banner** (only if user is mid-ingest)

The dashboard is read-only; actions happen on linked detail pages.

---

## 6. Historical Data Ingest (infrastructure)

Not a user-facing feature; supports everything else. Documented here because its scope decisions affect what's possible.

- **Triggered at signup.** User enters their CF handle; the system queues a background ingest job.
- **Async UX.** The user is sent to the dashboard immediately. The dashboard shows partial data with an ingest progress banner until complete (typically 2–5 minutes for an active user).
- **Triggered on handle change.** If a user updates their CF handle, the system re-runs the full ingest pipeline.
- **Daily refresh.** A cron job runs incremental sync for all users, fetching only submissions newer than `lastIngestedSubmissionId`.
- **Rate-limit-aware.** Codeforces API is ~1 req/sec; the ingest pipeline respects this globally and uses exponential backoff on failures.

---

## 7. Validation Module (portfolio artifact)

Not user-facing. Exists to defend the project in interviews.

- **At signup,** the system snapshots the user's pre-tool baseline: solve rate per (topic, bucket) computed from the 30 days of historical data immediately preceding signup.
- **Snapshot stored once,** never recomputed.
- **Post-tool comparison** is computed on demand: solve rate per (topic, bucket) for the 30 days after signup.
- **Min-N = 10:** A (topic, bucket) comparison is only valid if the user attempted at least 10 problems in that bucket. Smaller samples are excluded.
- **Reported as correlational only.** The interview defense is explicit about what this does and does not prove (see problem statement, "Validation methodology").

---

## Scope phasing

### MVP (must ship)
- Gap-Driven Daily Training Engine
- Population Benchmark Pipeline
- Contest Performance Tracker + Reliability
- Upsolving (basic queue, no virtual contests yet)
- Progress Dashboard
- Historical Data Ingest
- Validation Module (data captured even if not surfaced in UI)

### v1.5 (post-MVP polish)
- Virtual contest loop
- Replacement audit trail UI
- Cold-start visualization

### v2 (future)
- β tuning based on accumulated user data
- Multi-tag attribution refinement (weighted instead of all-tags equal)
- Div 3 / Educational round support
- Mobile responsive polish
- Public benchmark dataset export (open source)
