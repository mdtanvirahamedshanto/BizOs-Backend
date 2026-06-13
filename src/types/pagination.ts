/**
 * Pagination types used across all modules.
 */

/** Pagination parameters from client request */
export interface PaginationParams {
  cursor?: string;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Pagination metadata returned in API responses */
export interface PaginationMeta {
  total: number;
  limit: number;
  cursor?: string;
  nextCursor?: string | null;
  hasMore: boolean;
}

/** Paginated result wrapper */
export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Default pagination values */
export const PAGINATION_DEFAULTS = {
  LIMIT: 25,
  MAX_LIMIT: 100,
  SORT_ORDER: 'desc' as const,
  SORT_BY: 'createdAt',
} as const;
