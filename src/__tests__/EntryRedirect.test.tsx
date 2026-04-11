import React from 'react'
import { render } from '@testing-library/react-native'
import Index from '../../app/index'
import { useAuthStore } from '@/stores/authStore'
import { Redirect } from 'expo-router'

// Mock expo-router
jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
}))

// Mock auth store
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}))

describe('Index Entry Point', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders null while auth is loading', () => {
    ;(useAuthStore as unknown as jest.Mock).mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    })

    const { toJSON } = render(<Index />)
    expect(toJSON()).toBeNull()
  })

  it('redirects to /(app) when authenticated', () => {
    ;(useAuthStore as unknown as jest.Mock).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    })

    render(<Index />)
    expect(Redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(app)' }),
      undefined
    )
  })

  it('redirects to /(auth)/sign-in when not authenticated', () => {
    ;(useAuthStore as unknown as jest.Mock).mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
    })

    render(<Index />)
    expect(Redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/(auth)/sign-in' }),
      undefined
    )
  })
})
