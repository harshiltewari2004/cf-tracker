# Decisions log

## 2026-05-13 — Deploy target
- Chose **Render** over Railway. Render free tier sufficient for MVP.
- Frontend on Vercel.
- Both colocated with Atlas in **AWS Oregon (us-west-2)** / Upstash in **us-west-1**.
- Reason: backend ↔ database is the chattiest pair; colocate them.

## 2026-05-13 — bcryptjs over bcrypt
- Locked docs say `bcrypt`; using `bcryptjs` instead.
- Reason: pure-JS, no node-gyp native build step. Identical behavior for our use.

## 2026-05-13 — VITE_API_URL convention
- Base URL only, no trailing slash, no path suffix.
- Code does `${VITE_API_URL}/api/health` — never `${VITE_API_URL}health`.

## 2026-05-13 — Render cold start
- Free tier sleeps after 15 min inactivity. First request after sleep: ~30s cold boot.
- Acceptable for MVP. Revisit if it impacts demo.

## 2026-06-09 — Handle change wipe policy 
-Handle change wipes user-scoped derived collections before re-ingest; rationale: orphan contamination; catalog collections (Contest/Problem) untouched; non-atomic, empty window acceptable for MVP.

## 2026-06-10 — Rate limiter trust proxy (deferred to deploy)
- express-rate-limit keys clients by IP. On Render (behind a proxy), the real
  client IP is in X-Forwarded-For; without `app.set('trust proxy', ...)` all
  users share the proxy's IP and one bucket, tripping limits collectively.
- Action at Phase 7 deploy: set trust proxy deliberately (not blindly — over-
  trusting enables IP spoofing). Local dev unaffected; deferred until deploy.

  ## 2026-06-10 — Rate limiter uses in-memory store for MVP
- Default express-rate-limit store is per-process memory: counter resets on
  every server restart, and does not coordinate across instances.
- Fine for single-instance MVP on Render. If/when scaling to multiple
  instances, move to a shared Redis store (Upstash already in stack).

  ## SubmissionParser: filtered verdicts extended beyond spec

`03_data_models.md` §5 specifies CE and SKIPPED are filtered at ingest. Parser
also filters TESTING — an in-flight verdict CF returns while judging is
incomplete. A TESTING submission has no final outcome to record; the next daily
refresh re-fetches it with its settled verdict. Filtering it avoids writing a
Submission row that would need correction later.

Filtered set: COMPILATION_ERROR, SKIPPED, TESTING → parser returns null.

## SubmissionParser: unknown participantTypes skipped

Submission model enum (03_data_models.md §5) allows CONTESTANT / VIRTUAL /
PRACTICE. CF also returns MANAGER, OUT_OF_COMPETITION, GYM. Parser skips
(returns null) any participantType outside the known three rather than coercing
(e.g. mapping OUT_OF_COMPETITION → PRACTICE).

Rationale: coercion invents participation semantics the spec never decided, and
these types are rare for the target user population. Skipping loses negligible
data. Revisit if real-user volume shows meaningful counts in these types.

## 2026-06-13 — Phase 2 IngestService

### Shared page-loop factoring (initial vs daily refresh)
Both flows share one private core `ingestSubmissionPages`; the only loop-level
difference is the floor. Expressed as DATA not behavior: `floorSubmissionId`
nullable param. `null` (initial) makes stop-condition-1 unreachable → runs to
end of history. A value (refresh) stops once `cfSubmissionId <= floor`.
Rejected: branching on `job.type` inside the loop (couples core to job types),
and a `shouldStop` callback (over-engineered for two cases — boring code wins,
08 §15).

### Cursor is a read watermark, not a write watermark  ← interview-critical
`CFProfile.lastIngestedSubmissionId` (committed cursor) tracks the newest ID
SEEN FROM THE CF API, not the newest ID STORED in Mongo. These diverge when the
newest submission is filtered out (filtered verdict, or problem not in catalog).
Observed: committed cursor 378440634 > newest stored 378383336 — the gap is one
skipped `2197 C` submission.
Chosen deliberately: the cursor means "I have examined everything up to here,"
so the daily-refresh floor correctly skips submissions we intentionally never
store, instead of re-fetching+re-filtering them every day forever.
Consequence: the smoke-test assertion was wrong, not the code — changed
`cursor === newest stored` to `cursor >= newest stored`.

### Two-cursor update points (resume vs commit)
`IngestJob.lastIngestedSubmissionId` = per-page resume cursor (smallest ID in
the last fetched page), advanced every page. `CFProfile.lastIngestedSubmissionId`
= committed cursor (newest seen), promoted ONLY at successful pipeline
completion, never mid-job. Promoting mid-job with newest-first ordering would
poison resume. Because a resumed job refetches from page 1 and skips writes, the
newest ID is always re-observed on the attempt that finally succeeds — so
`newestSeenSubmissionId` can live in loop memory; no extra schema field needed.

### Cursor promotion sits AFTER the full pipeline, not after the loop
Per 03 §14 a finished page-loop ≠ a finished pipeline. Orchestrator promotes the
committed cursor + flips `ingestStatus` only after post-loop steps (GapEngine
recalc, ValidationBaseline for initial; recalc/reliability/upsolve for refresh).
If a post-loop step throws, BullMQ retries the whole job without a prematurely
advanced cursor.

### deriveContestResults runs POST-loop, and upserts (not inserts)
Contest result derivation moved out of the page loop because a single contest's
submissions can straddle a page boundary — deriving per-page risks computing
failCount/firstACTime from half a contest. ContestResult + ContestProblemResult
are upserted (not inserted) so a BullMQ retry re-deriving the same contest is
idempotent, via the `(user, cfContestId, problemIndex)` unique index. Mirrors the
`(user, cfSubmissionId)` submission dedup.

