import { PaymentRepository } from '@/repositories/payment.repository';
import { NotFoundError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type { CreatePaymentDTO, PaymentQueryDTO, RefundPaymentDTO } from '@/validators/payment.schema';
import { AuditService } from './audit.service';

export class PaymentService {
  constructor(private paymentRepo: PaymentRepository) {}

  async createPayment(shopId: string, userId: string, dto: CreatePaymentDTO): Promise<ServiceResult<any>> {
    const payment = await this.paymentRepo.createPayment(shopId, userId, {
      payableType: dto.payableType,
      payableId: dto.payableId,
      amountCents: dto.amountCents,
      method: dto.method,
      reference: dto.reference || null,
      notes: dto.notes || null,
    });

    await AuditService.log({
      shopId,
      userId,
      action: 'payment.created',
      entity: 'payments',
      entityId: payment.id,
      newValues: payment as any,
    });

    return success(payment);
  }

  async getPayment(shopId: string, id: string): Promise<ServiceResult<any>> {
    const payment = await this.paymentRepo.findById(shopId, id);
    if (!payment) {
      throw new NotFoundError('Payment');
    }
    return success(payment);
  }

  async listPayments(shopId: string, query: PaymentQueryDTO): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || PAGINATION_DEFAULTS.SORT_BY;
    const sortOrder = query.sortOrder || PAGINATION_DEFAULTS.SORT_ORDER;

    const { data, total } = await this.paymentRepo.findAndCountPayments(shopId, {
      payableType: query.payableType,
      payableId: query.payableId,
      type: query.type,
      method: query.method,
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

  async refundPayment(
    shopId: string,
    id: string,
    userId: string,
    dto: RefundPaymentDTO,
  ): Promise<ServiceResult<any>> {
    const refundPayment = await this.paymentRepo.refundPayment(shopId, id, userId, dto.notes || null);

    await AuditService.log({
      shopId,
      userId,
      action: 'payment.refunded',
      entity: 'payments',
      entityId: id,
      newValues: refundPayment as any,
    });

    return success(refundPayment);
  }
}
