import type { PaginatedResult } from './pagination';

/**
 * Base repository interface.
 * All module repositories implement this interface to ensure consistency.
 *
 * Key design decisions:
 * - tenantId is always the first parameter to prevent cross-tenant data leaks
 * - Soft delete by default (deletedAt column)
 * - findMany always returns PaginatedResult
 * - No Prisma types leak beyond the repository layer
 */
export interface IBaseRepository<T, CreateDTO, UpdateDTO> {
  findById(tenantId: string, id: string): Promise<T | null>;

  findMany(
    tenantId: string,
    filters?: Record<string, unknown>,
  ): Promise<PaginatedResult<T>>;

  create(tenantId: string, data: CreateDTO): Promise<T>;

  update(tenantId: string, id: string, data: UpdateDTO): Promise<T>;

  softDelete(tenantId: string, id: string): Promise<void>;

  exists(tenantId: string, id: string): Promise<boolean>;

  count(tenantId: string, filters?: Record<string, unknown>): Promise<number>;
}

/**
 * Filter parameters for repository queries.
 */
export interface FilterParams {
  cursor?: string;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  [key: string]: unknown;
}
