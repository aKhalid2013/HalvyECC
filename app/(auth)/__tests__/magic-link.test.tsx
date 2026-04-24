import { act, fireEvent, render } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { signIn } from '../../../src/api/auth';
import MagicLinkScreen from '../magic-link';

jest.mock('../../../src/api/auth', () => ({
  signIn: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

describe('MagicLinkScreen', () => {
  const mockBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ back: mockBack });
  });

  it('renders input state initially', () => {
    const { getByPlaceholderText, getByText } = render(<MagicLinkScreen />);
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByText('Send Magic Link')).toBeTruthy();
  });

  it('Send button is disabled for invalid email', () => {
    const { getByTestId, getByPlaceholderText } = render(<MagicLinkScreen />);
    const sendButton = getByTestId('send-magic-link-btn');

    fireEvent.changeText(getByPlaceholderText('Email'), 'invalid-email');
    expect(sendButton.props.accessibilityState.disabled).toBe(true);
  });

  it('transitions to confirmation state on success', async () => {
    (signIn as jest.Mock).mockResolvedValue({ data: {}, error: null });
    const { getByPlaceholderText, getByText, queryByPlaceholderText } = render(<MagicLinkScreen />);

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    await act(async () => {
      fireEvent.press(getByText('Send Magic Link'));
    });

    expect(signIn).toHaveBeenCalledWith('magic_link', 'test@example.com');
    expect(getByText('Check your email')).toBeTruthy();
    expect(queryByPlaceholderText('Email')).toBeNull();
  });

  it('shows error message on failure', async () => {
    (signIn as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'Failed to send' },
    });
    const { getByPlaceholderText, getByText } = render(<MagicLinkScreen />);

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    await act(async () => {
      fireEvent.press(getByText('Send Magic Link'));
    });

    expect(getByText('Failed to send')).toBeTruthy();
  });

  it('navigates back on "Back to sign-in" press', () => {
    const { getByText } = render(<MagicLinkScreen />);
    fireEvent.press(getByText('Back to sign-in'));
    expect(mockBack).toHaveBeenCalled();
  });
});
