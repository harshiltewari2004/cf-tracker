# CF Tracker — Timeline and Milestones

**v1.0 — Locked May 2026**

---

## Scope of estimate

This timeline assumes:
- **Solo build** (you, no co-developer)
- **Part-time effort** — ~15–20 hours/week (2–3 hrs weekdays, more weekends)
- **MERN learner** — comfortable with the stack but not a senior engineer
- **Total MVP duration: ~7 weeks**
- **Post-MVP for FAANG signal: +4–5 weeks**

If you can put 30+ hours/week on it, halve the timeline. If you're at 5–10 hours/week, double it. The phase order doesn't change either way.

---

## Build order rationale

**Backend before frontend.** The frontend cannot be meaningfully tested without real APIs returning real data. Mocking everything for 4 weeks of frontend work creates two problems: the mocks drift from reality, and you'll discover backend constraints late. Build the backend pipeline end-to-end first — even if ugly — then layer the frontend on top.

**Ingest layer before engines.** The engines (Gap, DailyPlan, Reliability) all consume Submission data. Without ingest working, you can't test engines except with synthetic fixtures. Get one user's real CF data flowing into Mongo before writing any engine code.

**Hero component before settings.** When time pressure hits at the end (and it will), settings can ship as a single form. The Weakness heatmap cannot. Polish the hero feature first.

---

## Pre-build — Week 0 (3–4 days)

### Goals
- Repo initialized with `client/` and `server/`
- All 6 locked docs in `docs/`
- Infra accounts created (Atlas, Upstash, Render)
- `.env.example` files in both halves with zod validation in `server/config/env.js`
- "Hello world" deploys successfully to Render and a Vercel preview from Vite

### Done when
- You can `git push` and see a deployed Express response at a public URL
- You can run `npm run dev` in both `client/` and `server/` and they talk to each other locally
- MongoDB Atlas cluster is connectable from your local Express
- Redis Upstash is connectable from your local Express

**Don't skip this.** Spending Week 0 on infra means Weeks 1–7 don't fight infra problems on top of code problems.

---

## Phase 1 — Backend foundation (Week 1)

### Build
- All 16 Mongoose models from `03_data_models.md`
- Express app skeleton, middleware (auth, rateLimit, errorHandler, validator)
- Auth routes: register, login, logout, me
- JWT in httpOnly cookie, bcrypt password hashing
- User and CFProfile creation flow on signup
- `routes/user.js` with `PATCH /api/user/handle` and `DELETE /api/user/account`
- Pino logger setup
- CORS configured

### Done when
- You can register a user via Postman/curl, get back a JWT cookie, and hit `GET /api/auth/me` successfully
- You can change your handle via `PATCH /api/user/handle` and see it update in CFProfile
- All 16 collections exist in Mongo with correct indexes

**Don't build any engine logic yet.** The temptation will be huge. Resist.

---

## Phase 2 — Ingest pipeline (Week 2)

The hardest backend piece. Budget the most time here.

### Build
- `CFApiClient.js` with axios + 1 req/sec global rate limiter (use `bottleneck` or hand-rolled)
- `SubmissionParser.js` — parse, normalize verdict, UTC normalize timestamps
- `IngestService.js` — `runInitialIngest`, `runDailyRefresh`
- BullMQ setup: `queues/ingestQueue.js` + `workers/ingestWorker.js`
- Redis connection in `config/redis.js`
- Onboarding controller flow: validate handle → create CFProfile → queue ingest job
- `GET /api/ingest/status` for polling
- Failure handling: 429 retry with backoff, 503 mid-page resume, dedup on `(user, cfSubmissionId)`
- Contest catalog seeding: separate one-time script that pulls all CF Div2 contests into the `Contest` collection

### Done when
- You can sign up with your real CF handle (`harshil20`), wait 2–5 minutes, and see your full submission history in Mongo
- A second signup of the same handle is idempotent (no duplicate submissions)
- Killing the worker mid-ingest and restarting resumes from `lastIngestedSubmissionId`
- Your contest catalog has every Div 2 from the past 2 years

**Validation milestone.** Before moving to Phase 3, manually inspect Mongo for a real user and confirm the data shape matches the schema. If anything looks off, fix it now — every downstream phase compounds bad ingest data.

---

