import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { config } from '@/constants/config'
import type { Database } from '@/types/database'

// SecureStore has a 2048-byte limit per key. Supabase sessions routinely
// exceed this, so we chunk large values and reassemble on read.
const CHUNK_SIZE = 1800

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const numChunksStr = await SecureStore.getItemAsync(`${key}_numChunks`)
    if (!numChunksStr) {
      return SecureStore.getItemAsync(key)
    }
    const numChunks = parseInt(numChunksStr, 10)
    const chunks: string[] = []
    for (let i = 0; i < numChunks; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`)
      if (chunk == null) return null
      chunks.push(chunk)
    }
    return chunks.join('')
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(`${key}_numChunks`)
      await SecureStore.setItemAsync(key, value)
      return
    }
    const numChunks = Math.ceil(value.length / CHUNK_SIZE)
    await SecureStore.setItemAsync(`${key}_numChunks`, String(numChunks))
    for (let i = 0; i < numChunks; i++) {
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))
    }
  },
  removeItem: async (key: string): Promise<void> => {
    const numChunksStr = await SecureStore.getItemAsync(`${key}_numChunks`)
    if (numChunksStr) {
      const numChunks = parseInt(numChunksStr, 10)
      for (let i = 0; i < numChunks; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`)
      }
      await SecureStore.deleteItemAsync(`${key}_numChunks`)
    }
    await SecureStore.deleteItemAsync(key)
  },
}

export const supabase = createClient<Database>(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  }
)
