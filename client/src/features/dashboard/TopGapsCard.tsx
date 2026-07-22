import { useWeakness } from '@/hooks/useWeakness';
import { Skeleton } from '@/components/ui/skeleton';
import { TopicBadge } from '@/components/shared/TopicBadge';
import { DASHBOARD_TOP_GAPS_LIMIT } from '@/lib/constants';

export const TopGapsCard = () => {
  const { data, isLoading, isError } = useWeakness();

  if (isLoading)
  return (
    <div className=" rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-3 font-semibold">Top Gaps</h2>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-56" />
        ))}
      </div>
    </div>
  );
  if (isError) return <p className="text-sm text-red-600">Couldn't load weaknesses.</p>;
  if (!data || data.length === 0)
    return (
      <div className=" rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-semibold">Top Gaps</h2>
        <p className="text-sm text-slate-500">No gap data yet.</p>
      </div>
    );
  const topGaps = [...data]
    .sort((a, b) => b.finalGap - a.finalGap)
    .slice(0, DASHBOARD_TOP_GAPS_LIMIT);

  return (
    <div className=" rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-3 font-semibold">Top Gaps</h2>
      <ul className="flex flex-col gap-2">
        {topGaps.map((gap) => (
          <li
            key={`${gap.topic}-${gap.bucket}`}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2">
              <TopicBadge topic={gap.topic} />
              <span className="text-slate-500">{gap.bucket}</span>
            </span>
            <span className="font-medium">{Math.round(gap.finalGap * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};