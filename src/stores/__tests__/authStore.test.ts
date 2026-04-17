import { act, renderHook } from '@testing-library/react-native';
import { useAuthStore } from '../authStore';
import { Session } from '@supabase/supabase-js';
import { User } from '../../types/models';

describe('Auth Zustand store', () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.session).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setSession + setUser -> isAuthenticated: true', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setSession({ access_token: 'token' } as Session);
      result.current.setUser({ id: 'user-1' } as User);
    });

    expect(result.current.session).not.toBeNull();
    expect(result.current.user).not.toBeNull();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('setSession alone (user null) -> isAuthenticated: false', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setSession({ access_token: 'token' } as Session);
    });

    expect(result.current.session).not.toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('setUser alone (session null) -> isAuthenticated: false', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setUser({ id: 'user-1' } as User);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.user).not.toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('setLoading(false) -> isLoading: false', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('setError({ code, message }) -> error set correctly', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setError({ code: 'X', message: 'Y' });
    });

    expect(result.current.error).toEqual({ code: 'X', message: 'Y' });
  });

  it('reset() -> all fields return to initial state; isLoading: true', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setSession({ access_token: 'token' } as Session);
      result.current.setUser({ id: 'user-1' } as User);
      result.current.setLoading(false);
      result.current.setError({ code: 'X', message: 'Y' });
    });

    // Verify it changed
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.reset();
    });

    // Verify reset
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('state updates are immutable (previous state object not mutated)', () => {
    const state1 = useAuthStore.getState();
    
    act(() => {
      state1.setLoading(false);
    });
    
    const state2 = useAuthStore.getState();
    expect(state1).not.toBe(state2);
    expect(state1.isLoading).toBe(true); // Should remain true in the old reference
    expect(state2.isLoading).toBe(false); // New reference updated
  });
});
