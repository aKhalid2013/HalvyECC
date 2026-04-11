/**
 * SPEC-003 TASK-2: Dependency presence smoke tests
 *
 * These tests verify that all 6 required packages are installed and
 * resolvable by Jest (i.e., included in transformIgnorePatterns).
 * They are intentionally minimal — the goal is to confirm the packages
 * can be imported without a "Cannot find module" or transform error.
 */

describe('SPEC-003 required dependencies', () => {
  it('resolves @supabase/supabase-js', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@supabase/supabase-js')
    expect(mod).toBeDefined()
    expect(typeof mod.createClient).toBe('function')
  })

  it('resolves expo-secure-store', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-secure-store')
    expect(mod).toBeDefined()
  })

  it('resolves @tanstack/react-query', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@tanstack/react-query')
    expect(mod).toBeDefined()
    expect(typeof mod.QueryClient).toBe('function')
  })

  it('resolves expo-auth-session', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-auth-session')
    expect(mod).toBeDefined()
  })

  it('resolves expo-web-browser', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-web-browser')
    expect(mod).toBeDefined()
  })

  it('resolves expo-crypto', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-crypto')
    expect(mod).toBeDefined()
  })
})
