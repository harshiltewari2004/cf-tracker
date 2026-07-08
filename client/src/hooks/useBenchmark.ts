import { useQuery } from '@tanstack/react-query';
import { benchmarkService } from '@/api/benchmarkService';
import { BENCHMARK_STALE_TIME_MS } from '@/lib/constants';

export const useBenchmark = () =>
  useQuery({
    queryKey: ['benchmark'],
    queryFn: benchmarkService.getBenchmarkMeta,
    staleTime: BENCHMARK_STALE_TIME_MS,
  });