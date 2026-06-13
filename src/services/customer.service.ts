import { CustomerRepository } from '@/repositories/customer.repository';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type { CreateCustomerDTO, UpdateCustomerDTO, CustomerQueryDTO } from '@/validators/customer.schema';
import { AuditService } from './audit.service';

export class CustomerService {
  constructor(private customerRepo: CustomerRepository) {}

  async createCustomer(shopId: string, dto: CreateCustomerDTO, actorUserId?: string): Promise<ServiceResult<any>> {
    // Check if phone already exists to avoid duplicate entries in the same shop
    if (dto.phone) {
      const existing = await this.customerRepo.findByPhone(shopId, dto.phone);
      if (existing) {
        throw new ConflictError('A customer with this phone number already exists in this shop');
      }
    }

    const customer = await this.customerRepo.create(shopId, dto);

    // Audit Log
    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'customer.created',
      entity: 'customers',
      entityId: customer.id,
      newValues: customer as any,
    });

    return success(customer);
  }

  async getCustomer(shopId: string, id: string): Promise<ServiceResult<any>> {
    const customer = await this.customerRepo.findById(shopId, id);
    if (!customer) {
      throw new NotFoundError('Customer');
    }
    return success(customer);
  }

  async updateCustomer(
    shopId: string,
    id: string,
    dto: UpdateCustomerDTO,
    actorUserId?: string,
  ): Promise<ServiceResult<any>> {
    const customer = await this.customerRepo.findById(shopId, id);
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    // Phone collision check
    if (dto.phone && dto.phone !== customer.phone) {
      const existing = await this.customerRepo.findByPhone(shopId, dto.phone);
      if (existing) {
        throw new ConflictError('A customer with this phone number already exists in this shop');
      }
    }

    const updated = await this.customerRepo.update(shopId, id, dto);

    // Audit Log
    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'customer.updated',
      entity: 'customers',
      entityId: customer.id,
      oldValues: customer as any,
      newValues: updated as any,
    });

    return success(updated);
  }

  async deleteCustomer(shopId: string, id: string, actorUserId?: string): Promise<ServiceResult<void>> {
    const customer = await this.customerRepo.findById(shopId, id);
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    await this.customerRepo.softDelete(shopId, id);

    // Audit Log
    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'customer.deleted',
      entity: 'customers',
      entityId: customer.id,
      oldValues: customer as any,
    });

    return success(undefined);
  }

  async listCustomers(
    shopId: string,
    query: CustomerQueryDTO,
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || PAGINATION_DEFAULTS.SORT_BY;
    const sortOrder = query.sortOrder || PAGINATION_DEFAULTS.SORT_ORDER;

    const { data, total } = await this.customerRepo.findAndCount(shopId, {
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
}
