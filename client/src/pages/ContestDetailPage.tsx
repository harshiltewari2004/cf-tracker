import { useParams } from 'react-router-dom';

import { useContestDetail } from '@/hooks/useContests';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { ContestSummaryCard } from '@/features/contests/ContestSummaryCard';
import { ContestProblemMatrix } from '@/features/contests/ContestProblemMatrix';

const ContestDetailPage = () => {
  const { cfContestId } = useParams();
  const contestId = Number(cfContestId); 

  const { data, isLoading, isError } = useContestDetail(contestId);

  if (isLoading) return <LoadingState />;
if (isError)
  return <p className="text-center text-red-600">Couldn't load this contest. Refresh to retry.</p>;
if (!data) return <EmptyState title="Contest not found" description="This contest isn't in your history." />;
  return (
  <div className="mx-auto max-w-3xl space-y-6 p-6">
    <h1 className="text-2xl font-bold">{data.contestName}</h1>
    <ContestSummaryCard contest={data} />
    <ContestProblemMatrix problems={data.problems} />
    <p className="text-sm text-slate-500">Contest detail — components coming next</p>
  </div>
);
};

export default ContestDetailPage; 