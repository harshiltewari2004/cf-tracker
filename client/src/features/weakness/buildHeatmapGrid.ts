import { BUCKET_ORDER } from '@/lib/constants';
import type { TopicBucketScore } from '@/types/models';

export interface HeatmapGrid {
  topics: string[];                          
  buckets: string[];                         
  cells: Map<string, TopicBucketScore>;      
}

export const buildHeatmapGrid = (scores: TopicBucketScore[]): HeatmapGrid => {
  
  const signal = scores.filter((s) => s.targetCount > 0);

  const cells = new Map<string, TopicBucketScore>();
  const maxGapByTopic = new Map<string, number>();
  const survivingBuckets = new Set<string>();

  for (const s of signal) {
    cells.set(`${s.topic}|${s.bucket}`, s);
    survivingBuckets.add(s.bucket);
    const prev = maxGapByTopic.get(s.topic) ?? 0;
    maxGapByTopic.set(s.topic, Math.max(prev, s.finalGap));
  }

  
  const topics = [...maxGapByTopic.keys()].sort(
    (a, b) => (maxGapByTopic.get(b) ?? 0) - (maxGapByTopic.get(a) ?? 0)
  );

  const buckets = BUCKET_ORDER.filter((b) => survivingBuckets.has(b));

  return { topics, buckets, cells };
};