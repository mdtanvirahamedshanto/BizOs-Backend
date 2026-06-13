import type { PrismaClient } from '@prisma/client';

export class ShopRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.shop.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.shop.findFirst({
      where: { slug, deletedAt: null },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.shop.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return this.prisma.shop.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
