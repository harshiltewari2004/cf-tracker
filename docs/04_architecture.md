# CF Tracker — Architecture

**v2.1 — Locked May 2026**

---

## 1. System Overview

CF Tracker is a full-stack Codeforces analytics platform that ingests submission history, computes skill gaps per (topic, difficulty bucket), and delivers a personalized daily practice plan. The stack is React + Express + MongoDB Atlas + Redis, deployed as a single instance on Render for MVP.

The architecture is built around six core engines (Gap, DailyPlan, Benchmark, Reliability, ContestFeedback, Virtual), an async job system (BullMQ) for ingest workloads, and a thin Redis cache layer for hot reads.

---

## 2. Stack

### Frontend
- **React 18** + **Vite** (build tool)
- **Tailwind CSS** + **shadcn/ui** (component primitives)
- **Zustand** (client state)
- **@tanstack/react-query** (server state — recommended addition)
- **React Router v6** (routing)
- **React Hook Form** + **Zod** (form handling + validation)
- **Framer Motion** (transitions)
- **Recharts** (data viz)
- **Axios** (HTTP client, `withCredentials: true`)

### Backend
- **Node.js 20+** + **Express**
- **Mongoose** (MongoDB ODM)
- **BullMQ** (job queue, Redis-backed)
- **node-cron** (in-process scheduler)
- **Pino** (structured JSON logging)
- **Zod** (runtime env validation)
- **express-rate-limit** (per-IP rate limiting)
- **express-validator** (request validation)
- **bcrypt** (password hashing)
- **jsonwebtoken** (JWT signing)
- **axios** (HTTP client to CF API)
- **date-fns** (date math; "30 days pre-usage" calculations)

### Infrastructure
- **MongoDB Atlas M0** — free tier, 3-node replica set, transactions supported
- **Upstash Redis**  — free tier sufficient for MVP
-  **Render** — single-instance Node.js deploy

---

## 3. Frontend Architecture

The frontend is a single-page React app served as a static bundle. Communicates with the backend via REST (Axios with `withCredentials: true` for httpOnly JWT cookies).

State separation:
- **Server state** (DailyPlan, TopicBucketScores, ContestResults) → React Query with cache-aside semantics built in.
- **Client state** (auth status, sidebar open/closed, ingest progress poll) → Zustand stores.

CSS strategy: Tailwind utility classes, with shadcn/ui primitives (Button, Card, Dialog, etc.) composed into app-specific components. No CSS-in-JS, no separate stylesheets.

Routing: nested routes via React Router v6. Three layouts (`AuthLayout`, `OnboardingLayout`, `AppLayout`) wrap their respective route trees. See `05_pages_and_components.md` for the full page hierarchy.

---

## 4. Backend Architecture

### 4.1 Layered structure

Request flow: **route → middleware → controller → service / engine → model**.

- **Routes:** Define HTTP paths, attach middleware, dispatch to controllers.
- **Middleware:** Cross-cutting concerns (auth, validation, rate limiting, error handling).
- **Controllers:** Thin. Parse request, call service, return response.
- **Services:** Stateless orchestration. Multi-step flows (e.g., onboarding: validate handle → call CF → create profile → queue ingest).
- **Engines:** Domain logic over collections (Gap, DailyPlan, Benchmark, Reliability, ContestFeedback, Virtual).
- **Models:** Mongoose schemas for the 16 collections.

### 4.2 Middleware layer

| Middleware | Purpose |
|---|---|
| `authMiddleware` | JWT verification from httpOnly cookie; attaches `userId` to `req` |
| `rateLimiter` | `authLimiter` (15/15min on auth routes), `apiLimiter` (100/15min on all routes) |
| `errorHandler` | Global error catch with consistent shape: `{ success: false, message, stack? }` |
| `validator` | express-validator + zod for request body validation |

### 4.3 Route layer

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

POST   /api/onboarding/codeforces
GET    /api/onboarding/status

PATCH  /api/user/handle              ← triggers re-ingest
DELETE /api/user/account

