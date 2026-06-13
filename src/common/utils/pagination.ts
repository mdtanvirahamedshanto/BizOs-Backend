import type { PaginationMeta, PaginationParams } from '../types/pagination';
import { PAGINATION_DEFAULTS } from '../types/pagination';

/**
 * Parse pagination parameters from request query string.
 * Enforces maximum limit to prevent abuse.
 */
export function parsePaginationParams(query: Record<string, unknown>): PaginationParams {
  const limit = Math.min(
    Math.max(Number(query.limit) || PAGINATION_DEFAULTS.LIMIT, 1),
    PAGINATION_DEFAULTS.MAX_LIMIT,
  );

  return {
    cursor: query.cursor as string | undefined,
    limit,
    sortBy: (query.sortBy as string) || PAGINATION_DEFAULTS.SORT_BY,
    sortOrder: (query.sortOrder as 'asc' | 'desc') || PAGINATION_DEFAULTS.SORT_ORDER,
  };
}

/**
 * Build pagination metadata for the API response.
 */
export function buildPaginationMeta(
  total: number,
  limit: number,
  items: { id: string }[],
  cursor?: string,
): PaginationMeta {
  const lastItem = items[items.length - 1];
  const hasMore = items.length === limit;

  return {
    total,
    limit,
    cursor,
    nextCursor: hasMore && lastItem ? lastItem.id : null,
    hasMore,
  };
}
