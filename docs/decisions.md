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

  ## DailyPlanEngine — cold-start weakness signal (Phase 3, Piece 3)

**Decision:** Cold-start tag ranking uses *catalog frequency* in the stretch
zone divided by the user's trusted `solves`, NOT the cohort benchmark
(`targetCount` / `finalGap`).

**Why:** `02_features.md` §1 mandates the cold-start plan sample weakest tags
"regardless of the gap formula." Catalog frequency (how often a tag appears on
problems that *exist* at the user's level, from the Problem collection) is a
distinct signal from `targetCount` (how many such problems the cohort *solved*).
They diverge on real cases: `implementation` is catalog-common but low cohort
p50 (strong solvers don't grind it); `dp` is catalog-rarer at low buckets but
high cohort p50 (gateway everyone grinds). The divergence proves catalog
frequency is not the benchmark in disguise, so using it is legal under §1.

**Model:** Model B ("least developed in tags common at the user's level"), an
exploration/breadth signal — not Model A (lowest demonstrated competence), which
would never broaden the user. Catalog supplies "requiredness," user `solves`
supply coverage, cohort is never touched.

**Blend:** `weakness = catalogFrequency / (solves + COLD_START_TAG_SMOOTHING)`,
smoothing = 1 (divide-by-zero guard; an untouched common tag ranks at full
requiredness). Catalog drives iteration so untouched tags are included
(default solves 0); user coverage is a lookup.

**Collapse:** (topic, bucket) pooled to topic by summing BOTH sides over the
same stretch-zone bucket set (rate-of-sums). Cold-start-local — the gap-driven
path never collapses (it ranks per-row by `finalGap`, `01` §"Why bucketed").

## DailyPlanEngine — stretch-zone binding for cold-start problems

**Decision:** Cold-start *served* problems are bound to the stretch zone
`[currentRating, currentRating + STRETCH_ZONE_SPAN]`, rating-exact, same as gap
problems — even though `02_features.md` §1 only mandates the zone for gap
problems explicitly.

**Why:** The stretch zone's rationale (growth band; below = too easy, above =
frustration) is about solving experience, which is path-independent. Binding
reuses one filter instead of inventing a second range rule — it's the
*smaller*-scope choice, not the larger. Tag starvation is handled by falling
across tags, not by widening the zone.

## DailyPlanEngine — gap fallback honors per-bucket gap (rejected one-query opt)

**Decision:** Gap selection searches the row's *exact* bucket first, then the
other in-zone bucket only on empty (strict `02` §1 three-level order). Rejected a
simpler one-query version that `$in`'d both in-zone buckets sorted by rating.

**Why:** `finalGap` is measured per (topic, bucket) — a hot invariant
(`01` §"Why bucketed"). The one-query version could serve an adjacent-bucket
problem on the strength of a gap measured in a different bucket — an attribution
smear. Saving one query is not worth spending a hot invariant; query count isn't
a bottleneck at MVP scale.

## DailyPlanEngine — upsolve selection skips the seen-set

**Decision:** Upsolve selection does NOT apply the gap-path seen-set dedup.

**Why:** An upsolve problem is one the user *failed in a real contest*
(`03_data_models.md` §8) — it is definitionally in their submission history.
Filtering "seen" would empty the upsolve slot every time. Upsolve's own dedup is
the queue's `(user, problem)` unique index. Bonus: because gap problems DO filter
on the seen-set, gap/upsolve collision is prevented for free (the upsolve problem
is seen, so gap selection already excludes it).

## DailyPlanEngine — idempotent write via $setOnInsert (never overwrite)

**Decision:** `generatePlan` writes with `findOneAndUpdate` + `$setOnInsert` on
the `(user, date)` unique index. Re-runs return the existing plan untouched.
Pure-atomic (no check-first `findOne` guard).

**Why:** A re-run (BullMQ retry, `04` §5) must not overwrite — the plan
accumulates in-day user state (solves, `verdict`/`solvedAt`, `replacedProblems`,
rollover). `$set` would destroy it; `$setOnInsert` writes only on insert.
Pure-atomic chosen over check-first because the skip path is rare (one
generate per user per day); the `findOne` guard is the noted optimization if the
skip path ever gets hot.

## dateUtils.getDateOnly — UTC-explicit, returns a Date

**Decision:** `getDateOnly` rebuilds the date at UTC midnight via
`Date.UTC(getUTCFullYear, getUTCMonth, getUTCDate)` and returns a `Date`
(not `date-fns` `startOfDay`, not a string).

**Why:** `startOfDay` operates in *local* time — on a non-UTC host it yields a
different UTC instant, misaligning with the UTC-anchored DailyPlan `date`
(`03` §7) and the 02:00 UTC cron (`04` §8.3). A `Date` (not string) is required
so Mongo `$lte` against `scheduledFor` (a Date) compares chronologically and the
`(user, date)` unique index dedups correctly — a Date-vs-string `$lte` compares
by BSON type order, silently returning wrong results.



TODO(harshil): verify whether runDailyRefresh updates CFProfile.currentRating/rank from user.info, or if rating is onboarding-write-only. If onboarding-only, rating goes stale over time — acceptable for MVP, revisit when real users accumulate. Surfaced during Phase 3 DailyPlanEngine smoke test (stale test profile had no rating).

## ReliabilityEngine — null-safe time checks, contest-driven loop

`refresh` iterates the (up-to-)6 contests, NOT the ContestProblemResult rows —
the metric's denominator is contests, and a contest where B was never attempted
(no submission → no row) must still count as not-reliable. Row-driven iteration
would be blind to unattempted problems, silently shrinking the denominator.
`aReliable = row?.status === 'solved' && row.firstACTime < RELIABLE_A_MINUTES` —
the solved-check short-circuits before the time comparison so a null firstACTime
can't coerce (null < 15 === true) into a false-positive reliable. Uses `$set`
(not `$setOnInsert`): ReliabilityScore is a pure derived cache (03 §11), meant to
be overwritten on every contest — opposite of DailyPlan's $setOnInsert.

ContestFeedbackEngine — invocation & transaction boundary. Engine is woven into the CONTESTANT write-pipeline fan-out (04 §7), not a standalone peer caller. extractContestFails is pure (deltas in a Map, no writes); seedUpsolveQueue writes best-effort outside the transaction. seedUpsolveQueue uses findOneAndUpdate + upsert + $setOnInsert (not $set) so a re-fail or BullMQ retry never clobbers user-authored status (completed/skipped) — same reasoning as DailyPlan, opposite of ReliabilityScore's $set. After-signup gate checked once per contest (single startTime). UPSOLVE_SCHEDULE_DELAY_MS added to constants.js as its own named constant rather than reusing AUTH_COOKIE_MAX_AGE_MS (value collision, meaning unrelated).

## Phase 3 — Write Pipeline: VIRTUAL path deferred to v1.5

**Date:** 2026-06-29

VIRTUAL write path left as a stub in `SubmissionWriter.js` (throws
"not implemented yet"). Deferred deliberately:

- Virtual contest loop is v1.5 per `02` scope phasing, not MVP. MVP write
  pipeline needs only PRACTICE (done) and CONTESTANT (next).
- The VIRTUAL path writes into `VirtualContest.results[]`, but the doc that
  creates those records — `VirtualContestEngine.scheduleWeeklyVirtual` — is
  not built yet. Building the write path now means coding against a
  non-existent creation contract.

### Open question carried to VirtualContestEngine build
Is `VirtualContest.results[]` **pre-seeded** at scheduling time (one entry
per contest problem, `status: 'unattempted'`), or does it fill in as the
user submits? The schema's explicit `unattempted` status value implies
pre-seeding — `unattempted` can only be represented if every problem has an
entry from the start. If pre-seeded, the VIRTUAL write path is a guaranteed-
existing-entry update (locate by `problemIndex`, mutate in place), NOT a
find-or-create push. Lock this when building the engine; the write path
depends on it.

### VIRTUAL path semantics (for whoever builds it)
Per `03` + `02` §4: Submission.insert → VirtualContest.results update →
TopicBucketScore solves-only increment (all-tags, AC only). Hot invariant:
virtual fails do NOT feed contestFails and do NOT count toward the 4/6
success metric. Conditional update rules: don't overwrite firstACTime once
set; accumulate failCount on pre-AC WAs only.

## Benchmark refresh runs in-process via cron, not through a BullMQ queue/worker

**Date:** 2026-06-30
**Status:** Accepted (MVP)
**Area:** Async jobs / benchmark pipeline

### Context
`04_architecture.md` §5 prescribes a `benchmarkQueue` + `benchmarkWorker` for the
weekly cohort refresh, mirroring the ingest queue/worker topology. The cron in
`jobs/benchmarkRefreshJob.js` instead calls `BenchmarkEngine.refresh()` directly,
with no queue and no worker. This is a deliberate deviation from §5, logged here
rather than drifted silently.

### Decision
`benchmarkRefreshJob.js` invokes `BenchmarkEngine.refresh()` in-process on the
weekly cron tick (Sunday 03:00 UTC). No `benchmarkQueue.js`, no `benchmarkWorker.js`
built for MVP.

### Rationale
- **Shadow-version safety (`04` §11).** `refresh()` writes target counts under a new,
  higher version and swaps the active pointer only on full completion. A mid-scan
  crash leaves an orphaned half-written version; the previous version stays live and
  authoritative. A failed refresh degrades to *stale*, never *corrupt* — and staleness
  is an explicitly tolerated state (`01_problem_statement.md`: "hold the previous
  benchmark version"). This is the property that makes a queue's retry/DLQ machinery
  low-value here.
- **I/O-bound, not CPU-bound.** The 2.5–3.5h cohort scan awaits CF under Bottleneck
  at ~1 req/sec. It never blocks the event loop; Express keeps serving during the scan.
- **Internal resilience.** `refresh()` already skips-and-continues per candidate on a
  CF hiccup, so a single flaky call doesn't sink the scan — only a process restart does.
- **Cadence.** Runs weekly; cohort populations drift gradually. The cost of a missed
  run is one extra week of staleness, recovered on the next tick.
- **Scope.** Building a queue + worker for a single weekly, staleness-tolerant,
  internally-resilient job is disproportionate for MVP.

### Risks accepted
- No automatic retry of the whole job on catastrophic failure (lost until next Sunday).
- No dead-letter visibility — failure surfaces only as a Pino `error` log
  (`04` §10 deems Pino sufficient for MVP).

### Revisit when
- Multi-instance deploy: `04` §12 already calls for replacing `node-cron` with BullMQ
  repeatable jobs (node-cron fires on every replica; repeatable jobs fire once cluster-wide).
  Migrating the benchmark refresh onto `benchmarkQueue` + `benchmarkWorker` is the natural
  step at that point. B is the MVP point on the path §12 already drew, not a dead end.

  ## GET /api/contests/:cfContestId/feedback deferred — no gap-history data model

**Date:** 2026-06-30
**Status:** Accepted (MVP)
**Area:** API routes / contest detail

### Context
`04_architecture.md` §4.3 lists `GET /api/contests/:cfContestId/feedback`, surfacing
`<GapImpactList />` (`05` §3.5) — "this contest shifted these (topic, bucket) gaps."

### Decision
Not built for MVP. `routes/contests.js` mounts only list + detail.

### Rationale
Answering "which gaps this contest shifted" requires a per-contest before/after gap
delta. `GapEngine.recalculate` writes `TopicBucketScore` via `$set` wholesale recompute
(recompute-from-scratch model) — it overwrites current values and stores no history, so
there is no snapshot to diff against. Building this for real means adding a gap-history
collection or per-contest delta capture — a change to locked `03_data_models.md`, not a
wiring task. The contest detail page is useful without it (summary + problem matrix +
upsolve-added list carry it).

### Revisit when
Gap-history is introduced (would also benefit progress-over-time charts, deferred to v2
per `05` §1). At that point a stored delta makes `/feedback` answerable.

## 2026-07-01 — POST /api/plan/problems/:id/replace

**Decision: replaceProblem is read-then-atomic-write, not read-modify-write.**
The handler reads today's plan first to gather two inputs it can't get any other
way: (1) the target slot's current `problem` ref (needed as `original` in the
audit entry) and (2) the full exclusion set. The actual mutation is still a single
atomic `findOneAndUpdate` with a positional `$set` + `$push`. The read only
assembles inputs; it does not participate in the write, so this does NOT
reintroduce the lost-update race that the positional `$set` in markSolved avoids.
Stale-exclusion race between read and write is tolerated (replace is a rare manual
click; worst case is a slightly stale exclusion set) — no locking.

**Decision: exclusion set = seen submissions ∪ all current plan problems.**
Passed as `seendIds` to the existing `selectGapProblems`. Seen submissions prevent
re-recommending an attempted problem; the current plan's problem refs prevent
(a) picking a problem already in another slot (duplicate) and (b) re-picking the
slot being replaced (no-op self-swap). The target's own ref is already covered
because it's a member of `plan.problems[]`.

**Decision: empty substitute search → AppError 422, not 404/400.**
`selectGapProblems` returning `[]` is a valid request that cannot be fulfilled in
the current data state (no eligible in-zone problem after exclusions). Per 02 §1
the system never recommends outside the stretch zone even if it means fewer
options, so "no substitute" is a spec-honored outcome, not a not-found (plan
exists) or bad-request (request was well-formed). 422 (semantic error) is
consistent with generatePlan's no-currentRating 422 (08 §6).

**Decision: completed: false hardcoded in the $set, not recomputed.**
Replacing a slot always sets that slot's status to `pending`, so the plan can
never be complete immediately after a replace. `completed` is therefore forced
false in the same atomic $set — no read-back or `.every()` recompute needed. This
shortcut is safe ONLY for replace; markSolved must still recompute because solving
a slot *may or may not* complete the plan depending on the other two.

**Ownership:** replaceProblem lives in DailyPlanEngine (owns DailyPlan, reuses
selectGapProblems). Controller thin. Consistent with markSolved / generatePlan.

**Test caveat — replace verified on hand-seeded state, not natural gap-driven flow.**
The replace happy path could not be exercised by the test account (6a43be…,
handle `testseed`) as-is: it has no ingest data, so `TopicBucketScore` was empty
and `selectGapProblems` correctly returned [] → 422. To reach the 200 path, a
single TopicBucketScore row was hand-seeded (topic "greedy", bucket "1200-1400",
finalGap 0.8, gap-formula-consistent: solves 2 / targetCount 10 → baseGap 0.8,
contestOpportunities 0 → penalty 0). The plan under test is also `cold_start`
(tag-distribution), not gap-driven. So replace's swap + audit-push mechanism is
proven, but the full ingest → GapEngine → gap-driven-plan → replace flow is not.
Same caveat class as the UpsolveQueue-seeding no-op in this test env. Re-verify
against a naturally-ingested account when one exists.

## 2026-07-02 — Frontend dependency versions ahead of locked stack (accepted drift)
Week 0 scaffold installed React 19.2, React Router 7.15, and Zod 4.4; locked docs
(04 §2, 05 §2) specify React 18 + Router v6. Kept installed versions after
compatibility verification (shadcn/ui, framer-motion, recharts, RHF all support
React 19; resolvers 5.x supports Zod 4). Constraints accepted with this decision:
- React Router used in DECLARATIVE MODE ONLY (BrowserRouter/Routes/Outlet — the
  v6-identical API). No framework-mode features (loaders/actions). Docs' v6
  patterns remain valid as written.
- Zod 4 error API (error.issues, z.email()) is the client convention going forward.
- Tailwind stays 3.4 per locked stack; shadcn CLI configured for v3, not v4.

## 2026-07-02 — /api/virtual/* left unmounted (closes PENDING from Phase 3)
Router file not created, routes not mounted. VirtualContestEngine is v1.5 scope
(02 §Scope phasing); an unmounted route can't drift or need maintenance. If a
client ever probes it, Express returns 404, which is accurate: the resource
does not exist yet.

## 2026-07-02 — ingestStore scope narrowed to client-only flags
05 §6 assigns "polling state" to ingestStore; 08 §5 forbids server data in
Zustand. Resolved: React Query owns ingest status data (queryKey
['ingest','status'], refetchInterval 3000ms) — key dedup natively provides
the "one polling source, two subscribers" property 05 §6 wanted. ingestStore
holds only client-session facts (ingestActive flag, future bannerDismissed).
No conflict: intent honored, mechanism corrected to respect 08 §5.