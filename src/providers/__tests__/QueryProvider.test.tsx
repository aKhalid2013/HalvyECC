import React from 'react'
import { render } from '@testing-library/react-native'
import { Text } from 'react-native'
import QueryProvider, { queryClient } from '../QueryProvider'

describe('QueryProvider', () => {
  it('renders children without crashing', () => {
    const { getByText } = render(
      <QueryProvider>
        <Text>Test Child</Text>
      </QueryProvider>
    )
    expect(getByText('Test Child')).toBeTruthy()
  })

  it('configures QueryClient with correct default options', () => {
    const options = queryClient.getDefaultOptions()
    
    // Queries
    expect(options.queries?.staleTime).toBe(120000)
    expect(options.queries?.retry).toBe(3)
    expect(options.queries?.refetchOnWindowFocus).toBe(true)
    
    // Mutations
    expect(options.mutations?.retry).toBe(3)
    
    // Retry delay logic check
    const retryDelay = options.queries?.retryDelay as (attempt: number) => number
    expect(retryDelay(0)).toBe(1000)
    expect(retryDelay(1)).toBe(2000)
    expect(retryDelay(2)).toBe(4000)
    expect(retryDelay(10)).toBe(10000) // capped
  })
})
