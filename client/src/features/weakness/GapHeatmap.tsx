import { useMemo } from 'react';
import { buildHeatmapGrid } from './buildHeatmapGrid';
import { BUCKET_HEADER_COLORS } from '@/lib/constants';
import type { TopicBucketScore } from '@/types/models';

interface GapHeatmapProps {
  scores: TopicBucketScore[];
}

const cellBackground = (cell: TopicBucketScore | undefined) => {
  if (!cell) return 'transparent';                          // no data
  if (cell.finalGap === 0) return 'rgba(34, 197, 94, 0.15)'; // earned zero
  const alpha = 0.15 + 0.85 * cell.finalGap;                 // floor keeps small gaps visible
  return `rgba(239, 68, 68, ${alpha})`;                      // gap intensity
};

export const GapHeatmap = ({ scores }: GapHeatmapProps) => {
  const grid = useMemo(() => buildHeatmapGrid(scores), [scores]);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `minmax(150px, auto) repeat(${grid.buckets.length}, minmax(52px, 1fr))`,
        }}
      >
        {/* header row */}
        <div /> {/* empty corner */}
        {grid.buckets.map((bucket) => (
          <div
            key={bucket}
            className="px-1 py-2 text-center text-xs font-medium"
            style={{ color: BUCKET_HEADER_COLORS[bucket] }}
          >
            {bucket}
          </div>
        ))}

        {/* data rows */}
        {grid.topics.map((topic) => (
          <>
            <div key={topic} className="py-2 pr-3 text-sm truncate">
              {topic}
            </div>
            {grid.buckets.map((bucket) => {
              const cell = grid.cells.get(`${topic}|${bucket}`);
              return (
                <div
                  key={`${topic}|${bucket}`}
                  className="min-h-9 rounded-sm"
                  style={{ backgroundColor: cellBackground(cell) }}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
};