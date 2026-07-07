// reliabilityService.ts
import { apiClient } from './client';

import type { ReliabilityScore } from '@/types/models';

export const reliabilityService = {
  getReliability: async () => {
    const res = await apiClient.get<{ success: boolean; data: ReliabilityScore }>('/api/reliability');
    return res.data.data;
  },
};