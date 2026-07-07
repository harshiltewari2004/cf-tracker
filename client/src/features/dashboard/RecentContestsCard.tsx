import { useRecentContests } from '@/hooks/useContests';
import { useReliability } from '@/hooks/useReliability';
import { LoadingState } from '@/components/shared/LoadingState';

export const RecentContestsCard = () => {
  const { data: contests, isLoading, isError } = useRecentContests();
    const { data: reliability } = useReliability();

  if (isLoading) return <LoadingState />;
  if (isError) return <p className="text-sm text-red-600">Couldn't load contests.</p>;
  if (!contests || contests.length === 0)
    return <p className="text-sm text-slate-500">No contests yet.</p>;

  
  const abFor = (cfContestId: number) =>
    reliability?.last6Contests.find((c) => c.contestId === cfContestId);

  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-3 font-semibold">Recent Contests</h2>
      <ul className="flex flex-col gap-3">
        {contests.map((contest) => {
          const ab = abFor(contest.cfContestId);
          return (
            <li key={contest.cfContestId} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{contest.contestName}</span>
                <span
                  className={contest.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}
                >
                  {contest.ratingChange >= 0 ? '+' : ''}
                  {contest.ratingChange}
                </span>
              </div>
              <div className="mt-0.5 flex gap-3 text-xs text-slate-500">
                <span>rank {contest.rank}</span>
                <span>A {ab ? (ab.solvedA ? '✓' : '✗') : '–'}</span>
                <span>B {ab ? (ab.solvedB ? '✓' : '✗') : '–'}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};