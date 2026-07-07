import { apiClient } from './client';

import type { TopicBucketScore } from '@/types/models';

export const gapService = {
  getWeakness: async () => {
    const res = await apiClient.get<{ success: boolean; data: TopicBucketScore[] }>('/api/weakness');
    return res.data.data;
  },
};