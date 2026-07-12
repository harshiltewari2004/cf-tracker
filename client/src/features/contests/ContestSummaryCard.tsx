import type { ContestDetail } from '@/types/models';

interface ContestSummaryCardProps {
  contest: ContestDetail;
}

const formatTime = (minutes: number | null | undefined) =>
  minutes != null ? `${minutes}m` : '—';

export const ContestSummaryCard = ({ contest }: ContestSummaryCardProps) => {
    const aRow = contest.problems.find((p) => p.isDiv2A);
  const bRow = contest.problems.find((p) => p.isDiv2B);

  const stats = [
    { label: 'Rank', value: `#${contest.rank}` },
    {
      label: 'Rating',
      value: `${contest.oldRating} → ${contest.newRating}`,
      delta: contest.ratingChange,
    },
    { label: 'Time to A', value: formatTime(aRow?.firstACTime) },
    { label: 'Time to B', value: formatTime(bRow?.firstACTime) },
  ];

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-lg font-semibold">
              {s.value}
              {s.delta != null && (
                <span
                  className={`ml-2 text-sm ${s.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {s.delta >= 0 ? '+' : ''}
                  {s.delta}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};