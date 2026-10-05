import { apiClient } from './client';

import type { TopicBucketScore, WeaknessLedger } from '@/types/models';

export const gapService = {
  getWeakness: async () => {
    const res = await apiClient.get<{ success: boolean; data: TopicBucketScore[] }>('/api/weakness');
    return res.data.data;
  },
  getLedger: async () => {
    const res = await apiClient.get<{ success: boolean; data: WeaknessLedger }>('/api/weakness/ledger');
    return res.data.data;
  },
};