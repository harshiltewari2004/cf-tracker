export const QUERY_STALE_TIME_MS = 5 * 60 * 1000;
export const PASSWORD = {
  MIN_LENGTH: 8,
} as const;
export const CF_HANDLE_MIN_LENGTH = 3;
export const CF_HANDLE_MAX_LENGTH = 24;
export const CF_HANDLE_REGEX = /^[a-zA-Z0-9_]+$/;
export const INGEST_POLL_INTERVAL_MS = 3000;
export const DASHBOARD_RECENT_CONTESTS_LIMIT = 3;
export const DASHBOARD_TOP_GAPS_LIMIT = 3;
export const RELIABILITY_WINDOW = 6;  
export const RELIABILITY_TARGET = 4;   
