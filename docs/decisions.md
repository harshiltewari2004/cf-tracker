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