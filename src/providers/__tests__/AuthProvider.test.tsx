import type { Session } from '@supabase/supabase-js';
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { onAuthStateChange } from '../../api/auth';
import { getCurrentUser } from '../../api/users';
import { useAuthStore } from '../../stores/authStore';
import { AuthProvider } from '../AuthProvider';

jest.mock('../../api/auth', () => ({
  onAuthStateChange: jest.fn(),
}));

jest.mock('../../api/users', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

describe('AuthProvider', () => {
  const mockSetSession = jest.fn();
  const mockSetUser = jest.fn();
  const mockSetLoading = jest.fn();
  const mockSetError = jest.fn();
  const mockReset = jest.fn();
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupStoreMock = (isLoading: boolean) => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        isLoading,
        setSession: mockSetSession,
        setUser: mockSetUser,
        setLoading: mockSetLoading,
        setError: mockSetError,
        reset: mockReset,
      };
      return selector ? selector(state) : state;
    });
  };

  it('session received -> setSession, setUser, setLoading(false) called', async () => {
    setupStoreMock(false);
    (getCurrentUser as jest.Mock).mockResolvedValue({ data: { id: 'u1' }, error: null });

    let callback: (session: Session | null) => Promise<void>;
    (onAuthStateChange as jest.Mock).mockImplementation((cb) => {
      callback = cb;
      return mockUnsubscribe;
    });

    const callOrder: string[] = [];
    mockSetSession.mockImplementation(() => callOrder.push('setSession'));
    mockSetUser.mockImplementation(() => callOrder.push('setUser'));
    mockSetLoading.mockImplementation(() => callOrder.push('setLoading'));

    render(
      <AuthProvider>
        <Text>child</Text>
      </AuthProvider>
    );

    await act(async () => {
      await callback({ access_token: '123' } as unknown as Session);
    });

    expect(getCurrentUser).toHaveBeenCalled();
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: '123' });
    expect(mockSetUser).toHaveBeenCalledWith({ id: 'u1' });
    expect(mockSetLoading).toHaveBeenCalledWith(false);
    expect(callOrder).toEqual(['setSession', 'setUser', 'setLoading']);
  });

  it('USER_DEACTIVATED -> setError called, setUser not called', async () => {
    setupStoreMock(false);
    (getCurrentUser as jest.Mock).mockResolvedValue({
      data: null,
      error: { code: 'USER_DEACTIVATED' },
    });

    let callback: (session: Session | null) => Promise<void>;
    (onAuthStateChange as jest.Mock).mockImplementation((cb) => {
      callback = cb;
      return mockUnsubscribe;
    });

    render(
      <AuthProvider>
        <Text>child</Text>
      </AuthProvider>
    );

    await act(async () => {
      await callback({ access_token: '123' } as unknown as Session);
    });

    expect(mockSetError).toHaveBeenCalledWith({ code: 'USER_DEACTIVATED' });
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockSetLoading).toHaveBeenCalledWith(false);
  });

  it('session null -> reset() called then setLoading(false)', async () => {
    setupStoreMock(false);
    let callback: (session: Session | null) => Promise<void>;
    (onAuthStateChange as jest.Mock).mockImplementation((cb) => {
      callback = cb;
      return mockUnsubscribe;
    });

    const callOrder: string[] = [];
    mockReset.mockImplementation(() => callOrder.push('reset'));
    mockSetLoading.mockImplementation(() => callOrder.push('setLoading'));

    render(
      <AuthProvider>
        <Text>child</Text>
      </AuthProvider>
    );

    await act(async () => {
      await callback(null);
    });

    expect(mockReset).toHaveBeenCalled();
    expect(mockSetLoading).toHaveBeenCalledWith(false);
    expect(callOrder).toEqual(['reset', 'setLoading']);
  });

  it('isLoading: true -> children not rendered', () => {
    setupStoreMock(true);
    (onAuthStateChange as jest.Mock).mockReturnValue(mockUnsubscribe);

    const { queryByText } = render(
      <AuthProvider>
        <Text>child</Text>
      </AuthProvider>
    );
    expect(queryByText('child')).toBeNull();
  });

  it('isLoading: false -> children rendered', () => {
    setupStoreMock(false);
    (onAuthStateChange as jest.Mock).mockReturnValue(mockUnsubscribe);

    const { queryByText } = render(
      <AuthProvider>
        <Text>child</Text>
      </AuthProvider>
    );
    expect(queryByText('child')).not.toBeNull();
  });

  it('unmount -> unsubscribe called', () => {
    setupStoreMock(false);
    (onAuthStateChange as jest.Mock).mockReturnValue(mockUnsubscribe);

    const { unmount } = render(
      <AuthProvider>
        <Text>child</Text>
      </AuthProvider>
    );
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
