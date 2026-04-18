export function toCamel<T>(obj: unknown): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamel(item)) as unknown as T;
  }

  if (typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => {
        const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
        return [camelKey, toCamel(value)];
      })
    ) as T;
  }

  return obj as T;
}
