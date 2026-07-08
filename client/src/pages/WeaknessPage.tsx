import { useWeakness } from '@/hooks/useWeakness';
import { GapHeatmap } from '@/features/weakness/GapHeatmap';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { TopicGapList } from '@/features/weakness/TopicGapList';

const WeaknessPage = () => {
  const { data: scores, isLoading, isError } = useWeakness();

  if (isLoading) return <LoadingState />;
  if (isError) return <EmptyState title="Couldn't load weakness data." />;
  if (!scores || scores.length === 0)
    return <EmptyState title="No gap data yet — complete your first ingest." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Weakness Analysis</h1>
      <GapHeatmap scores={scores} />
      
      <TopicGapList scores={scores} />
    </div>
  );
};

export default WeaknessPage;