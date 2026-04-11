import { supabase } from './client'
import { toCamel } from '@/utils/transforms'
import type { User } from '@/types/models'
import { Database } from '@/types/database'
import type { ApiResult } from './types'

type UserUpdate = Database['public']['Tables']['users']['Update']

export interface UpdateUserPayload {
  displayName?: string
  avatarUrl?: string | null
}

/**
 * Fetches a single user by ID.
 */
export async function getUser(userId: string): Promise<ApiResult<User | null>> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) return { data: null, error: { code: 'USER_NOT_FOUND', message: error.message } }
    return { data: toCamel<User>(data), error: null }
  } catch (err: unknown) {
    return { data: null, error: { code: 'API_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }
  }
}

/**
 * Fetches the currently authenticated user.
 * Returns error if user is deactivated.
 */
export async function getCurrentUser(): Promise<ApiResult<User | null>> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return { data: null, error: { code: 'NOT_AUTHENTICATED', message: 'No active session found' } }
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (error) return { data: null, error: { code: 'USER_NOT_FOUND', message: error.message } }
    if (data.deleted_at) {
      return { data: null, error: { code: 'USER_DEACTIVATED', message: 'Account is deactivated' } }
    }

    return { data: toCamel<User>(data), error: null }
  } catch (err: unknown) {
    return { data: null, error: { code: 'API_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }
  }
}

/**
 * Updates a user's profile.
 */
export async function updateUser(userId: string, payload: UpdateUserPayload): Promise<ApiResult<User | null>> {
  try {
    const updatePayload: UserUpdate = {}
    if (payload.displayName !== undefined) updatePayload.display_name = payload.displayName
    if (payload.avatarUrl !== undefined) updatePayload.avatar_url = payload.avatarUrl

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .single()

    if (error) return { data: null, error: { code: 'UPDATE_ERROR', message: error.message } }
    return { data: toCamel<User>(data), error: null }
  } catch (err: unknown) {
    return { data: null, error: { code: 'API_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }
  }
}

/**
 * Deactivates a user (soft delete).
 */
export async function deleteUser(userId: string): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId)
      .single()

    if (error) return { data: null, error: { code: 'DELETE_ERROR', message: error.message } }
    return { data: null, error: null }
  } catch (err: unknown) {
    return { data: null, error: { code: 'API_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }
  }
}

/**
 * Reactivates a deactivated user.
 */
export async function reactivateUser(userId: string): Promise<ApiResult<null>> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: null })
      .eq('id', userId)
      .single()

    if (error) return { data: null, error: { code: 'REACTIVATE_ERROR', message: error.message } }
    return { data: null, error: null }
  } catch (err: unknown) {
    return { data: null, error: { code: 'API_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }
  }
}
