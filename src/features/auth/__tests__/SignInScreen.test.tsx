import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { router } from 'expo-router'
import SignInScreen from '../../../../app/(auth)/sign-in'
import { signIn } from '@/api/auth'

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}))

jest.mock('@/api/auth', () => ({
  signIn: jest.fn(),
}))

// Mock Alert.alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {})

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders all UI elements correctly', () => {
    const { getByText } = render(<SignInScreen />)
    
    expect(getByText('Halvy')).toBeTruthy()
    expect(getByText('Split expenses, not friendships')).toBeTruthy()
    expect(getByText('Continue with Google')).toBeTruthy()
    expect(getByText('Continue with Apple')).toBeTruthy()
    expect(getByText('Sign in with Magic Link')).toBeTruthy()
    expect(getByText(/By continuing, you agree to our Terms of Service/)).toBeTruthy()
  })

  it('calls signIn google when Google button is pressed', async () => {
    ;(signIn as jest.Mock).mockResolvedValue({ data: null, error: null })
    const { getByText } = render(<SignInScreen />)
    
    fireEvent.press(getByText('Continue with Google'))
    
    expect(signIn).toHaveBeenCalledWith('google')
  })

  it('shows alert error when Google signIn fails', async () => {
    const mockError = { code: 'AUTH_ERROR', message: 'Failed to connect' }
    ;(signIn as jest.Mock).mockResolvedValue({ data: null, error: mockError })
    const { getByText } = render(<SignInScreen />)
    
    fireEvent.press(getByText('Continue with Google'))
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Sign-in Error', mockError.message)
    })
  })

  it('shows "coming soon" alert for Apple button', () => {
    const { getByText } = render(<SignInScreen />)
    
    fireEvent.press(getByText('Continue with Apple'))
    
    expect(Alert.alert).toHaveBeenCalledWith(
      expect.stringContaining('soon'),
      expect.any(String)
    )
    expect(signIn).not.toHaveBeenCalledWith('apple')
  })

  it('navigates to magic-link screen when Magic Link button is pressed', () => {
    const { getByText } = render(<SignInScreen />)
    
    fireEvent.press(getByText('Sign in with Magic Link'))
    
    expect(router.push).toHaveBeenCalledWith('/(auth)/magic-link')
  })
})
