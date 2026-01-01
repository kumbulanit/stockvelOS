import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  StockQueryDto,
  StockMovementQueryDto,
  CreateAdjustmentDto,
  StockLevelResponseDto,
  StockMovementResponseDto,
} from '../dto/stock.dto';
import { StockMovementType, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';

export interface CreateStockMovementInput {
  groupId: string;
  productId: string;
  movementType: StockMovementType;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  createdById?: string;
}

@Injectable()
export class StockService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Get current stock levels for a group
   */
  async getCurrentStock(
    groupId: string,
    query: StockQueryDto,
  ): Promise<StockLevelResponseDto[]> {
    // Build the raw query for aggregated stock
    const stockLevels = await this.prisma.$queryRaw<
      {
        product_id: string;
        product_name: string;
        unit: string;
        category: string;
        current_quantity: Decimal;
        last_movement_at: Date | null;
      }[]
    >`
      SELECT 
        gsm.product_id,
        gp.name AS product_name,
        gp.unit,
        gp.category,
        COALESCE(SUM(
          CASE 
            WHEN gsm.movement_type = 'IN' THEN gsm.quantity
            WHEN gsm.movement_type = 'OUT' THEN -gsm.quantity
            WHEN gsm.movement_type = 'ADJUSTMENT' THEN gsm.quantity
          END
        ), 0) AS current_quantity,
        MAX(gsm.created_at) AS last_movement_at
      FROM grocery_stock_movements gsm
      JOIN grocery_products gp ON gp.id = gsm.product_id
      WHERE gsm.group_id = ${groupId}::uuid
        AND gp.active = true
        ${query.category ? Prisma.sql`AND gp.category = ${query.category}::"GroceryCategory"` : Prisma.empty}
        ${query.search ? Prisma.sql`AND gp.name ILIKE ${'%' + query.search + '%'}` : Prisma.empty}
      GROUP BY gsm.product_id, gp.name, gp.unit, gp.category
      ORDER BY gp.category, gp.name
    `;

    return stockLevels.map((level) => ({
      productId: level.product_id,
      productName: level.product_name,
      unit: level.unit,
      category: level.category as any,
      currentQuantity: Number(level.current_quantity),
      lastMovementAt: level.last_movement_at,
    }));
  }

  /**
   * Get stock level for a specific product
   */
  async getProductStock(groupId: string, productId: string): Promise<number> {
    const result = await this.prisma.$queryRaw<{ current_quantity: Decimal }[]>`
      SELECT COALESCE(SUM(
        CASE 
          WHEN movement_type = 'IN' THEN quantity
          WHEN movement_type = 'OUT' THEN -quantity
          WHEN movement_type = 'ADJUSTMENT' THEN quantity
        END
      ), 0) AS current_quantity
      FROM grocery_stock_movements
      WHERE group_id = ${groupId}::uuid
        AND product_id = ${productId}::uuid
    `;

    return Number(result[0]?.current_quantity || 0);
  }

  /**
   * Check if sufficient stock is available
   */
  async checkAvailability(
    groupId: string,
    productId: string,
    requiredQuantity: number,
  ): Promise<{ available: boolean; currentStock: number }> {
    const currentStock = await this.getProductStock(groupId, productId);
    return {
      available: currentStock >= requiredQuantity,
      currentStock,
    };
  }

  /**
   * Create a stock movement (IN, OUT, or ADJUSTMENT)
   */
  async createMovement(input: CreateStockMovementInput): Promise<any> {
    // For OUT movements, validate stock availability
    if (input.movementType === 'OUT') {
      const { available, currentStock } = await this.checkAvailability(
        input.groupId,
        input.productId,
        input.quantity,
      );

      if (!available) {
        throw new BadRequestException(
          `Insufficient stock. Current: ${currentStock}, Required: ${input.quantity}`,
        );
      }
    }

    // For ADJUSTMENT, calculate the signed quantity
    // Positive adjustment = add stock, Negative = remove stock
    // But we still need to prevent going negative
    if (input.movementType === 'ADJUSTMENT' && input.quantity < 0) {
      const currentStock = await this.getProductStock(
        input.groupId,
        input.productId,
      );
      if (currentStock + input.quantity < 0) {
        throw new BadRequestException(
          `Adjustment would result in negative stock. Current: ${currentStock}, Adjustment: ${input.quantity}`,
        );
      }
    }

    const movement = await this.prisma.groceryStockMovement.create({
      data: {
        groupId: input.groupId,
        productId: input.productId,
        movementType: input.movementType,
        quantity: new Prisma.Decimal(Math.abs(input.quantity)),
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        reason: input.reason,
        createdById: input.createdById,
      },
      include: {
        product: {
          select: { name: true, unit: true },
        },
      },
    });

    return movement;
  }

  /**
   * Create stock IN movements for a purchase
   */
  async createPurchaseMovements(
    groupId: string,
    purchaseId: string,
    items: { productId: string; quantity: number }[],
    createdById: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.groceryStockMovement.create({
          data: {
            groupId,
            productId: item.productId,
            movementType: 'IN',
            quantity: new Prisma.Decimal(item.quantity),
            referenceType: 'PURCHASE',
            referenceId: purchaseId,
            createdById,
          },
        });
      }
    });
  }

  /**
   * Create stock OUT movement for a distribution item
   */
  async createDistributionMovement(
    groupId: string,
    productId: string,
    distributionItemId: string,
    quantity: number,
    createdById: string,
  ): Promise<void> {
    await this.createMovement({
      groupId,
      productId,
      movementType: 'OUT',
      quantity,
      referenceType: 'DISTRIBUTION_ITEM',
      referenceId: distributionItemId,
      createdById,
    });
  }

  /**
   * Create stock ADJUSTMENT
   */
  async createAdjustment(
    groupId: string,
    dto: CreateAdjustmentDto,
    userId: string,
  ): Promise<StockMovementResponseDto> {
    const product = await this.prisma.groceryProduct.findFirst({
      where: { id: dto.productId, groupId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const movement = await this.createMovement({
      groupId,
      productId: dto.productId,
      movementType: 'ADJUSTMENT',
      quantity: dto.quantity,
      reason: dto.reason,
      createdById: userId,
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_STOCK_ADJUSTMENT',
      resourceType: 'GROCERY_STOCK_MOVEMENT',
      resourceId: movement.id,
      groupId,
      afterState: {
        productId: dto.productId,
        productName: product.name,
        quantity: dto.quantity,
        reason: dto.reason,
      },
      outcome: 'SUCCESS',
    });

    return this.mapMovementToResponse(movement);
  }

  /**
   * Get stock movement history
   */
  async getMovements(
    groupId: string,
    query: StockMovementQueryDto,
  ): Promise<{ movements: StockMovementResponseDto[]; total: number }> {
    const where: any = { groupId };

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.movementType) {
      where.movementType = query.movementType;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [movements, total] = await Promise.all([
      this.prisma.groceryStockMovement.findMany({
        where,
        include: {
          product: { select: { name: true, unit: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.groceryStockMovement.count({ where }),
    ]);

    return {
      movements: movements.map((m) => this.mapMovementToResponse(m)),
      total,
    };
  }

  private mapMovementToResponse(movement: any): StockMovementResponseDto {
    return {
      id: movement.id,
      groupId: movement.groupId,
      productId: movement.productId,
      productName: movement.product?.name || 'Unknown',
      movementType: movement.movementType,
      quantity: Number(movement.quantity),
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      reason: movement.reason,
      createdBy: movement.createdBy
        ? {
            id: movement.createdBy.id,
            firstName: movement.createdBy.firstName,
            lastName: movement.createdBy.lastName,
          }
        : null,
      createdAt: movement.createdAt,
    };
  }
}
