import type { Session } from '@supabase/supabase-js'
import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from './client'
import type { ApiResult } from './types'

WebBrowser.maybeCompleteAuthSession()

export type AuthProvider = 'google' | 'apple' | 'magic_link'
export type Unsubscribe = () => void

/**
 * Initiates sign-in process for the given provider.
 * For Google: uses OAuth with Expo redirect.
 * For Magic Link: sends OTP via email.
 * For Apple: currently returns an 'unavailable' error.
 */
export async function signIn(provider: AuthProvider, email?: string): Promise<ApiResult<Session | null>> {
  try {
    if (provider === 'apple') {
      return { data: null, error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Apple sign-in coming soon' } }
    }

    if (provider === 'magic_link') {
      const { error } = await supabase.auth.signInWithOtp({ email: email! })
      if (error) return { data: null, error: { code: 'AUTH_ERROR', message: error.message } }
      return { data: null, error: null }
    }

    // Google OAuth
    const redirectTo = makeRedirectUri()
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: 'google', 
      options: { redirectTo } 
    })
    
    if (error) return { data: null, error: { code: 'AUTH_ERROR', message: error.message } }
    return { data: null, error: null }
  } catch (err: unknown) {
    return { data: null, error: { code: 'AUTH_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }
  }
}

/**
 * Signs out the current user session.
 */
export async function signOut(): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) return { data: null, error: { code: 'AUTH_ERROR', message: error.message } }
    return { data: null, error: null }
  } catch (err: unknown) {
    return { data: null, error: { code: 'AUTH_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }
  }
}

/**
 * Signs out the current user session from all devices.
 */
export async function signOutAllDevices(): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) return { data: null, error: { code: 'AUTH_ERROR', message: error.message } }
    return { data: null, error: null }
  } catch (err: unknown) {
    return { data: null, error: { code: 'AUTH_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }
  }
}

/**
 * Gets the current active session.
 */
export async function getSession(): Promise<ApiResult<Session | null>> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) return { data: null, error: { code: 'AUTH_ERROR', message: error.message } }
    return { data: session, error: null }
  } catch (err: unknown) {
    return { data: null, error: { code: 'AUTH_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }
  }
}

/**
 * Subscribes to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback: (session: Session | null) => void): Unsubscribe {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })

  return () => {
    subscription.unsubscribe()
  }
}
