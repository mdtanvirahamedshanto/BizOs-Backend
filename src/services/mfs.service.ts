import { MfsRepository } from '@/repositories/mfs.repository';
import { NotFoundError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type {
  MfsAccountDTO,
  UpdateMfsAccountDTO,
  MfsTransactionDTO,
  MfsQueryDTO,
} from '@/validators/mfs.schema';
import { AuditService } from './audit.service';

export class MfsService {
  constructor(private mfsRepo: MfsRepository) {}

  // ==========================================
  // MFS ACCOUNTS
  // ==========================================

  async createAccount(
    shopId: string,
    dto: MfsAccountDTO,
    actorUserId?: string
  ): Promise<ServiceResult<any>> {
    const account = await this.mfsRepo.createAccount(shopId, dto);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'mfs-account.created',
      entity: 'mfs_accounts',
      entityId: account.id,
      newValues: account as any,
    });

    return success(account);
  }

  async updateAccount(
    shopId: string,
    id: string,
    dto: UpdateMfsAccountDTO,
    actorUserId?: string
  ): Promise<ServiceResult<any>> {
    const account = await this.mfsRepo.findAccountById(shopId, id);
    if (!account) {
      throw new NotFoundError('MFS Account');
    }

    const updated = await this.mfsRepo.updateAccount(shopId, id, dto);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'mfs-account.updated',
      entity: 'mfs_accounts',
      entityId: id,
      oldValues: account as any,
      newValues: updated as any,
    });

    return success(updated);
  }

  async getAccount(shopId: string, id: string): Promise<ServiceResult<any>> {
    const account = await this.mfsRepo.findAccountById(shopId, id);
    if (!account) {
      throw new NotFoundError('MFS Account');
    }
    return success(account);
  }

  async listAccounts(
    shopId: string,
    provider?: 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY'
  ): Promise<ServiceResult<any[]>> {
    const accounts = await this.mfsRepo.listAccounts(shopId, provider);
    return success(accounts);
  }

  // ==========================================
  // MFS TRANSACTIONS
  // ==========================================

  async createTransaction(
    shopId: string,
    userId: string,
    dto: MfsTransactionDTO
  ): Promise<ServiceResult<any>> {
    const transaction = await this.mfsRepo.createTransaction(shopId, userId, dto);

    await AuditService.log({
      shopId,
      userId,
      action: 'mfs-transaction.created',
      entity: 'mfs_transactions',
      entityId: transaction.id,
      newValues: transaction as any,
    });

    return success(transaction);
  }

  async getTransaction(shopId: string, id: string): Promise<ServiceResult<any>> {
    const transaction = await this.mfsRepo.findTransactionById(shopId, id);
    if (!transaction) {
      throw new NotFoundError('MFS Transaction');
    }
    return success(transaction);
  }

  async listTransactions(
    shopId: string,
    query: MfsQueryDTO
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || PAGINATION_DEFAULTS.SORT_ORDER;

    const { data, total } = await this.mfsRepo.findAndCountTransactions(shopId, {
      mfsAccountId: query.mfsAccountId,
      provider: query.provider,
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
}
