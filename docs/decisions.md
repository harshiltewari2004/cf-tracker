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