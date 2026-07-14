import { apiClient } from './client';

export const userService = {
  updateHandle: async (handle: string) => {
    const res = await apiClient.patch<{ success: boolean }>('/api/user/handle', { handle });
    return res.data;
  },
};