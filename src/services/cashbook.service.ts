import { CashbookRepository } from '@/repositories/cashbook.repository';
import { ConflictError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type {
  ManualCashEntryDTO,
  DailyClosingDTO,
  CashbookQueryDTO,
} from '@/validators/cashbook.schema';
import { AuditService } from './audit.service';
import { prisma } from '@/prisma/client';

export class CashbookService {
  constructor(private cashbookRepo: CashbookRepository) {}

  async recordCashIn(
    shopId: string,
    userId: string,
    dto: ManualCashEntryDTO
  ): Promise<ServiceResult<any>> {
    const entry = await prisma.$transaction(async (tx) => {
      return CashbookRepository.recordEntry(tx, shopId, {
        type: 'IN',
        amountCents: dto.amountCents,
        description: dto.description,
        referenceType: 'manual',
        referenceId: null,
        paymentId: null,
        recordedBy: userId,
      });
    });

    await AuditService.log({
      shopId,
      userId,
      action: 'cashbook.cash-in',
      entity: 'cashbook_entries',
      entityId: entry.id,
      newValues: entry as any,
    });

    return success(entry);
  }

  async recordCashOut(
    shopId: string,
    userId: string,
    dto: ManualCashEntryDTO
  ): Promise<ServiceResult<any>> {
    const balance = await this.cashbookRepo.getCurrentBalance(shopId);

    // Prevent negative balance if business rules require it, or warn.
    // In South Asian micro-retail, physical cashbox cannot have negative cash.
    if (balance < dto.amountCents) {
      throw new ConflictError(
        `Insufficient cash balance. Available: ${balance} cents. Requested payout: ${dto.amountCents} cents.`
      );
    }

    const entry = await prisma.$transaction(async (tx) => {
      return CashbookRepository.recordEntry(tx, shopId, {
        type: 'OUT',
        amountCents: dto.amountCents,
        description: dto.description,
        referenceType: 'manual',
        referenceId: null,
        paymentId: null,
        recordedBy: userId,
      });
    });

    await AuditService.log({
      shopId,
      userId,
      action: 'cashbook.cash-out',
      entity: 'cashbook_entries',
      entityId: entry.id,
      newValues: entry as any,
    });

    return success(entry);
  }

  async getCurrentBalance(shopId: string): Promise<ServiceResult<{ balanceCents: number }>> {
    const balanceCents = await this.cashbookRepo.getCurrentBalance(shopId);
    return success({ balanceCents });
  }

  async listEntries(
    shopId: string,
    query: CashbookQueryDTO
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || 'entryDate';
    const sortOrder = query.sortOrder || PAGINATION_DEFAULTS.SORT_ORDER;

    const { data, total } = await this.cashbookRepo.findAndCountEntries(shopId, {
      type: query.type,
      startDate: query.startDate,
      endDate: query.endDate,
      limit,
      cursor: query.cursor,
      sortBy,
      sortOrder,
    });

    const meta = buildPaginationMeta(total, limit, data, query.cursor);

    return success({
      data,
      meta,
    });
  }

  async getClosingPreview(shopId: string, dateStr?: string): Promise<ServiceResult<any>> {
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date.getTime())) {
      throw new ConflictError('Invalid closing date string provided');
    }
    const preview = await this.cashbookRepo.getClosingPreview(shopId, date);
    return success(preview);
  }

  async recordClosing(
    shopId: string,
    userId: string,
    dto: DailyClosingDTO,
    dateStr?: string
  ): Promise<ServiceResult<any>> {
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date.getTime())) {
      throw new ConflictError('Invalid closing date string provided');
    }

    const closing = await this.cashbookRepo.recordClosing(shopId, userId, {
      closingDate: date,
      actualBalanceCents: dto.actualBalanceCents,
      notes: dto.notes || null,
    });

    await AuditService.log({
      shopId,
      userId,
      action: 'cashbook.closing',
      entity: 'daily_closings',
      entityId: closing.id,
      newValues: closing as any,
    });

    return success(closing);
  }

  async listClosings(
    shopId: string,
    query: { limit?: number; cursor?: string }
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const { data, total } = await this.cashbookRepo.findAndCountClosings(shopId, {
      limit,
      cursor: query.cursor,
    });

    const meta = buildPaginationMeta(total, limit, data, query.cursor);

    return success({
      data,
      meta,
    });
  }
}
