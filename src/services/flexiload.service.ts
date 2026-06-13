import { FlexiloadRepository } from '@/repositories/flexiload.repository';
import { NotFoundError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type {
  FlexiloadAccountDTO,
  UpdateFlexiloadAccountDTO,
  FlexiloadTransactionDTO,
  FlexiloadQueryDTO,
} from '@/validators/flexiload.schema';
import { AuditService } from './audit.service';

export class FlexiloadService {
  constructor(private flexiloadRepo: FlexiloadRepository) {}

  // ==========================================
  // FLEXILOAD ACCOUNTS
  // ==========================================

  async createAccount(
    shopId: string,
    dto: FlexiloadAccountDTO,
    actorUserId?: string
  ): Promise<ServiceResult<any>> {
    const account = await this.flexiloadRepo.createAccount(shopId, dto);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'flexiload-account.created',
      entity: 'flexiload_accounts',
      entityId: account.id,
      newValues: account as any,
    });

    return success(account);
  }

  async updateAccount(
    shopId: string,
    id: string,
    dto: UpdateFlexiloadAccountDTO,
    actorUserId?: string
  ): Promise<ServiceResult<any>> {
    const account = await this.flexiloadRepo.findAccountById(shopId, id);
    if (!account) {
      throw new NotFoundError('Flexiload Account');
    }

    const updated = await this.flexiloadRepo.updateAccount(shopId, id, dto);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'flexiload-account.updated',
      entity: 'flexiload_accounts',
      entityId: id,
      oldValues: account as any,
      newValues: updated as any,
    });

    return success(updated);
  }

  async getAccount(shopId: string, id: string): Promise<ServiceResult<any>> {
    const account = await this.flexiloadRepo.findAccountById(shopId, id);
    if (!account) {
      throw new NotFoundError('Flexiload Account');
    }
    return success(account);
  }

  async listAccounts(
    shopId: string,
    operator?: 'GP' | 'ROBI' | 'AIRTEL' | 'BL' | 'TELETALK'
  ): Promise<ServiceResult<any[]>> {
    const accounts = await this.flexiloadRepo.listAccounts(shopId, operator);
    return success(accounts);
  }

  // ==========================================
  // FLEXILOAD TRANSACTIONS
  // ==========================================

  async createTransaction(
    shopId: string,
    userId: string,
    dto: FlexiloadTransactionDTO
  ): Promise<ServiceResult<any>> {
    const transaction = await this.flexiloadRepo.createTransaction(shopId, userId, dto);

    await AuditService.log({
      shopId,
      userId,
      action: 'flexiload-transaction.created',
      entity: 'flexiload_transactions',
      entityId: transaction.id,
      newValues: transaction as any,
    });

    return success(transaction);
  }

  async getTransaction(shopId: string, id: string): Promise<ServiceResult<any>> {
    const transaction = await this.flexiloadRepo.findTransactionById(shopId, id);
    if (!transaction) {
      throw new NotFoundError('Flexiload Transaction');
    }
    return success(transaction);
  }

  async listTransactions(
    shopId: string,
    query: FlexiloadQueryDTO
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || PAGINATION_DEFAULTS.SORT_ORDER;

    const { data, total } = await this.flexiloadRepo.findAndCountTransactions(shopId, {
      accountId: query.accountId,
      operator: query.operator,
      connectionType: query.connectionType,
      status: query.status,
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
