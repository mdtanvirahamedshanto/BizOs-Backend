import { ShopRepository } from '@/repositories/shop.repository';
import { NotFoundError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import type { UpdateShopDTO, UpdateShopSettingsDTO } from '@/validators/shop.schema';

export class ShopService {
  constructor(private shopRepo: ShopRepository) {}

  async getShop(id: string): Promise<ServiceResult<any>> {
    const shop = await this.shopRepo.findById(id);
    if (!shop) {
      throw new NotFoundError('Shop');
    }
    return success(shop);
  }

  async updateShop(id: string, dto: UpdateShopDTO): Promise<ServiceResult<any>> {
    const shop = await this.shopRepo.findById(id);
    if (!shop) {
      throw new NotFoundError('Shop');
    }

    const updated = await this.shopRepo.update(id, dto);
    return success(updated);
  }

  async updateSettings(id: string, dto: UpdateShopSettingsDTO): Promise<ServiceResult<any>> {
    const shop = await this.shopRepo.findById(id);
    if (!shop) {
      throw new NotFoundError('Shop');
    }

    const updated = await this.shopRepo.update(id, {
      settings: dto.settings,
    });
    return success(updated);
  }

  async deleteShop(id: string): Promise<ServiceResult<void>> {
    const shop = await this.shopRepo.findById(id);
    if (!shop) {
      throw new NotFoundError('Shop');
    }

    await this.shopRepo.softDelete(id);
    return success(undefined);
  }
}
