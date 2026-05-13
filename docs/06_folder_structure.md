# CF Tracker — Folder Structure

**v1.0 — Locked May 2026**

---

## 1. Repo Layout

A monorepo with `client/` and `server/` as siblings. Deployed separately (frontend → static host or Vercel, backend → Render). No shared package; types are re-declared on each side because the project is small enough that the duplication cost is lower than the build-tooling cost of a shared package.

```
cf-tracker/
├── client/                  # React + Vite frontend
├── server/                  # Express backend
├── docs/                    # The 6 locked docs (this file + 5 others)
├── .gitignore
├── README.md
└── package.json             # optional: root scripts (lint:all, test:all)
```

---

## 2. Server Folder Structure

```
server/
├── config/
│   ├── db.js                        # MongoDB Atlas connection with retry
│   ├── redis.js                     # Redis client + BullMQ connection
│   ├── env.js                       # zod env-var validation, fail-fast on missing vars
│   ├── cors.js                      # CORS (credentials: true, env-driven origin)
│   ├── logger.js                    # Pino structured JSON setup
│   └── constants.js                 # BUCKET_RANGES, GAP_BETA, COHORT filters, etc.
│
├── models/                          # Mongoose schemas — see 03_data_models.md
│   ├── User.js
│   ├── CFProfile.js
│   ├── Contest.js                   # Master CF contest catalog
│   ├── Problem.js
│   ├── Submission.js
│   ├── TopicBucketScore.js
│   ├── DailyPlan.js
│   ├── UpsolveQueue.js
│   ├── ContestResult.js
│   ├── ContestProblemResult.js
│   ├── ReliabilityScore.js
│   ├── BenchmarkCohort.js
│   ├── BenchmarkTargetCount.js
│   ├── IngestJob.js
│   ├── VirtualContest.js
│   └── ValidationBaseline.js
│
├── routes/                          # Express routers — see 04_architecture.md §4.3
│   ├── auth.js                      # POST register/login/logout, GET me
│   ├── user.js                      # PATCH /api/user/handle, DELETE /api/user/account
│   ├── onboarding.js                # POST codeforces, GET status
│   ├── plan.js                      # GET today, POST :id/solved, POST :id/replace
│   ├── weakness.js                  # GET, GET /:topic
│   ├── contests.js                  # GET, GET /:id, GET /:id/feedback
│   ├── reliability.js               # GET
│   ├── dashboard.js                 # GET (aggregated)
│   ├── virtual.js                   # GET /current, POST /start
│   └── ingest.js                    # GET /status (polled during onboarding)
│
├── controllers/                     # Thin: parse request → call service → return
│   ├── authController.js
│   ├── userController.js            # updateHandle, deleteAccount
│   ├── onboardingController.js
│   ├── planController.js            # getTodaysPlan, markSolved, replaceProblem
│   ├── weaknessController.js
│   ├── contestController.js
│   ├── dashboardController.js
│   ├── reliabilityController.js
│   ├── virtualController.js
│   └── ingestController.js
│
├── services/                        # Stateless orchestration
│   ├── authService.js               # bcrypt, JWT sign/verify
│   ├── userService.js               # handle change → queue re-ingest
│   ├── onboardingService.js         # validate handle → CFProfile → IngestJob
│   └── planService.js               # plan generation orchestration
│
├── engines/                         # Domain logic — see 04_architecture.md §4.4
│   ├── GapEngine.js                 # recalculate(userId), computeGap(...)
│   ├── DailyPlanEngine.js           # generatePlan, getColdStartPlan, getGapDrivenPlan
│   ├── BenchmarkEngine.js           # refresh, fetchCohort, computeTargetCounts
│   ├── ReliabilityEngine.js         # refresh(userId), computeReliabilityProgress
│   ├── ContestFeedbackEngine.js     # extractContestFails, seedUpsolveQueue
│   └── VirtualContestEngine.js      # selectContest, scheduleWeeklyVirtual
│
├── ingest/                          # CF API integration
│   ├── IngestService.js             # runInitialIngest, runDailyRefresh
│   ├── CFApiClient.js               # axios wrapper, ~1 req/sec rate-limited
│   └── SubmissionParser.js          # parse, normalizeVerdict, UTC normalization
│
├── queues/                          # BullMQ queue definitions
│   ├── ingestQueue.js               # initial + daily-refresh jobs
│   └── benchmarkQueue.js            # weekly cohort refresh
│
├── workers/                         # BullMQ workers (consume queues)
│   ├── ingestWorker.js              # consumes ingestQueue, calls IngestService
│   └── benchmarkWorker.js           # consumes benchmarkQueue, calls BenchmarkEngine
│
├── jobs/                            # node-cron in-process schedulers
│   ├── dailyRefreshJob.js           # 02:00 UTC — enqueues per-user BullMQ jobs
│   └── benchmarkRefreshJob.js       # Sunday 03:00 UTC — enqueues benchmark refresh
│
├── middleware/
│   ├── authMiddleware.js            # JWT verification from httpOnly cookie
│   ├── rateLimiter.js               # authLimiter, apiLimiter
│   ├── errorHandler.js              # consistent error response shape
│   └── validator.js                 # express-validator + zod
│
├── utils/
│   ├── bucketUtils.js               # ratingToBucket, getBuckets, isInStretchZone
│   ├── dateUtils.js                 # toUTC, getDateOnly, daysBetween
│   └── mathUtils.js                 # clamp + future math helpers
│
├── tests/
│   ├── unit/
│   │   ├── engines/                 # GapEngine, DailyPlanEngine, etc.
│   │   ├── services/
│   │   └── utils/
│   ├── integration/
│   │   └── routes/                  # endpoint-level with test DB
│   └── e2e/
│       └── flows/                   # signup → ingest → first plan
│
├── .env.example                     # All required env vars with placeholder values
├── .gitignore
├── package.json
└── server.js                        # app setup, middleware, routes, DB, cron init
```

