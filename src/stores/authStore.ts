import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { User } from '../types/models';
import { ApiError } from '../types/api';

export interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: ApiError | null;
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: ApiError | null) => void;
  reset: () => void;
}

const initialState = {
  session: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,
  setSession: (session) => set((state) => ({ 
    session, 
    isAuthenticated: session !== null && state.user !== null 
  })),
  setUser: (user) => set((state) => ({ 
    user, 
    isAuthenticated: state.session !== null && user !== null 
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
