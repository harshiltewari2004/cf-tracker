
import { useReliability } from '@/hooks/useReliability';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ContestRow } from './ContestRow';
import { useContests } from '@/hooks/useContests';
export const ContestTimeline = () => {
  const { data: contests, isLoading, isError } = useContests();
  const { data: reliability } = useReliability();

  if (isLoading)
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
  if (isError) return <p className="text-sm text-red-600">Couldn't load contests.</p>;
  if (!contests || contests.length === 0)
    return (
  <EmptyState
    title="No contests yet"
    description="Enter a Div 2 round and it'll appear here within a day."
  />
);

  const abFor = (cfContestId: number) =>
    reliability?.last6Contests.find((c) => c.contestId === cfContestId);

  return (
    <div className=" rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="mb-1 font-semibold">Contest History</h2>
      <ul className="divide-y">
        {contests.map((contest) => (
          <ContestRow
            key={contest.cfContestId}
            contest={contest}
            ab={abFor(contest.cfContestId)}
          />
        ))}
      </ul>
    </div>
  );
};