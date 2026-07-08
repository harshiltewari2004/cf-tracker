import { TopicBadge } from '@/components/shared/TopicBadge';
import type { TopicBucketScore } from '@/types/models';

interface TopicGapListProps {
  scores: TopicBucketScore[];
}

export const TopicGapList = ({ scores }: TopicGapListProps) => {
  const signal = scores
  .filter((s) => s.targetCount > 0)
  .sort(
    (a, b) =>
      b.finalGap - a.finalGap ||
      (b.targetCount - b.solves) - (a.targetCount - a.solves)
  );

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">Topic</th>
            <th className="px-3 py-2 font-medium">Bucket</th>
            <th className="px-3 py-2 font-medium text-right">Gap</th>
            <th className="px-3 py-2 font-medium text-right">Contest fails</th>
            <th className="px-3 py-2 font-medium text-right">Solves</th>
          </tr>
        </thead>
        <tbody>
          {signal.map((s) => (
            <tr key={`${s.topic}|${s.bucket}`} className="border-b last:border-0">
              <td className="px-3 py-2"><TopicBadge topic={s.topic} /></td>
              <td className="px-3 py-2">{s.bucket}</td>
              <td className="px-3 py-2 text-right font-medium">
                {Math.round(s.finalGap * 100)}%
              </td>
              <td className="px-3 py-2 text-right">
                {s.contestFails}/{s.contestOpportunities}
              </td>
              <td className="px-3 py-2 text-right">
                {s.solves}/{s.targetCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};