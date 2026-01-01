import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { LedgerService } from '../../ledger/ledger.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { StockService } from './stock.service';
import {
  CreatePurchaseDto,
  ApprovePurchaseDto,
  RejectPurchaseDto,
  PurchaseQueryDto,
  PurchaseResponseDto,
} from '../dto/purchase.dto';
import { GroceryPurchaseStatus, LedgerEntryType, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';

@Injectable()
export class PurchaseService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private ledgerService: LedgerService,
    private notificationsService: NotificationsService,
    private stockService: StockService,
  ) {}

  async create(
    groupId: string,
    dto: CreatePurchaseDto,
    userId: string,
  ): Promise<PurchaseResponseDto> {
    // Get group to check rules
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, rules: true, currency: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Validate all products exist and belong to group
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.groceryProduct.findMany({
      where: {
        id: { in: productIds },
        groupId,
        active: true,
        deletedAt: null,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found or inactive');
    }

    // Calculate totals
    const itemsWithTotals = dto.items.map((item) => ({
      ...item,
      lineTotal: new Decimal(item.quantity).times(item.unitPrice).toNumber(),
    }));

    const calculatedTotal = itemsWithTotals.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );

    // Check if approval is required based on group rules
    const rules = (group.rules as any)?.grocery || {};
    const approvalThreshold = rules.purchaseApprovalThreshold || 0;
    const autoApproveBelow = rules.autoApproveBelow || 0;

    let status: GroceryPurchaseStatus = 'PENDING';
    if (calculatedTotal <= autoApproveBelow) {
      status = 'APPROVED';
    } else if (calculatedTotal > approvalThreshold && approvalThreshold > 0) {
      status = 'PENDING_APPROVAL';
    } else {
      status = 'APPROVED';
    }

    // Create purchase with items in transaction
    const purchase = await this.prisma.$transaction(async (tx) => {
      const newPurchase = await tx.groceryPurchase.create({
        data: {
          groupId,
          createdById: userId,
          supplierName: dto.supplierName,
          purchaseDate: new Date(dto.purchaseDate),
          totalAmount: new Prisma.Decimal(calculatedTotal),
          currency: group.currency,
          status,
          notes: dto.notes,
          receiptDocumentId: dto.receiptDocumentId,
          approvedById: status === 'APPROVED' ? userId : null,
          approvedAt: status === 'APPROVED' ? new Date() : null,
        },
      });

      // Create line items
      await tx.groceryPurchaseItem.createMany({
        data: itemsWithTotals.map((item) => ({
          purchaseId: newPurchase.id,
          productId: item.productId,
          quantity: new Prisma.Decimal(item.quantity),
          unitPrice: new Prisma.Decimal(item.unitPrice),
          lineTotal: new Prisma.Decimal(item.lineTotal),
        })),
      });

      return newPurchase;
    });

    // If auto-approved, create stock movements and ledger entry
    if (status === 'APPROVED') {
      await this.processPurchaseApproval(groupId, purchase.id, userId);
    }

    // If pending approval, notify chairperson
    if (status === 'PENDING_APPROVAL') {
      await this.notifyPendingApproval(groupId, purchase.id, calculatedTotal);
    }

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_PURCHASE_CREATED',
      resourceType: 'GROCERY_PURCHASE',
      resourceId: purchase.id,
      groupId,
      afterState: {
        supplierName: dto.supplierName,
        totalAmount: calculatedTotal,
        status,
        itemCount: dto.items.length,
      },
      outcome: 'SUCCESS',
    });

    return this.findById(groupId, purchase.id);
  }

  async findAll(
    groupId: string,
    query: PurchaseQueryDto,
  ): Promise<{ purchases: PurchaseResponseDto[]; total: number }> {
    const where: any = {
      groupId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.purchaseDate = {};
      if (query.startDate) {
        where.purchaseDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.purchaseDate.lte = new Date(query.endDate);
      }
    }

    const [purchases, total] = await Promise.all([
      this.prisma.groceryPurchase.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
          items: {
            include: {
              product: { select: { name: true, unit: true } },
            },
          },
        },
        orderBy: { purchaseDate: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.groceryPurchase.count({ where }),
    ]);

    return {
      purchases: purchases.map((p) => this.mapToResponse(p)),
      total,
    };
  }

  async findById(groupId: string, purchaseId: string): Promise<PurchaseResponseDto> {
    const purchase = await this.prisma.groceryPurchase.findFirst({
      where: {
        id: purchaseId,
        groupId,
        deletedAt: null,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            product: { select: { name: true, unit: true } },
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return this.mapToResponse(purchase);
  }

  async approve(
    groupId: string,
    purchaseId: string,
    dto: ApprovePurchaseDto,
    userId: string,
  ): Promise<PurchaseResponseDto> {
    const purchase = await this.prisma.groceryPurchase.findFirst({
      where: {
        id: purchaseId,
        groupId,
        deletedAt: null,
      },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    if (purchase.status !== 'PENDING_APPROVAL' && purchase.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot approve purchase with status ${purchase.status}`,
      );
    }

    await this.prisma.groceryPurchase.update({
      where: { id: purchaseId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        notes: dto.notes ? `${purchase.notes || ''}\n[Approval Note] ${dto.notes}` : purchase.notes,
      },
    });

    // Process approval (stock movements + ledger)
    await this.processPurchaseApproval(groupId, purchaseId, userId);

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_PURCHASE_APPROVED',
      resourceType: 'GROCERY_PURCHASE',
      resourceId: purchaseId,
      groupId,
      beforeState: { status: purchase.status },
      afterState: { status: 'APPROVED' },
      outcome: 'SUCCESS',
    });

    // Notify creator
    await this.notificationsService.create({
      userId: purchase.createdById,
      groupId,
      type: 'GROCERY_PURCHASE_APPROVED',
      title: 'Purchase Approved',
      body: `Your purchase of R${purchase.totalAmount} has been approved`,
      channel: 'IN_APP',
    });

    return this.findById(groupId, purchaseId);
  }

  async reject(
    groupId: string,
    purchaseId: string,
    dto: RejectPurchaseDto,
    userId: string,
  ): Promise<PurchaseResponseDto> {
    const purchase = await this.prisma.groceryPurchase.findFirst({
      where: {
        id: purchaseId,
        groupId,
        deletedAt: null,
      },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    if (purchase.status !== 'PENDING_APPROVAL' && purchase.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot reject purchase with status ${purchase.status}`,
      );
    }

    await this.prisma.groceryPurchase.update({
      where: { id: purchaseId },
      data: {
        status: 'REJECTED',
        notes: `${purchase.notes || ''}\n[Rejection Reason] ${dto.reason}`,
      },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROCERY_PURCHASE_REJECTED',
      resourceType: 'GROCERY_PURCHASE',
      resourceId: purchaseId,
      groupId,
      beforeState: { status: purchase.status },
      afterState: { status: 'REJECTED', reason: dto.reason },
      outcome: 'SUCCESS',
    });

    // Notify creator
    await this.notificationsService.create({
      userId: purchase.createdById,
      groupId,
      type: 'GROCERY_PURCHASE_REJECTED',
      title: 'Purchase Rejected',
      body: `Your purchase of R${purchase.totalAmount} has been rejected: ${dto.reason}`,
      channel: 'IN_APP',
    });

    return this.findById(groupId, purchaseId);
  }

  private async processPurchaseApproval(
    groupId: string,
    purchaseId: string,
    userId: string,
  ): Promise<void> {
    const purchase = await this.prisma.groceryPurchase.findUnique({
      where: { id: purchaseId },
      include: { items: true },
    });

    if (!purchase) return;

    // Create stock IN movements for each item
    await this.stockService.createPurchaseMovements(
      groupId,
      purchaseId,
      purchase.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      })),
      userId,
    );

    // Create ledger debit entry
    await this.ledgerService.createEntry({
      groupId,
      entryType: LedgerEntryType.GROCERY_PURCHASE_DEBIT,
      amount: purchase.totalAmount,
      referenceType: 'GROCERY_PURCHASE',
      referenceId: purchaseId,
      description: `Grocery purchase from ${purchase.supplierName}`,
      createdById: userId,
    });
  }

  private async notifyPendingApproval(
    groupId: string,
    purchaseId: string,
    amount: number,
  ): Promise<void> {
    // Get chairperson(s) of the group
    const chairs = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        role: 'CHAIRPERSON',
        status: 'ACTIVE',
      },
      include: { user: true },
    });

    for (const chair of chairs) {
      await this.notificationsService.create({
        userId: chair.userId,
        groupId,
        type: 'GROCERY_PURCHASE_PENDING_APPROVAL',
        title: 'Purchase Requires Approval',
        body: `A grocery purchase of R${amount.toFixed(2)} requires your approval`,
        channel: 'PUSH',
        data: { purchaseId },
      });
    }
  }

  private mapToResponse(purchase: any): PurchaseResponseDto {
    return {
      id: purchase.id,
      groupId: purchase.groupId,
      supplierName: purchase.supplierName,
      purchaseDate: purchase.purchaseDate.toISOString().split('T')[0],
      totalAmount: Number(purchase.totalAmount),
      currency: purchase.currency,
      status: purchase.status,
      notes: purchase.notes,
      receiptDocumentId: purchase.receiptDocumentId,
      createdBy: {
        id: purchase.createdBy.id,
        firstName: purchase.createdBy.firstName,
        lastName: purchase.createdBy.lastName,
      },
      approvedBy: purchase.approvedBy
        ? {
            id: purchase.approvedBy.id,
            firstName: purchase.approvedBy.firstName,
            lastName: purchase.approvedBy.lastName,
          }
        : null,
      approvedAt: purchase.approvedAt,
      items: purchase.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productUnit: item.product.unit,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
    };
  }
}
