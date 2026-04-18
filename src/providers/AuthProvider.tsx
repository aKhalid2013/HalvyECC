import type React from 'react';
import { useEffect } from 'react';
import { onAuthStateChange } from '../api/auth';
import { getCurrentUser } from '../api/users';
import { useAuthStore } from '../stores/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isLoading = useAuthStore((state) => state.isLoading);
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setError = useAuthStore((state) => state.setError);
  const reset = useAuthStore((state) => state.reset);

  useEffect(() => {
    const handleAuthChange = async (session: any) => {
      if (session !== null) {
        const { data: user, error } = await getCurrentUser();
        if (error) {
          setError(error);
          setLoading(false);
        } else {
          setSession(session);
          setUser(user);
          setLoading(false);
        }
      } else {
        reset();
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChange(handleAuthChange);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [setSession, setUser, setLoading, setError, reset]);

  if (isLoading) {
    return null;
  }

  return <>{children}</>;
}
