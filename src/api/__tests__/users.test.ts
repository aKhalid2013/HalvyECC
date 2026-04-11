import { supabase } from '../client'
import { toCamel } from '@/utils/transforms'
import { getUser, getCurrentUser, updateUser, deleteUser, reactivateUser } from '../users'

// Mocking dependencies
jest.mock('../client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}))

jest.mock('@/utils/transforms', () => ({
  toCamel: jest.fn((obj) => obj),
}))

// Get mock references
const mockFrom = supabase.from as jest.Mock
const mockSingle = jest.fn()
const mockEq = jest.fn(() => ({ single: mockSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockUpdate = jest.fn(() => ({ eq: mockEq }))

mockFrom.mockReturnValue({
  select: mockSelect,
  update: mockUpdate,
})

describe('Users API Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSingle.mockReset()
    mockEq.mockClear()
    mockSelect.mockClear()
    mockUpdate.mockClear()
    mockFrom.mockClear()
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
    })
  })

  describe('getUser', () => {
    it('fetches user and applies toCamel', async () => {
      const mockUser = { id: 'user-1', display_name: 'Test' }
      mockSingle.mockResolvedValue({ data: mockUser, error: null })

      const result = await getUser('user-1')

      expect(mockFrom).toHaveBeenCalledWith('users')
      expect(mockSelect).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
      expect(toCamel).toHaveBeenCalledWith(mockUser)
      expect(result.data).toEqual(mockUser)
    })
  })

  describe('getCurrentUser', () => {
    it('successfully fetches authenticated active user', async () => {
      const mockAuthUser = { id: 'user-1' }
      const mockPublicUser = { id: 'user-1', display_name: 'Test', deleted_at: null }
      
      ;(supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: mockAuthUser }, error: null })
      mockSingle.mockResolvedValue({ data: mockPublicUser, error: null })

      const result = await getCurrentUser()

      expect(supabase.auth.getUser).toHaveBeenCalled()
      expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
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
      mockSingle.mockResolvedValue({ data: mockPublicUser, error: null })

      const result = await getCurrentUser()

      expect(result.error).toEqual({
        code: 'USER_DEACTIVATED',
        message: 'Account is deactivated',
      })
    })
  })

  describe('updateUser', () => {
    it('converts payload to snake_case and updates', async () => {
      mockSingle.mockResolvedValue({ data: { id: 'u1' }, error: null })

      await updateUser('u1', { displayName: 'New Name', avatarUrl: 'new-url' })

      expect(mockUpdate).toHaveBeenCalledWith({
        display_name: 'New Name',
        avatar_url: 'new-url',
      })
      expect(mockEq).toHaveBeenCalledWith('id', 'u1')
    })
  })

  describe('deleteUser', () => {
    it('performs soft delete by setting deleted_at', async () => {
      mockSingle.mockResolvedValue({ data: {}, error: null })

      await deleteUser('u1')

      expect(mockUpdate).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
      })
      expect(mockEq).toHaveBeenCalledWith('id', 'u1')
    })
  })

  describe('reactivateUser', () => {
    it('clears deleted_at to reactivate', async () => {
      mockSingle.mockResolvedValue({ data: {}, error: null })

      await reactivateUser('u1')

      expect(mockUpdate).toHaveBeenCalledWith({
        deleted_at: null,
      })
      expect(mockEq).toHaveBeenCalledWith('id', 'u1')
    })
  })
})
