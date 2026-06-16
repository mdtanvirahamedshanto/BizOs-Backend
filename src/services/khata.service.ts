import type { KhataRepository } from '@/repositories/khata.repository';
import { NotFoundError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type {
  KhataQueryDTO,
  KhataEntryQueryDTO,
  CreateCollectionDTO,
  CreateRepaymentDTO,
  KhataAdjustmentDTO,
  EnsureKhataAccountDTO,
} from '@/validators/khata.schema';
import { AuditService } from './audit.service';
import { khataEvents } from '@/events/khata.events';

export class KhataService {
  constructor(private khataRepo: KhataRepository) {}

  async listAccounts(shopId: string, query: KhataQueryDTO): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || 'updatedAt';
    const sortOrder = query.sortOrder || 'desc';

    const { data, total } = await this.khataRepo.findAndCountAccounts(shopId, {
      partyType: query.partyType,
      isActive: query.isActive,
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

  async getAccount(shopId: string, id: string): Promise<ServiceResult<any>> {
    const account = await this.khataRepo.findById(shopId, id);
    if (!account) {
      throw new NotFoundError('Khata Account');
    }
    return success(account);
  }

  async listEntries(
    shopId: string,
    accountId: string,
    query: KhataEntryQueryDTO,
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const account = await this.khataRepo.findById(shopId, accountId);
    if (!account) {
      throw new NotFoundError('Khata Account');
    }

    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const { data, total } = await this.khataRepo.findEntries(shopId, accountId, {
      limit,
      cursor: query.cursor,
    });

    const meta = buildPaginationMeta(total, limit, data, query.cursor);

    return success({
      data,
      meta,
    });
  }

  async recordCollection(
    shopId: string,
    accountId: string,
    userId: string,
    dto: CreateCollectionDTO,
  ): Promise<ServiceResult<any>> {
    const result = await this.khataRepo.recordCollection(shopId, accountId, userId, {
      amountCents: dto.amountCents,
      method: dto.method,
      reference: dto.reference || null,
      notes: dto.notes || null,
    });

    await AuditService.log({
      shopId,
      userId,
      action: 'khata.collection',
      entity: 'khata_accounts',
      entityId: accountId,
      newValues: result as any,
    });

    khataEvents.entryAdded({
      shopId,
      khataAccountId: accountId,
      entryId: result.payment.id,
      amountCents: dto.amountCents,
      type: 'CREDIT',
    });

    return success(result);
  }

  async recordRepayment(
    shopId: string,
    accountId: string,
    userId: string,
    dto: CreateRepaymentDTO,
  ): Promise<ServiceResult<any>> {
    const result = await this.khataRepo.recordRepayment(shopId, accountId, userId, {
      amountCents: dto.amountCents,
      method: dto.method,
      reference: dto.reference || null,
      notes: dto.notes || null,
    });

    await AuditService.log({
      shopId,
      userId,
      action: 'khata.repayment',
      entity: 'khata_accounts',
      entityId: accountId,
      newValues: result as any,
    });

    khataEvents.entryAdded({
      shopId,
      khataAccountId: accountId,
      entryId: result.payment.id,
      amountCents: dto.amountCents,
      type: 'DEBIT',
    });

    return success(result);
  }

  async recordAdjustment(
    shopId: string,
    accountId: string,
    userId: string,
    dto: KhataAdjustmentDTO,
  ): Promise<ServiceResult<any>> {
    const result = await this.khataRepo.recordAdjustment(shopId, accountId, userId, {
      type: dto.type,
      amountCents: dto.amountCents,
      description: dto.description,
    });

    await AuditService.log({
      shopId,
      userId,
      action: 'khata.adjusted',
      entity: 'khata_accounts',
      entityId: accountId,
      newValues: result as any,
    });

    khataEvents.entryAdded({
      shopId,
      khataAccountId: accountId,
      entryId: result.entry.id,
      amountCents: dto.amountCents,
      type: dto.type,
    });

    return success(result);
  }

  async getDueSummary(shopId: string): Promise<ServiceResult<any>> {
    const summary = await this.khataRepo.getDueSummary(shopId);
    return success(summary);
  }

  async ensureAccount(shopId: string, dto: EnsureKhataAccountDTO): Promise<ServiceResult<any>> {
    const account = await this.khataRepo.ensureAccount(shopId, dto.partyType, dto.partyId);
    return success(account);
  }
}
