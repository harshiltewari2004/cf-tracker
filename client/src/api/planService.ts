import { apiClient } from './client';

import type { DailyPlan } from '@/types/models';

export const planService = {
  getTodaysPlan: async () => {
    const res = await apiClient.get<{ success: boolean; data: DailyPlan }>('/api/plan/today');
    return res.data.data;
  },
};