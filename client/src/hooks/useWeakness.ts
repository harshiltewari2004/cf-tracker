import { useQuery } from '@tanstack/react-query';

import { gapService } from '@/api/gapService';

export const useWeakness = () =>
  useQuery({ queryKey: ['weakness'], queryFn: gapService.getWeakness });

export const useLedger = () =>
  useQuery({
    queryKey: ['weakness', 'ledger'],
    queryFn: gapService.getLedger,
  });