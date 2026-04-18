import { toCamel } from '../../utils/transforms';
import { supabase } from '../client';
import { deleteUser, getCurrentUser, getUser, reactivateUser, updateUser } from '../users';

const mockSingle = jest.fn();
const mockSelectAfterEq = jest.fn(() => ({ single: mockSingle }));
const mockEq = jest.fn(() => ({ single: mockSingle, select: mockSelectAfterEq }));
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));

jest.mock('../client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  },
}));

jest.mock('../../utils/transforms', () => ({
  toCamel: jest.fn((data) => ({ ...data, camelized: true })),
}));

describe('Users API module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('returns active user with camelCase fields', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: { id: 'user-1', deleted_at: null },
        error: null,
      });

      const result = await getCurrentUser();

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
      expect(toCamel).toHaveBeenCalledWith({ id: 'user-1', deleted_at: null });
      expect(result.data).toEqual({ id: 'user-1', deleted_at: null, camelized: true });
      expect(result.error).toBeNull();
    });

    it('returns USER_DEACTIVATED if deleted_at is non-null', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'user-2' } },
        error: null,
      });
      mockSingle.mockResolvedValue({
        data: { id: 'user-2', deleted_at: '2026-01-01T00:00:00Z' },
        error: null,
      });

      const result = await getCurrentUser();

      expect(result.data).toBeNull();
      expect(result.error).toEqual({
        code: 'USER_DEACTIVATED',
        message: 'User account is deactivated',
      });
      expect(toCamel).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('issues UPDATE with deleted_at, not .delete()', async () => {
      (mockEq as jest.Mock).mockResolvedValueOnce({ error: null });

      const result = await deleteUser('user-3');

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(String),
        })
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'user-3');
      expect(result.error).toBeNull();
    });
  });

  describe('reactivateUser', () => {
    it('issues UPDATE with deleted_at: null', async () => {
      mockSingle.mockResolvedValue({
        data: { id: 'user-4', deleted_at: null },
        error: null,
      });

      const result = await reactivateUser('user-4');

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockUpdate).toHaveBeenCalledWith({ deleted_at: null });
      expect(mockEq).toHaveBeenCalledWith('id', 'user-4');
      expect(mockSelectAfterEq).toHaveBeenCalled();
      expect(result.data).toEqual({ id: 'user-4', deleted_at: null, camelized: true });
      expect(result.error).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('issues UPDATE with snake_case keys', async () => {
      mockSingle.mockResolvedValue({
        data: { id: 'user-5', display_name: 'X' },
        error: null,
      });

      const result = await updateUser('user-5', { displayName: 'X', avatarUrl: 'http://img' });

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockUpdate).toHaveBeenCalledWith({
        display_name: 'X',
        avatar_url: 'http://img',
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'user-5');
      expect(mockSelectAfterEq).toHaveBeenCalled();
      expect(result.data).toEqual({ id: 'user-5', display_name: 'X', camelized: true });
    });
  });

  describe('getUser', () => {
    it('returns user with camelCase fields', async () => {
      mockSingle.mockResolvedValue({
        data: { id: 'user-6' },
        error: null,
      });

      const result = await getUser('user-6');

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('id', 'user-6');
      expect(result.data).toEqual({ id: 'user-6', camelized: true });
    });
  });
});
