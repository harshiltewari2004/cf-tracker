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
  
### 17-06-26
  1. Contest catalog stores Div2 only; combined rounds count as Div2.

The catalog persists only Div2 rounds. Combined "Div. 1 + Div. 2" rounds are stored as Div2; Div1/Div3/Educational are classified (to avoid mislabeling) but not stored; Div4/Global are skipped entirely.

Why: All three flows the catalog feeds (virtual selection, contestOpportunities, "what counts as a contest," 03 §3) are Div2-centric. A combined round is a real Div2 contest for a Div2 user — same Div2-rated A/B. Div4/Global have no slot in the locked division enum (03 §3) and target populations outside the 800–1300 user. Storing Div1/Div3/Educational is master-catalog completeness, not MVP-required; extending is a one-line change to the write filter.
2. Division is classified from the contest name, conservatively.

Division is parsed from the name via ordered, most-specific-first, first-match-wins rules (Educational → Combined → Global → Div3/4 → Div2 → Div1 → Unknown). Anything unmatched is skipped and logged.

Why: CF's markers are substrings of each other ("Rated for Div. 2" and "Div. 1 + Div. 2" both contain "Div. 2"), so check order is load-bearing — a naive substring match mislabels Educational and combined rounds as Div2. Since division is the source of truth for downstream isDiv2 denormalizations (03 §3, §9), a conservative classifier that skips-and-logs the ambiguous is correct: missing a few rounds beats corrupting the field.
3. No date cutoff at seed; full history stored, recency deferred to query.

The seed stores all FINISHED Div2 contests regardless of age — no "past 2 years" filter at seed time.

Why: A cutoff is more code and introduces a contestOpportunities undercount for users with older participation. Storage is trivial on M0. 07's "past 2 years" is a floor, not a ceiling. The recency need (don't surface ancient contests as virtuals) belongs at query time in VirtualContestEngine, via the existing (division, startTime) index — not duplicated in the seed.
4. Known limitation: rated rounds with no division marker are skipped.

Rounds whose names carry no "Div." marker — Hello/Good Bye New-Year rounds, pre-split numbered rounds, some sponsor rounds — are not captured.

Why: No name signal classifies them without a fragile "any Codeforces Round = Div2" heuristic that would sweep in April Fools, team/ICPC contests, and special events, corrupting the source-of-truth field. Cost of missing is minimal: Hello/Good Bye are ~2/year, the rest are old-meta and irrelevant to recent 800–1300 users, and the success metric is built from per-user ingest, not this catalog.

5. Div2 contests with no resolvable problems are skipped, not stored.

The seed only persists a Div2 contest if its problems resolve from the Problem catalog; contests with an empty problems[] are skipped. This excludes 21 old Technocup-derived Div2 rounds (2017–2018 "based on Technocup … Elimination Round") whose problems aren't in the catalog.