## Phase 3 — Domain engines (Week 3)

### Build (in this order)
1. **`BenchmarkEngine`** — fetch cohort, compute medians, write `BenchmarkCohort` + `BenchmarkTargetCount`. One-time run script first; cron job later.
2. **`GapEngine`** — `recalculate(userId)` reads Submission + ContestProblemResult + BenchmarkTargetCount, writes TopicBucketScore with all formula components.
3. **`DailyPlanEngine`** — `generatePlan(userId, date)` with cold-start vs gap-driven branching, stretch zone filtering, dedup against seen problems.
4. **`ReliabilityEngine`** — `refresh(userId)` queries last 6 Div2 ContestResults, computes A/B reliability, writes ReliabilityScore.
5. **`ContestFeedbackEngine`** — runs after contest ingest, seeds UpsolveQueue, triggers GapEngine recalc.
6. **Write pipeline** — wire everything together. The CONTESTANT submission write path with transaction (`session.withTransaction`).
7. **Cron jobs** — `dailyRefreshJob.js` (enqueues per-user) and `benchmarkRefreshJob.js`.

### Done when
- For your test user, `GET /api/weakness` returns sorted TopicBucketScores with sensible gap values
- `GET /api/plan/today` returns 2 gap problems + 1 upsolve (or 3 gap if queue empty)
- `GET /api/reliability` returns last-6 contests with `aReliableCount`, `bReliableCount`, `reliabilityProgress`
- The benchmark cron successfully refreshes (manually trigger it once to verify)
- All API routes from `04_architecture.md` §4.3 are implemented and respond with real data

**Backend MVP complete.** At this point you should be able to demo the full backend with curl/Postman. Frontend is next.

---

## Phase 4 — Frontend skeleton (Week 4)

### Build
- Vite + Tailwind + shadcn/ui setup
- React Router v6 route tree
- React Query setup (`QueryClientProvider` in App)
- Zustand stores (auth, ui, ingest)
- Axios client with `withCredentials` and 401 interceptor
- All three layouts: AuthLayout, OnboardingLayout, AppLayout
- Auth pages (login, signup) — fully functional
- Onboarding: HandleEntryPage + IngestProgressPage with polling
- All page files exist as empty shells with their route mounted

### Done when
- You can sign up via the UI, enter your CF handle, see the ingest progress bar fill, and land on a (still-empty) dashboard
- Sidebar nav works; clicking each link routes to the correct empty page
- 401 from any API call routes you to `/login`
- Mobile viewport (375px) doesn't completely break

---

## Phase 5 — Core UI (Week 5)

### Build (in this order)
1. **DashboardPage** with `<DailyPlanWidget />`, `<ReliabilitySummary />`, `<RecentContestsCard />`, `<TopGapsCard />`
2. **DailyPlanPage** with `<ProblemCard />`, mark-solved mutation, replace-problem dialog
3. **WeaknessPage** with `<GapHeatmap />` (the hero), `<TopicGapList />`, `<GapExplainer />` popover, `<BenchmarkContextBadge />`

