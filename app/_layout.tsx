import { Redirect, Stack, useSegments } from 'expo-router';
import { AuthProvider } from '../src/providers/AuthProvider';
import { QueryProvider } from '../src/providers/QueryProvider';
import { useAuthStore } from '../src/stores/authStore';
import '../global.css';

function AuthGate() {
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const segments = useSegments();

  if (isLoading) {
    return null;
  }

  const inAuthGroup = segments[0] === '(auth)';

  if (!isAuthenticated && !inAuthGroup) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (isAuthenticated && inAuthGroup) {
    return <Redirect href="/(app)/groups" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </QueryProvider>
  );
}
