import { apiClient } from './client';

import type { ContestResult } from '@/types/models';

export const contestService = {
  getContests: async (limit?: number) => {
    const res = await apiClient.get<{ success: boolean; data: ContestResult[] }>('/api/contests', {
      params: limit ? { limit } : undefined,
    });
    return res.data.data;
  },
};