import type { PaginationMeta } from './pagination';

/**
 * Standardized service result type.
 * All service methods return this to ensure consistent API responses.
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    pagination?: PaginationMeta;
    cached?: boolean;
  };
}

/**
 * Helper to create a successful service result.
 */
export function success<T>(data: T, meta?: ServiceResult<T>['meta']): ServiceResult<T> {
  return { success: true, data, meta };
}

/**
 * Helper to create a failed service result.
 */
export function failure<T = never>(code: string, message: string): ServiceResult<T> {
  return { success: false, error: { code, message } };
}
