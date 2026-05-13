# CF Tracker — Coding Conventions

**v1.0 — Locked May 2026**

---

## Why this doc exists

When you (or future-Claude reading this project) generate code, you should be able to make consistent decisions without re-deriving them every time. This document locks the recurring choices.

Three principles override everything below:

1. **Consistency beats correctness.** If the codebase already does X, do X — even if Y would be marginally better in isolation.
2. **Explicit over implicit.** Type annotations, return values, error throws. Don't rely on the reader to infer.
3. **Boring code wins.** Choose the obvious solution over the clever one. Future-you (and reviewers) will thank you.

---

## 1. Naming

### Files

| Kind | Convention | Example |
|---|---|---|
| React components | PascalCase `.tsx` | `DashboardPage.tsx`, `GapHeatmap.tsx` |
| Hooks | camelCase `.ts`, prefix `use` | `useDailyPlan.ts` |
| Backend models (Mongoose) | PascalCase `.js` | `User.js`, `TopicBucketScore.js` |
| Backend engines | PascalCase `.js` | `GapEngine.js`, `BenchmarkEngine.js` |
| Controllers, services, utils, middleware, routes | camelCase `.js` | `authController.js`, `bucketUtils.js` |
| Type files | camelCase `.ts` | `api.ts`, `models.ts` |
| Test files | mirror source + `.test` | `GapEngine.test.js`, `useDailyPlan.test.ts` |

### Identifiers

- **Variables, functions, methods:** `camelCase` — `getUserPlan`, `topGaps`
- **Components, classes, types, interfaces:** `PascalCase` — `DailyPlan`, `IngestService`, `User`
- **Constants:** `SCREAMING_SNAKE_CASE` — `GAP_BETA`, `BUCKET_RANGES`
- **Environment variables:** `SCREAMING_SNAKE_CASE` — `MONGODB_URI`
- **Booleans:** prefix `is`, `has`, `should` — `isSolved`, `hasContestData`, `shouldRetry`
- **Event handlers (props):** prefix `on` — `<button onClick={onSubmit}>`
- **Event handlers (internal):** prefix `handle` — `const handleSubmit = () => {...}`

### Plurals

- Collection names in Mongo: **singular** Mongoose model name, plural collection (Mongoose handles automatically) — `User` model → `users` collection
- Variables: plural for arrays, singular for items — `users`, `user`; `submissions`, `submission`

---

## 2. File organization

### One thing per file (mostly)

- **One React component per file.** Co-locate small private sub-components in the same file only if they're never reused.
- **One Mongoose model per file.** Always.
- **One controller per resource.** Multiple endpoint handlers in the same file are fine; one resource per file.

### Import order

```javascript
// 1. External (npm packages)
import express from 'express';
import { z } from 'zod';

// 2. Internal absolute imports (config, utils, models, etc.)
import logger from '../config/logger.js';
import User from '../models/User.js';

// 3. Type-only imports (TS only)
import type { Request, Response } from 'express';

// 4. Relative same-folder
import { hashPassword } from './utils.js';
```

Separate each group with a blank line. Don't mix.

### Export style

- **Named exports preferred.** Helps refactoring and discoverability.
- **Default exports** only for: route entry-point components (`pages/*.tsx`), `main.tsx`, `App.tsx`, server entry `server.js`.

```typescript
// Good
export const useDailyPlan = () => {...};
export const useMarkSolved = () => {...};

// Avoid (default export of a single named thing)
const useDailyPlan = () => {...};
export default useDailyPlan;
```

---

## 3. TypeScript

The frontend is TypeScript-first per `04_architecture.md`. Backend is JS for MVP with a TS port planned in `07_timeline_and_milestones.md` Phase 8.

### Use `interface` for object shapes, `type` for unions and aliases

```typescript
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

type IngestStatus = 'queued' | 'processing' | 'complete' | 'failed';
```

### Never use `any`

If you reach for `any`, it means you don't understand the shape. Stop and figure it out. `unknown` is acceptable for genuinely unknown data; narrow it before use.

### Type imports

```typescript
import type { User } from '@/types/models';
```

Type imports are erased at compile time — use them. Mixing value and type imports without the `type` keyword bloats output.

