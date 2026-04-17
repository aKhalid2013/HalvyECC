import React from 'react';
import { render } from '@testing-library/react-native';
import { useSegments, Redirect, Stack } from 'expo-router';
import RootLayout from '../_layout';
import { useAuthStore } from '../../src/stores/authStore';

jest.mock('expo-router', () => ({
  Stack: Object.assign(
    jest.fn(({ children }) => <>{children}</>),
    { Screen: jest.fn(() => null) }
  ),
  Redirect: jest.fn(() => null),
  useSegments: jest.fn(),
}));

jest.mock('../../src/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../../src/providers/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../src/providers/QueryProvider', () => ({
  QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('RootLayout Auth Gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupStoreMock = (isLoading: boolean, isAuthenticated: boolean) => {
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        isLoading,
        isAuthenticated,
      };
      return selector ? selector(state) : state;
    });
  };

  it('renders null when isLoading is true', () => {
    setupStoreMock(true, false);
    (useSegments as jest.Mock).mockReturnValue([]);

    const { toJSON } = render(<RootLayout />);
    expect(toJSON()).toBeNull();
  });

  it('redirects to sign-in when not authenticated and not in auth group', () => {
    setupStoreMock(false, false);
    (useSegments as jest.Mock).mockReturnValue(['(app)']);

    render(<RootLayout />);
    expect(Redirect).toHaveBeenCalled();
    const props = (Redirect as jest.Mock).mock.calls[0][0];
    expect(props.href).toBe('/(auth)/sign-in');
  });

  it('does NOT redirect when not authenticated but ALREADY in auth group', () => {
    setupStoreMock(false, false);
    (useSegments as jest.Mock).mockReturnValue(['(auth)']);

    render(<RootLayout />);
    expect(Redirect).not.toHaveBeenCalled();
    expect(Stack).toHaveBeenCalled();
  });

  it('renders Stack when authenticated', () => {
    setupStoreMock(false, true);
    (useSegments as jest.Mock).mockReturnValue(['(app)']);

    render(<RootLayout />);
    expect(Stack).toHaveBeenCalled();
    expect(Redirect).not.toHaveBeenCalled();
  });

  it('redirects to groups when authenticated but in auth group', () => {
    setupStoreMock(false, true);
    (useSegments as jest.Mock).mockReturnValue(['(auth)']);

    render(<RootLayout />);
    expect(Redirect).toHaveBeenCalled();
    const props = (Redirect as jest.Mock).mock.calls[0][0];
    expect(props.href).toBe('/(app)/groups');
  });
});
