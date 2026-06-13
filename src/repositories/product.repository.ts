import type { PrismaClient } from '@prisma/client';

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

  async updateCategory(_shopId: string, id: string, data: any) {
    return this.prisma.category.update({
      where: { id },
      data,
    });
  }

  async softDeleteCategory(_shopId: string, id: string) {
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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

  async updateProduct(_shopId: string, id: string, data: any) {
    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  async softDeleteProduct(_shopId: string, id: string) {
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findProducts(
    shopId: string,
    options: {
      search?: string;
      categoryId?: string | null;
      brand?: string;
      barcode?: string;
      isActive?: boolean;
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
}
