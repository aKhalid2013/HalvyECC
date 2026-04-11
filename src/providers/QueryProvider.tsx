import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Global QueryClient instance with project-standard backoff and staleTime.
 * Exported for testing and manual cache access if needed.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
  },
})

interface QueryProviderProps {
  children: React.ReactNode
}

export default function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
