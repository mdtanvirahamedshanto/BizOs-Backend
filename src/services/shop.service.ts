import { ShopRepository } from '@/repositories/shop.repository';
import { NotFoundError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import type { UpdateShopDTO, UpdateShopSettingsDTO } from '@/validators/shop.schema';
import { AuditService } from './audit.service';

export class ShopService {
  constructor(private shopRepo: ShopRepository) {}

  async getShop(id: string): Promise<ServiceResult<any>> {
    const shop = await this.shopRepo.findById(id);
    if (!shop) {
      throw new NotFoundError('Shop');
    }
    return success(shop);
  }

  async updateShop(id: string, dto: UpdateShopDTO, actorUserId?: string): Promise<ServiceResult<any>> {
    const shop = await this.shopRepo.findById(id);
    if (!shop) {
      throw new NotFoundError('Shop');
    }

    const updated = await this.shopRepo.update(id, dto);

    await AuditService.log({
      shopId: id,
      userId: actorUserId,
      action: 'shop.updated',
      entity: 'shops',
      entityId: id,
      oldValues: shop as any,
      newValues: updated as any,
    });

    return success(updated);
  }

  async updateSettings(
    id: string,
    dto: UpdateShopSettingsDTO,
    actorUserId?: string,
  ): Promise<ServiceResult<any>> {
    const shop = await this.shopRepo.findById(id);
    if (!shop) {
      throw new NotFoundError('Shop');
    }

    const updated = await this.shopRepo.update(id, {
      settings: dto.settings,
    });

    await AuditService.log({
      shopId: id,
      userId: actorUserId,
      action: 'shop.settings_updated',
      entity: 'shops',
      entityId: id,
      oldValues: { settings: shop.settings },
      newValues: { settings: updated.settings },
    });

    return success(updated);
  }

  async deleteShop(id: string, actorUserId?: string): Promise<ServiceResult<void>> {
    const shop = await this.shopRepo.findById(id);
    if (!shop) {
      throw new NotFoundError('Shop');
    }

    await this.shopRepo.softDelete(id);

    await AuditService.log({
      shopId: id,
      userId: actorUserId,
      action: 'shop.deleted',
      entity: 'shops',
      entityId: id,
      oldValues: shop as any,
    });

    return success(undefined);
  }
}