### daily refresh does NOT touch CFProfile.ingestStatus
`ingestStatus` is the user-facing onboarding sync state (03 §2). A routine daily
refresh leaving it alone prevents resurrecting the onboarding ingest banner on
every cron run.

### OPEN — zero/low-data promotion guard  ← still owed, decide before ingestWorker
A run currently promotes the cursor + marks complete regardless of how many
submissions were skipped. Empty-catalog case is now moot (catalog seeded), but
catalog STALENESS (new contest's problems not yet seeded) can still cause
silent skips that the cursor sails past — permanent data loss, since the floor
never re-fetches. Asymmetry: promoting a bad run = silent loss; refusing a fine
run = pointless dead-letter. Threshold must be a RATIO with a denominator floor,
not a raw count. DECISION PENDING: skip-ratio guard vs. log-loudly-and-promote
for MVP. Affects ingestWorker's failed-attempt handling.

## 2026-06-13 — Catalog seed + bucket utils

### bucketUtils: half-open buckets, closed stretch zone
Buckets are `[low, high)` — rating 1000 → "1000-1200", never "800-1000" — so
every rating maps to exactly one bucket (no double-counting in TopicBucketScore).
Stretch zone is closed `[userRating, userRating+200]` per 01, so a problem at
exactly userRating+200 is in-zone. Two different range semantics, each from its
own doc, deliberately not unified. Bucket labels are frozen once written (part of
the `(user, topic, bucket)` unique index) — changing the format later = migration.

### CONFLICT FLAGGED: 05 §3.3 vs 03 grid
05's GapExplainer example shows `greedy@1100-1300`, which is not a valid bucket on
03's even-hundred grid (likely confused a stretch zone with a bucket). Resolved in
favor of 03 (schema authority). 05 example treated as illustrative, not normative.

### seed-catalog: divisions, unrated problems, batched backfill
- Div4/ICPC/special rounds skipped from Contest catalog (03 §3 division enum has
  no Div4). Their submissions still store (problems exist in problemset.problems),
  but deriveContestResults warn-skips them. Acceptable: success metric is Div2-only.
- Problems with no CF rating stored as `rating:null, ratingBucket:null` — can
  never surface in a daily plan (stretch-zone filter), but submissions resolve.
- Step-3 backfill batched into chunked bulkWrite after a sequential per-contest
  version (3300 serial round trips to M0) wedged on a stalled connection. Added
  `serverSelectionTimeoutMS`/`socketTimeoutMS` to the connect call so no single op
  hangs forever. NOTE: this same sequential-round-trip risk is acceptable in the
  production ingest worker because BullMQ wraps it with retry/backoff (04 §5,§11);
  the one-off script had no such harness.

  ## Catalog-miss skip guard on ingest (Door A)

**Date:** 2026-06-14
**Status:** Accepted
**Area:** Ingest pipeline — `ingest/IngestService.js`, `config/constants.js`, `utils/errors.js`

### Context
The read watermark (`CFProfile.lastIngestedSubmissionId`) is promoted only at full-pipeline
success and is never re-fetched below once promoted (`04_architecture.md` §8.2). A submission
can be skipped during ingest for two distinct reasons:
- **Filtered verdict** (CE / SKIPPED) — dropped by design (`03_data_models.md`, Submission);
  no data loss.
- **Catalog miss** — a real, countable submission whose problem is absent from the `Problem`
  catalog (catalog is seeded on a separate system-level track). Promoting the watermark past a
  catalog-missed submission is permanent loss, because the floor never re-fetches below itself.

### Decision
Add a skip-ratio guard in `IngestService` that gates watermark promotion. Only catalog misses
count toward it; filtered-verdict skips are excluded from both numerator and denominator.
- **Denominator** = submissions surviving the verdict filter (`fresh`). **Numerator** =
  catalog-missed submissions.
- **Floor:** `INGEST_SKIP_GUARD_MIN_SUBMISSIONS = 20` — below this the ratio is not trusted,
  mirroring the cohort `N ≥ 20` floor in `01_problem_statement.md` / `03_data_models.md`.
- **Threshold:** `INGEST_SKIP_GUARD_MAX_MISS_RATIO = 0.5`.
- **Below floor or below threshold:** promote the watermark, log the missed `contestId:cfIndex`
  tuples loudly (actionable for manual reseed).
- **At/above floor AND above threshold:** refuse to promote; throw `DegradedIngestError`
  carrying surviving / misses / ratio / missedProblems.

The guard lives in `IngestService` because promotion happens there before the function returns —
a post-hoc check in the worker cannot protect a cursor that has already advanced.

`DegradedIngestError` is a domain error with no BullMQ knowledge. The worker translates it into a
BullMQ `UnrecoverableError` → immediate dead-letter + alert (`04_architecture.md` §11) rather than
retrying: catalog staleness is not transient within the retry window (5s → ~30 min, §5), so
retries cannot re-seed the catalog and would only waste rate-limited CF calls.

Already-written submissions are not rolled back on a degraded throw. The `(user, cfSubmissionId)`
unique index makes re-ingest idempotent, so a re-run after catalog reseed self-heals.

### Deferred to v2
Auto-redrive — capturing missed submission tuples + payload to a durable store and reprocessing
them after catalog reseed — would eliminate the residual below-floor trickle entirely. Deferred
because it requires adding to the locked 16-collection data model (`03_data_models.md`) and needs
an explicit doc unlock before implementation.

### Consequences
- A low-rate trickle of catalog-miss loss below the floor is accepted for MVP. It is visible (loud
  logs + missed tuples) and fixable (manual reseed + re-trigger), not silent.
- Degraded runs fail fast via dead-letter alert rather than silently corrupting downstream
  gap/reliability data.