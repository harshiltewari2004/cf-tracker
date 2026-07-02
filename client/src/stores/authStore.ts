import {create} from 'zustand';

import type {User} from '@/types/models';

type AuthStatus = 'resolving'|'authenticated'|'unauthenticated';

interface AuthState {
    user: User|null;
    status:AuthStatus;
    setUser:(user:User)=>void;
    clearAuth:()=>void;
}

export const useAuthStore = create<AuthState>((set)=>({
    user:null,
    status:'resolving',
    setUser:(user)=>set({user,status:'authenticated'}),
    clearAuth:()=>set({user:null,status:'unauthenticated'}),
}));