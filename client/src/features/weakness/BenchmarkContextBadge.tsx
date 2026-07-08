import { format } from 'date-fns';
import { useBenchmark } from '@/hooks/useBenchmark';

export const BenchmarkContextBadge = () => {
  const { data: meta } = useBenchmark();

  if (!meta) return null;

  const { filters, N, fallbackUsed, lastRefreshed } = meta;

  return (
    <p className="text-xs text-muted-foreground">
      Benchmarked against N={N} {filters.country}, {filters.minRating}–{filters.maxRating} rated
      users · refreshed {format(new Date(lastRefreshed), 'MMM d, yyyy')}
      {fallbackUsed && (
        <span className="ml-1 text-amber-600">· fallback: {fallbackUsed}</span>
      )}
    </p>
  );
};