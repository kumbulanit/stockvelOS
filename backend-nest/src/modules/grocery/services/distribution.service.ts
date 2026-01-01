import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { StockService } from './stock.service';
import {
  CreateDistributionDto,
  UpdateDistributionStatusDto,
  UpdateDistributionItemStatusDto,
  ConfirmDistributionItemDto,
  DistributionQueryDto,
  DistributionResponseDto,
  DistributionItemResponseDto,
  MemberAllocationResponseDto,
  MemberHistoryResponseDto,
  MemberFairnessSummaryDto,
} from '../dto/distribution.dto';
import {
  GroceryDistributionStatus,
  DistributionItemStatus,
  AllocationRule,
  Prisma,
} from '@prisma/client';
import { Decimal } from 'decimal.js';

@Injectable()
export class DistributionService {
  private readonly IDEMPOTENCY_TTL_DAYS = 7;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
    private stockService: StockService,
  ) {}

  async create(
    groupId: string,
    dto: CreateDistributionDto,
    userId: string,
  ): Promise<DistributionResponseDto> {
    // Get active members for distribution
    const activeMembers = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        status: 'ACTIVE',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (activeMembers.length === 0) {
      throw new BadRequestException('No active members in group');
    }

    // Validate stock availability for all products
    for (const product of dto.products) {
      const { available, currentStock } = await this.stockService.checkAvailability(
        groupId,
        product.productId,
        product.totalQuantity,
      );

      if (!available) {
        const productInfo = await this.prisma.groceryProduct.findUnique({
          where: { id: product.productId },
          select: { name: true },
        });
        throw new BadRequestException(
          `Insufficient stock for ${productInfo?.name || 'product'}. ` +
            `Available: ${currentStock}, Requested: ${product.totalQuantity}`,
        );
      }
    }

    // Calculate allocations based on rule
    const allocations = this.calculateAllocations(
      activeMembers,
      dto.products,
      dto.allocationRule || AllocationRule.EQUAL_SHARE,
      dto.overrides || [],
    );

    // Create distribution with items in transaction
    const distribution = await this.prisma.$transaction(async (tx) => {
      const newDistribution = await tx.groceryDistribution.create({
        data: {
          groupId,
          createdById: userId,
          distributionDate: new Date(dto.distributionDate),
          allocationRule: dto.allocationRule || AllocationRule.EQUAL_SHARE,
          notes: dto.notes,
          status: 'ACTIVE',
        },
      });

      // Create distribution items
      const itemsData: Prisma.GroceryDistributionItemCreateManyInput[] = [];
      for (const allocation of allocations) {
        itemsData.push({
          distributionId: newDistribution.id,
          memberId: allocation.memberId,
          productId: allocation.productId,
          quantityAllocated: new Prisma.Decimal(allocation.quantity),
          quantityOverride: allocation.override
            ? new Prisma.Decimal(allocation.override.quantity)
            : null,
          overrideReason: allocation.override?.reason,
          status: 'PENDING',
        });
      }

      await tx.groceryDistributionItem.createMany({ data: itemsData });

      return newDistribution;
    });

    // Log audit for overrides
    if (dto.overrides && dto.overrides.length > 0) {
      await this.auditService.log({
        actorId: userId,
        actorType: 'USER',
        action: 'GROCERY_DISTRIBUTION_OVERRIDES',
        resourceType: 'GROCERY_DISTRIBUTION',
        resourceId: distribution.id,
        groupId,
        afterState: { overrides: dto.overrides },
        outcome: 'SUCCESS',
      });
    }

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_DISTRIBUTION_CREATED',
      resourceType: 'GROCERY_DISTRIBUTION',
      resourceId: distribution.id,
      groupId,
      afterState: {
        distributionDate: dto.distributionDate,
        allocationRule: dto.allocationRule,
        productCount: dto.products.length,
        memberCount: activeMembers.length,
      },
      outcome: 'SUCCESS',
    });

    // Notify all members
    for (const member of activeMembers) {
      await this.notificationsService.create({
        userId: member.userId,
        groupId,
        type: 'GROCERY_DISTRIBUTION_CREATED',
        title: 'New Distribution Available',
        body: `Groceries are ready for collection on ${dto.distributionDate}`,
        channel: 'PUSH',
        data: { distributionId: distribution.id },
      });
    }

    return this.findById(groupId, distribution.id);
  }

  async findAll(
    groupId: string,
    query: DistributionQueryDto,
  ): Promise<{ distributions: DistributionResponseDto[]; total: number }> {
    const where: any = {
      groupId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.distributionDate = {};
      if (query.startDate) {
        where.distributionDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.distributionDate.lte = new Date(query.endDate);
      }
    }

    const [distributions, total] = await Promise.all([
      this.prisma.groceryDistribution.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          items: {
            include: {
              member: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
              product: { select: { name: true, unit: true } },
              confirmedBy: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { distributionDate: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.groceryDistribution.count({ where }),
    ]);

    return {
      distributions: distributions.map((d) => this.mapToResponse(d)),
      total,
    };
  }

  async findById(groupId: string, distributionId: string): Promise<DistributionResponseDto> {
    const distribution = await this.prisma.groceryDistribution.findFirst({
      where: {
        id: distributionId,
        groupId,
        deletedAt: null,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            member: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            product: { select: { name: true, unit: true } },
            confirmedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!distribution) {
      throw new NotFoundException('Distribution not found');
    }

    return this.mapToResponse(distribution);
  }

  async updateStatus(
    groupId: string,
    distributionId: string,
    dto: UpdateDistributionStatusDto,
    userId: string,
  ): Promise<DistributionResponseDto> {
    const distribution = await this.prisma.groceryDistribution.findFirst({
      where: { id: distributionId, groupId, deletedAt: null },
    });

    if (!distribution) {
      throw new NotFoundException('Distribution not found');
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['ACTIVE', 'CANCELLED'],
      ACTIVE: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[distribution.status]?.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${distribution.status} to ${dto.status}`,
      );
    }

    await this.prisma.groceryDistribution.update({
      where: { id: distributionId },
      data: { status: dto.status },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_DISTRIBUTION_STATUS_UPDATED',
      resourceType: 'GROCERY_DISTRIBUTION',
      resourceId: distributionId,
      groupId,
      beforeState: { status: distribution.status },
      afterState: { status: dto.status },
      outcome: 'SUCCESS',
    });

    return this.findById(groupId, distributionId);
  }

  async updateItemStatus(
    itemId: string,
    dto: UpdateDistributionItemStatusDto,
    userId: string,
    isTreasurer: boolean,
  ): Promise<DistributionItemResponseDto> {
    const item = await this.prisma.groceryDistributionItem.findUnique({
      where: { id: itemId },
      include: {
        distribution: true,
        member: { include: { user: true } },
        product: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Distribution item not found');
    }

    // Only treasurer can set to PACKED or COLLECTED
    if (['PACKED', 'COLLECTED'].includes(dto.status) && !isTreasurer) {
      throw new ForbiddenException('Only treasurer can mark items as packed or collected');
    }

    // Cannot update if already confirmed
    if (item.status === 'CONFIRMED') {
      throw new BadRequestException('Item already confirmed');
    }

    await this.prisma.groceryDistributionItem.update({
      where: { id: itemId },
      data: {
        status: dto.status,
        confirmationNote: dto.note,
        ...(dto.status === 'CONFIRMED' && {
          confirmedById: userId,
          confirmedAt: new Date(),
        }),
      },
    });

    // If marked as CONFIRMED or COLLECTED, create OUT stock movement
    if (['COLLECTED', 'CONFIRMED'].includes(dto.status) && item.status !== 'COLLECTED') {
      await this.stockService.createDistributionMovement(
        item.distribution.groupId,
        item.productId,
        itemId,
        Number(item.quantityOverride || item.quantityAllocated),
        userId,
      );
    }

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_DISTRIBUTION_ITEM_STATUS_UPDATED',
      resourceType: 'GROCERY_DISTRIBUTION_ITEM',
      resourceId: itemId,
      groupId: item.distribution.groupId,
      beforeState: { status: item.status },
      afterState: { status: dto.status, note: dto.note },
      metadata: { isTreasurerOverride: isTreasurer && item.member.userId !== userId },
      outcome: 'SUCCESS',
    });

    return this.findItemById(itemId);
  }

  async confirmItem(
    itemId: string,
    dto: ConfirmDistributionItemDto,
    userId: string,
  ): Promise<DistributionItemResponseDto> {
    // Check idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.groceryIdempotencyKey.findUnique({
        where: { key: dto.idempotencyKey },
      });

      if (existing) {
        // Return cached response
        return existing.response as unknown as DistributionItemResponseDto;
      }
    }

    const item = await this.prisma.groceryDistributionItem.findUnique({
      where: { id: itemId },
      include: {
        distribution: true,
        member: true,
        product: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Distribution item not found');
    }

    // Verify the user is the member assigned to this item
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        id: item.memberId,
        userId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You can only confirm your own distribution items');
    }

    if (item.status === 'CONFIRMED') {
      // Already confirmed - return existing state (idempotent)
      const result = await this.findItemById(itemId);
      
      // Store idempotency key if provided
      if (dto.idempotencyKey) {
        await this.storeIdempotencyKey(dto.idempotencyKey, 'CONFIRM_ITEM', itemId, result);
      }
      
      return result;
    }

    // Update item status
    await this.prisma.groceryDistributionItem.update({
      where: { id: itemId },
      data: {
        status: 'CONFIRMED',
        confirmedById: userId,
        confirmedAt: new Date(),
        confirmationNote: dto.note,
        idempotencyKey: dto.idempotencyKey,
      },
    });

    // Create OUT stock movement if not already done
    if (item.status !== 'COLLECTED') {
      await this.stockService.createDistributionMovement(
        item.distribution.groupId,
        item.productId,
        itemId,
        Number(item.quantityOverride || item.quantityAllocated),
        userId,
      );
    }

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_DISTRIBUTION_ITEM_CONFIRMED',
      resourceType: 'GROCERY_DISTRIBUTION_ITEM',
      resourceId: itemId,
      groupId: item.distribution.groupId,
      afterState: {
        status: 'CONFIRMED',
        confirmedAt: new Date().toISOString(),
        idempotencyKey: dto.idempotencyKey,
      },
      outcome: 'SUCCESS',
    });

    const result = await this.findItemById(itemId);

    // Store idempotency key
    if (dto.idempotencyKey) {
      await this.storeIdempotencyKey(dto.idempotencyKey, 'CONFIRM_ITEM', itemId, result);
    }

    // Check if all items in distribution are confirmed
    await this.checkDistributionCompletion(item.distributionId);

    return result;
  }

  async getMemberAllocations(
    groupId: string,
    userId: string,
  ): Promise<MemberAllocationResponseDto[]> {
    const membership = await this.prisma.groupMember.findFirst({
      where: { groupId, userId, status: 'ACTIVE' },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    const items = await this.prisma.groceryDistributionItem.findMany({
      where: {
        memberId: membership.id,
        status: { notIn: ['CONFIRMED', 'CANCELLED'] },
        distribution: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      },
      include: {
        distribution: true,
        product: { select: { name: true, unit: true } },
      },
      orderBy: { distribution: { distributionDate: 'desc' } },
    });

    // Group by distribution
    const grouped = items.reduce(
      (acc, item) => {
        const distId = item.distributionId;
        if (!acc[distId]) {
          acc[distId] = {
            distributionId: distId,
            distributionDate: item.distribution.distributionDate
              .toISOString()
              .split('T')[0],
            status: item.distribution.status,
            items: [],
          };
        }
        acc[distId].items.push({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          productUnit: item.product.unit,
          quantityAllocated: Number(item.quantityOverride || item.quantityAllocated),
          status: item.status,
          confirmedAt: item.confirmedAt,
        });
        return acc;
      },
      {} as Record<string, MemberAllocationResponseDto>,
    );

    return Object.values(grouped);
  }

  async getMemberHistory(
    groupId: string,
    memberId: string,
  ): Promise<MemberHistoryResponseDto> {
    const items = await this.prisma.groceryDistributionItem.findMany({
      where: {
        memberId,
        status: 'CONFIRMED',
        distribution: {
          groupId,
          deletedAt: null,
        },
      },
      include: {
        distribution: true,
        product: { select: { name: true, unit: true } },
      },
      orderBy: { confirmedAt: 'desc' },
    });

    // Group by distribution
    const grouped = items.reduce(
      (acc, item) => {
        const distId = item.distributionId;
        if (!acc[distId]) {
          acc[distId] = {
            id: distId,
            distributionDate: item.distribution.distributionDate
              .toISOString()
              .split('T')[0],
            totalItems: 0,
            confirmedItems: 0,
            items: [],
          };
        }
        acc[distId].totalItems++;
        if (item.status === 'CONFIRMED') {
          acc[distId].confirmedItems++;
        }
        acc[distId].items.push({
          productName: item.product.name,
          quantity: Number(item.quantityOverride || item.quantityAllocated),
          confirmedAt: item.confirmedAt,
        });
        return acc;
      },
      {} as Record<string, any>,
    );

    const distributions = Object.values(grouped);
    const totalItemsReceived = items.length;

    // Calculate estimated value (simplified - would need price data)
    const estimatedValue = 0; // Would calculate from purchase prices

    return {
      distributions,
      summary: {
        totalDistributions: distributions.length,
        totalItemsReceived,
        estimatedValue,
      },
    };
  }

  async getMemberFairnessSummary(
    groupId: string,
    memberId: string,
  ): Promise<MemberFairnessSummaryDto> {
    const member = await this.prisma.groupMember.findFirst({
      where: { id: memberId, groupId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Get total contributions
    const contributions = await this.prisma.contribution.aggregate({
      where: {
        groupId,
        memberId: member.userId,
        status: 'APPROVED',
      },
      _sum: { amount: true },
      _max: { createdAt: true },
    });

    // Get confirmed distribution items (simplified value calculation)
    const distributionItems = await this.prisma.groceryDistributionItem.findMany({
      where: {
        memberId,
        status: 'CONFIRMED',
      },
      include: {
        product: true,
      },
    });

    // For now, use quantity as a proxy for value (would need price data for accurate calculation)
    const totalGroceryValue = distributionItems.reduce(
      (sum, item) => sum + Number(item.quantityOverride || item.quantityAllocated),
      0,
    );

    const totalContributions = Number(contributions._sum.amount || 0);
    const fairnessRatio = totalContributions > 0 ? totalGroceryValue / totalContributions : 0;

    const lastDistribution = await this.prisma.groceryDistributionItem.findFirst({
      where: { memberId, status: 'CONFIRMED' },
      orderBy: { confirmedAt: 'desc' },
      select: { confirmedAt: true },
    });

    return {
      memberId,
      member: {
        firstName: member.user.firstName,
        lastName: member.user.lastName,
      },
      totalContributions,
      totalGroceryValue,
      fairnessRatio,
      lastContributionDate: contributions._max.createdAt,
      lastDistributionDate: lastDistribution?.confirmedAt || null,
    };
  }

  private calculateAllocations(
    members: any[],
    products: { productId: string; totalQuantity: number }[],
    rule: AllocationRule,
    overrides: { memberId: string; productId: string; quantity: number; reason?: string }[],
  ): Array<{
    memberId: string;
    productId: string;
    quantity: number;
    override?: { quantity: number; reason?: string };
  }> {
    const allocations: Array<{
      memberId: string;
      productId: string;
      quantity: number;
      override?: { quantity: number; reason?: string };
    }> = [];

    for (const product of products) {
      // Get overrides for this product
      const productOverrides = overrides.filter((o) => o.productId === product.productId);
      const overrideMap = new Map(productOverrides.map((o) => [o.memberId, o]));

      // Calculate remaining quantity after overrides
      const overrideTotal = productOverrides.reduce((sum, o) => sum + o.quantity, 0);
      const remainingQuantity = product.totalQuantity - overrideTotal;
      const membersWithoutOverride = members.filter((m) => !overrideMap.has(m.id));

      // Equal share for remaining
      const equalShare =
        membersWithoutOverride.length > 0
          ? remainingQuantity / membersWithoutOverride.length
          : 0;

      for (const member of members) {
        const override = overrideMap.get(member.id);
        if (override) {
          allocations.push({
            memberId: member.id,
            productId: product.productId,
            quantity: equalShare, // Base allocation
            override: { quantity: override.quantity, reason: override.reason },
          });
        } else {
          allocations.push({
            memberId: member.id,
            productId: product.productId,
            quantity: equalShare,
          });
        }
      }
    }

    return allocations;
  }

  private async findItemById(itemId: string): Promise<DistributionItemResponseDto> {
    const item = await this.prisma.groceryDistributionItem.findUnique({
      where: { id: itemId },
      include: {
        member: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        product: { select: { name: true, unit: true } },
        confirmedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!item) {
      throw new NotFoundException('Distribution item not found');
    }

    return {
      id: item.id,
      distributionId: item.distributionId,
      memberId: item.memberId,
      member: {
        id: item.member.id,
        userId: item.member.userId,
        user: {
          firstName: item.member.user.firstName,
          lastName: item.member.user.lastName,
        },
      },
      productId: item.productId,
      product: {
        name: item.product.name,
        unit: item.product.unit,
      },
      quantityAllocated: Number(item.quantityAllocated),
      quantityOverride: item.quantityOverride ? Number(item.quantityOverride) : null,
      overrideReason: item.overrideReason,
      status: item.status,
      confirmedBy: item.confirmedBy
        ? {
            id: item.confirmedBy.id,
            firstName: item.confirmedBy.firstName,
            lastName: item.confirmedBy.lastName,
          }
        : null,
      confirmationNote: item.confirmationNote,
      confirmedAt: item.confirmedAt,
      createdAt: item.createdAt,
    };
  }

  private async storeIdempotencyKey(
    key: string,
    actionType: string,
    referenceId: string,
    response: any,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.IDEMPOTENCY_TTL_DAYS);

    await this.prisma.groceryIdempotencyKey.upsert({
      where: { key },
      create: {
        key,
        actionType,
        referenceId,
        response,
        expiresAt,
      },
      update: {
        response,
        expiresAt,
      },
    });
  }

  private async checkDistributionCompletion(distributionId: string): Promise<void> {
    const counts = await this.prisma.groceryDistributionItem.groupBy({
      by: ['status'],
      where: { distributionId },
      _count: true,
    });

    const total = counts.reduce((sum, c) => sum + c._count, 0);
    const confirmed = counts.find((c) => c.status === 'CONFIRMED')?._count || 0;

    if (confirmed === total) {
      await this.prisma.groceryDistribution.update({
        where: { id: distributionId },
        data: { status: 'COMPLETED' },
      });
    }
  }

  private mapToResponse(distribution: any): DistributionResponseDto {
    const items = distribution.items || [];
    const stats = {
      totalItems: items.length,
      pendingCount: items.filter((i: any) => i.status === 'PENDING').length,
      packedCount: items.filter((i: any) => i.status === 'PACKED').length,
      collectedCount: items.filter((i: any) => i.status === 'COLLECTED').length,
      confirmedCount: items.filter((i: any) => i.status === 'CONFIRMED').length,
    };

    return {
      id: distribution.id,
      groupId: distribution.groupId,
      status: distribution.status,
      allocationRule: distribution.allocationRule,
      distributionDate: distribution.distributionDate.toISOString().split('T')[0],
      notes: distribution.notes,
      createdBy: {
        id: distribution.createdBy.id,
        firstName: distribution.createdBy.firstName,
        lastName: distribution.createdBy.lastName,
      },
      items: items.map((item: any) => ({
        id: item.id,
        distributionId: item.distributionId,
        memberId: item.memberId,
        member: {
          id: item.member.id,
          userId: item.member.userId,
          user: {
            firstName: item.member.user.firstName,
            lastName: item.member.user.lastName,
          },
        },
        productId: item.productId,
        product: {
          name: item.product.name,
          unit: item.product.unit,
        },
        quantityAllocated: Number(item.quantityAllocated),
        quantityOverride: item.quantityOverride ? Number(item.quantityOverride) : null,
        overrideReason: item.overrideReason,
        status: item.status,
        confirmedBy: item.confirmedBy
          ? {
              id: item.confirmedBy.id,
              firstName: item.confirmedBy.firstName,
              lastName: item.confirmedBy.lastName,
            }
          : null,
        confirmationNote: item.confirmationNote,
        confirmedAt: item.confirmedAt,
        createdAt: item.createdAt,
      })),
      createdAt: distribution.createdAt,
      updatedAt: distribution.updatedAt,
      stats,
    };
  }
}
