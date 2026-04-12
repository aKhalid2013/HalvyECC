import { Slot, Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()

  // Redirect to sign-in if session is lost (logout, expiry, etc.)
  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />
  }

  return <Slot />
}
