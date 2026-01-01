import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { ApprovePayoutDto, RejectPayoutDto } from './dto/approve-payout.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class SavingsPayoutsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private ledgerService: LedgerService,
  ) {}

  async createPayout(groupId: string, dto: CreatePayoutDto, userId: string) {
    // Verify group is a savings group
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, type: 'SAVINGS', deletedAt: null },
      include: { savingsRules: true },
    });

    if (!group) {
      throw new NotFoundException('Savings group not found');
    }

    // Get current balance
    const currentBalance = await this.ledgerService.getBalance(groupId);
    const requestedAmount = new Decimal(dto.amount);

    // Validate amount doesn't exceed balance
    if (requestedAmount.greaterThan(currentBalance)) {
      throw new BadRequestException(
        `Insufficient balance. Current: ${currentBalance.toString()}, Requested: ${requestedAmount.toString()}`,
      );
    }

    // Check for duplicate using idempotency key
    if (dto.idempotencyKey) {
      const existing = await this.prisma.savingsPayout.findFirst({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return existing; // Return existing payout for idempotent request
      }
    }

    const payout = await this.prisma.savingsPayout.create({
      data: {
        groupId,
        amount: dto.amount,
        currency: dto.currency || 'ZAR',
        payoutType: dto.payoutType,
        description: dto.description,
        targetMembers: dto.targetMembers,
        distributionType: dto.distributionType || 'EQUAL',
        createdById: userId,
        idempotencyKey: dto.idempotencyKey,
        status: 'PENDING',
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'PAYOUT_CREATED',
      resourceType: 'SAVINGS_PAYOUT',
      resourceId: payout.id,
      groupId,
      afterState: {
        amount: dto.amount.toString(),
        payoutType: dto.payoutType,
        distributionType: dto.distributionType,
      },
      outcome: 'SUCCESS',
    });

    return payout;
  }

  async getPayouts(
    groupId: string,
    options: { status?: string; limit?: number; offset?: number } = {},
  ) {
    const { status, limit = 50, offset = 0 } = options;

    const where = {
      groupId,
      deletedAt: null,
      ...(status && { status: status as any }),
    };

    const [payouts, total] = await Promise.all([
      this.prisma.savingsPayout.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.savingsPayout.count({ where }),
    ]);

    return { payouts, total, limit, offset };
  }

  async getPayout(payoutId: string) {
    const payout = await this.prisma.savingsPayout.findFirst({
      where: { id: payoutId, deletedAt: null },
      include: {
        group: {
          include: { savingsRules: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approvals: {
          include: {
            approver: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    return payout;
  }

  async approvePayout(payoutId: string, dto: ApprovePayoutDto, userId: string) {
    const payout = await this.prisma.savingsPayout.findFirst({
      where: { id: payoutId, deletedAt: null },
      include: {
        group: { include: { savingsRules: true } },
        approvals: true,
      },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== 'PENDING') {
      throw new BadRequestException(`Payout is already ${payout.status.toLowerCase()}`);
    }

    // Check if user already approved
    const existingApproval = payout.approvals.find((a) => a.approverId === userId);
    if (existingApproval) {
      throw new BadRequestException('You have already voted on this payout');
    }

    // Verify user is treasurer or chairperson
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        groupId: payout.groupId,
        userId,
        status: 'ACTIVE',
        deletedAt: null,
        role: { in: ['TREASURER', 'CHAIRPERSON'] },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Only treasurer or chairperson can approve payouts');
    }

    // Get current balance
    const currentBalance = await this.ledgerService.getBalance(payout.groupId);
    const payoutAmount = new Decimal(payout.amount.toString());

    if (payoutAmount.greaterThan(currentBalance)) {
      throw new BadRequestException(
        `Insufficient balance. Current: ${currentBalance.toString()}, Payout: ${payoutAmount.toString()}`,
      );
    }

    // Create approval
    await this.prisma.savingsPayoutApproval.create({
      data: {
        payoutId,
        approverId: userId,
        decision: 'APPROVED',
        reason: dto.reason,
      },
    });

    // Count approvals
    const approvalCount = payout.approvals.filter((a) => a.decision === 'APPROVED').length + 1;
    const requiredApprovals = payout.group.savingsRules?.minApprovalCount || 2;

    // Check if we have enough approvals
    if (approvalCount >= requiredApprovals) {
      // Enough approvals - debit from ledger
      await this.ledgerService.debitPayout(
        payout.groupId,
        payout.id,
        payoutAmount,
        payout.payoutType,
        payout.description || undefined,
        userId,
      );

      // Update payout status
      await this.prisma.savingsPayout.update({
        where: { id: payoutId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      });

      await this.auditService.log({
        actorId: userId,
        actorType: 'USER',
        action: 'PAYOUT_APPROVED',
        resourceType: 'SAVINGS_PAYOUT',
        resourceId: payoutId,
        groupId: payout.groupId,
        afterState: {
          amount: payout.amount.toString(),
          approvalCount,
          status: 'APPROVED',
        },
        outcome: 'SUCCESS',
      });
    } else {
      await this.auditService.log({
        actorId: userId,
        actorType: 'USER',
        action: 'PAYOUT_APPROVAL_ADDED',
        resourceType: 'SAVINGS_PAYOUT',
        resourceId: payoutId,
        groupId: payout.groupId,
        afterState: {
          approvalCount,
          requiredApprovals,
          status: 'PENDING',
        },
        outcome: 'SUCCESS',
      });
    }

    return this.getPayout(payoutId);
  }

  async rejectPayout(payoutId: string, dto: RejectPayoutDto, userId: string) {
    const payout = await this.prisma.savingsPayout.findFirst({
      where: { id: payoutId, deletedAt: null },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== 'PENDING') {
      throw new BadRequestException(`Payout is already ${payout.status.toLowerCase()}`);
    }

    // Verify user is treasurer or chairperson
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        groupId: payout.groupId,
        userId,
        status: 'ACTIVE',
        deletedAt: null,
        role: { in: ['TREASURER', 'CHAIRPERSON'] },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Only treasurer or chairperson can reject payouts');
    }

    // Create rejection
    await this.prisma.savingsPayoutApproval.create({
      data: {
        payoutId,
        approverId: userId,
        decision: 'REJECTED',
        reason: dto.reason,
      },
    });

    // Update payout status to rejected
    await this.prisma.savingsPayout.update({
      where: { id: payoutId },
      data: { status: 'REJECTED' },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'PAYOUT_REJECTED',
      resourceType: 'SAVINGS_PAYOUT',
      resourceId: payoutId,
      groupId: payout.groupId,
      afterState: {
        reason: dto.reason,
        status: 'REJECTED',
      },
      outcome: 'SUCCESS',
    });

    return this.getPayout(payoutId);
  }

  async cancelPayout(payoutId: string, userId: string) {
    const payout = await this.prisma.savingsPayout.findFirst({
      where: { id: payoutId, deletedAt: null },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== 'PENDING') {
      throw new BadRequestException(`Cannot cancel payout with status ${payout.status}`);
    }

    // Only creator or chairperson can cancel
    if (payout.createdById !== userId) {
      const membership = await this.prisma.groupMember.findFirst({
        where: {
          groupId: payout.groupId,
          userId,
          status: 'ACTIVE',
          deletedAt: null,
          role: 'CHAIRPERSON',
        },
      });

      if (!membership) {
        throw new ForbiddenException('Only creator or chairperson can cancel payouts');
      }
    }

    await this.prisma.savingsPayout.update({
      where: { id: payoutId },
      data: { status: 'CANCELLED' },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'PAYOUT_CANCELLED',
      resourceType: 'SAVINGS_PAYOUT',
      resourceId: payoutId,
      groupId: payout.groupId,
      outcome: 'SUCCESS',
    });

    return { success: true };
  }
}
