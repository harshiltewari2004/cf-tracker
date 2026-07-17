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
export const BENCHMARK_STALE_TIME_MS = 24 * 60 * 60 * 1000;
export const BUCKET_ORDER = [
  '800-1000',
  '1000-1200',
  '1200-1400',
  '1400-1600',
  '1600-1800',
  '1800-2000',
  '2000-2200',
  '2200-2400',
  '2400-2600',
  '2600-2800',
  '2800-3000',
  '3000-3200',
  '3200-3400',
  '3400-3600',
] as const;


export const BUCKET_HEADER_COLORS: Record<string, string> = {
  '800-1000': '#808080',   
  '1000-1200': '#808080',
  '1200-1400': '#008000',  
  '1400-1600': '#03A89E',  
  '1600-1800': '#0000FF',  
  '1800-2000': '#0000FF',
  '2000-2200': '#AA00AA',  
  '2200-2400': '#FF8C00',  
  '2400-2600': '#FF0000',  
  '2600-2800': '#FF0000',
  '2800-3000': '#FF0000',
  '3000-3200': '#FF0000',
  '3200-3400': '#FF0000',
  '3400-3600': '#FF0000',
};

import { LayoutDashboard, ListTodo, Target, Trophy, Settings } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/plan', label: 'Plan', icon: ListTodo },
  { to: '/weakness', label: 'Weakness', icon: Target },
  { to: '/contests', label: 'Contests', icon: Trophy },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;