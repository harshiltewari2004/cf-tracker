export const BCRYPT_COST_FACTOR = 12;
export const AUTH_COOKIE_NAME = 'token';
export const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const RATE_LIMIT_WINDOW_MS = 15*60*1000;
export const AUTH_RATE_LIMIT_MAX = 15;
export const API_RATE_LIMIT_MAX = 100;
export const INGEST_PAGE_SIZE = 500;
export const MONGO_DUPLICATE_KEY_CODE = 11000;
export const MIN_PROBLEM_RATING = 800;
export const MAX_PROBLEM_RATING = 3500;
export const BUCKET_WIDTH = 200;
export const STRETCH_ZONE_SPAN = 200; 
export const INGEST_SKIP_GUARD_MIN_SUBMISSIONS=20;
export const INGEST_SKIP_GUARD_MAX_MISS_RATIO=0.5;
export const INGEST_QUEUE_NAME = 'ingest';
export const INGEST_JOB_INITIAL = 'initial';
export const INGEST_JOB_DAILY_REFRESH = 'daily_refresh';
export const INGEST_JOB_ATTEMPTS = 5; // matches the queue's attempts (04_architecture.md §5)
export const INGEST_WORKER_CONCURRENCY = 5;

export const BUCKET_RANGES = [];
for (let low = MIN_PROBLEM_RATING; low < MAX_PROBLEM_RATING; low += BUCKET_WIDTH) {
  BUCKET_RANGES.push({ low, high: low + BUCKET_WIDTH, label: `${low}-${low + BUCKET_WIDTH}` });
}