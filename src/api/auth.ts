import type { Session } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import type { ApiResult, Unsubscribe } from '../types/api';
import { supabase } from './client';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

export async function signIn(
  provider: 'google' | 'apple' | 'magic_link',
  email?: string
): Promise<ApiResult<Session>> {
  try {
    if (provider === 'apple') {
      return {
        data: null,
        error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Apple sign-in coming soon' },
      };
    }

    if (provider === 'google') {
      const redirectTo = Platform.OS !== 'web' ? makeRedirectUri({ scheme: 'halvy' }) : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) throw error;
      return { data: null, error: null };
    }

    if (provider === 'magic_link') {
      const { error } = await supabase.auth.signInWithOtp({ email: email ?? '' });
      if (error) throw error;
      return { data: null, error: null };
    }

    return { data: null, error: { code: 'UNKNOWN_PROVIDER', message: 'Unknown provider' } };
  } catch (err: unknown) {
    return { data: null, error: { code: 'UNKNOWN', message: errorMessage(err) } };
  }
}

export async function signOut(): Promise<ApiResult<void>> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { data: null, error: null };
  } catch (err: unknown) {
    return { data: null, error: { code: 'UNKNOWN', message: errorMessage(err) } };
  }
}

export async function signOutAllDevices(): Promise<ApiResult<void>> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) throw error;
    return { data: null, error: null };
  } catch (err: unknown) {
    return { data: null, error: { code: 'UNKNOWN', message: errorMessage(err) } };
  }
}

export async function getSession(): Promise<ApiResult<Session | null>> {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    return { data: session, error: null };
  } catch (err: unknown) {
    return { data: null, error: { code: 'UNKNOWN', message: errorMessage(err) } };
  }
}

export function onAuthStateChange(callback: (session: Session | null) => void): Unsubscribe {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_, session) => {
    callback(session);
  });
  return () => subscription.unsubscribe();
}
