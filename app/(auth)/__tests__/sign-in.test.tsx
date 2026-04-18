import { fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { signIn } from '../../../src/api/auth';
import SignInScreen from '../sign-in';

jest.mock('../../../src/api/auth', () => ({
  signIn: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

describe('SignInScreen', () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it('renders correctly', () => {
    const { getByText } = render(<SignInScreen />);
    expect(getByText('Halvy')).toBeTruthy();
    expect(getByText('Continue with Google')).toBeTruthy();
    expect(getByText('Continue with Apple')).toBeTruthy();
    expect(getByText('Sign in with Magic Link')).toBeTruthy();
  });

  it('Apple button is disabled', () => {
    const { getByText } = render(<SignInScreen />);
    expect(getByText('(Coming soon)')).toBeTruthy();
  });

  it('navigates to magic link screen', () => {
    const { getByText } = render(<SignInScreen />);
    fireEvent.press(getByText('Sign in with Magic Link'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/magic-link');
  });

  it('calls signIn google on press', async () => {
    (signIn as jest.Mock).mockResolvedValue({ data: {}, error: null });
    const { getByText } = render(<SignInScreen />);
    fireEvent.press(getByText('Continue with Google'));
    expect(signIn).toHaveBeenCalledWith('google');
  });

  it('shows Alert on signIn error', async () => {
    const spy = jest.spyOn(Alert, 'alert');
    (signIn as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'OAuth failed' },
    });
    const { getByText } = render(<SignInScreen />);
    await fireEvent.press(getByText('Continue with Google'));
    expect(spy).toHaveBeenCalledWith('Error', 'OAuth failed');
  });
});
