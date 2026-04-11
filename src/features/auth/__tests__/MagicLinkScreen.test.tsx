import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { router } from 'expo-router'
import { signIn } from '@/api/auth'
import MagicLinkScreen from '../../../../app/(auth)/magic-link'

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
  },
}))

jest.mock('@/api/auth', () => ({
  signIn: jest.fn(),
}))

describe('MagicLinkScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders input state initially', () => {
    const { getByPlaceholderText, getByText } = render(<MagicLinkScreen />)
    
    expect(getByPlaceholderText('you@example.com')).toBeTruthy()
    expect(getByText('Send Magic Link')).toBeTruthy()
  })

  it('disables send button for invalid email', () => {
    const { getByText, getByPlaceholderText } = render(<MagicLinkScreen />)
    const input = getByPlaceholderText('you@example.com')
    const button = getByText('Send Magic Link')

    fireEvent.changeText(input, 'invalid-email')
    expect(button.props.accessibilityState.disabled).toBe(true)

    fireEvent.changeText(input, 'valid@email.com')
    expect(button.props.accessibilityState.disabled).toBe(false)
  })

  it('transitions to confirmation state on success', async () => {
    ;(signIn as jest.Mock).mockResolvedValue({ data: null, error: null })
    const { getByText, getByPlaceholderText, queryByText } = render(<MagicLinkScreen />)
    
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@halvy.com')
    fireEvent.press(getByText('Send Magic Link'))

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('magic_link', 'test@halvy.com')
      expect(getByText('Check your email')).toBeTruthy()
      expect(getByText(/We sent a sign-in link to test@halvy.com/)).toBeTruthy()
    })
  })

  it('shows error message on failure', async () => {
    ;(signIn as jest.Mock).mockResolvedValue({ 
      data: null, 
      error: { code: 'OTP_ERROR', message: 'Failed to send' } 
    })
    const { getByText, getByPlaceholderText } = render(<MagicLinkScreen />)
    
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@halvy.com')
    fireEvent.press(getByText('Send Magic Link'))

    await waitFor(() => {
      expect(getByText('Failed to send link. Please try again.')).toBeTruthy()
    })
  })

  it('handles resend cooldown countdown', async () => {
    ;(signIn as jest.Mock).mockResolvedValue({ data: null, error: null })
    const { getByText, getByPlaceholderText } = render(<MagicLinkScreen />)
    
    fireEvent.changeText(getByPlaceholderText('you@example.com'), 'test@halvy.com')
    fireEvent.press(getByText('Send Magic Link'))

    await waitFor(() => {
      expect(getByText(/Resend in 60s/)).toBeTruthy()
    })

    // Wait 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000)
    })
    expect(getByText(/Resend in 50s/)).toBeTruthy()

    // Wait remaining 50 seconds
    act(() => {
      jest.advanceTimersByTime(50000)
    })
    expect(getByText('Resend')).toBeTruthy()
  })

  it('calls router.back when back buttons are pressed', () => {
    const { getByText } = render(<MagicLinkScreen />)
    
    fireEvent.press(getByText(/Back to sign-in/))
    expect(router.back).toHaveBeenCalled()
  })
})
