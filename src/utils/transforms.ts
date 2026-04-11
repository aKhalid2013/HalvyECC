/**
 * toCamel — recursively converts snake_case object keys to camelCase.
 *
 * Handles:
 *   - Flat objects          { display_name: 'x' } → { displayName: 'x' }
 *   - Nested objects        recursive conversion on nested plain objects
 *   - null / undefined      returned as-is (passthrough)
 *   - Arrays                each element is converted via toCamel
 *   - Already-camelCase     keys without underscores are left unchanged
 */

type CamelInput = Record<string, unknown> | Record<string, unknown>[] | null | undefined

function toCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

export function toCamel<T>(obj: CamelInput): T {
  if (obj === null || obj === undefined) {
    return obj as unknown as T
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamel<unknown>(item as CamelInput)) as unknown as T
  }

  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      toCamelKey(k),
      v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v)
        ? toCamel(v as Record<string, unknown>)
        : Array.isArray(v)
          ? toCamel(v as Record<string, unknown>[])
          : v,
    ])
  ) as T
}
