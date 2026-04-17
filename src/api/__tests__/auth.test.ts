import { signIn, signOut, signOutAllDevices, getSession, onAuthStateChange } from '../auth';
import { supabase } from '../client';

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
}));

describe('Auth API module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signIn', () => {
    it('delegates google to signInWithOAuth', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockResolvedValue({ data: {}, error: null });
      await signIn('google');
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google' });
    });

    it('delegates magic_link to signInWithOtp', async () => {
      (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ data: {}, error: null });
      await signIn('magic_link', 'x@y.com');
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'x@y.com' });
    });

    it('returns AUTH_PROVIDER_UNAVAILABLE for apple without calling supabase', async () => {
      const result = await signIn('apple');
      expect(result).toEqual({
        data: null,
        error: { code: 'AUTH_PROVIDER_UNAVAILABLE', message: 'Apple sign-in coming soon' }
      });
      expect(supabase.auth.signInWithOAuth).not.toHaveBeenCalled();
      expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
    });

    it('handles supabase error', async () => {
      (supabase.auth.signInWithOAuth as jest.Mock).mockRejectedValue(new Error('Network error'));
      const result = await signIn('google');
      expect(result).toEqual({
        data: null,
        error: { code: 'UNKNOWN', message: 'Network error' }
      });
    });
  });

  describe('signOut', () => {
    it('calls supabase.auth.signOut with no args', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });
      await signOut();
      expect(supabase.auth.signOut).toHaveBeenCalledWith();
    });
  });

  describe('signOutAllDevices', () => {
    it('calls supabase.auth.signOut with scope: global', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });
      await signOutAllDevices();
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
    });
  });

  describe('getSession', () => {
    it('returns session', async () => {
      const mockSession = { access_token: '123' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: mockSession }, error: null });
      const result = await getSession();
      expect(result.data).toBe(mockSession);
    });
  });

  describe('onAuthStateChange', () => {
    it('subscribes and returns an unsubscribe function', () => {
      const mockUnsubscribe = jest.fn();
      (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      });
      const callback = jest.fn();
      const unsubscribe = onAuthStateChange(callback);
      
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
      
      const authChangeCallback = (supabase.auth.onAuthStateChange as jest.Mock).mock.calls[0][0];
      authChangeCallback('SIGNED_IN', { access_token: '123' });
      expect(callback).toHaveBeenCalledWith({ access_token: '123' });

      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