Why: The catalog invariant is "every stored Div2 contest carries its problems." A stored contest with no problems is inert — it contributes nothing to virtual selection or contestOpportunities — and is a footgun for VirtualContestEngine, which iterates Div2 contests expecting A/B problems. The 21 excluded rounds are old-meta (low-value by the recency reasoning in #3) and their problems simply aren't in the Problem catalog. Tracked as a known limitation: the seed is idempotent, so if the Problem catalog is later backfilled comprehensively, a re-run picks these up automatically.


## 2026-06-22 — Phase 3, piece 1: BenchmarkEngine

### Resolved conflicts
- **BenchmarkTargetCount unique index → (topic, bucket, cohortVersion).** 03 §13 declared
  it unique on (topic, bucket), but 04 §11's shadow-swap needs two versions to coexist
  during a refresh. Adding cohortVersion was the smaller change (field already existed, no
  transaction needed) and is what makes rows-first/pointer-last writes safe. Old-version
  pruning deferred to v2.

### CF API contract (live behavior vs assumptions)
- **Country filter value is "India", not "IN".** The live API returns the full country
  name. FALLBACK_TIERS and BenchmarkCohort.filters.country store "India"; 03 §12's "IN"
  example was wrong against the API.
- **getRatedList forced to activeOnly: false.** activeOnly:true uses CF's ~30-day active
  window — narrower than our locked 180-day recency filter — and would silently drop valid
  users. Recency is enforced ourselves from user.rating.

### Engine design
- **getTopicBucketRows lives in utils/bucketUtils.js, not the engine.** Pure transform
  (incl. the all-tags rule) → utils, per the isInStretchZone precedent. It's the shared atom
  BenchmarkEngine (cohort side) and GapEngine (user side) MUST apply identically, or the gap
  comparison is biased.
- **Cohort scan is full, no early-stop.** ratedList is rating-sorted; stopping at N≥20 would
  bias the cohort toward the top of the band and skew medians.
- **Skip-and-continue fault tolerance.** Per-candidate try/catch logs a warn and continues on
  any CF failure (stale handle, timeout). A multi-hour scan can't die on one bad handle. No
  per-candidate retry/pagination — MVP-minimal.
- **computeTargetCounts includes zeros.** p50 is taken over all N users; a non-solver
  contributes 0. It's the median of cohort *solves* — excluding non-solvers would inflate
  target_count and make everyone look artificially weak. Rare buckets → p50 0 →
  divide-by-zero handled on the GapEngine side, not here.
- **refresh write ordering: rows first, cohort pointer last (shadow-swap, 04 §11).**
  deleteMany(version) → insertMany rows → BenchmarkCohort.create last. A crash before the
  pointer leaves no half-published version; restart-from-scratch is safe.
- **selectCohort exit states.** First tier with N≥20 wins; else broadest tier with N≥15
  accepted; else null = hold previous version. Sub-20 only at the broadest rung. Fallback
  expands the rating band upward only, never below the floor.

### Schema corrections
- **BenchmarkCohort.fallbackUsed (not fallBackUsed).** Renamed to match 03 §12 and the engine
  write; the capital-B version was silently dropped under strict mode, leaving the fallback
  audit trail permanently null.
- **BenchmarkTargetCount.bucket is String.** Buckets are range strings ("800-1000"), per 03 §13.

### Dev tooling
- **Cohort cached to disk in run-benchmark.js.** An onSelection hook dumps the scanned
  { cohort, tier } to scripts/.cohort-cache.json (gitignored) after the scan, before the
  write — so a write-path bug doesn't cost a full ~3.5h rescan. refresh also accepts
  injectedSelection to replay the cache (doubles as a write-path test seam). Production
  refresh() with no args is untouched. This is the visible cost of choosing
  restart-from-scratch over checkpointing; resumable mid-scan checkpointing is a v2 QoL item.

### Validation outcome
- **Version 1 written and validated.** Primary tier IN/1300–1500, N≈773 (live drift
  run-to-run), fallbackUsed null. Top medians are math / greedy / implementation /
  constructive algorithms / brute force at the 800–1400 buckets — bread-and-butter Div2 A/B,
  real CF tags only, nothing niche or high-bucket. Non-monotonic counts across buckets reflect
  CF problem supply × cohort practice, not a bug. Full scan ~3.5h.

### Still PENDING
- Redis cache invalidation in refresh — TODO; key gets defined when GapEngine's read path lands.
- Old benchmark-version pruning — deferred to v2.
- Resumable mid-scan checkpointing — v2 QoL.
- Prettier config still on defaults vs 08 §11 (singleQuote, trailingComma es5, printWidth 100).
- Upstash Redis region (Mumbai vs Oregon colocation) — undecided.

## GapEngine (Phase 3, Piece 2)

### Solves dedup keyed on problem identity
aggregateSolves dedups AC submissions by `problem._id` before counting, so
`solves` is a distinct-problem count, not a submission count — matching
BenchmarkEngine.dedupSolved on the cohort side (which keys on `contestId-index`).
The dedup *field* differs by data shape (Mongo doc `_id` vs CF API
`contestId`/`index`); the *counting unit* (distinct problems) is identical, which
is what keeps base_gap unbiased per 01_problem_statement.md multi-tag rule.
Two dedup implementations kept intentionally rather than extracting a shared
`dedupBy` helper — defer extraction until a third call site appears (rule of
three). Per 08 "boring code wins" + "ask before diverging."

### contestFails / contestOpportunities not deduped
aggregateContestSignal does NOT dedup, deliberately. ContestProblemResult has a
unique index on (user, cfContestId, problemIndex) per 03_data_models.md §10, so
one row per problem is DB-enforced — no duplicates can exist. Dedup would be
redundant. Contrast with Submission, which has no such uniqueness (hence solves
needs dedup).

### CONTESTANT-only enforced by construction, not by filter
contestFails/contestOpportunities read ContestProblemResult with no
participantType filter. Per 03 write pipeline, only the CONTESTANT path creates
ContestProblemResult rows (VIRTUAL → VirtualContest.results, PRACTICE → none), so
the collection is CONTESTANT-only by construction. Hot invariant (CONTESTANT
only) satisfied without a filter. TODO: when the contest write path is built,
verify no code path writes a VIRTUAL row into ContestProblemResult.

### Missing benchmark row → targetCount 0 → baseGap 0
recalculate maps a missing BenchmarkTargetCount row to targetCount = 0 via
`?? 0`, relying on computeGap's `targetCount <= 0` guard to return baseGap = 0.
A (topic,bucket) the user solved but no cohort member did produces no practice
gap — correct, since there's no benchmark to be "behind." Guard handles both
solves=0 (0/0 NaN) and solves>0 (n/0 Infinity) cases.

### Target counts read from max written cohortVersion
aggregateTargetCounts reads BenchmarkTargetCount at max(cohortVersion) present in
that collection, not via BenchmarkCohort's version pointer. Only computed versions
have target-count rows, so a held refresh (N<15, per 01 fallback) writes no rows
and cannot be picked — sidesteps the hold-marker ambiguity. Self-consistent by
construction.

### getTopicBucketRows uses `== null` (intentional)
getTopicBucketRows guards `problem?.rating == null` with loose equality — the
recognized JS idiom for catching null OR undefined in one check. Intentional, not
an oversight. Kept over `=== null || === undefined` for readability per 08
"boring code wins."

### Deferred (not bugs — known tradeoffs)
- recalculate uses per-row findOneAndUpdate (sequential). ~398 rows = ~3min wall
  clock observed. Scale path: bulkWrite to batch into one round-trip. Deferred —
  MVP correctness over throughput.
- Stale rows: recalculate only upserts keys present in current run. If a benchmark
  version drops a (topic,bucket), the old TopicBucketScore row lingers with stale
  numbers. Acceptable for MVP (keys rarely disappear). Revisit if it surfaces.
- smoke-ingest@local.test source handle not yet verified — confirm which CF handle
  the 398 rows describe.