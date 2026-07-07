// useReliability.ts
import { useQuery } from '@tanstack/react-query';

import { reliabilityService } from '@/api/reliabilityService';

export const useReliability = () =>
  useQuery({ queryKey: ['reliability'], queryFn: reliabilityService.getReliability });