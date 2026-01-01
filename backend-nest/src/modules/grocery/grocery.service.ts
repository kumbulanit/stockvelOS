import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProductService } from './services/product.service';
import { PurchaseService } from './services/purchase.service';
import { StockService } from './services/stock.service';
import { DistributionService } from './services/distribution.service';
import { GroupType, MemberRole } from '@prisma/client';

export interface GroceryGroupSummary {
  groupId: string;
  groupName: string;
  currentPotBalance: number;
  totalStockValue: number;
  activeProductCount: number;
  pendingDistributions: number;
  recentPurchases: number;
}

@Injectable()
export class GroceryService {
  constructor(
    private prisma: PrismaService,
    private productService: ProductService,
    private purchaseService: PurchaseService,
    private stockService: StockService,
    private distributionService: DistributionService,
  ) {}

  /**
   * Validate that a group is of type GROCERY
   */
  async validateGroceryGroup(groupId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { type: true, status: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.type !== GroupType.GROCERY) {
      throw new ForbiddenException('This operation is only available for Grocery groups');
    }

    if (group.status !== 'ACTIVE') {
      throw new ForbiddenException('Group is not active');
    }
  }

  /**
   * Validate user's role in the group
   */
  async validateMemberRole(
    groupId: string,
    userId: string,
    allowedRoles: MemberRole[],
  ): Promise<{ membership: any; role: MemberRole }> {
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'ACTIVE',
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `This action requires one of these roles: ${allowedRoles.join(', ')}`,
      );
    }

    return { membership, role: membership.role };
  }

  /**
   * Check if user can chair another grocery group (max 1 chair per user)
   */
  async canChairGroceryGroup(userId: string, excludeGroupId?: string): Promise<boolean> {
    const existingChair = await this.prisma.groupMember.findFirst({
      where: {
        userId,
        role: 'CHAIRPERSON',
        status: 'ACTIVE',
        group: {
          type: 'GROCERY',
          status: 'ACTIVE',
        },
        ...(excludeGroupId && { groupId: { not: excludeGroupId } }),
      },
    });

    return !existingChair;
  }

  /**
   * Get grocery group dashboard summary
   */
  async getGroupSummary(groupId: string): Promise<GroceryGroupSummary> {
    await this.validateGroceryGroup(groupId);

    const [group, stockLevels, pendingDist, recentPurchases, potBalance] =
      await Promise.all([
        this.prisma.group.findUnique({
          where: { id: groupId },
          select: { name: true },
        }),
        this.stockService.getCurrentStock(groupId, {}),
        this.prisma.groceryDistribution.count({
          where: {
            groupId,
            status: 'ACTIVE',
            deletedAt: null,
          },
        }),
        this.prisma.groceryPurchase.count({
          where: {
            groupId,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            deletedAt: null,
          },
        }),
        this.getGroupPotBalance(groupId),
      ]);

    // Calculate total stock value (simplified - uses quantity as proxy)
    const totalStockValue = stockLevels.reduce(
      (sum, s) => sum + s.currentQuantity,
      0,
    );

    return {
      groupId,
      groupName: group?.name || '',
      currentPotBalance: potBalance,
      totalStockValue,
      activeProductCount: stockLevels.length,
      pendingDistributions: pendingDist,
      recentPurchases,
    };
  }

  /**
   * Get user's grocery groups
   */
  async getUserGroceryGroups(userId: string): Promise<any[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        group: {
          type: 'GROCERY',
          status: 'ACTIVE',
        },
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            currency: true,
          },
        },
      },
    });

    const groups = await Promise.all(
      memberships.map(async (m) => {
        // Get next distribution
        const nextDistribution = await this.prisma.groceryDistribution.findFirst({
          where: {
            groupId: m.groupId,
            status: 'ACTIVE',
            distributionDate: { gte: new Date() },
          },
          orderBy: { distributionDate: 'asc' },
          select: { distributionDate: true },
        });

        // Get last received items count
        const lastReceived = await this.prisma.groceryDistributionItem.count({
          where: {
            memberId: m.id,
            status: 'CONFIRMED',
            confirmedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        });

        return {
          groupId: m.group.id,
          groupName: m.group.name,
          description: m.group.description,
          role: m.role,
          nextDistributionDate: nextDistribution?.distributionDate || null,
          recentItemsReceived: lastReceived,
        };
      }),
    );

    return groups;
  }

  private async getGroupPotBalance(groupId: string): Promise<number> {
    const latestEntry = await this.prisma.ledgerEntry.findFirst({
      where: { groupId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { balanceAfter: true },
    });

    return latestEntry ? Number(latestEntry.balanceAfter) : 0;
  }
}
