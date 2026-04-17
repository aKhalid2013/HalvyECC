import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeScreen from '../index';
import { useAuthStore } from '../../../src/stores/authStore';
import { signOut } from '../../../src/api/auth';
import { useRouter } from 'expo-router';

jest.mock('../../../src/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../../../src/api/auth', () => ({
  signOut: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

describe('HomeScreen (Authenticated)', () => {
  const mockReplace = jest.fn();
  const mockReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        user: { displayName: 'John Doe', email: 'john@example.com' },
        reset: mockReset,
      };
      return selector(state);
    });
  });

  it('renders welcome message and user info', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Welcome, John Doe')).toBeTruthy();
    expect(getByText('john@example.com')).toBeTruthy();
  });

  it('calls signOut and resets store on Sign Out press', async () => {
    (signOut as jest.Mock).mockResolvedValue({ error: null });
    const { getByText } = render(<HomeScreen />);
    
    await fireEvent.press(getByText('Sign Out'));
    
    expect(signOut).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});