### Inferred return types are fine

Don't annotate every function return type. TypeScript's inference is good. Annotate only when:
- The return type is non-obvious or must be enforced (public APIs)
- Inference picks up too much detail and you want to constrain

```typescript
// Good — inferred
const formatTime = (minutes: number) => `${minutes}m`;

// Good — annotated for clarity
const fetchUser = async (id: string): Promise<User> => {...};
```

---

## 4. Backend (Node + Express + Mongoose)

### Async/await everywhere

Never use `.then()` chains. Never use callbacks except for genuine event-emitter patterns.

```javascript
// Good
const user = await User.findById(id);

// Bad
User.findById(id).then(user => {...});
```

### Controllers are thin

A controller's job is: parse request → call service → return response. No business logic. No database queries (those go in services or engines).

```javascript
// controllers/planController.js
export const getTodaysPlan = async (req, res, next) => {
  try {
    const plan = await planService.getTodaysPlan(req.userId);
    res.json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
};
```

### Services orchestrate, engines compute

- `services/` — multi-step orchestration involving external calls, validations, multiple writes (e.g., onboarding flow)
- `engines/` — domain logic over collections (Gap, DailyPlan, Reliability)

A service can call multiple engines. An engine should not call services.

### Mongoose query conventions

- **Use `.lean()`** for read-only queries. Returns plain objects, much faster.
- **Always specify projections** when you don't need the full document — `.select('field1 field2')`.
- **Use indexes** declared in the model (defined per `03_data_models.md`). Don't ad-hoc query on un-indexed fields.
- **Population:** prefer `.populate()` for one-level joins; for deeper joins, restructure the data instead.

```javascript
// Good
const user = await User.findById(id).select('email name').lean();

// Bad — fetches full document when only email is needed
const user = await User.findById(id);
```

### Transactions

Use `session.withTransaction()` for the contest write path per `04_architecture.md` §7. Don't manually manage `startTransaction` / `commitTransaction` — `withTransaction` handles retries.

### Throw early, throw specifically

```javascript
// Good — custom error with status, formatted by errorHandler middleware
throw new AppError('User not found', 404);

// Bad — generic error, status lost
throw new Error('User not found');
```

Define `AppError` in `utils/errors.js`:

```javascript
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}
```

The global `errorHandler` middleware checks `isOperational` to distinguish expected errors from bugs.

---

## 5. Frontend (React + React Query + Zustand)

### Functional components only

No class components. No `React.FC` wrapper — type props directly:

```typescript
interface ProblemCardProps {
  problem: Problem;
  onSolved: () => void;
}

export const ProblemCard = ({ problem, onSolved }: ProblemCardProps) => {
  return <div>...</div>;
};
```

### Destructure props at the parameter list

```typescript
// Good
export const ProblemCard = ({ problem, onSolved }: ProblemCardProps) => {...};

// Avoid
export const ProblemCard = (props: ProblemCardProps) => {
  const { problem, onSolved } = props;
  ...
};
```

Exception: when there are 6+ props or you need to forward all of them.

### Hooks rules (the actual ones)

- Call hooks at the top of the component, never inside conditions or loops
- Custom hooks always start with `use`
- Don't call hooks from regular functions

### React Query patterns

- **One file per resource** in `hooks/` — query + mutations co-located
- **Query keys are arrays** — `['plan', 'today']`, `['weakness', userId]`
- **Always `invalidateQueries` after mutations** — this is how the cache stays correct

```typescript
// hooks/useDailyPlan.ts
export const useDailyPlan = () => useQuery({
  queryKey: ['plan', 'today'],
  queryFn: planService.getTodaysPlan
});

export const useMarkSolved = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: planService.markSolved,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', 'today'] });
    }
  });
};
```

### Zustand patterns

- **Server data never goes in Zustand.** That's React Query's job.
- One store per domain: `authStore`, `uiStore`, `ingestStore`.
- Keep stores small. If a store has 10+ fields or 5+ actions, split it.

### Conditional rendering

```typescript
// Good — early return for loading/error
if (isLoading) return <LoadingState />;
if (error) return <ErrorMessage error={error} />;
return <Content data={data} />;

// Good — short ternary for tiny branches
{isOpen && <Dialog />}

// Avoid — nested ternaries
{isLoading ? <Loading /> : error ? <Error /> : <Content />}
```

