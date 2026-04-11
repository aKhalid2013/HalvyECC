import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import HomeScreen from '../../../../app/(app)/index'
import { signOut } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

// Mock dependencies
jest.mock('@/api/auth', () => ({
  signOut: jest.fn(),
}))

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}))

// Mock Alert.alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {})

describe('HomeScreen', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@halvy.com',
    displayName: 'Test User',
    avatarUrl: null,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useAuthStore as unknown as jest.Mock).mockReturnValue({
      user: mockUser,
    })
  })

  it('renders user information correctly', () => {
    const { getByText } = render(<HomeScreen />)
    
    expect(getByText('Welcome, Test User')).toBeTruthy()
    expect(getByText('test@halvy.com')).toBeTruthy()
    expect(getByText('Sign Out')).toBeTruthy()
  })

  it('calls signOut when Sign Out button is pressed', async () => {
    ;(signOut as jest.Mock).mockResolvedValue({ data: null, error: null })
    const { getByText } = render(<HomeScreen />)
    
    fireEvent.press(getByText('Sign Out'))
    
    expect(signOut).toHaveBeenCalled()
  })

  it('shows alert error when signOut fails', async () => {
    const mockError = { code: 'AUTH_ERROR', message: 'Failed to sign out' }
    ;(signOut as jest.Mock).mockResolvedValue({ data: null, error: mockError })
    const { getByText } = render(<HomeScreen />)
    
    fireEvent.press(getByText('Sign Out'))
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', mockError.message)
    })
  })
})
