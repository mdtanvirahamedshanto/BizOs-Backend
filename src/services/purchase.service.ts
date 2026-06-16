import type { PurchaseRepository } from '@/repositories/purchase.repository';
import type { ProductRepository } from '@/repositories/product.repository';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type {
  CreatePurchaseDTO,
  UpdatePurchaseDTO,
  PurchaseQueryDTO,
  ReturnPurchaseDTO,
} from '@/validators/purchase.schema';
import { AuditService } from './audit.service';

export class PurchaseService {
  constructor(
    private purchaseRepo: PurchaseRepository,
    private productRepo: ProductRepository,
  ) {}

  async createPurchase(shopId: string, userId: string, dto: CreatePurchaseDTO): Promise<ServiceResult<any>> {
    // 1. Verify items exist and build data list
    const purchaseItemsData: any[] = [];
    let subtotalCents = 0;

    for (const item of dto.items) {
      const product = await this.productRepo.findProductById(shopId, item.productId);
      if (!product) {
        throw new NotFoundError(`Product with ID ${item.productId}`);
      }

      const totalCents = item.quantity * item.unitCostCents;
      subtotalCents += totalCents;

      purchaseItemsData.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitCostCents: item.unitCostCents,
        totalCents,
      });
    }

    // 2. Parse overall totals
    const taxCents = dto.taxCents || 0;
    const discountCents = dto.discountCents || 0;
    const totalCents = Math.max(0, subtotalCents + taxCents - discountCents);

    let paidCents = dto.payment ? dto.payment.amountCents : 0;
    if (paidCents > totalCents) {
      paidCents = totalCents; // Cap payment at total PO cost
    }
    const dueCents = totalCents - paidCents;

    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID' = 'UNPAID';
    if (totalCents > 0) {
      if (dueCents === 0) {
        paymentStatus = 'PAID';
      } else if (paidCents === 0) {
        paymentStatus = 'UNPAID';
      } else {
        paymentStatus = 'PARTIAL';
      }
    } else {
      paymentStatus = 'PAID';
    }

    // 3. Generate sequential PO number
    const referenceNumber = await this.purchaseRepo.generateNextPurchaseNumber(shopId);

    // 4. Run database creation transaction
    const purchase = await this.purchaseRepo.createPurchase(shopId, userId, referenceNumber, {
      supplierId: dto.supplierId || null,
      purchaseDate: dto.purchaseDate || new Date(),
      expectedDate: dto.expectedDate || null,
      status: dto.status,
      subtotalCents,
      taxCents,
      discountCents,
      totalCents,
      paidCents,
      dueCents,
      paymentStatus,
      notes: dto.notes || null,
      items: purchaseItemsData,
      payment: dto.payment
        ? {
            amountCents: paidCents,
            method: dto.payment.method,
            reference: dto.payment.reference || null,
          }
        : undefined,
    });

    await AuditService.log({
      shopId,
      userId,
      action: 'purchase.created',
      entity: 'purchases',
      entityId: purchase.id,
      newValues: purchase as any,
    });

    return success(purchase);
  }

  async getPurchase(shopId: string, id: string): Promise<ServiceResult<any>> {
    const purchase = await this.purchaseRepo.findById(shopId, id);
    if (!purchase) {
      throw new NotFoundError('Purchase');
    }
    return success(purchase);
  }

  async listPurchases(shopId: string, query: PurchaseQueryDTO): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || PAGINATION_DEFAULTS.SORT_BY;
    const sortOrder = query.sortOrder || PAGINATION_DEFAULTS.SORT_ORDER;

    const { data, total } = await this.purchaseRepo.findAndCountPurchases(shopId, {
      search: query.search,
      status: query.status,
      paymentStatus: query.paymentStatus,
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

  async updatePurchaseStatus(
    shopId: string,
    id: string,
    userId: string,
    dto: UpdatePurchaseDTO,
  ): Promise<ServiceResult<any>> {
    if (!dto.status) {
      throw new ConflictError('Status is required for status transition update');
    }

    const updated = await this.purchaseRepo.updatePurchaseStatus(
      shopId,
      id,
      userId,
      dto.status,
      dto.notes || null,
    );

    await AuditService.log({
      shopId,
      userId,
      action: 'purchase.status_updated',
      entity: 'purchases',
      entityId: id,
      newValues: { status: dto.status } as any,
    });

    return success(updated);
  }

  async processReturn(
    shopId: string,
    id: string,
    userId: string,
    dto: ReturnPurchaseDTO,
  ): Promise<ServiceResult<any>> {
    const returnedPurchase = await this.purchaseRepo.processReturn(shopId, id, userId, {
      items: dto.items,
      refundAmountCents: dto.refundAmountCents || 0,
      notes: dto.notes || null,
    });

    await AuditService.log({
      shopId,
      userId,
      action: 'purchase.returned',
      entity: 'purchases',
      entityId: id,
      newValues: returnedPurchase as any,
    });

    return success(returnedPurchase);
  }
}
