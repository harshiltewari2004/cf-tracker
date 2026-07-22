# CF Tracker

**A closed-loop coaching system for competitive programmers.** It reads your Codeforces
submission history, measures your skill gaps against a benchmarked peer cohort, prescribes a
daily practice plan to close them — then uses your next real contest as independent evidence of
whether the practice actually worked.

**Live:** https://cf-tracker-two.vercel.app · **Design docs:** [`docs/`](./docs)

![CF Tracker demo](docs/demo.gif)

---

## The problem

I spent a year on Codeforces stuck in the same place: solving A reliably, solving B sometimes,
and never knowing whether "sometimes" was getting better.

The tools available were all rear-view mirrors. They showed me what I had already solved,
grouped by tag, in a chart. None of them answered the only question I actually had each morning:
**what should I practice today?**

The deeper issue is that practice volume is a bad proxy for mastery. You can grind fifty greedy
problems and still freeze on a greedy B under contest pressure, because practice and contest are
different skills. Any tool that only counts solves will tell you that you're strong at greedy.
Your rating will disagree.

CF Tracker is built around that gap.

---

## Why this isn't a dashboard

A dashboard reports. This system runs a loop:

```
   ┌──────────────────────────────────────────────────────────┐
   │                                                          │
   ▼                                                          │
DIAGNOSE                PRESCRIBE               RE-MEASURE     │
                                                               │
Compare your solves    Generate 3 problems     Your next real  │
per (topic, rating     per day: 2 targeting    Div 2 contest   │
bucket) against a      your largest gaps,      is graded and   │
peer cohort that       1 upsolve from a        fed back in as  │
already meets the      problem you failed      an independent  │
target                 in a real contest       signal ─────────┘
```

The load-bearing part is the last arrow. Contest failure enters the gap score as a **separate
additive term**, not as a discount on your practice count:

```
base_gap  = 1 − (solves / target_count)                  clamped to [0, 1]
penalty   = β × (contest_fails / contest_opportunities)   β = 0.4
final_gap = clamp(base_gap + penalty, 0, 1)
```

Because the penalty is additive, **a user with 100% practice completion who still fails a topic
in contests retains a non-zero gap.** You cannot grind your way out of a weakness. Mastery
requires contest evidence.

Full derivation, including why additive rather than multiplicative and why β = 0.4, is in
[`docs/01_problem_statement.md`](./docs/01_problem_statement.md).

### The success metric

Over your **last 6 real Div 2 contests**:

- `aReliable` — solved A in under 15 minutes
- `bReliable` — solved B in under 40 minutes
- **Metric met when `aReliableCount >= 4` AND `bReliableCount >= 4`**

The two conditions are evaluated **independently**. This is deliberately *not* "contests where
both A and B went well" — collapsing them into a single count hides the case where one of the two
is consistently the bottleneck.

It is also time-bounded rather than binary. Solving A is not the same as solving A in twelve
minutes, and only one of those predicts what happens when the clock is real.

> The live dashboard currently shows my own account at **A: 6/6, B: 3/6** — while the contest
> list shows A and B both solved in every recent round. Solved in all of them, reliable in half.
> That difference is the entire point of the metric.

Virtual contests do not count toward it. They contribute practice volume, never mastery evidence.

### The benchmark

`target_count` is the **median** (p50) solve count per (topic, rating bucket) across a peer cohort
filtered to: India, rating 1300–1500, ≥ 30 contests, ≥ 500 total solves, active within 180 days.

Median rather than mean, so a single 5,000-problem outlier doesn't shift the target. Cohort
requires **N ≥ 20**; if the primary filter comes up short it widens in a fixed order — rating band
first, then geography — and **never below the rating floor**. Below a hard floor of N = 15 the
pipeline holds the previous version rather than publishing a weak benchmark. Every refresh is
versioned and the raw cohort list is stored for audit.

---

## Architecture

**Frontend** — React, Vite, TypeScript, Tailwind, shadcn/ui, React Query (server state), Zustand
(client state), React Router, React Hook Form + Zod, Framer Motion, Recharts, Axios.

**Backend** — Node, Express, MongoDB Atlas + Mongoose, BullMQ on Redis, JWT in httpOnly cookies,
Pino, bcrypt, node-cron, Zod for env validation.

**Deployed** — frontend on Vercel, backend on Render, MongoDB Atlas M0, Upstash Redis.

*Exact versions live in `client/package.json` and `server/package.json`. They aren't duplicated
here — a README that restates a manifest is a second source of truth that silently drifts.*

### Decisions worth defending

**Ingest is asynchronous and idempotent.** The Codeforces API allows roughly 1 request/second, and
a full history pull for an active account takes 2–5 minutes. Blocking signup on that is
unacceptable, so signup returns immediately and queues a BullMQ job. The pipeline writes
page-by-page, dedups on a `(user, cfSubmissionId)` unique index, and resumes from
`lastIngestedSubmissionId` on partial failure. Killing the worker mid-ingest and restarting is
safe by construction, not by retry logic.

**The contest write path is transactional; the derived writes aren't.** A `ContestResult` without
its matching `ContestProblemResult` rows silently corrupts every reliability query downstream, so
those two writes are wrapped in `session.withTransaction()`. Gap scores, reliability cache, and
the upsolve queue are left outside the transaction deliberately — they are *derived* data,
reconstructible from the primary writes, and including them would inflate lock scope for no
integrity gain.

