import React, { useEffect } from 'react'
import * as Linking from 'expo-linking'
import { supabase } from '@/api/client'
import { onAuthStateChange } from '@/api/auth'
import { getCurrentUser } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'

/**
 * AuthProvider handles initial authentication hydration and 
 * listens for auth state changes throughout the app lifecycle.
 * It blocks rendering of children until the initial auth state is resolved.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, setSession, setUser, setLoading, setError, reset } = useAuthStore()

  useEffect(() => {
    // Handle deep links that carry auth tokens from magic link email clicks.
    // Supabase redirects to the app with #access_token=...&refresh_token=... in the URL.
    const processAuthUrl = async (url: string) => {
      const hashIndex = url.indexOf('#')
      if (hashIndex === -1) return
      const params = new URLSearchParams(url.slice(hashIndex + 1))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }
    }

    // Cold start: app was opened by the deep link
    Linking.getInitialURL().then((url) => { if (url) processAuthUrl(url) })

    // Warm start: app was already running when the link was tapped
    const linkSub = Linking.addEventListener('url', ({ url }) => processAuthUrl(url))

    // Subscribe to auth state changes (Supabase fires this immediately on subscription)
    const unsubscribe = onAuthStateChange(async (session) => {
      if (session) {
        setSession(session)
        // Fetch public user profile when session exists
        const result = await getCurrentUser()
        if (result.data) {
          setUser(result.data)
        } else if (result.error) {
          setError(result.error)
        }
      } else {
        // No session exists or user signed out
        reset()
      }
      // Hydration is complete after the first auth state check
      setLoading(false)
    })

    return () => {
      linkSub.remove()
      unsubscribe()
    }
  }, [setSession, setUser, setLoading, setError, reset])

  // Block rendering until initial auth state is resolved
  if (isLoading) {
    return null
  }

  return <>{children}</>
}
