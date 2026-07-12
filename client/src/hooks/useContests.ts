import { useQuery } from '@tanstack/react-query';

import { contestService } from '@/api/contestService';
import { DASHBOARD_RECENT_CONTESTS_LIMIT } from '@/lib/constants';

export const useRecentContests = () =>
  useQuery({
    queryKey: ['contests', 'recent'],
    queryFn: () => contestService.getContests(DASHBOARD_RECENT_CONTESTS_LIMIT),
  });

  export const useContests = () =>
  useQuery({
    queryKey: ['contests'],
    queryFn: () => contestService.getContests(),
  });

  export const useContestDetail = (cfContestId: number) =>
  useQuery({
    queryKey: ['contests', cfContestId],
    queryFn: () => contestService.getContestDetail(cfContestId),
    enabled: Number.isFinite(cfContestId), 
  });