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
export const INGEST_BACKOFF_DELAY_MS = 5000;
export const INGEST_KEEP_COMPLETED=100;
export const INGEST_KEEP_FAILED=500;
export const GAP_BETA = 0.4;
export const RELIABLE_A_MINUTES=15;
export const RELIABLE_B_MINUTES=40;
export const RELIABILITY_WINDOW=6;
export const RELIABILITY_TARGET=4;
export const DAILY_PLAN_SIZE=3;
export const COLD_START_TAG_SMOOTHING=1;
export const PLAN_TYPE = {
  COLD_START: 'cold_start',
  GAP_DRIVEN: 'gap_driven',
};

export const BUCKET_RANGES = [];
for (let low = MIN_PROBLEM_RATING; low < MAX_PROBLEM_RATING; low += BUCKET_WIDTH) {
  BUCKET_RANGES.push({ low, high: low + BUCKET_WIDTH, label: `${low}-${low + BUCKET_WIDTH}` });
}



export const CF_HANDLE = {
  MIN_LENGTH: 3,                    
  MAX_LENGTH: 24,
  REGEX: /^[a-zA-Z0-9_]+$/,         
};

export const POLL_RATE_LIMIT={
  WINDOW_MS:15*60*1000,
  MAX:200
};

export const COHORT = {
  MIN_CONTESTS: 30,
  MIN_SOLVES: 500,
  RECENCY_DAYS: 180,
  TARGET_N: 20,
  FLOOR_N: 15,
  FALLBACK_TIERS: [
    { country: 'India', minRating: 1300, maxRating: 1500, fallbackUsed: null },
    { country: 'India', minRating: 1300, maxRating: 1700, fallbackUsed: '1300-1700_IN' },
    { country: null, minRating: 1300, maxRating: 1500, fallbackUsed: '1300-1500_global' },
    { country: null, minRating: 1300, maxRating: 1700, fallbackUsed: '1300-1700_global' },
  ],
};