GET    /api/plan/today
POST   /api/plan/problems/:id/solved
POST   /api/plan/problems/:id/replace

GET    /api/weakness
GET    /api/weakness/:topic

GET    /api/contests
GET    /api/contests/:cfContestId
GET    /api/contests/:cfContestId/feedback

GET    /api/reliability
GET    /api/dashboard

GET    /api/virtual/current
POST   /api/virtual/start

GET    /api/ingest/status            ← polled during onboarding
```

The `/api/cf/` prefix has been dropped — the entire app is CF-related, so the prefix carries no signal. See §11 for endpoints removed.

### 4.4 Core engines

Engines are **logical services**, not external RPC endpoints. They expose pure functions invoked by services and the write pipeline.

| Engine | Inputs | Outputs |
|---|---|---|
| **GapEngine** | Submission, BenchmarkTargetCount, ContestProblemResult | TopicBucketScore upserts |
| **DailyPlanEngine** | TopicBucketScore, UpsolveQueue, Problem | DailyPlan documents |
| **BenchmarkEngine** | Cohort users via CF API | BenchmarkCohort, BenchmarkTargetCount |
| **ReliabilityEngine** | ContestProblemResult | ReliabilityScore (cached) |
| **ContestFeedbackEngine** | ContestResult, ContestProblemResult | UpsolveQueue inserts, GapEngine recalc |
| **VirtualContestEngine** | TopicBucketScore, Contest catalog | VirtualContest documents |

GapEngine is **invoked as part of the write pipeline** (see `03_data_models.md`), not as a separately-called service. When a new submission arrives, TopicBucketScore updates happen inside the write fan-out.

---

## 5. Async Job System — BullMQ

### Decision

**BullMQ (Redis-backed).** Chosen over Agenda (Mongo-backed) and all custom queue implementations.

### Rationale

1. Production standard for Node.js queues — widely known, reviewable code.
2. Built-in exponential backoff and retries handle CF API rate-limit failures without custom logic.
3. Once Redis is in for the queue, caching and distributed rate-limiting come essentially for free.

### Configuration

```javascript
{
  attempts: 5,
  backoff: { type: 'exponential', delay: 5000 }
  // Retry schedule: 5s → 25s → 125s → 625s → ~30 min
}
```

Stalled-job detection is built in. Jobs that don't acknowledge within `stalledInterval` (default 30s) automatically return to the queue — no custom code required.

### Queue topology

```
queues/
  ingestQueue       // initial + daily-refresh ingest jobs
  benchmarkQueue    // weekly cohort refresh

workers/
  ingestWorker      // consumes ingestQueue, calls IngestService
  benchmarkWorker   // consumes benchmarkQueue, calls BenchmarkEngine
