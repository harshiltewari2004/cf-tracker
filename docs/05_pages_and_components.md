# CF Tracker — Pages and Components

**v1.0 — Locked May 2026**

---

## 1. MVP Scope

Seven user-facing pages comprise the MVP. Routes for the authenticated app, the onboarding flow, and auth complete the surface area.

### Build (core loop)
1. Auth (login + signup)
2. Onboarding (CF handle entry, ingest progress)
3. Dashboard (home — today's plan + reliability + summary)
4. Daily Plan (detailed today's-plan page)
5. Weakness Analysis (gap heatmap + per-topic breakdown)
6. Contests (history + reliability detail)
7. Settings (handle change, logout)

### Defer to v2
- Virtual Contest UI — system schedules them; for MVP, a simple list inside Contests page suffices
- Upsolve Queue page — surfaces inside Daily Plan for MVP; dedicated page comes later
- Progress-over-time charts — needs 30+ days of per-user data to be meaningful

---

## 2. Route Structure

```
/                          → redirect to /dashboard if auth, else /login
/login                     → AuthLayout
/signup                    → AuthLayout
/onboarding/handle         → OnboardingLayout (step 1: enter CF handle)
/onboarding/ingesting      → OnboardingLayout (step 2: ingest progress)

/dashboard                 → AppLayout (default home)
/plan                      → AppLayout (today's plan detail)
/weakness                  → AppLayout
/contests                  → AppLayout
/contests/:cfContestId     → AppLayout (single contest detail)
/settings                  → AppLayout

*                          → 404 page
```

React Router v6 nested routes — each Layout becomes a parent route, individual pages render in `<Outlet />`.

---

## 3. Pages

For backend endpoints referenced below, see `04_architecture.md` §4.3.

### 3.1 `/dashboard` — DashboardPage

**Purpose:** Single screen showing today's coaching state. The user opens this every day; it must answer "what should I do today?" in 2 seconds.

**Data fetched:**
- `GET /api/plan/today` → today's DailyPlan
- `GET /api/reliability` → ReliabilityScore
- `GET /api/contests?limit=3` → recent 3 contests
- `GET /api/weakness?top=3` → top 3 gap (topic, bucket) pairs

**Components:**
- `<DailyPlanWidget />` — 3 problems with completion checkboxes, links to CF
- `<ReliabilitySummary />` — A: 3/6, B: 2/6 with progress bars
- `<RecentContestsCard />` — last 3 Div2 results
- `<TopGapsCard />` — top 3 weaknesses (topic@bucket badges with gap %)

**Layout:** 2-column grid on desktop, stacked on mobile.

---

### 3.2 `/plan` — DailyPlanPage

**Purpose:** Focused workspace for today's 3 problems. Used when the user has decided to study.

**Data fetched:**
- `GET /api/plan/today` → today's DailyPlan (same query as dashboard, React Query dedups)

**Components:**
- `<PlanProblemList />` — full-detail list of 3 problems
- `<ProblemCard />` (×3) — name, rating, tags, status, "open in CF" button, "I can't solve this" replace button
- `<PlanCompletionMeter />` — 0/3 → 3/3 progress
- `<ReplaceProblemDialog />` — modal showing the candidate replacement
- `<EmptyState />` — for cold-start day 1 or weekend gaps

**Mutations:**
- Mark solved → `POST /api/plan/problems/:id/solved` → optimistic update + invalidate plan query
- Replace → `POST /api/plan/problems/:id/replace` → returns new problem, replaces in cache

---

### 3.3 `/weakness` — WeaknessPage

**Purpose:** Diagnostic view. Shows where the user is weak so they understand *why* the daily plan picks what it picks. Also the most visually distinctive page — the screenshot for portfolio.

**Data fetched:**
- `GET /api/weakness` → all TopicBucketScores for the user

**Components:**
- `<GapHeatmap />` — matrix grid: topics on Y, rating buckets on X, cell color intensity = `finalGap`. **Hero component.**
- `<TopicGapList />` — flat list sorted by `finalGap` desc with topic, bucket, gap%, contestFails, solves columns
- `<GapExplainer />` — popover: "Why is greedy@1100-1300 my biggest weakness? Solves: 8 / target: 23. Contest fails: 2 / opportunities: 4."
- `<BenchmarkContextBadge />` — "Benchmarked against N=22 IN, 1300-1500 rated users, refreshed [date]"

`<GapExplainer />` is the most interview-relevant component because it surfaces the gap function components transparently. Don't hide the math; expose it. That's your portfolio-defense moment when an interviewer screenshots the page.

---

### 3.4 `/contests` — ContestsPage

**Purpose:** Track the 4-of-6 success metric. User checks this after every contest.

**Data fetched:**
- `GET /api/contests` → last 20 ContestResults
- `GET /api/reliability` → cached ReliabilityScore

**Components:**
- `<ReliabilityBreakdown />` — 6 columns × 2 rows (A and B), green/red cells with time
- `<SuccessMetricBanner />` — "3/6 on A, 2/6 on B" with progress toward 4/4
- `<ContestTimeline />` — chronological list with rank, rating change, A/B status
- `<ContestRow />` — clickable → `/contests/:cfContestId`

---

### 3.5 `/contests/:cfContestId` — ContestDetailPage

**Purpose:** Drill-in for a single contest. Shows what happened problem-by-problem, what got added to upsolve queue, what gaps shifted.

**Data fetched:**
- `GET /api/contests/:cfContestId` → ContestResult + ContestProblemResult[]
- `GET /api/contests/:cfContestId/feedback` → which TopicBucketScores were updated

**Components:**
- `<ContestSummaryCard />` — rank, rating change, time-to-A, time-to-B
- `<ContestProblemMatrix />` — A, B, C, D with solved/failed/unattempted status and times
- `<UpsolveAddedList />` — problems automatically queued
- `<GapImpactList />` — "This contest shifted these (topic, bucket) gaps:"

---

### 3.6 `/settings` — SettingsPage

**Purpose:** Account management. Minimal but necessary.

**Components:**
- `<HandleChangeForm />` — uses React Hook Form + Zod; triggers re-ingest via `PATCH /api/user/handle`
- `<LogoutButton />`
- `<DeleteAccountSection />` — `DELETE /api/user/account`; defer if needed

---

### 3.7 `/onboarding/*` — Onboarding Wizard

**Purpose:** First-run flow. Captures CF handle, kicks off ingest, returns user to a partial dashboard while ingest completes.

**Steps:**

| Step | Path | Component | Behavior |
|---|---|---|---|
| 1 | `/onboarding/handle` | `<HandleEntryStep />` | CF handle input with regex validation + `POST /api/onboarding/codeforces` |
| 2 | `/onboarding/ingesting` | `<IngestProgressStep />` | Polls `GET /api/ingest/status` every 3s, shows progress bar |

Don't block the user. After step 2 begins, route to `/dashboard` with `coldStartComplete: false` and show partial data behind an `<IngestStatusBanner />`.

---

### 3.8 `/login` and `/signup`

Standard auth forms. React Hook Form + Zod, email + password, JWT in httpOnly cookie. Nothing project-specific.

---

## 4. Reusable Components

The shadcn/ui primitives provide Button, Card, Dialog, Input, Tabs, Badge, etc. On top of those:

| Component | Purpose | Used in |
|---|---|---|
| `<TopicBadge />` | Topic name with consistent color per topic | Weakness, Plan, Contests |
| `<BucketBadge />` | Rating bucket pill ("1100-1300") | Weakness, Plan |
| `<ProblemCard />` | Problem display with name, rating, tags, link | Plan, Upsolve, Weakness drill-in |
| `<GapMeter />` | Visual gap representation (bar or circular) | Weakness, Dashboard |
| `<ReliabilityIndicator />` | "X / 6" badge with color | Dashboard, Contests |
| `<IngestStatusBanner />` | Renders only when user is mid-ingest | App-wide (in AppLayout topbar) |
| `<LoadingState />` | Skeleton loaders | Everywhere |
| `<EmptyState />` | "No data yet" placeholder | Plan, Contests |
| `<ErrorBoundary />` | Catches render errors | App root |

**Color consistency:** Define a `topic → color` map once (e.g., `dp` is always purple, `greedy` always orange). Don't randomize.

---

## 5. Layouts

Three layouts, mounted via React Router nested routes.

### `<AuthLayout />`
Centered card on plain background. Wraps `/login`, `/signup`.

### `<OnboardingLayout />`
Wizard with step indicator (1/2, 2/2). Wraps `/onboarding/*`.

### `<AppLayout />`
Wraps the authenticated app. Includes:
- `<Sidebar />` — nav: Dashboard, Plan, Weakness, Contests, Settings
- `<Topbar />` — handle, logout button, `<IngestStatusBanner />`
- `<main>` with `<Outlet />`
- `<Toaster />` — global toast notifications

---

## 6. State Management

Two layers of state with distinct ownership.

### Server state — React Query (`@tanstack/react-query`)

All data that originates from the backend lives in React Query. Default config:
- `staleTime: 5 * 60 * 1000` (5 min) — most data isn't more volatile than that
- Refetch on window focus enabled — catches contest finishes that happened in another tab
- Manual `invalidateQueries` after mutations

Hooks pattern: one hook per query, co-located with the service.

```ts
// hooks/useDailyPlan.ts
export const useDailyPlan = () => useQuery({
  queryKey: ['plan', 'today'],
  queryFn: planService.getTodaysPlan
});

export const useMarkSolved = () => useMutation({
  mutationFn: planService.markSolved,
  onSuccess: () => queryClient.invalidateQueries(['plan', 'today'])
});
```

### Client state — Zustand

Zustand is for state that is **client-only** and not derivable from server data.

- **`authStore`** — current user, login/logout actions, JWT verification status
- **`uiStore`** — sidebar open/closed, theme, toasts queue
- **`ingestStore`** — current ingest progress (lifted so Sidebar topbar banner and Onboarding step 2 can subscribe to one polling source)

Server data (DailyPlan, TopicBucketScore, ContestResults) does **not** live in Zustand. Putting server data in Zustand defeats React Query's caching layer and forces hand-rolled refetch logic.

---

## 7. API Service Layer

One file per resource. Exports typed functions consumed by React Query hooks.

```
src/api/
  client.ts           // axios instance with baseURL + withCredentials
  authService.ts      // login, signup, me, logout
  planService.ts      // getTodaysPlan, markSolved, replaceProblem
  gapService.ts       // getWeakness, getTopGaps
  contestService.ts   // getContests, getContestDetail, getContestFeedback
  reliabilityService.ts
  ingestService.ts    // pollStatus
  userService.ts      // updateHandle, deleteAccount
  onboardingService.ts // submitHandle
```

`client.ts` is the single Axios instance with `baseURL`, `withCredentials: true`, and a response interceptor that surfaces a 401 by clearing `authStore` and redirecting to `/login`.

---

## 8. Build Order

Don't build pages in URL order. Build the data flow end-to-end first, then layer pages on top.

### Phase 1 — Skeleton (2-3 days)
1. Auth pages + JWT cookie flow + AuthLayout
2. AppLayout shell (sidebar with empty pages)
3. Onboarding: handle entry → triggers ingest → routes to dashboard

### Phase 2 — Core loop (1 week)
4. Dashboard with `<DailyPlanWidget />` showing today's 3 problems
5. Daily Plan page with mark-solved + replace mutations
6. Weakness page with the heatmap (your hero feature — invest time)

### Phase 3 — Contest tracking (3-4 days)
7. Contests page with reliability breakdown
8. Contest detail page

### Phase 4 — Polish (3-4 days)
9. Settings page
10. Loading states, error boundaries, empty states everywhere
11. Framer Motion animations (sparingly — transitions, not decoration)
12. Mobile responsive pass

**Total: ~3-4 weeks for MVP.** If you're at week 6, you're scope-creeping. Stop and ship.

---

## 9. Cross-Cutting Concerns

### Loading
- Initial app load: full-screen `<LoadingState />` until auth resolves
- Page-level: skeleton loaders matching the eventual content shape
- Inline (mutations): button spinners and optimistic updates via React Query

### Error handling
- React Query handles network errors at the query level (retry with backoff, then error state)
- `<ErrorBoundary />` at app root catches render errors
- 401 responses → auto-logout via Axios interceptor
- Form validation errors → inline via React Hook Form + Zod messages

### Mobile responsive
- All pages must work on 375px viewport (iPhone SE)
- Sidebar collapses to a bottom-nav tab bar on mobile
- `<GapHeatmap />` becomes a stacked list view below 768px
- Test on real device or accurate emulation, not just Chrome DevTools resizing
