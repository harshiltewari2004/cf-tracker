import { useReliability } from '@/hooks/useReliability';
import { Skeleton } from '@/components/ui/skeleton';
import { RELIABILITY_WINDOW, RELIABILITY_TARGET } from '@/lib/constants';

const ReliabilityBar = ({ label, count }: { label: string; count: number }) => (
  <div>
    <div className="mb-1 flex justify-between text-sm">
      <span className="font-medium">{label}</span>
      <span className="text-slate-500">
        {count}/{RELIABILITY_WINDOW} (target {RELIABILITY_TARGET})
      </span>
    </div>
    <div className="h-2 rounded bg-slate-100">
      <div
        className={`h-2 rounded ${count >= RELIABILITY_TARGET ? 'bg-green-500' : 'bg-amber-400'}`}
        style={{ width: `${(count / RELIABILITY_WINDOW) * 100}%` }}
      />
    </div>
  </div>
);

export const ReliabilitySummary = () => {
  const { data, isLoading, isError } = useReliability();

  if (isLoading)
  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-3 font-semibold">Reliability</h2>
      <div className="mt-3 flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
  if (isError) return <p className="text-sm text-red-600">Couldn't load reliability.</p>;
  if (!data || data.totalReal === 0)
    return (
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">Reliability</h2>
        <p className="text-sm text-slate-500">
          No real Div 2 contests yet — your record starts with your first round.
        </p>
      </div>
    );
  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-3 font-semibold">Reliability</h2>
      <div className="flex flex-col gap-3">
        <ReliabilityBar label="Problem A (<15 min)" count={data.aReliableCount} />
        <ReliabilityBar label="Problem B (<40 min)" count={data.bReliableCount} />
      </div>
    </div>
  );
};