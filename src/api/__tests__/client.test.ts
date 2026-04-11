import { Platform } from 'react-native'
import { createClient } from '@supabase/supabase-js'

// Mocking dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))

jest.mock('@/constants/config', () => ({
  config: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
  },
}))

describe('Supabase Client Singleton', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  it('configures for native platforms correctly', () => {
    // Mocking Platform.OS for native (ios)
    Object.defineProperty(Platform, 'OS', {
      value: 'ios',
      configurable: true,
    })

    // Import the client after setting the mock
    require('../client')

    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          storage: expect.objectContaining({
            getItem: expect.any(Function),
            setItem: expect.any(Function),
            removeItem: expect.any(Function),
          }),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        }),
      })
    )
  })

  it('configures for web platform correctly', () => {
    // Mocking Platform.OS for web
    Object.defineProperty(Platform, 'OS', {
      value: 'web',
      configurable: true,
    })

    // Import the client after setting the mock
    require('../client')

    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          storage: undefined,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        }),
      })
    )
  })
})
