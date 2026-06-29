import type { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError } from '@/utils/errors';

export class ProductRepository {
  constructor(private prisma: PrismaClient) {}

  // ==========================================
  // Category Operations
  // ==========================================

  async createCategory(shopId: string, data: any) {
    return this.prisma.category.create({
      data: {
        ...data,
        shopId,
      },
    });
  }

  async findCategoryById(shopId: string, id: string) {
    return this.prisma.category.findFirst({
      where: { id, shopId, deletedAt: null },
    });
  }

  async findCategoryBySlug(shopId: string, slug: string) {
    return this.prisma.category.findFirst({
      where: { slug, shopId, deletedAt: null },
    });
  }

  async updateCategory(shopId: string, id: string, data: any) {
    const { count } = await this.prisma.category.updateMany({
      where: { id, shopId },
      data,
    });
    if (count === 0) throw new NotFoundError('Category');
    return this.prisma.category.findFirst({ where: { id, shopId } });
  }

  async softDeleteCategory(shopId: string, id: string) {
    const { count } = await this.prisma.category.updateMany({
      where: { id, shopId },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new NotFoundError('Category');
    return this.prisma.category.findFirst({ where: { id, shopId } });
  }

  async findCategories(
    shopId: string,
    options: {
      search?: string;
      parentId?: string | null;
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const whereClause: any = { shopId, deletedAt: null };

    if (options.search) {
      whereClause.name = { contains: options.search, mode: 'insensitive' };
    }

    if (options.parentId !== undefined) {
      whereClause.parentId = options.parentId;
    }

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { [options.sortBy || 'sortOrder']: options.sortOrder || 'asc' },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.category.findMany(queryOptions),
      this.prisma.category.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async findCategoriesAll(shopId: string) {
    return this.prisma.category.findMany({
      where: { shopId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ==========================================
  // Product Operations
  // ==========================================

  async createProduct(shopId: string, data: any) {
    return this.prisma.product.create({
      data: {
        ...data,
        shopId,
      },
    });
  }

  async findProductById(shopId: string, id: string) {
    return this.prisma.product.findFirst({
      where: { id, shopId, deletedAt: null },
      include: { category: true },
    });
  }

  async findProductBySku(shopId: string, sku: string) {
    return this.prisma.product.findFirst({
      where: { sku, shopId, deletedAt: null },
    });
  }

  async findProductBySlug(shopId: string, slug: string) {
    return this.prisma.product.findFirst({
      where: { slug, shopId, deletedAt: null },
    });
  }

  async updateProduct(shopId: string, id: string, data: any) {
    const { count } = await this.prisma.product.updateMany({
      where: { id, shopId },
      data,
    });
    if (count === 0) throw new NotFoundError('Product');
    return this.prisma.product.findFirst({ where: { id, shopId }, include: { category: true } });
  }

  async softDeleteProduct(shopId: string, id: string) {
    const { count } = await this.prisma.product.updateMany({
      where: { id, shopId },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new NotFoundError('Product');
    return this.prisma.product.findFirst({ where: { id, shopId } });
  }

  async findProducts(
    shopId: string,
    options: {
      search?: string;
      categoryId?: string | null;
      brand?: string;
      barcode?: string;
      isActive?: boolean;
      lowStock?: boolean;
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const whereClause: any = { shopId, deletedAt: null };

    if (options.search) {
      whereClause.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { sku: { contains: options.search, mode: 'insensitive' } },
        { brand: { contains: options.search, mode: 'insensitive' } },
        { barcode: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    if (options.categoryId !== undefined && options.categoryId !== null) {
      whereClause.categoryId = options.categoryId;
    }

    if (options.brand !== undefined) {
      whereClause.brand = { equals: options.brand, mode: 'insensitive' };
    }

    if (options.barcode !== undefined) {
      whereClause.barcode = options.barcode;
    }

    if (options.isActive !== undefined) {
      whereClause.isActive = options.isActive;
    }

    if (options.lowStock) {
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          stockQuantity: {
            lte: this.prisma.product.fields.lowStockThreshold,
          },
        },
      ];
    }

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { [options.sortBy || 'createdAt']: options.sortOrder || 'desc' },
      include: { category: true },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany(queryOptions),
      this.prisma.product.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async getUniqueBrands(shopId: string): Promise<string[]> {
    const result = await this.prisma.product.groupBy({
      by: ['brand'],
      where: {
        shopId,
        deletedAt: null,
        brand: { not: null },
      },
    });
    return result.map((r) => r.brand as string).filter(Boolean);
  }

  async getUniqueUnits(shopId: string): Promise<string[]> {
    const result = await this.prisma.product.groupBy({
      by: ['unit'],
      where: {
        shopId,
        deletedAt: null,
      },
    });
    return result.map((r) => r.unit).filter(Boolean);
  }

  async findOrCreateQuickSaleProduct(shopId: string) {
    const existing = await this.prisma.product.findFirst({
      where: { shopId, sku: 'QUICK-SALE', deletedAt: null },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.product.create({
      data: {
        shopId,
        name: 'Quick Sale',
        slug: 'quick-sale',
        sku: 'QUICK-SALE',
        sellPriceCents: 0,
        costPriceCents: 0,
        stockQuantity: 999_999,
        lowStockThreshold: 0,
        isActive: true,
      },
    });
  }

  async findStockMovements(
    shopId: string,
    productId: string,
    options: { limit: number; cursor?: string },
  ) {
    const whereClause = { shopId, productId };

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany(queryOptions),
      this.prisma.stockMovement.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async adjustStock(
    shopId: string,
    productId: string,
    userId: string,
    data: { type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'DAMAGE'; quantity: number; notes?: string | null },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, shopId, deletedAt: null },
      });

      if (!product) {
        throw new NotFoundError('Product');
      }

      let delta = data.quantity;
      if (data.type === 'OUT' || data.type === 'DAMAGE') {
        delta = -Math.abs(data.quantity);
      } else {
        delta = Math.abs(data.quantity);
      }

      const newStock = product.stockQuantity + delta;
      if (newStock < 0) {
        throw new ConflictError('Insufficient stock for this adjustment');
      }

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: newStock },
        include: { category: true },
      });

      const movement = await tx.stockMovement.create({
        data: {
          shopId,
          productId,
          type: data.type,
          quantity: delta,
          unitCostCents: product.costPriceCents,
          referenceType: 'adjustment',
          notes: data.notes,
          createdBy: userId,
        },
        include: {
          creator: { select: { id: true, name: true } },
        },
      });

      return { product: updatedProduct, movement, balanceAfter: newStock };
    });
  }
}
