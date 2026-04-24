import type { ApiResult } from '../types/api';
import type { User } from '../types/models';
import { toCamel } from '../utils/transforms';
import { supabase } from './client';

export interface UpdateUserPayload {
  displayName?: string;
  avatarUrl?: string | null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unknown error';
}

export async function getCurrentUser(): Promise<ApiResult<User>> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('No active session');

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (error) throw error;
    if (data.deleted_at !== null) {
      return {
        data: null,
        error: { code: 'USER_DEACTIVATED', message: 'User account is deactivated' },
      };
    }

    return { data: toCamel<User>(data), error: null };
  } catch (err: unknown) {
    return { data: null, error: { code: 'UNKNOWN', message: errorMessage(err) } };
  }
}

export async function getUser(userId: string): Promise<ApiResult<User>> {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();

    if (error) throw error;
    return { data: toCamel<User>(data), error: null };
  } catch (err: unknown) {
    return { data: null, error: { code: 'UNKNOWN', message: errorMessage(err) } };
  }
}

export async function updateUser(
  userId: string,
  payload: UpdateUserPayload
): Promise<ApiResult<User>> {
  try {
    const snakePayload: { display_name?: string; avatar_url?: string | null } = {};
    if (payload.displayName !== undefined) snakePayload.display_name = payload.displayName;
    if (payload.avatarUrl !== undefined) snakePayload.avatar_url = payload.avatarUrl;

    const { data, error } = await supabase
      .from('users')
      .update(snakePayload)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data: toCamel<User>(data), error: null };
  } catch (err: unknown) {
    return { data: null, error: { code: 'UNKNOWN', message: errorMessage(err) } };
  }
}

export async function deleteUser(userId: string): Promise<ApiResult<void>> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
    return { data: null, error: null };
  } catch (err: unknown) {
    return { data: null, error: { code: 'UNKNOWN', message: errorMessage(err) } };
  }
}

export async function reactivateUser(userId: string): Promise<ApiResult<User>> {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ deleted_at: null })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data: toCamel<User>(data), error: null };
  } catch (err: unknown) {
    return { data: null, error: { code: 'UNKNOWN', message: errorMessage(err) } };
  }
}