```

For MVP, workers run in the same process as Express. Scale path: split into separate processes when queue depth grows.

---

## 6. Caching — Redis

BullMQ requires Redis, so it's already in the stack. Three entities with high read-to-write ratios are cached using the **cache-aside** pattern.

| Entity | TTL / Invalidation | Rationale |
|---|---|---|
| **BenchmarkTargetCount** | TTL 7 days; invalidate on weekly cron | 240 rows total, read on every gap recompute, written weekly |
| **ReliabilityScore** | TTL 5 min; or explicit invalidate on contest ingest | One per user, read on every dashboard load |
| **DailyPlan (today's)** | TTL = end of day UTC | Read on every dashboard view |

### Not cached
- `Submission` — write-heavy, rarely read after ingest
- `TopicBucketScore` — write-heavy
- `ContestResult` — write-heavy

### Pattern

Cache-aside: read Redis first → on miss, query Mongo → populate Redis. No write-through or write-behind at MVP scale.

---

## 7. Transactionality — MongoDB

### Requirement

MongoDB **replica set required**. Atlas M0 (free tier) provides a 3-node replica set. Local dev: `mongod --replSet rs0`.

### Transaction boundary

The contest-write path wraps three documents in a single transaction because partial success leaves inconsistent state — a `ContestResult` without `ContestProblemResult` breaks reliability queries.

```javascript
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    await Submission.create([submissionDoc], { session });
    if (submissionDoc.participantType === 'CONTESTANT') {
      await ContestResult.findOneAndUpdate(
        { user, cfContestId },
        { $set: contestResultDoc },
        { session, upsert: true }
      );
      await ContestProblemResult.create([contestProblemDoc], { session });
    }
  });
} finally {
  await session.endSession();
}
```

### Outside the transaction (best-effort)

These are derived data — reconstructible from primary writes if a recovery job runs. They live outside the transaction to avoid inflating lock scope.

- `TopicBucketScore` increment
- `ReliabilityScore` refresh
- `UpsolveQueue` insert

### Error handling

The driver auto-retries `TransientTransactionError`. Other failures bubble up and BullMQ retries the whole job.

---

## 8. Ingest Layer

### 8.1 Signup (synchronous portion)

1. Fetch CF `user.info`, validate handle exists
2. Create CFProfile
3. Create IngestJob (status: queued)
4. Queue background ingest job via `ingestQueue.add('initial', { userId })`
5. Return dashboard immediately — do not block the response

### 8.2 Background job (async)

Runs in `ingestWorker`:

1. CF APIs called: `user.status` (paginated), `user.rating`, `contest.standings`
2. UTC normalization on all timestamps
3. Rate limit: ~1 req/sec global
4. Dedup on `cfSubmissionId`
5. Resume from `lastIngestedSubmissionId` on partial failure
6. Trigger GapEngine to compute initial TopicBucketScores
7. **Snapshot ValidationBaseline** (after step 6 — needs the gap data)
8. Set `coldStartComplete = true` once user has ≥20 in-system solves later

### 8.3 Daily refresh (cron)

Runs at 02:00 UTC via `node-cron`:

1. Query all users with `coldStartComplete: true`
2. **Enqueue one BullMQ job per user** (do not loop synchronously — one slow user would block the rest)
3. `ingestWorker` processes them in parallel under the global 1 req/sec rate limit
4. Each job: fetch submissions since `lastIngestedSubmissionId`, trigger GapEngine recalc, refresh ReliabilityScore, update UpsolveQueue

---

## 9. Authentication

- **Strategy:** JWT in httpOnly cookie. `withCredentials: true` on Axios.
- **Token lifetime:** 24h access token. (v2 may add refresh tokens with 7-day lifetime.)
- **Signing algorithm:** HS256, secret loaded from env var.
- **Storage:** Cookie set by `/api/auth/login` and `/api/auth/register`. Cleared by `/api/auth/logout`.
- **Verification:** `authMiddleware` reads the cookie, verifies signature, attaches `userId` to `req`. Returns 401 on missing or invalid token.

Password hashing: bcrypt with cost factor 12.

---

## 10. Observability

### Logging
- **Pino** structured JSON logs to stdout
- Captured by Render log aggregator
- Log levels: `error`, `warn`, `info`, `debug` (dev only)
- Request logs include: method, path, status, duration, userId (if authenticated)

### Metrics (v2)
- Prometheus exporter on `/metrics` (not exposed publicly)
- Tracked: queue depth, CF API consumption (req/sec actual vs budget), gap recompute latency, transaction retry rate
- Grafana dashboard for queue health and CF API rate-limit headroom

### Alerting (v2)
- Dead-letter queue size > 0 → page
- CF API failure rate > 50% over 15 min → page
- Daily refresh cron miss → warn

For MVP, Pino logs are sufficient. Prometheus + Grafana add v2.

---

## 11. Failure Modes

| Failure Mode | Response |
|---|---|
| **CF API 429** | Global rate-limiter at 1 req/sec. If 429 still occurs, BullMQ retries with exponential backoff (5 attempts). Job lands in dead-letter queue after 5 failures; alert fires. |
| **CF API 503 mid-page** | Each page is a separate call. Writes to Mongo as each page arrives (write-as-you-go). Retry resumes from the failed page using cursor stored in IngestJob. Safe because writes dedup on `(user, cfSubmissionId)` — idempotent. |
| **CF API down 1 hour** | All jobs retry with backoff (5s → ~30 min). One day of stale data is tolerable because gap calculations work on stored historical data, not live API. v2 adds a circuit breaker that pauses the queue when CF failure rate exceeds a threshold. |
| **MongoDB write conflict** | Driver auto-retries `TransientTransactionError`. If still failing, BullMQ retries the whole job. Idempotency holds via the `(user, cfSubmissionId)` unique index. |
| **BenchmarkEngine partial (10/30)** | Shadow-version pattern: write target counts under a higher version number, swap active pointer only when all 30 are written. Previous version stays live on failure; next cron run restarts cleanly. |
| **Orphaned IngestJob** | BullMQ built-in stalled-job detection returns unacknowledged jobs to the queue after `stalledInterval`. No custom code. |

### Interview answer: "What if the CF API goes down for 30 minutes?"

> *Daily refresh jobs retry with exponential backoff up to 5 attempts. The system tolerates one day of stale data because gap calculations work on stored historical data, not live API calls. If failures persist, jobs land in the dead-letter queue and I get alerted. v2 adds a circuit breaker that pauses the queue globally when CF failure rate exceeds a threshold, preventing pointless retries.*

---

## 12. Deployment

### MVP topology

| Component | Choice |
|---|---|
| **Express + Worker** | Single process on Render (free tier) |
| **MongoDB** | Atlas M0 — free, replica set, transactions supported |
| **Redis** | Upstash or Upstash free tier |
| **Cron** | `node-cron` in-process — safe on single instance (no race conditions) |
| **BullMQ Worker** | Runs in same process as Express initially |

### Scale path (when needed, not now)

- **Queue depth grows:** split worker into a separate process/container, scale horizontally.
- **Web latency degrades:** scale Express horizontally behind a load balancer.
- **Multi-instance:** replace `node-cron` with BullMQ repeatable jobs — `queue.add(name, data, { repeat: { cron: '0 0 * * *' } })`. `node-cron` fires on every replica; BullMQ repeatable jobs fire once across the cluster.
- **Leader election:** Redis-based locking via `SETNX` or the Redlock library.

---

## 13. CORS

- `Access-Control-Allow-Credentials: true` (required for `withCredentials` cookies)
- `Access-Control-Allow-Origin`: specific frontend origin (no wildcards — wildcards are incompatible with credentials)
- `Access-Control-Allow-Methods`: GET, POST, PUT, PATCH, DELETE, OPTIONS
- `Access-Control-Allow-Headers`: Content-Type, Authorization

In dev: allow `http://localhost:5173` (Vite default).
In prod: env-driven origin (single allowed value).

