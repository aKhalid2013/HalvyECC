import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import { AuthProvider } from '../src/providers/AuthProvider';
import { QueryProvider } from '../src/providers/QueryProvider';
import '../global.css';

export default function RootLayout() {
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const segments = useSegments();

  if (isLoading) {
    return null;
  }

  const inAuthGroup = segments[0] === '(auth)';

  if (!isAuthenticated && !inAuthGroup) {
    // Redirect unauthenticated users to sign-in
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (isAuthenticated && inAuthGroup) {
    // Redirect authenticated users away from auth screens
    return <Redirect href="/(app)/groups" />;
  }

  return (
    <QueryProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AuthProvider>
    </QueryProvider>
  );
}
