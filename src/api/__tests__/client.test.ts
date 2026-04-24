import { Platform } from 'react-native';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/constants/config', () => ({
  config: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
  },
}));

describe('Supabase Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('uses ExpoSecureStoreAdapter on ios', () => {
    Platform.OS = 'ios';
    require('../client');
    const { createClient } = require('@supabase/supabase-js');

    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          storage: expect.any(Object),
          detectSessionInUrl: false,
        }),
      })
    );

    const callArgs = (createClient as jest.Mock).mock.calls[0][2];
    const storage = callArgs.auth.storage;

    const SecureStoreMock = require('expo-secure-store');

    storage.getItem('test-key');
    expect(SecureStoreMock.getItemAsync).toHaveBeenCalledWith('test-key');

    storage.setItem('test-key', 'test-val');
    expect(SecureStoreMock.setItemAsync).toHaveBeenCalledWith('test-key', 'test-val');

    storage.removeItem('test-key');
    expect(SecureStoreMock.deleteItemAsync).toHaveBeenCalledWith('test-key');
  });

  it('uses ExpoSecureStoreAdapter on android', () => {
    Platform.OS = 'android';
    require('../client');
    const { createClient } = require('@supabase/supabase-js');

    const callArgs = (createClient as jest.Mock).mock.calls[0][2];
    expect(callArgs.auth.storage).toBeDefined();
    expect(callArgs.auth.detectSessionInUrl).toBe(false);
  });

  it('uses undefined storage on web', () => {
    Platform.OS = 'web';
    require('../client');
    const { createClient } = require('@supabase/supabase-js');

    const callArgs = (createClient as jest.Mock).mock.calls[0][2];
    expect(callArgs.auth.storage).toBeUndefined();
    expect(callArgs.auth.detectSessionInUrl).toBe(true);
  });
});
