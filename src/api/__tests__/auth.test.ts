import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '../client'
import { signIn, signOut, signOutAllDevices, getSession, onAuthStateChange } from '../auth'

// Mocking dependencies
jest.mock('../client', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
      signInWithOtp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
  },
}))

jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'halvy://redirect'),
}))

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}))

describe('Auth API Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('signIn', () => {
    it('calls signInWithOAuth for Google', async () => {
      ;(supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({ error: null })

      const result = await signIn('google')

      expect(makeRedirectUri).toHaveBeenCalled()
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: 'halvy://redirect' },
      })
      expect(result).toEqual({ data: null, error: null })
    })

    it('calls signInWithOtp for magic_link', async () => {
      ;(supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null })

      const result = await signIn('magic_link', 'test@example.com')

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
      })
      expect(result).toEqual({ data: null, error: null })
    })

    it('returns error for Apple (not implemented)', async () => {
      const result = await signIn('apple')

      expect(result.error).toEqual({
        code: 'AUTH_PROVIDER_UNAVAILABLE',
        message: 'Apple sign-in coming soon',
      })
    })

    it('wraps Supabase errors', async () => {
      ;(supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({
        error: { message: 'Invalid email' },
      })

      const result = await signIn('magic_link', 'invalid')

      expect(result.error).toEqual({
        code: 'AUTH_ERROR',
        message: 'Invalid email',
      })
    })
  })

  describe('signOut', () => {
    it('calls supabase.auth.signOut', async () => {
      ;(supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null })

      const result = await signOut()

      expect(supabase.auth.signOut).toHaveBeenCalled()
      expect(result).toEqual({ data: null, error: null })
    })

    it('calls signOut globally for signOutAllDevices', async () => {
      ;(supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null })

      const result = await signOutAllDevices()

      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' })
      expect(result).toEqual({ data: null, error: null })
    })
  })

  describe('getSession', () => {
    it('calls supabase.auth.getSession', async () => {
      const mockSession = { user: { id: '123' } }
      ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const result = await getSession()

      expect(supabase.auth.getSession).toHaveBeenCalled()
      expect(result.data).toEqual(mockSession)
    })
  })

  describe('onAuthStateChange', () => {
    it('returns an unsubscribe function', () => {
      const mockUnsubscribe = jest.fn()
      ;(supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      })

      const callback = jest.fn()
      const unsubscribe = onAuthStateChange(callback)

      expect(supabase.auth.onAuthStateChange).toHaveBeenCalledWith(expect.any(Function))
      
      unsubscribe()
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })
})
