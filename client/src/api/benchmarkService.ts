import { apiClient } from './client';
import type { BenchmarkMeta } from '@/types/models';

export const benchmarkService = {
  getBenchmarkMeta: async (): Promise<BenchmarkMeta> => {
    const res = await apiClient.get('/api/benchmark');
    return res.data.data;
  },
};