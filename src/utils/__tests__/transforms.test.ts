/**
 * SPEC-003 TASK-3: toCamel utility tests
 * Tests all five cases: flat, nested, null/undefined passthrough, array, already-camelCase
 */
import { toCamel } from '../transforms'

describe('toCamel', () => {
  // Case 1: flat object — snake_case keys become camelCase
  it('converts flat snake_case keys to camelCase', () => {
    const input = { display_name: 'Alice', avatar_url: 'https://example.com', auth_provider: 'google' }
    const result = toCamel<{ displayName: string; avatarUrl: string; authProvider: string }>(input)
    expect(result).toEqual({
      displayName: 'Alice',
      avatarUrl: 'https://example.com',
      authProvider: 'google',
    })
  })

  // Case 2: nested object — converts keys recursively
  it('recursively converts nested snake_case keys', () => {
    const input = {
      user_id: '123',
      group_info: {
        group_name: 'Dinner',
        created_at: '2026-01-01',
      },
    }
    const result = toCamel<{ userId: string; groupInfo: { groupName: string; createdAt: string } }>(input)
    expect(result).toEqual({
      userId: '123',
      groupInfo: {
        groupName: 'Dinner',
        createdAt: '2026-01-01',
      },
    })
  })

  // Case 3: null / undefined passthrough — returns null/undefined as-is
  it('returns null when given null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(toCamel(null as any)).toBeNull()
  })

  it('returns undefined when given undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(toCamel(undefined as any)).toBeUndefined()
  })

  // Case 4: array of objects — each element is converted
  it('converts each element in an array of objects', () => {
    const input = [
      { display_name: 'Alice', deleted_at: null },
      { display_name: 'Bob',   deleted_at: '2026-01-01' },
    ]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = toCamel<{ displayName: string; deletedAt: string | null }[]>(input as any)
    expect(result).toEqual([
      { displayName: 'Alice', deletedAt: null },
      { displayName: 'Bob',   deletedAt: '2026-01-01' },
    ])
  })

  // Case 5: already-camelCase keys — no-op, returned unchanged
  it('leaves already-camelCase keys unchanged', () => {
    const input = { displayName: 'Alice', avatarUrl: 'https://example.com' }
    const result = toCamel<typeof input>(input)
    expect(result).toEqual({ displayName: 'Alice', avatarUrl: 'https://example.com' })
  })

  // Edge: values that are primitives (string, number, boolean) inside the object
  it('preserves primitive values without modification', () => {
    const input = { is_active: true, score: 42, label: 'hello' }
    const result = toCamel<{ isActive: boolean; score: number; label: string }>(input)
    expect(result).toEqual({ isActive: true, score: 42, label: 'hello' })
  })

  // Edge: array values inside an object are NOT recursed into (they are mapped per-element)
  it('converts array-valued object properties element-by-element', () => {
    const input = {
      line_items: [
        { item_id: 'a', total_amount: 100 },
        { item_id: 'b', total_amount: 200 },
      ],
    }
    const result = toCamel<{ lineItems: { itemId: string; totalAmount: number }[] }>(input)
    expect(result).toEqual({
      lineItems: [
        { itemId: 'a', totalAmount: 100 },
        { itemId: 'b', totalAmount: 200 },
      ],
    })
  })
})
