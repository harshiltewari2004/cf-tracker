import { useDailyPlan } from '@/hooks/useDailyPlan';
import { LoadingState } from '@/components/shared/LoadingState';
import { TopicBadge } from '@/components/shared/TopicBadge';

export const DailyPlanWidget = () => {
  const { data: plan, isLoading, isError } = useDailyPlan();

  if (isLoading) return <LoadingState />;
  if (isError) return <p className="text-sm text-red-600">Couldn't load today's plan.</p>;
  if (!plan || plan.problems.length === 0)
    return <p className="text-sm text-slate-500">No plan for today yet.</p>;

  const solvedCount = plan.problems.filter((p) => p.status === 'solved').length;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Today's Plan</h2>
        <span className="text-sm text-slate-500">
          {solvedCount}/{plan.problems.length} solved
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {plan.problems.map((entry) => (
          <li key={entry._id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <a
                href={entry.problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate font-medium hover:underline"
              >
                {entry.problem.name}
              </a>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="text-xs text-slate-500">{entry.problem.rating}</span>
                {entry.problem.tags.map((tag) => (
                  <TopicBadge key={tag} topic={tag} />
                ))}
              </div>
            </div>
            <span
              className={`shrink-0 text-xs font-medium ${
                entry.status === 'solved' ? 'text-green-600' : 'text-slate-400'
              }`}
            >
              {entry.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};