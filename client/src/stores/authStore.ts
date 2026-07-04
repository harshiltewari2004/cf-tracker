import {create} from 'zustand';

import type {User} from '@/types/models';

import { authService } from '@/api/authService';

type AuthStatus = 'resolving'|'authenticated'|'unauthenticated';

interface AuthState {
    user: User|null;
    status:AuthStatus;
    setUser:(user:User)=>void;
    clearAuth:()=>void;
    checkAuth: () => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set)=>({
    user:null,
    status:'resolving',
    setUser:(user)=>set({user,status:'authenticated'}),
    clearAuth:()=>set({user:null,status:'unauthenticated'}),
    checkAuth: async () => {
  try {
    const user = await authService.me();
    set({ status: 'authenticated', user });
  } catch {
    set({ status: 'unauthenticated', user: null });
  }
},
login: async (email, password) => {
    const user = await authService.login(email, password);
    set({ user, status: 'authenticated' });
  },
  signup: async (name, email, password) => {
    const user = await authService.signup(name, email, password);
    set({ user, status: 'authenticated' });
  },
  logout: async () => {
    try {
      await authService.logout();
    } finally {
      set({ user: null, status: 'unauthenticated' });
    }
  },
}));