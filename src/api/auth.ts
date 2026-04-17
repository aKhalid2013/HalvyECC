import { Session } from '@supabase/supabase-js';
import { ApiResult, Unsubscribe } from '../types/api';
import { supabase } from './client';

export async function signIn(provider: 'google' | 'apple' | 'magic_link', email?: string): Promise<ApiResult<Session>> {
  try {
    if (provider === 'apple') {
      return {
        data: null,
        error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Apple sign-in coming soon' },
      };
    }

    if (provider === 'google') {
      const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
      return { data: data as any, error: null };
    }

    if (provider === 'magic_link') {
      const { data, error } = await supabase.auth.signInWithOtp({ email: email! });
      if (error) throw error;
      return { data: data as any, error: null };
    }

    return { data: null, error: { code: 'UNKNOWN_PROVIDER', message: 'Unknown provider' } };
  } catch (err: any) {
    return { data: null, error: { code: 'UNKNOWN', message: err.message } };
  }
}

export async function signOut(): Promise<ApiResult<void>> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { data: null, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'UNKNOWN', message: err.message } };
  }
}

export async function signOutAllDevices(): Promise<ApiResult<void>> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw error;
    return { data: null, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'UNKNOWN', message: err.message } };
  }
}

export async function getSession(): Promise<ApiResult<Session | null>> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return { data: session, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'UNKNOWN', message: err.message } };
  }
}

export function onAuthStateChange(callback: (session: Session | null) => void): Unsubscribe {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}
