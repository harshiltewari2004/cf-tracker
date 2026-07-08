import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { planService } from '@/api/planService';

import type { DailyPlan } from '@/types/models';


export const useDailyPlan = () =>
  useQuery({ queryKey: ['plan', 'today'], queryFn: planService.getTodaysPlan });

export const useMarkSolved = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: planService.markSolved,

    onMutate: async (planProblemId: string) => {
      // Stop any in-flight refetch from overwriting the optimistic patch
      await queryClient.cancelQueries({ queryKey: ['plan', 'today'] });

      const previous = queryClient.getQueryData<DailyPlan>(['plan', 'today']);

      // Lever B: flip status ONLY. solvedAt and completed are server-owned —
      // the onSettled invalidate reconciles them (05 §3.2, 03 §7).
      queryClient.setQueryData<DailyPlan>(['plan', 'today'], (old) =>
        old
          ? {
              ...old,
              problems: old.problems.map((p) =>
                p._id === planProblemId ? { ...p, status: 'solved' } : p
              ),
            }
          : old
      );

      return { previous };
    },

    onError: (_err, _planProblemId, context) => {
      // Rollback: restore the snapshot taken in onMutate
      if (context?.previous) {
        queryClient.setQueryData(['plan', 'today'], context.previous);
      }
      toast.error('Failed to mark solved. Please try again.');
    },

    onSettled: () => {
      // Lever C: refetch through the populated read path regardless of outcome
      queryClient.invalidateQueries({ queryKey: ['plan', 'today'] });
    },
  });
};

export const useReplaceProblem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: planService.replaceProblem,
    // No onMutate: the client cannot know the replacement problem in advance,
    // and the response is unpopulated — invalidate-and-refetch is the only
    // correct lever (D-P8-1). Dialog shows isPending meanwhile.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', 'today'] });
    },
  });
};