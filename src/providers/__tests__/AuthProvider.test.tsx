import React from 'react'
import { render, act } from '@testing-library/react-native'
import { Text } from 'react-native'
import * as Linking from 'expo-linking'
import AuthProvider from '../AuthProvider'
import { onAuthStateChange } from '@/api/auth'
import { getCurrentUser } from '@/api/users'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/api/client'

// Mock dependencies
jest.mock('@/api/auth', () => ({
  onAuthStateChange: jest.fn(),
}))

jest.mock('@/api/users', () => ({
  getCurrentUser: jest.fn(),
}))

jest.mock('@/api/client', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
    },
  },
}))

jest.mock('expo-linking', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
}))

// Mock session and user data
const mockSession = { access_token: 'abc', user: { id: 'user-1' } } as any
const mockUser = { id: 'user-1', email: 'test@halvy.com', displayName: 'Test User' } as any

describe('AuthProvider', () => {
  let mockUnsubscribe: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockUnsubscribe = jest.fn()
    ;(onAuthStateChange as jest.Mock).mockReturnValue(mockUnsubscribe)
    useAuthStore.getState().reset()
    useAuthStore.setState({ isLoading: true })
  })

  it('subscribes to onAuthStateChange on mount and unsubscribes on unmount', () => {
    const { unmount } = render(
      <AuthProvider>
        <Text>Child</Text>
      </AuthProvider>
    )

    expect(onAuthStateChange).toHaveBeenCalledTimes(1)
    
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('renders null while isLoading is true', () => {
    const { queryByText } = render(
      <AuthProvider>
        <Text>Child</Text>
      </AuthProvider>
    )

    expect(queryByText('Child')).toBeNull()
  })

  it('populates store and renders children when session exists', async () => {
    ;(getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser, error: null })
    
    let authCallback: (session: any) => void
    ;(onAuthStateChange as jest.Mock).mockImplementation((cb) => {
      authCallback = cb
      return mockUnsubscribe
    })

    const { queryByText, findByText } = render(
      <AuthProvider>
        <Text>Child Content</Text>
      </AuthProvider>
    )

    // Initially loading
    expect(queryByText('Child Content')).toBeNull()

    // Trigger auth change
    await act(async () => {
      authCallback!(mockSession)
    })

    expect(useAuthStore.getState().session).toEqual(mockSession)
    expect(useAuthStore.getState().user).toEqual(mockUser)
    expect(useAuthStore.getState().isLoading).toBe(false)
    
    expect(await findByText('Child Content')).toBeTruthy()
  })

  it('resets store when session is null', async () => {
    let authCallback: (session: any) => void
    ;(onAuthStateChange as jest.Mock).mockImplementation((cb) => {
      authCallback = cb
      return mockUnsubscribe
    })

    // Pre-populate store
    act(() => {
      useAuthStore.getState().setSession(mockSession)
      useAuthStore.getState().setUser(mockUser)
    })

    render(
      <AuthProvider>
        <Text>Child</Text>
      </AuthProvider>
    )

    await act(async () => {
      authCallback!(null)
    })

    expect(useAuthStore.getState().session).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('calls setSession when a magic link deep link is received', async () => {
    const url = 'exp://192.168.100.33:8081#access_token=tok123&refresh_token=ref456&token_type=bearer'
    ;(Linking.getInitialURL as jest.Mock).mockResolvedValue(url)
    // Have onAuthStateChange immediately resolve loading so the component renders
    ;(onAuthStateChange as jest.Mock).mockImplementation((cb: (s: null) => void) => {
      cb(null)
      return mockUnsubscribe
    })

    render(
      <AuthProvider>
        <Text>Child</Text>
      </AuthProvider>
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'tok123',
      refresh_token: 'ref456',
    })
  })

  it('sets error when getCurrentUser fails', async () => {
    const mockError = { code: 'USER_DEACTIVATED', message: 'Account is deactivated' }
    ;(getCurrentUser as jest.Mock).mockResolvedValue({ data: null, error: mockError })
    
    let authCallback: (session: any) => void
    ;(onAuthStateChange as jest.Mock).mockImplementation((cb) => {
      authCallback = cb
      return mockUnsubscribe
    })

    render(
      <AuthProvider>
        <Text>Child</Text>
      </AuthProvider>
    )

    await act(async () => {
      authCallback!(mockSession)
    })

    expect(useAuthStore.getState().session).toEqual(mockSession)
    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().error).toEqual(mockError)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})