### Server design notes

- **`/api/cf/` prefix dropped.** The whole app is CF-related; the prefix carried no signal. All routes live under `/api/<resource>/` directly.
- **`/api/cf/sync` removed.** DoS vector. Sync is automatic only — see `04_architecture.md` §14.
- **`engines/` vs `services/`.** Engines are domain-specific computation over collections (Gap, Plan, etc.) — long-running, periodic, complex. Services are stateless orchestration of multi-step flows (signup, handle change). Don't conflate.
- **`workers/` and `jobs/` are different.** Workers are BullMQ consumers — they process queued work. Jobs are cron schedulers — they *enqueue* work for workers. Daily refresh cron does not loop synchronously over users; it enqueues one BullMQ job per user.
- **No `IngestJobHandler.js`.** Its role moved to `workers/ingestWorker.js` — that's the BullMQ-native pattern.

---

## 3. Client Folder Structure

```
client/
├── public/
│   └── favicon.svg
│
├── src/
│   ├── api/                         # See 05_pages_and_components.md §7
│   │   ├── client.ts                # axios instance, baseURL, withCredentials, 401 interceptor
│   │   ├── authService.ts
│   │   ├── userService.ts
│   │   ├── onboardingService.ts
│   │   ├── planService.ts
│   │   ├── gapService.ts
│   │   ├── contestService.ts
│   │   ├── reliabilityService.ts
│   │   └── ingestService.ts
│   │
│   ├── hooks/                       # React Query hooks, one per data resource
│   │   ├── useAuth.ts
│   │   ├── useDailyPlan.ts          # useDailyPlan + useMarkSolved + useReplaceProblem
│   │   ├── useWeakness.ts
│   │   ├── useContests.ts
│   │   ├── useReliability.ts
│   │   ├── useDashboard.ts
│   │   └── useIngestStatus.ts
│   │
│   ├── stores/                      # Zustand — client-only state
│   │   ├── authStore.ts
│   │   ├── uiStore.ts               # sidebar open, theme
│   │   └── ingestStore.ts           # lifted polling state
│   │
│   ├── pages/                       # Route entry points (thin wrappers)
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── DailyPlanPage.tsx
│   │   ├── WeaknessPage.tsx
│   │   ├── ContestsPage.tsx
│   │   ├── ContestDetailPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── HandleEntryPage.tsx      # /onboarding/handle
│   │   ├── IngestProgressPage.tsx   # /onboarding/ingesting
│   │   └── NotFoundPage.tsx
│   │
│   ├── features/                    # Page-specific components
│   │   ├── dashboard/
│   │   │   ├── DailyPlanWidget.tsx
│   │   │   ├── ReliabilitySummary.tsx
│   │   │   ├── RecentContestsCard.tsx
│   │   │   └── TopGapsCard.tsx
│   │   ├── plan/
│   │   │   ├── PlanProblemList.tsx
│   │   │   ├── PlanCompletionMeter.tsx
│   │   │   └── ReplaceProblemDialog.tsx
│   │   ├── weakness/
│   │   │   ├── GapHeatmap.tsx       # HERO COMPONENT
│   │   │   ├── TopicGapList.tsx
│   │   │   ├── GapExplainer.tsx
│   │   │   └── BenchmarkContextBadge.tsx
│   │   ├── contests/
│   │   │   ├── ReliabilityBreakdown.tsx
│   │   │   ├── SuccessMetricBanner.tsx
│   │   │   ├── ContestTimeline.tsx
│   │   │   ├── ContestRow.tsx
│   │   │   ├── ContestSummaryCard.tsx
│   │   │   ├── ContestProblemMatrix.tsx
│   │   │   ├── UpsolveAddedList.tsx
│   │   │   └── GapImpactList.tsx
│   │   └── settings/
│   │       └── HandleChangeForm.tsx
│   │
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives (button, card, dialog, etc.)
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── AuthLayout.tsx
│   │   │   ├── OnboardingLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   └── shared/                  # Cross-feature reusables — see 05 §4
│   │       ├── TopicBadge.tsx
│   │       ├── BucketBadge.tsx
│   │       ├── ProblemCard.tsx
│   │       ├── GapMeter.tsx
│   │       ├── ReliabilityIndicator.tsx
│   │       ├── IngestStatusBanner.tsx
│   │       ├── LoadingState.tsx
│   │       ├── EmptyState.tsx
│   │       └── ErrorBoundary.tsx
│   │
│   ├── lib/
│   │   ├── utils.ts                 # cn() helper for shadcn/ui
│   │   ├── topicColors.ts           # topic → color map (locked once, never randomized)
│   │   └── constants.ts             # frontend-only constants
│   │
│   ├── types/                       # Shared TypeScript types
│   │   ├── api.ts                   # API request/response shapes
│   │   ├── models.ts                # mirror of backend Mongoose schemas
│   │   └── index.ts                 # barrel
│   │
│   ├── App.tsx                      # QueryClientProvider, error boundary, etc.
│   ├── main.tsx                     # React DOM root
│   └── router.tsx                   # React Router v6 route tree
│
├── tests/
│   ├── unit/                        # Component logic tests
│   ├── integration/                 # Multi-component flows with mocked API
│   └── e2e/                         # Playwright or Cypress against running stack
│
├── .env.example                     # VITE_API_URL etc.
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

### Client design notes

- **`pages/` vs `features/`.** A `pages/*.tsx` file is a thin route entry point — it composes layout + a feature component tree. The actual UI lives in `features/<page>/`. This keeps `pages/` skimmable as a route map and `features/` organized by domain.
- **`components/shared/` is for true cross-feature primitives.** `<ProblemCard />` is shared because it appears in plan, upsolve, and weakness drill-ins. `<DailyPlanWidget />` is dashboard-specific so it lives in `features/dashboard/`.
- **`hooks/` co-locates query + mutation per resource.** `useDailyPlan.ts` exports `useDailyPlan`, `useMarkSolved`, and `useReplaceProblem`. One file per data resource keeps cache invalidation logic close together.
- **TypeScript everywhere.** `.ts` for non-component logic, `.tsx` for components. shadcn/ui ships TS-first; aligning saves friction.
- **`topicColors.ts` is the single locked color map.** Define it once. Never randomize topic colors at render time. Visual consistency matters.

---

## 4. Naming Conventions

### Backend
- Files: `camelCase.js` (`authController.js`, `gapEngine.js` — wait, engines are `PascalCase.js` since they're class-like singletons)
- **Engines:** `PascalCase.js` — they're treated as named services
- **Controllers, services, utils, middleware, routes:** `camelCase.js`
- **Models:** `PascalCase.js` matching the collection name (`User.js`, `TopicBucketScore.js`)
- **Functions:** `camelCase`
- **Constants:** `SCREAMING_SNAKE_CASE`

### Frontend
- **Components:** `PascalCase.tsx` (`DashboardPage.tsx`, `GapHeatmap.tsx`)
- **Hooks:** `camelCase.ts` starting with `use` (`useDailyPlan.ts`)
- **Utilities, services, stores:** `camelCase.ts`
- **Types:** `camelCase.ts` for files, `PascalCase` for type/interface names

---

## 5. What Goes in `.env`

### Server
```
NODE_ENV=development|production
PORT=3000
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...
JWT_SECRET=<32+ char random>
JWT_EXPIRES_IN=24h
COOKIE_DOMAIN=localhost
FRONTEND_ORIGIN=http://localhost:5173
LOG_LEVEL=info
```

### Client
```
VITE_API_URL=http://localhost:3000
```

`config/env.js` validates these at startup with zod and exits with a clear error if anything is missing or malformed. Never reference `process.env` directly outside this file.

---

## 6. What's NOT in this Structure (and why)

- **No GraphQL.** REST is sufficient; the data model isn't graph-shaped enough to justify the schema overhead.
- **No microservices.** Single Express monolith. Splitting workers into their own deploy comes later (see `04_architecture.md` §12 scale path).
- **No shared `packages/` between client and server.** Re-declaring types on the client is cheaper than monorepo build tooling for a project this size.
- **No Storybook.** Component-level visual development isn't the bottleneck for this project. Add it in v2 if the design system grows.
- **No Docker for local dev.** MongoDB Atlas + Upstash Redis + `npm run dev` covers it. Docker comes if/when self-hosting becomes necessary.

These are deliberate scope decisions. Each saves real time without compromising the deliverable.

---

## 7. Where to Start

1. Initialize monorepo: `mkdir cf-tracker && cd cf-tracker && git init`
2. Scaffold server: `mkdir server && cd server && npm init -y && npm i express mongoose bullmq ioredis pino bcrypt jsonwebtoken zod axios date-fns express-rate-limit express-validator cors cookie-parser dotenv node-cron`
3. Scaffold client: `cd ../ && npm create vite@latest client -- --template react-ts && cd client && npx shadcn-ui@latest init && npm i @tanstack/react-query zustand react-router-dom react-hook-form @hookform/resolvers zod axios framer-motion recharts lucide-react`
4. Create the folder skeletons above (empty files, just the structure).
5. Drop the 6 locked docs into `docs/`.
6. Follow the build order in `05_pages_and_components.md` §8.

You're ready to build.
