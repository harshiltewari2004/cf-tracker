import { useWeakness } from '@/hooks/useWeakness';
//import { GapHeatmap } from '@/features/weakness/GapHeatmap';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { TopicGapList } from '@/features/weakness/TopicGapList';
import { BenchmarkContextBadge } from '@/features/weakness/BenchmarkContextBadge';

const WeaknessPage = () => {
  const { data: scores, isLoading, isError } = useWeakness();

  if (isLoading) return <LoadingState />;
  if (isError) return <EmptyState title="Couldn't load weakness data." />;
  if (!scores || scores.length === 0)
    return <EmptyState title="No gap data yet — complete your first ingest." />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Weakness Analysis</h1>
      <BenchmarkContextBadge />
      {/* Deferred (D-P9-8): color-intensity grid reads as a palette without conveying the gap message. Logic retained in GapHeatmap.tsx + buildHeatmapGrid.ts. Revisit with the "Weakness scan" composition. */}
{/* <GapHeatmap scores={scores} /> */}
<TopicGapList scores={scores} />
    </div>
  );
};

export default WeaknessPage;