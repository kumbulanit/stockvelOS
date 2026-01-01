import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  ProductResponseDto,
} from '../dto/product.dto';
import { GroceryCategory } from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(
    groupId: string,
    dto: CreateProductDto,
    userId: string,
  ): Promise<ProductResponseDto> {
    // Check for duplicate product name in group
    const existing = await this.prisma.groceryProduct.findFirst({
      where: {
        groupId,
        name: { equals: dto.name, mode: 'insensitive' },
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Product "${dto.name}" already exists in this group`,
      );
    }

    const product = await this.prisma.groceryProduct.create({
      data: {
        groupId,
        name: dto.name,
        unit: dto.unit,
        category: dto.category,
        defaultSize: dto.defaultSize,
      },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_PRODUCT_CREATED',
      resourceType: 'GROCERY_PRODUCT',
      resourceId: product.id,
      groupId,
      afterState: product,
      outcome: 'SUCCESS',
    });

    return this.mapToResponse(product);
  }

  async findAll(
    groupId: string,
    query: ProductQueryDto,
  ): Promise<{ products: ProductResponseDto[]; total: number }> {
    const where: any = {
      groupId,
      deletedAt: null,
    };

    if (query.category) {
      where.category = query.category;
    }

    if (query.active !== undefined) {
      where.active = query.active;
    }

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [products, total] = await Promise.all([
      this.prisma.groceryProduct.findMany({
        where,
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.groceryProduct.count({ where }),
    ]);

    return {
      products: products.map((p) => this.mapToResponse(p)),
      total,
    };
  }

  async findById(groupId: string, productId: string): Promise<ProductResponseDto> {
    const product = await this.prisma.groceryProduct.findFirst({
      where: {
        id: productId,
        groupId,
        deletedAt: null,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapToResponse(product);
  }

  async update(
    groupId: string,
    productId: string,
    dto: UpdateProductDto,
    userId: string,
  ): Promise<ProductResponseDto> {
    const existing = await this.prisma.groceryProduct.findFirst({
      where: {
        id: productId,
        groupId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    // Check for name conflict if changing name
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.groceryProduct.findFirst({
        where: {
          groupId,
          name: { equals: dto.name, mode: 'insensitive' },
          id: { not: productId },
          deletedAt: null,
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `Product "${dto.name}" already exists in this group`,
        );
      }
    }

    const updated = await this.prisma.groceryProduct.update({
      where: { id: productId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.unit && { unit: dto.unit }),
        ...(dto.category && { category: dto.category }),
        ...(dto.defaultSize !== undefined && { defaultSize: dto.defaultSize }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_PRODUCT_UPDATED',
      resourceType: 'GROCERY_PRODUCT',
      resourceId: productId,
      groupId,
      beforeState: existing,
      afterState: updated,
      outcome: 'SUCCESS',
    });

    return this.mapToResponse(updated);
  }

  async softDelete(
    groupId: string,
    productId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.groceryProduct.findFirst({
      where: {
        id: productId,
        groupId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    // Check if product has any stock movements or purchase items
    const hasReferences = await this.prisma.groceryStockMovement.findFirst({
      where: { productId },
    });

    if (hasReferences) {
      // Cannot delete - just deactivate
      await this.prisma.groceryProduct.update({
        where: { id: productId },
        data: { active: false },
      });

      await this.auditService.log({
        actorId: userId,
        actorType: 'USER',
        action: 'GROCERY_PRODUCT_DEACTIVATED',
        resourceType: 'GROCERY_PRODUCT',
        resourceId: productId,
        groupId,
        metadata: { reason: 'Product has stock history - deactivated instead of deleted' },
        outcome: 'SUCCESS',
      });

      throw new BadRequestException(
        'Product has stock history and cannot be deleted. It has been deactivated instead.',
      );
    }

    // Soft delete
    await this.prisma.groceryProduct.update({
      where: { id: productId },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_PRODUCT_DELETED',
      resourceType: 'GROCERY_PRODUCT',
      resourceId: productId,
      groupId,
      beforeState: existing,
      outcome: 'SUCCESS',
    });
  }

  async getCategories(): Promise<GroceryCategory[]> {
    return Object.values(GroceryCategory);
  }

  private mapToResponse(product: any): ProductResponseDto {
    return {
      id: product.id,
      groupId: product.groupId,
      name: product.name,
      unit: product.unit,
      category: product.category,
      defaultSize: product.defaultSize ? Number(product.defaultSize) : null,
      active: product.active,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
