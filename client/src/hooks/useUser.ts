import { useMutation, useQueryClient } from '@tanstack/react-query';

import { userService } from '@/api/userService';
import { useIngestStore } from '@/stores/ingestStore';

export const useUpdateHandle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userService.updateHandle,
    onSuccess: () => {
      useIngestStore.getState().setIngestActive(true);
      queryClient.invalidateQueries();
    },
  });
};