### Event handlers

```typescript
// Internal handlers prefixed `handle`
const handleSubmit = () => {...};

// Props prefixed `on`
<Form onSubmit={handleSubmit} />
```

---

## 6. API contracts

All responses follow this shape:

```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, message: string, code?: string }
```

### HTTP status codes

| Code | Meaning |
|---|---|
| 200 | Success with body |
| 201 | Resource created |
| 204 | Success with no body (rare; prefer 200 with `{ success: true }`) |
| 400 | Validation error (request shape wrong) |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (e.g., handle taken) |
| 422 | Semantic error (e.g., handle exists on CF but ingest failed) |
| 429 | Rate-limited |
| 500 | Server error (unhandled) |

Don't invent status codes. Don't return 200 with `{ success: false }`.

### Request validation

Use `zod` schemas in `middleware/validator.js`. Reject malformed requests before they reach the controller:

```javascript
const updateHandleSchema = z.object({
  handle: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/)
});
```

---

## 7. Error handling

### Backend

- **Operational errors** (validation, not found, conflict): throw `AppError` with status code. Global handler formats response.
- **Programmer errors** (null reference, undefined property): let them bubble. Pino logs them. Global handler returns 500.
- **External service errors** (CF API down): wrap and throw with context — `throw new AppError('Codeforces API unavailable', 503)`.

Never swallow errors silently. If you `try/catch`, either rethrow, throw a new error, or log and continue with explicit reasoning in a comment.

### Frontend

- **Network errors:** React Query handles retries. Show error UI when query is in error state.
- **Validation errors:** React Hook Form + Zod surface inline.
- **Unexpected errors:** `<ErrorBoundary />` at app root catches render errors. Show fallback UI.

```typescript
// Don't do this
try {
  await mutation.mutateAsync(data);
} catch {} // silent

// Do this
try {
  await mutation.mutateAsync(data);
} catch (err) {
  toast.error('Failed to save. Please try again.');
  logger.error({ err }, 'mutation failed');
}
```

---

## 8. Logging

Use Pino structured logging. Never `console.log` in committed code (acceptable during local dev, must be removed before commit).

```javascript
// Good — structured fields, contextual
logger.info({ userId, jobId }, 'ingest job started');
logger.error({ err, userId }, 'ingest job failed');

// Bad — string concatenation, no context
console.log('Started ingest for ' + userId);
```

### Log levels

- `error` — operational failures, exceptions, dead-letter queue events
- `warn` — recoverable issues (rate-limit hit, transaction retry)
- `info` — significant events (job started, user signed up, cron run)
- `debug` — verbose internal state, dev only

### Never log

- Passwords, raw or hashed
- JWT secrets or tokens
- Full request bodies for auth endpoints
- PII beyond what's necessary for debugging (email is OK; full address isn't)

---

## 9. Testing

### File structure

Mirror source structure under `tests/`:

```
tests/
  unit/
    engines/GapEngine.test.js
  integration/
    routes/auth.test.js
  e2e/
    flows/signup.test.js
```

### Test naming

```javascript
describe('GapEngine', () => {
  describe('computeGap', () => {
    it('returns 0 when solves equal targetCount', () => {...});
    it('clamps to 1 when penalty would push beyond', () => {...});
    it('returns base_gap when contestOpportunities is 0', () => {...});
  });
});
```

Each `it` describes behavior in plain English. Read the names alone and you should know what's tested.

### Arrange-Act-Assert

```javascript
it('marks problem as solved on POST', async () => {
  // Arrange
  const user = await createTestUser();
  const plan = await createTestPlan(user);

  // Act
  const res = await request(app)
    .post(`/api/plan/problems/${plan.problems[0].id}/solved`)
    .set('Cookie', authCookie(user));

  // Assert
  expect(res.status).toBe(200);
  expect(res.body.data.problems[0].status).toBe('solved');
});
```

### What to test (per `07_timeline_and_milestones.md` Phase 8)

