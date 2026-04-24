export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
}

export type Unsubscribe = () => void;
