import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useQueryClient } from '@tanstack/react-query';
import { QueryProvider } from '../QueryProvider';

describe('QueryProvider', () => {
  it('provides a QueryClient with correct default options', () => {
    const { result } = renderHook(() => useQueryClient(), {
      wrapper: ({ children }) => <QueryProvider>{children}</QueryProvider>,
    });

    const client = result.current;
    const defaultOptions = client.getDefaultOptions();

    expect(defaultOptions.queries?.staleTime).toBe(120000);
    expect(defaultOptions.queries?.retry).toBe(3);
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true);

    const retryDelay = defaultOptions.queries?.retryDelay as (attempt: number) => number;
    expect(retryDelay(0)).toBe(1000);
    expect(retryDelay(1)).toBe(2000);
    expect(retryDelay(2)).toBe(4000);
    expect(retryDelay(3)).toBe(8000);
    expect(retryDelay(4)).toBe(10000);
    expect(retryDelay(10)).toBe(10000);
  });
});
