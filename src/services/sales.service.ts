import type { SalesRepository } from '@/repositories/sales.repository';
import type { ProductRepository } from '@/repositories/product.repository';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type { CreateSaleDTO, SaleQueryDTO, ReturnSaleDTO } from '@/validators/sales.schema';
import { AuditService } from './audit.service';
import { salesEvents } from '@/events/sales.events';
import { inventoryEvents } from '@/events/inventory.events';

export class SalesService {
  constructor(
    private salesRepo: SalesRepository,
    private productRepo: ProductRepository,
  ) {}

  async createSale(shopId: string, userId: string, dto: CreateSaleDTO): Promise<ServiceResult<any>> {
    // 1. Calculate pricing for all items
    const saleItemsData: any[] = [];
    let subtotalCents = 0;
    let totalItemDiscountCents = 0;
    let totalItemTaxCents = 0;

    for (const item of dto.items) {
      const product = await this.productRepo.findProductById(shopId, item.productId);
      if (!product) {
        throw new NotFoundError(`Product with ID ${item.productId}`);
      }

      if (product.stockQuantity < item.quantity) {
        throw new ConflictError(
          `Insufficient stock for product "${product.name}". Available: ${product.stockQuantity}, Requested: ${item.quantity}`,
        );
      }

      const unitPriceCents = product.sellPriceCents;

      // Calculate item discount
      let itemDiscountCents = 0;
      if (item.discountType === 'PERCENTAGE' && item.discountValue) {
        itemDiscountCents = Math.round(unitPriceCents * (item.discountValue / 100));
      } else if (item.discountType === 'FIXED' && item.discountValue) {
        itemDiscountCents = item.discountValue;
      }
      // Cap item discount at unit price
      itemDiscountCents = Math.min(unitPriceCents, itemDiscountCents);

      // Calculate item tax
      const taxRate = product.taxRate ? Number(product.taxRate) : 0;
      const taxablePrice = unitPriceCents - itemDiscountCents;
      const itemTaxCents = Math.round(taxablePrice * taxRate);

      const lineTotalCents = (unitPriceCents - itemDiscountCents + itemTaxCents) * item.quantity;

      subtotalCents += unitPriceCents * item.quantity;
      totalItemDiscountCents += itemDiscountCents * item.quantity;
      totalItemTaxCents += itemTaxCents * item.quantity;

      saleItemsData.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPriceCents,
        discountCents: itemDiscountCents * item.quantity,
        taxCents: itemTaxCents * item.quantity,
        totalCents: lineTotalCents,
      });
    }

    // 2. Calculate header-level discount
    let headerDiscountCents = 0;
    const remainingAfterItemDiscounts = subtotalCents - totalItemDiscountCents;

    if (dto.discountType === 'PERCENTAGE' && dto.discountValue) {
      headerDiscountCents = Math.round(remainingAfterItemDiscounts * (dto.discountValue / 100));
    } else if (dto.discountType === 'FIXED' && dto.discountValue) {
      headerDiscountCents = dto.discountValue;
    }
    // Cap header discount
    headerDiscountCents = Math.min(remainingAfterItemDiscounts, headerDiscountCents);

    const discountCents = totalItemDiscountCents + headerDiscountCents;
    const taxCents = totalItemTaxCents;
    const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);

    // 3. Payments, dues and payment status mapping
    let paidCents = dto.payment ? dto.payment.amountCents : 0;
    if (paidCents > totalCents) {
      paidCents = totalCents; // Cap payment at total amount
    }
    const dueCents = totalCents - paidCents;

    if (dueCents > 0 && !dto.customerId) {
      throw new ConflictError('A customer must be selected for credit sales (sales with outstanding due)');
    }

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

    // 4. Generate Seq invoice number
    const invoiceNumber = await this.salesRepo.generateNextInvoiceNumber(shopId);

    // 5. Database Transaction execution
    const sale = await this.salesRepo.createSale(shopId, userId, invoiceNumber, {
      customerId: dto.customerId || null,
      saleDate: dto.saleDate || new Date(),
      status: 'COMPLETED',
      subtotalCents,
      discountType: dto.discountType || null,
      discountValue: dto.discountValue || 0,
      discountCents,
      taxCents,
      totalCents,
      paidCents,
      dueCents,
      paymentStatus,
      notes: dto.notes || null,
      items: saleItemsData,
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
      action: 'sale.created',
      entity: 'sales',
      entityId: sale.id,
      newValues: sale as any,
    });

    salesEvents.created({
      shopId,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      customerId: sale.customerId ?? undefined,
      totalCents: sale.totalCents,
    });
    salesEvents.completed({
      shopId,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      totalCents: sale.totalCents,
    });

    for (const item of saleItemsData) {
      const product = await this.productRepo.findProductById(shopId, item.productId);
      if (product && product.stockQuantity <= product.lowStockThreshold) {
        inventoryEvents.lowStock({
          shopId,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock: product.stockQuantity,
          threshold: product.lowStockThreshold,
        });
      }
    }

    return success(sale);
  }

  async getSale(shopId: string, id: string): Promise<ServiceResult<any>> {
    const sale = await this.salesRepo.findById(shopId, id);
    if (!sale) {
      throw new NotFoundError('Sale');
    }
    return success(sale);
  }

  async listSales(shopId: string, query: SaleQueryDTO): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || PAGINATION_DEFAULTS.SORT_BY;
    const sortOrder = query.sortOrder || PAGINATION_DEFAULTS.SORT_ORDER;

    const { data, total } = await this.salesRepo.findAndCountSales(shopId, {
      search: query.search,
      status: query.status,
      paymentStatus: query.paymentStatus,
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

  async processReturn(
    shopId: string,
    saleId: string,
    userId: string,
    dto: ReturnSaleDTO,
  ): Promise<ServiceResult<any>> {
    const sale = await this.salesRepo.findById(shopId, saleId);
    if (!sale) {
      throw new NotFoundError('Sale');
    }

    if (sale.status === 'RETURNED' || sale.status === 'VOID') {
      throw new ConflictError('Sale is already returned or voided');
    }

    // Process return with repository transaction helper
    const updatedSale = await this.salesRepo.processReturn(shopId, saleId, userId, {
      items: dto.items,
      refundAmountCents: dto.refundAmountCents || 0,
      notes: dto.notes || null,
    });

    await AuditService.log({
      shopId,
      userId,
      action: 'sale.returned',
      entity: 'sales',
      entityId: sale.id,
      oldValues: sale as any,
      newValues: updatedSale as any,
    });

    return success(updatedSale);
  }
}