---

## 14. Removed Endpoints

### `/api/cf/sync`

The manual sync endpoint has been **eliminated**. It created a DoS vector — users could exhaust the Codeforces rate limit.

Sync now happens automatically in three cases only:

- **At signup** — IngestJob queued immediately
- **On handle change** — `PATCH /api/user/handle` controller queues a re-ingest through the same BullMQ pipeline as signup. No special-case code.
- **Via daily cron** — incremental refresh

If a user wants their data synced "right now," the daily cron will catch it within 24 hours. There's no legitimate reason to expose manual sync.

---

## 15. Data Layer Summary

### MongoDB collections (16)

Detailed schemas, indexes, and write semantics live in `03_data_models.md`. Names only here:

`User`, `CFProfile`, `Contest`, `Problem`, `Submission`, `TopicBucketScore`, `DailyPlan`, `UpsolveQueue`, `ContestResult`, `ContestProblemResult`, `ReliabilityScore`, `BenchmarkCohort`, `BenchmarkTargetCount`, `IngestJob`, `VirtualContest`, `ValidationBaseline`.

### Codeforces API endpoints used

- `user.info` — at signup, handle change
- `user.status` (paginated) — full ingest and daily refresh
- `user.rating` — full ingest
- `contest.standings` — full ingest
- `problemset.problems` — problem catalog (system-level)
- `contest.list` — Contest catalog (system-level)

**Rate limit:** ~1 req/sec, no auth required for public data.
