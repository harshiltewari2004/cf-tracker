import { useQuery } from '@tanstack/react-query';

import { planService } from '@/api/planService';

export const useDailyPlan = () =>
  useQuery({ queryKey: ['plan', 'today'], queryFn: planService.getTodaysPlan });