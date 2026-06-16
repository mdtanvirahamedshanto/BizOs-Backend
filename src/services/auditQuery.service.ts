import type { AuditRepository } from '@/repositories/audit.repository';
import { NotFoundError } from '@/utils/errors';
import { success, type ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type { AuditQueryDTO } from '@/validators/audit.schema';

export class AuditQueryService {
  constructor(private auditRepo: AuditRepository) {}

  async listLogs(shopId: string, query: AuditQueryDTO): Promise<ServiceResult<PaginatedResult<unknown>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    const { data, total } = await this.auditRepo.findAndCount(shopId, {
      action: query.action,
      entity: query.entity,
      entityId: query.entityId,
      userId: query.userId,
      startDate: query.startDate,
      endDate: query.endDate,
      limit,
      cursor: query.cursor,
      sortBy,
      sortOrder,
    });

    const meta = buildPaginationMeta(total, limit, data, query.cursor);

    return success({ data, meta });
  }

  async getLog(shopId: string, id: string): Promise<ServiceResult<unknown>> {
    const log = await this.auditRepo.findById(shopId, id);
    if (!log) {
      throw new NotFoundError('Audit log');
    }
    return success(log);
  }

  async listActions(shopId: string): Promise<ServiceResult<string[]>> {
    const actions = await this.auditRepo.listDistinctActions(shopId);
    return success(actions);
  }
}