### Done when
- You can use the app for a full day: open dashboard → see today's plan → click into Daily Plan → mark a problem solved → see it reflected on dashboard
- Weakness heatmap looks polished (this is the screenshot you'll use in interviews — invest the time)
- All three pages handle loading, error, and empty states correctly

**Hero milestone.** When the heatmap feels right, you're 70% done with the visible product.

---

## Phase 6 — Contest UI (Week 6)

### Build
1. **ContestsPage** with `<ReliabilityBreakdown />`, `<SuccessMetricBanner />`, `<ContestTimeline />`
2. **ContestDetailPage** with `<ContestProblemMatrix />`, `<UpsolveAddedList />`, `<GapImpactList />`

### Done when
- After a real Div 2 contest, you can see the result on the Contests page within 24 hours (the daily cron runs)
- Clicking into a contest shows a per-problem breakdown with times
- The "this contest shifted these gaps" panel actually shows shifts vs the previous gap state

---

## Phase 7 — Polish + ship MVP (Week 7)

### Build
- SettingsPage with handle change form, logout, delete account
- Empty states everywhere (you missed some — find them)
- Loading skeletons everywhere
- ErrorBoundary at app root
- Mobile responsive pass on all pages (real device, not just DevTools)
- Framer Motion transitions — page transitions, dialog open/close (sparingly)
- 404 page
- README in repo root with setup instructions and a demo GIF

### Deploy
- Frontend → Vercel or Netlify (env: `VITE_API_URL` pointing to Render backend)
- Backend → Render with all env vars set
- Test signup → ingest → first plan flow on production with a real CF handle

### Done when
- Anyone with a CF handle can sign up at your live URL and use the product end-to-end
- You're not embarrassed to share the URL

**MVP shipped.** Take a day off. You earned it.

---

## Phase 8 — FAANG signal work (Weeks 8–12)

These are not features. They're evidence of engineering rigor. Per `meta_deliverables`, ranked by impact:

### Week 8 — Real users + measurement
- Recruit 15–20 actual CP students (CF subreddit, college clubs, Discord)
- Track their rating trajectories for 8 weeks via the daily cron
- Capture testimonials and aggregate stats — even mixed results matter

### Week 9 — Technical blog post
- 2,000-word post on Medium or your own site
- Title: *"Building a closed-loop coach for competitive programming"*
- Walk through the gap function design, contest-feedback math, validation methodology
- Link from your resume — interviewers read this before the call

### Week 10 — TypeScript port + test suite
- Port server to TS (Mongoose schemas become typed)
- Vitest or Jest: 50–80 tests
  - Unit: gap function edge cases (target=0, multi-tag, divide-by-zero), bucket utils
  - Integration: contest-write transaction, ingest pipeline
  - E2E: signup → ingest → first daily plan

### Week 11 — Production observability
- Pino → structured JSON to log aggregator
- Prometheus exporter on `/metrics`
- Grafana dashboard for queue depth, CF API consumption, gap recompute latency
- Screenshot the dashboard for portfolio

### Week 12 — Open source benchmark + Loom video
- Weekly script that exports `BenchmarkTargetCount` as a public JSON dump on GitHub
- README explaining the methodology, citing your blog post
- 5-minute Loom architecture walkthrough — record yourself with the architecture doc on screen

---

## Critical milestones — pause and validate

These are the moments to stop, breathe, and confirm you're on track. Not optional.

| Milestone | When | What to verify |
|---|---|---|
| **Real ingest works** | End of Week 2 | Your own CF data is in Mongo, dedup works, killing/restarting the worker resumes cleanly |
| **Gap function returns sensible values** | End of Week 3 | Manually inspect 3–4 (topic, bucket) rows for your account. Do the gap values match your actual weak topics? If not, the formula or attribution is wrong — fix before frontend |
| **One real end-to-end flow** | End of Week 4 | Signup → ingest → land on empty dashboard works without errors |
| **Hero component looks right** | End of Week 5 | Show the Weakness heatmap to a CP friend. If they don't immediately understand it, redesign |
| **Production deploy works** | End of Week 7 | Sign up at your live URL with a fresh email. If it fails, fix before you tell anyone about the project |

---

## Risk markers — when to reassess

If at any of these checkpoints the corresponding condition is **false**, stop and re-plan. Don't push through.

- **End of Week 2:** Ingest pipeline working with your real CF data
- **End of Week 4:** You can sign up and reach a dashboard with real (even if minimal) data
- **End of Week 6:** All 7 MVP pages exist and render real data — even if rough
- **End of Week 7:** Live URL works for a stranger

If any are missed by more than 5 days, the issue is usually **scope creep, not skill**. Cut something.

---

## Definition of MVP done

A non-technical user can:
1. Sign up at a live URL with their CF handle
2. Wait through the ingest progress bar
3. See a populated dashboard with today's plan, reliability, recent contests, top gaps
4. Click a problem → open it on Codeforces → solve it → return and mark it solved
5. View their weakness heatmap and understand which topic-bucket pairs are weak
6. After their next real Div2 contest, see the contest reflected within 24 hours

If all six work, you have a shippable MVP. If any don't, you don't.

---

## Final note

The timeline above is a guide, not a contract. Your real timeline depends on hours/week, prior MERN experience, and how many surprises the CF API throws at you (it will throw some). Build the backend honestly — without shortcuts on the ingest pipeline — and the frontend will follow naturally.

The thinking is done. The decisions are locked. The structure is in place. Build it well.

Good luck.
