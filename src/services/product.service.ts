import type { ProductRepository } from '@/repositories/product.repository';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import { generateSlug, generateUniqueSlug } from '@/utils/slug';
import type {
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CategoryQueryDTO,
  CreateProductDTO,
  UpdateProductDTO,
  ProductQueryDTO,
  StockMovementQueryDTO,
  StockAdjustmentDTO,
} from '@/validators/product.schema';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';
import { productEvents } from '@/events/product.events';

export class ProductService {
  constructor(private productRepo: ProductRepository) {}

  // ==========================================
  // Category Service Operations
  // ==========================================

  async createCategory(shopId: string, dto: CreateCategoryDTO, actorUserId?: string): Promise<ServiceResult<any>> {
    if (dto.parentId) {
      const parent = await this.productRepo.findCategoryById(shopId, dto.parentId);
      if (!parent) {
        throw new NotFoundError('Parent category');
      }
    }

    let slug = generateSlug(dto.name);
    const existing = await this.productRepo.findCategoryBySlug(shopId, slug);
    if (existing) {
      slug = generateUniqueSlug(dto.name);
    }

    const category = await this.productRepo.createCategory(shopId, {
      ...dto,
      slug,
    });

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'category.created',
      entity: 'categories',
      entityId: category.id,
      newValues: category as any,
    });

    return success(category);
  }

  async getCategory(shopId: string, id: string): Promise<ServiceResult<any>> {
    const category = await this.productRepo.findCategoryById(shopId, id);
    if (!category) {
      throw new NotFoundError('Category');
    }
    return success(category);
  }

  async updateCategory(
    shopId: string,
    id: string,
    dto: UpdateCategoryDTO,
    actorUserId?: string,
  ): Promise<ServiceResult<any>> {
    const category = await this.productRepo.findCategoryById(shopId, id);
    if (!category) {
      throw new NotFoundError('Category');
    }

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new ConflictError('A category cannot be its own parent');
      }
      const parent = await this.productRepo.findCategoryById(shopId, dto.parentId);
      if (!parent) {
        throw new NotFoundError('Parent category');
      }
    }

    const updateData: any = { ...dto };

    if (dto.name && dto.name !== category.name) {
      let slug = generateSlug(dto.name);
      const existing = await this.productRepo.findCategoryBySlug(shopId, slug);
      if (existing) {
        slug = generateUniqueSlug(dto.name);
      }
      updateData.slug = slug;
    }

    const updated = await this.productRepo.updateCategory(shopId, id, updateData);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'category.updated',
      entity: 'categories',
      entityId: category.id,
      oldValues: category as any,
      newValues: updated as any,
    });

    return success(updated);
  }

  async deleteCategory(shopId: string, id: string, actorUserId?: string): Promise<ServiceResult<void>> {
    const category = await this.productRepo.findCategoryById(shopId, id);
    if (!category) {
      throw new NotFoundError('Category');
    }

    await this.productRepo.softDeleteCategory(shopId, id);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'category.deleted',
      entity: 'categories',
      entityId: category.id,
      oldValues: category as any,
    });

    return success(undefined);
  }

  async listCategories(
    shopId: string,
    query: CategoryQueryDTO,
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || 'sortOrder';
    const sortOrder = query.sortOrder || 'asc';

    let parentId: string | null | undefined = undefined;
    if (query.parentId !== undefined) {
      parentId = query.parentId === 'null' ? null : query.parentId;
    }

    const { data, total } = await this.productRepo.findCategories(shopId, {
      search: query.search,
      parentId,
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

  async getCategoryTree(shopId: string): Promise<ServiceResult<any[]>> {
    const categories = await this.productRepo.findCategoriesAll(shopId);
    const categoryMap = new Map<string, any>();
    const roots: any[] = [];

    for (const cat of categories) {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        parentId: cat.parentId,
        sortOrder: cat.sortOrder,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        children: [],
      });
    }

    for (const cat of categories) {
      const node = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      for (const node of nodes) {
        if (node.children && node.children.length > 0) {
          sortNodes(node.children);
        }
      }
    };
    sortNodes(roots);

    return success(roots);
  }

  // ==========================================
  // Product Service Operations
  // ==========================================

  async createProduct(shopId: string, dto: CreateProductDTO, actorUserId?: string): Promise<ServiceResult<any>> {
    if (dto.categoryId) {
      const category = await this.productRepo.findCategoryById(shopId, dto.categoryId);
      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    const existingSku = await this.productRepo.findProductBySku(shopId, dto.sku);
    if (existingSku) {
      throw new ConflictError('A product with this SKU already exists in this shop');
    }

    let slug = generateSlug(dto.name);
    const existingSlug = await this.productRepo.findProductBySlug(shopId, slug);
    if (existingSlug) {
      slug = generateUniqueSlug(dto.name);
    }

    const product = await this.productRepo.createProduct(shopId, {
      ...dto,
      slug,
    });

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'product.created',
      entity: 'products',
      entityId: product.id,
      newValues: product as any,
    });

    return success(product);
  }

  async getProduct(shopId: string, id: string): Promise<ServiceResult<any>> {
    const cacheKey = CacheService.buildKey(shopId, 'inventory', 'product', id);
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) {
      return success(cached);
    }

    const product = await this.productRepo.findProductById(shopId, id);
    if (!product) {
      throw new NotFoundError('Product');
    }

    await CacheService.set(cacheKey, product, 300);
    return success(product);
  }

  async updateProduct(
    shopId: string,
    id: string,
    dto: UpdateProductDTO,
    actorUserId?: string,
  ): Promise<ServiceResult<any>> {
    const product = await this.productRepo.findProductById(shopId, id);
    if (!product) {
      throw new NotFoundError('Product');
    }

    if (dto.categoryId) {
      const category = await this.productRepo.findCategoryById(shopId, dto.categoryId);
      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    if (dto.sku && dto.sku !== product.sku) {
      const existingSku = await this.productRepo.findProductBySku(shopId, dto.sku);
      if (existingSku) {
        throw new ConflictError('A product with this SKU already exists in this shop');
      }
    }

    const updateData: any = { ...dto };

    if (dto.name && dto.name !== product.name) {
      let slug = generateSlug(dto.name);
      const existingSlug = await this.productRepo.findProductBySlug(shopId, slug);
      if (existingSlug) {
        slug = generateUniqueSlug(dto.name);
      }
      updateData.slug = slug;
    }

    const updated = await this.productRepo.updateProduct(shopId, id, updateData);

    await CacheService.del(CacheService.buildKey(shopId, 'inventory', 'product', id));

    productEvents.updated({
      shopId,
      productId: id,
      changes: dto as Record<string, unknown>,
    });

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'product.updated',
      entity: 'products',
      entityId: product.id,
      oldValues: product as any,
      newValues: updated as any,
    });

    return success(updated);
  }

  async deleteProduct(shopId: string, id: string, actorUserId?: string): Promise<ServiceResult<void>> {
    const product = await this.productRepo.findProductById(shopId, id);
    if (!product) {
      throw new NotFoundError('Product');
    }

    await this.productRepo.softDeleteProduct(shopId, id);

    await CacheService.del(CacheService.buildKey(shopId, 'inventory', 'product', id));

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'product.deleted',
      entity: 'products',
      entityId: product.id,
      oldValues: product as any,
    });

    return success(undefined);
  }

  async listProducts(
    shopId: string,
    query: ProductQueryDTO,
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || PAGINATION_DEFAULTS.SORT_BY;
    const sortOrder = query.sortOrder || PAGINATION_DEFAULTS.SORT_ORDER;

    const { data, total } = await this.productRepo.findProducts(shopId, {
      search: query.search,
      categoryId: query.categoryId,
      brand: query.brand,
      barcode: query.barcode,
      isActive: query.isActive,
      lowStock: query.lowStock,
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

  async getBrands(shopId: string): Promise<ServiceResult<string[]>> {
    const brands = await this.productRepo.getUniqueBrands(shopId);
    return success(brands);
  }

  async getUnits(shopId: string): Promise<ServiceResult<string[]>> {
    const defaultUnits = ['pcs', 'kg', 'gm', 'ltr', 'ml', 'box', 'pack', 'dozen', 'ft', 'yd'];
    const dbUnits = await this.productRepo.getUniqueUnits(shopId);
    const allUnits = Array.from(new Set([...defaultUnits, ...dbUnits]));
    return success(allUnits);
  }

  async listStockMovements(
    shopId: string,
    productId: string,
    query: StockMovementQueryDTO,
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const product = await this.productRepo.findProductById(shopId, productId);
    if (!product) {
      throw new NotFoundError('Product');
    }

    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const { data, total } = await this.productRepo.findStockMovements(shopId, productId, {
      limit,
      cursor: query.cursor,
    });

    const meta = buildPaginationMeta(total, limit, data, query.cursor);

    return success({ data, meta });
  }

  async adjustStock(
    shopId: string,
    productId: string,
    dto: StockAdjustmentDTO,
    actorUserId?: string,
  ): Promise<ServiceResult<any>> {
    const result = await this.productRepo.adjustStock(shopId, productId, actorUserId || '', {
      type: dto.type,
      quantity: dto.quantity,
      notes: dto.notes,
    });

    await CacheService.del(CacheService.buildKey(shopId, 'inventory', 'product', productId));

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'stock.adjusted',
      entity: 'stock_movements',
      entityId: result.movement.id,
      newValues: result.movement as any,
    });

    return success(result);
  }
}