**Caching is cache-aside on three entities only.** Benchmark target counts (240 rows, read on
every gap recompute, written weekly), reliability scores (one per user, read on every dashboard
load), and today's plan. Write-heavy collections — submissions, gap scores, contest results — are
not cached at all. Redis was already in the stack for BullMQ, so the marginal cost was zero.

**Multi-tag attribution credits every tag.** Codeforces problems carry several tags; a `["dp",
"greedy", "implementation"]` problem increments the row for each. This inflates counts slightly —
but **the same rule is applied when computing cohort medians**, so both sides of the comparison
are inflated identically and the ratio stays unbiased. Only real Codeforces API tags are ever
used; no informal categories are invented.

Full topology, failure modes, and the queue design: [`docs/04_architecture.md`](./docs/04_architecture.md).

---

## What this does and doesn't prove

The system snapshots a per-(topic, bucket) solve-rate baseline at the end of initial ingest, and
compares it against the same measure over subsequent usage. Each user is **their own control**.

That design removes some confounders — baseline ability, motivation, choice of topics — and it is
still **correlational, not causal.** Being your own control does not rule out regression to the
mean, and it does not rule out the possibility that a user who signs up for a coaching tool was
already about to study harder. Establishing causation would require a randomized trial, which this
project does not run.

Comparisons are additionally suppressed below **N = 10 attempted problems** in a (topic, bucket),
because a solve rate over four attempts is noise wearing a percentage sign.

I'd rather ship a claim I can defend under questioning than a number I can't.

---

## Running locally

```bash
git clone https://github.com/harshiltewari2004/cf-tracker.git
cd cf-tracker

# backend
cd server && npm install && cp .env.example .env   # fill in, then:
npm run dev

# frontend
cd ../client && npm install && cp .env.example .env
npm run dev
```

**MongoDB must be a replica set**, even locally — the contest write path uses transactions, which
single-node `mongod` does not support. Either point `MONGODB_URI` at an Atlas M0 cluster (free
tier is a 3-node replica set) or run `mongod --replSet rs0` and initiate it once.

Server env: `NODE_ENV`, `PORT`, `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
`COOKIE_DOMAIN`, `FRONTEND_ORIGIN`, `LOG_LEVEL`. Client env: `VITE_API_URL`.

All server variables are validated with Zod at startup and the process exits with a named error if
any are missing or malformed — no `process.env` access anywhere outside `config/env.js`.

---

## Design docs

The product was specified before it was built. These eight documents were locked before the first
line of implementation code and treated as authoritative throughout; where the build wanted to
diverge, the divergence was logged rather than silently applied.

| Doc | Contents |
|---|---|
| [`01_problem_statement.md`](./docs/01_problem_statement.md) | Target user, success metric, gap function derivation, cohort filters, validation methodology |
| [`02_features.md`](./docs/02_features.md) | Five user-facing features, cold-start behavior, upsolve loop |
| [`03_data_models.md`](./docs/03_data_models.md) | 16 collections, indexes, write pipeline branched by `participantType` |
| [`04_architecture.md`](./docs/04_architecture.md) | Backend topology, BullMQ, transaction boundaries, failure modes |
| [`05_pages_and_components.md`](./docs/05_pages_and_components.md) | Routes, page breakdown, state ownership |
| [`06_folder_structure.md`](./docs/06_folder_structure.md) | Client and server organization, naming |
| [`07_timeline_and_milestones.md`](./docs/07_timeline_and_milestones.md) | Phase order, validation gates, risk markers |
| [`08_coding_conventions.md`](./docs/08_coding_conventions.md) | Naming, imports, error handling, logging, testing |

[`decisions.md`](./docs/decisions.md) is the running log. Every non-obvious choice is recorded at
commit time as a `D-Pxx-x` entry with its alternative and the reason the alternative lost —
written when the decision was made, not reconstructed afterward.

---

## Not built, on purpose

Scope was cut to reach a shippable MVP rather than a broader half-working one.

**Deferred to v1.5** — virtual contest engine, per-contest gap-impact history (no data model
exists for it yet), in-flight ingest job cancellation, bundle trim via selective animation
loading.

**Deferred to v2** — β tuning against accumulated data, weighted rather than equal multi-tag
attribution, Div 3 and Educational round support, public benchmark dataset export.

**Not in scope at all** — ML-based recommendation (the gap function is rule-based and that is a
deliberate choice, not a limitation to apologize for), in-contest coaching, hints or solutions,
social features, non-Codeforces platforms.

Known limitation, stated plainly: every (topic, bucket) a user has never touched scores a
`base_gap` of exactly 1.0, so the top-gaps ranking has many tied rows and no defined tiebreak.
The daily plan is unaffected — it filters candidates to the stretch zone before ranking — but the
dashboard's top-gaps panel can surface a gap that is real and simultaneously not actionable. A
tiebreak on stretch-zone proximity is the v1.5 fix.

---

## Author

**Harshil Tewari** — [GitHub](https://github.com/harshiltewari2004) · [Codeforces](https://codeforces.com/profile/harshil20) · [LinkedIn](https://www.linkedin.com/in/harshiltewari/)

Built solo. Every line typed by hand.
