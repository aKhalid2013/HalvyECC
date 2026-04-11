import React, { useEffect } from 'react'
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
      unsubscribe()
    }
  }, [setSession, setUser, setLoading, setError, reset])

  // Block rendering until initial auth state is resolved
  if (isLoading) {
    return null
  }

  return <>{children}</>
}
