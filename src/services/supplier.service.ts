import { SupplierRepository } from '@/repositories/supplier.repository';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type { CreateSupplierDTO, UpdateSupplierDTO, SupplierQueryDTO } from '@/validators/supplier.schema';
import { AuditService } from './audit.service';

export class SupplierService {
  constructor(private supplierRepo: SupplierRepository) {}

  async createSupplier(shopId: string, dto: CreateSupplierDTO, actorUserId?: string): Promise<ServiceResult<any>> {
    if (dto.phone) {
      const existing = await this.supplierRepo.findByPhone(shopId, dto.phone);
      if (existing) {
        throw new ConflictError('A supplier with this phone number already exists in this shop');
      }
    }

    const supplier = await this.supplierRepo.create(shopId, dto);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'supplier.created',
      entity: 'suppliers',
      entityId: supplier.id,
      newValues: supplier as any,
    });

    return success(supplier);
  }

  async getSupplier(shopId: string, id: string): Promise<ServiceResult<any>> {
    const supplier = await this.supplierRepo.findById(shopId, id);
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }
    return success(supplier);
  }

  async updateSupplier(
    shopId: string,
    id: string,
    dto: UpdateSupplierDTO,
    actorUserId?: string,
  ): Promise<ServiceResult<any>> {
    const supplier = await this.supplierRepo.findById(shopId, id);
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }

    if (dto.phone && dto.phone !== supplier.phone) {
      const existing = await this.supplierRepo.findByPhone(shopId, dto.phone);
      if (existing) {
        throw new ConflictError('A supplier with this phone number already exists in this shop');
      }
    }

    const updated = await this.supplierRepo.update(shopId, id, dto);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'supplier.updated',
      entity: 'suppliers',
      entityId: supplier.id,
      oldValues: supplier as any,
      newValues: updated as any,
    });

    return success(updated);
  }

  async deleteSupplier(shopId: string, id: string, actorUserId?: string): Promise<ServiceResult<void>> {
    const supplier = await this.supplierRepo.findById(shopId, id);
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }

    await this.supplierRepo.softDelete(shopId, id);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'supplier.deleted',
      entity: 'suppliers',
      entityId: supplier.id,
      oldValues: supplier as any,
    });

    return success(undefined);
  }

  async listSuppliers(
    shopId: string,
    query: SupplierQueryDTO,
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || PAGINATION_DEFAULTS.SORT_BY;
    const sortOrder = query.sortOrder || PAGINATION_DEFAULTS.SORT_ORDER;

    const { data, total } = await this.supplierRepo.findAndCount(shopId, {
      search: query.search,
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

  async getDueTracking(shopId: string, id: string): Promise<ServiceResult<any>> {
    const supplier = await this.supplierRepo.findById(shopId, id);
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }

    const [purchaseDueCents, khataAccount] = await Promise.all([
      this.supplierRepo.getPurchaseDue(shopId, id),
      this.supplierRepo.getKhataAccount(shopId, id),
    ]);

    const khataBalanceCents = khataAccount ? khataAccount.balanceCents : 0;
    // Semantics: -ve = shop owes the party (payable), +ve = party owes shop (receivable).
    // Total shop obligations (shop owes supplier): purchase due + absolute value of negative khata balance.
    const totalShopOwesCents = khataBalanceCents < 0 ? Math.abs(khataBalanceCents) : 0;

    return success({
      supplierId: supplier.id,
      supplierName: supplier.name,
      purchaseDueCents,
      khataBalanceCents,
      totalShopOwesCents,
    });
  }

  async getPurchaseHistory(
    shopId: string,
    id: string,
    query: { limit?: number; cursor?: string },
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const supplier = await this.supplierRepo.findById(shopId, id);
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }

    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const { data, total } = await this.supplierRepo.findPurchasesAndCount(shopId, id, {
      limit,
      cursor: query.cursor,
    });

    const meta = buildPaginationMeta(total, limit, data, query.cursor);

    return success({
      data,
      meta,
    });
  }

  async getSupplierLedger(
    shopId: string,
    id: string,
    query: { limit?: number; cursor?: string },
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const supplier = await this.supplierRepo.findById(shopId, id);
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }

    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const { data, total } = await this.supplierRepo.findLedgerEntries(shopId, id, {
      limit,
      cursor: query.cursor,
    });

    const meta = buildPaginationMeta(total, limit, data, query.cursor);

    return success({
      data,
      meta,
    });
  }

  async getSupplierPayments(
    shopId: string,
    id: string,
    query: { limit?: number; cursor?: string },
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const supplier = await this.supplierRepo.findById(shopId, id);
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }

    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const { data, total } = await this.supplierRepo.findPaymentsAndCount(shopId, id, {
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
