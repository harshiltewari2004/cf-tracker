import { useReliability } from '@/hooks/useReliability';
import { LoadingState } from '@/components/shared/LoadingState';
import { RELIABILITY_TARGET, RELIABILITY_WINDOW } from '@/lib/constants';

export const SuccessMetricBanner = () => {
  const { data: reliability, isLoading, isError } = useReliability();

  if (isLoading) return <LoadingState />;
  if (isError || !reliability)
    return <p className="text-sm text-red-600">Couldn't load reliability data.</p>;

  const { aReliableCount, bReliableCount, last6Contests } = reliability;
  const windowSize = Math.min(last6Contests.length, RELIABILITY_WINDOW);
  // Success metric evaluated inline, never stored (01)
  const isReliable = aReliableCount >= RELIABILITY_TARGET && bReliableCount >= RELIABILITY_TARGET;

  if (windowSize === 0)
    return (
      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold">Div 2 Reliability</h2>
        <p className="mt-1 text-sm text-slate-500">
          No real Div 2 contests yet. Your reliability window fills as you compete.
        </p>
      </div>
    );

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Div 2 Reliability</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isReliable ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {isReliable ? 'Reliable' : 'In progress'}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <MetricRow label="A" count={aReliableCount} windowSize={windowSize} />
        <MetricRow label="B" count={bReliableCount} windowSize={windowSize} />
      </div>
    </div>
  );
};

interface MetricRowProps {
  label: string;
  count: number;
  windowSize: number;
}

const MetricRow = ({ label, count, windowSize }: MetricRowProps) => (
  <div className="flex items-center gap-3 text-sm">
    <span className="w-4 font-medium">{label}</span>
    <div className="h-2 flex-1 rounded-full bg-slate-100">
      <div
        className="h-2 rounded-full bg-green-500"
        style={{ width: `${(Math.min(count, RELIABILITY_TARGET) / RELIABILITY_TARGET) * 100}%` }}
      />
    </div>
    <span className="w-20 text-right text-slate-500">
      {count}/{windowSize} · goal {RELIABILITY_TARGET}
    </span>
  </div>
);