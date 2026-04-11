import { supabase } from '../client'
import { toCamel } from '@/utils/transforms'
import { getUser, getCurrentUser, updateUser, deleteUser, reactivateUser } from '../users'

// Mocking dependencies
jest.mock('../client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}))

jest.mock('@/utils/transforms', () => ({
  toCamel: jest.fn((obj) => obj), // Pass through by default for testing
}))

describe('Users API Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getUser', () => {
    it('fetches user and applies toCamel', async () => {
      const mockUser = { id: 'user-1', display_name: 'Test' }
      const fromSpy = supabase.from as jest.Mock
      fromSpy().select().eq().single.mockResolvedValue({ data: mockUser, error: null })

      const result = await getUser('user-1')

      expect(fromSpy).toHaveBeenCalledWith('users')
      expect(toCamel).toHaveBeenCalledWith(mockUser)
      expect(result.data).toEqual(mockUser)
    })
  })

  describe('getCurrentUser', () => {
    it('successfully fetches authenticated active user', async () => {
      const mockAuthUser = { id: 'user-1' }
      const mockPublicUser = { id: 'user-1', display_name: 'Test', deleted_at: null }
      
      ;(supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: mockAuthUser }, error: null })
      const fromSpy = supabase.from as jest.Mock
      fromSpy().select().eq().single.mockResolvedValue({ data: mockPublicUser, error: null })

      const result = await getCurrentUser()

      expect(supabase.auth.getUser).toHaveBeenCalled()
      expect(result.data).toEqual(mockPublicUser)
    })

    it('returns error when not authenticated', async () => {
      ;(supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null }, error: null })

      const result = await getCurrentUser()

      expect(result.error).toEqual({
        code: 'NOT_AUTHENTICATED',
        message: 'No active session found',
      })
    })

    it('returns error when user is deactivated', async () => {
      const mockAuthUser = { id: 'user-1' }
      const mockPublicUser = { id: 'user-1', deleted_at: '2026-04-11T12:00:00Z' }
      
      ;(supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: mockAuthUser }, error: null })
      const fromSpy = supabase.from as jest.Mock
      fromSpy().select().eq().single.mockResolvedValue({ data: mockPublicUser, error: null })

      const result = await getCurrentUser()

      expect(result.error).toEqual({
        code: 'USER_DEACTIVATED',
        message: 'Account is deactivated',
      })
    })
  })

  describe('updateUser', () => {
    it('converts payload to snake_case and updates', async () => {
      const fromSpy = supabase.from as jest.Mock
      fromSpy().update().eq().single.mockResolvedValue({ data: { id: 'u1' }, error: null })

      await updateUser('u1', { displayName: 'New Name', avatarUrl: 'new-url' })

      expect(fromSpy().update).toHaveBeenCalledWith({
        display_name: 'New Name',
        avatar_url: 'new-url',
      })
    })
  })

  describe('deleteUser', () => {
    it('performs soft delete by setting deleted_at', async () => {
      const fromSpy = supabase.from as jest.Mock
      fromSpy().update().eq().single.mockResolvedValue({ data: {}, error: null })

      await deleteUser('u1')

      expect(fromSpy().update).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
      })
    })
  })

  describe('reactivateUser', () => {
    it('clears deleted_at to reactivate', async () => {
      const fromSpy = supabase.from as jest.Mock
      fromSpy().update().eq().single.mockResolvedValue({ data: {}, error: null })

      await reactivateUser('u1')

      expect(fromSpy().update).toHaveBeenCalledWith({
        deleted_at: null,
      })
    })
  })
})
