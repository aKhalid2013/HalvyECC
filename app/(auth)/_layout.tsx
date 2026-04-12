import { Stack, Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()

  // Redirect to app as soon as authentication is confirmed.
  // This fires reactively when isAuthenticated changes mid-session
  // (e.g. after OTP verification on the magic-link screen).
  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(app)" />
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  )
}
