/**
 * Shared API result types used across all API modules.
 * @see docs/api/api-contracts.md
 */

export interface ApiError {
  code: string
  message: string
  status?: number
}

export type ApiResult<T> =
  | { data: T;    error: null     }
  | { data: null; error: ApiError }
