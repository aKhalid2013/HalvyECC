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

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState,
  setSession: (session) => set({ session, isAuthenticated: session !== null && get().user !== null }),
  setUser: (user) => set({ user, isAuthenticated: get().session !== null && user !== null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
