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
};

