import { useAuthStore } from '../authStore'

describe('AuthStore (Zustand)', () => {
  beforeEach(() => {
    useAuthStore.getState().reset()
  })

  it('has correct initial state', () => {
    const state = useAuthStore.getState()
    expect(state.session).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isLoading).toBe(false) // Because reset() was called in beforeEach
    expect(state.error).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('updates session and user', () => {
    const mockSession = { access_token: 'token' } as any
    const mockUser = { id: 'user-1' } as any

    useAuthStore.getState().setSession(mockSession)
    expect(useAuthStore.getState().session).toEqual(mockSession)
    expect(useAuthStore.getState().isAuthenticated).toBe(false) // user still null

    useAuthStore.getState().setUser(mockUser)
    expect(useAuthStore.getState().user).toEqual(mockUser)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('updates loading and error state', () => {
    const mockError = { code: 'ERR', message: 'fail' }

    useAuthStore.getState().setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)

    useAuthStore.getState().setError(mockError)
    expect(useAuthStore.getState().error).toEqual(mockError)
  })

  it('derives isAuthenticated correctly', () => {
    const store = useAuthStore.getState()
    const mockSession = { access_token: 't' } as any
    const mockUser = { id: 'u' } as any

    // 1. null / null
    expect(useAuthStore.getState().isAuthenticated).toBe(false)

    // 2. session / null
    store.setSession(mockSession)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)

    // 3. null / user
    store.reset()
    store.setUser(mockUser)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)

    // 4. session / user
    store.setSession(mockSession)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('resets correctly', () => {
    const store = useAuthStore.getState()
    store.setSession({} as any)
    store.setUser({} as any)
    store.setLoading(true)
    store.setError({ code: 'x', message: 'x' })

    store.reset()

    const state = useAuthStore.getState()
    expect(state.session).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})
