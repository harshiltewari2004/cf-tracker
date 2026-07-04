import {apiClient} from './client';

import type { User } from '@/types/models';

interface MeResponse{
    success:boolean;
    data:User;
}

export const authService = {
    me:async()=>{
        const res = await apiClient.get<MeResponse>('/api/auth/me');
        return res.data.data;
  },
    login: async (email: string, password: string) => {
    const res = await apiClient.post<MeResponse>('/api/auth/login', { email, password });
    return res.data.data;
  },
  signup: async (name: string, email: string, password: string) => {
    const res = await apiClient.post<MeResponse>('/api/auth/register', { name, email, password });
    return res.data.data;
  },
  logout: async () => {
    await apiClient.post('/api/auth/logout');
  },
};
