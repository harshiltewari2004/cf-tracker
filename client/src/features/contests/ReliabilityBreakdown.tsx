import { useReliability } from '@/hooks/useReliability';
import { LoadingState } from '@/components/shared/LoadingState';

const formatTime = (minutes: number | null) => (minutes != null ? `${minutes}m` : '—');

export const ReliabilityBreakdown = () => {
  const { data: reliability, isLoading, isError } = useReliability();

  if (isLoading) return <LoadingState />;
  if (isError || !reliability)
    return <p className="text-sm text-red-600">Couldn't load reliability data.</p>;

  const { last6Contests } = reliability;

  if (last6Contests.length === 0) return null; // banner already explains the empty state

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-1 font-semibold">Last {last6Contests.length} Contests</h2>
      <p className="mb-3 text-xs text-slate-500">Most recent first · A reliable under 15m · B under 40m</p>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `2rem repeat(${last6Contests.length}, minmax(0, 1fr))` }}
      >
        <div />
        {last6Contests.map((c) => (
          <div key={c.contestId} className="text-center text-xs text-slate-500">
            #{c.contestId}
          </div>
        ))}

        <div className="flex items-center text-sm font-medium">A</div>
        {last6Contests.map((c) => (
          <ReliabilityCell key={c.contestId} reliable={c.aReliable} time={c.timeA} />
        ))}

        <div className="flex items-center text-sm font-medium">B</div>
        {last6Contests.map((c) => (
          <ReliabilityCell key={c.contestId} reliable={c.bReliable} time={c.timeB} />
        ))}
      </div>
    </div>
  );
};

interface ReliabilityCellProps {
  reliable: boolean;
  time: number | null;
}

const ReliabilityCell = ({ reliable, time }: ReliabilityCellProps) => (
  <div
    className={`rounded py-2 text-center text-sm font-medium ${
      reliable ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'
    }`}
  >
    {formatTime(time)}
  </div>
);