- **Unit:** `GapEngine.computeGap` edge cases, bucket utils, date utils, validators
- **Integration:** API endpoints with test DB, contest write transaction
- **E2E:** signup → ingest → first plan flow

50–80 tests total is the FAANG-signal target. Don't aim for 100% coverage — aim for the cases that actually fail.

---

## 10. Git

### Branch naming

```
main                    # always deployable
feature/gap-engine
fix/transaction-retry
chore/upgrade-mongoose
```

### Commits

Short, imperative present tense:

```
Add GapEngine.computeGap with all-tags attribution
Fix transaction retry on TransientTransactionError
Refactor planController to use planService
```

Don't write paragraphs. If you need a paragraph, you've stuffed too much into one commit — split it.

For a solo project, formal Conventional Commits is overkill. Just be descriptive.

### Commit early, commit often

Commit at the end of each meaningful unit of work — finishing a function, fixing a bug, completing a section. Don't accumulate 20 unrelated changes in one commit.

---

## 11. Tooling

### ESLint + Prettier

Both projects use ESLint + Prettier with the following decisions:

- **Prettier:** default config + `printWidth: 100`, `singleQuote: true`, `semi: true`, `trailingComma: 'es5'`
- **ESLint:** `eslint:recommended` + `@typescript-eslint/recommended` (frontend) or just `eslint:recommended` (backend MVP)
- **No bikeshedding.** Don't argue about tabs vs spaces. Prettier picks (2-space tabs).

### Husky + lint-staged

Pre-commit hook: run Prettier on staged files, run ESLint, block commit on errors. Skip if you're moving fast in early phases — add when the codebase is large enough that drift becomes a problem (around end of Week 3).

```json
// package.json
{
  "lint-staged": {
    "*.{js,ts,tsx}": ["prettier --write", "eslint --fix"]
  }
}
```

---

## 12. Comments

Code should be self-documenting. Comments are for **why**, not **what**.

```javascript
// Bad — explains the what (obvious from code)
// Increment solves count
score.solves += 1;

// Good — explains the why (non-obvious decision)
// All-tags attribution: each tag's row gets +1 to keep cohort comparison unbiased
problem.tags.forEach(tag => {
  scores[tag][bucket].solves += 1;
});
```

### When to comment

- Non-obvious business rules ("β=0.4 is a defensible midpoint, see problem statement")
- Workarounds ("CF API returns null for unrated contests; coerce to 0")
- TODOs with a date or issue link (`// TODO(harshil, 2026-06): handle Div3 contests`)
- Public API surfaces with JSDoc

### When not to comment

- Restating what the code does
- Out-of-date "explanations" no one will update
- Decorative banners (`// ===== HELPERS =====`)

---

## 13. Performance defaults

- **Mongoose `.lean()`** on every read-only query. Don't think about it; just do it.
- **Index every field used in `.find()`, `.sort()`, or `.aggregate()`.** If you're querying without an index, that's a bug.
- **React Query handles caching.** Don't manually memoize what React Query already caches.
- **`useMemo` and `useCallback`** only when profiler shows the actual cost. Premature optimization is real overhead.
- **Lazy-load route components** with `React.lazy` for routes outside the core flow (Settings, ContestDetail). Keep core (Dashboard, Plan, Weakness) in the main bundle.

---

## 14. Security defaults

- **Never trust client input.** Validate every body, query, and param with zod.
- **Never log secrets.** Audit Pino output before deploying.
- **Never embed JWT in URLs.** Cookies only, httpOnly, secure in production.
- **Never use `eval()`, `new Function()`, or `Function()`.** Never.
- **Hash passwords with bcrypt.** Cost factor 12. Never store plaintext, never log even briefly.
- **CORS specifies origin.** Never `Access-Control-Allow-Origin: *` with credentials.
- **Rate-limit auth routes more aggressively** than general API. Brute force is real.

---

## 15. When in doubt

- **Match the existing pattern in the codebase.** Even if you'd do it differently from scratch.
- **Look at the locked docs.** They're the source of truth.
- **Boring code wins.** Choose the obvious solution.
- **Ask Claude in your project conversation.** That's why the docs are there — Claude will respond consistent with them.

---

This is the last locked doc. The full set is now seven files. Build it well.
