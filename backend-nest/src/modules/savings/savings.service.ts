import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateSavingsGroupDto } from './dto/create-savings-group.dto';
import { UpdateSavingsRulesDto } from './dto/update-savings-rules.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class SavingsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private ledgerService: LedgerService,
  ) {}

  async createSavingsGroup(dto: CreateSavingsGroupDto, userId: string) {
    // Check chairperson constraint for savings groups
    const existingChairship = await this.prisma.groupMember.findFirst({
      where: {
        userId,
        role: 'CHAIRPERSON',
        status: 'ACTIVE',
        deletedAt: null,
        group: {
          type: 'SAVINGS',
          deletedAt: null,
        },
      },
      include: { group: true },
    });

    if (existingChairship) {
      throw new BadRequestException(
        `You are already chairperson of another savings group: ${existingChairship.group.name}`,
      );
    }

    // Create group with savings rules in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the group
      const group = await tx.group.create({
        data: {
          name: dto.name,
          type: 'SAVINGS',
          description: dto.description,
          currency: dto.currency || 'ZAR',
          contributionAmount: dto.monthlyAmount,
          contributionFrequency: 'MONTHLY',
          members: {
            create: {
              userId,
              role: 'CHAIRPERSON',
              status: 'ACTIVE',
            },
          },
        },
      });

      // Create savings rules
      const rules = await tx.savingsRule.create({
        data: {
          groupId: group.id,
          monthlyAmount: dto.monthlyAmount,
          dueDay: dto.dueDay,
          gracePeriodDays: dto.gracePeriodDays || 7,
          fineEnabled: dto.fineEnabled || false,
          fineAmount: dto.fineAmount,
          fineType: dto.fineType,
          payoutModel: dto.payoutModel || 'YEAR_END',
          payoutSchedule: dto.payoutSchedule,
          minApprovalCount: dto.minApprovalCount || 2,
        },
      });

      // Create opening balance ledger entry
      await tx.ledgerEntry.create({
        data: {
          groupId: group.id,
          entryType: 'OPENING_BALANCE',
          amount: 0,
          currency: 'ZAR',
          balanceAfter: 0,
          description: 'Opening balance for new savings group',
          createdById: userId,
        },
      });

      return { group, rules };
    });

    // Audit log
    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'SAVINGS_GROUP_CREATED',
      resourceType: 'GROUP',
      resourceId: result.group.id,
      groupId: result.group.id,
      afterState: {
        name: result.group.name,
        monthlyAmount: dto.monthlyAmount.toString(),
        dueDay: dto.dueDay,
        payoutModel: dto.payoutModel,
      },
      outcome: 'SUCCESS',
    });

    return result;
  }

  async getSavingsGroup(groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: {
        id: groupId,
        type: 'SAVINGS',
        deletedAt: null,
      },
      include: {
        savingsRules: true,
        members: {
          where: { deletedAt: null, status: 'ACTIVE' },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            },
          },
        },
        _count: {
          select: {
            contributions: { where: { status: 'APPROVED', deletedAt: null } },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Savings group not found');
    }

    // Get current balance
    const balance = await this.ledgerService.getBalance(groupId);

    return {
      ...group,
      currentBalance: balance.toString(),
    };
  }

  async updateSavingsRules(groupId: string, dto: UpdateSavingsRulesDto, userId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, type: 'SAVINGS', deletedAt: null },
      include: { savingsRules: true },
    });

    if (!group) {
      throw new NotFoundException('Savings group not found');
    }

    if (!group.savingsRules) {
      throw new NotFoundException('Savings rules not found');
    }

    const beforeState = {
      monthlyAmount: group.savingsRules.monthlyAmount.toString(),
      dueDay: group.savingsRules.dueDay,
      fineEnabled: group.savingsRules.fineEnabled,
      fineAmount: group.savingsRules.fineAmount?.toString(),
      payoutModel: group.savingsRules.payoutModel,
    };

    const updatedRules = await this.prisma.savingsRule.update({
      where: { id: group.savingsRules.id },
      data: {
        monthlyAmount: dto.monthlyAmount,
        dueDay: dto.dueDay,
        gracePeriodDays: dto.gracePeriodDays,
        fineEnabled: dto.fineEnabled,
        fineAmount: dto.fineAmount,
        fineType: dto.fineType,
        payoutModel: dto.payoutModel,
        payoutSchedule: dto.payoutSchedule,
        minApprovalCount: dto.minApprovalCount,
      },
    });

    // Also update the group's contribution amount
    if (dto.monthlyAmount) {
      await this.prisma.group.update({
        where: { id: groupId },
        data: { contributionAmount: dto.monthlyAmount },
      });
    }

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'SAVINGS_RULES_UPDATED',
      resourceType: 'SAVINGS_RULE',
      resourceId: updatedRules.id,
      groupId,
      beforeState,
      afterState: {
        monthlyAmount: updatedRules.monthlyAmount.toString(),
        dueDay: updatedRules.dueDay,
        fineEnabled: updatedRules.fineEnabled,
        fineAmount: updatedRules.fineAmount?.toString(),
        payoutModel: updatedRules.payoutModel,
      },
      outcome: 'SUCCESS',
    });

    return updatedRules;
  }

  async getSavingsSummary(groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, type: 'SAVINGS', deletedAt: null },
      include: { savingsRules: true },
    });

    if (!group) {
      throw new NotFoundException('Savings group not found');
    }

    // Get ledger summary
    const ledgerSummary = await this.ledgerService.getSummary(groupId);

    // Get member stats
    const members = await this.prisma.groupMember.findMany({
      where: { groupId, status: 'ACTIVE', deletedAt: null },
      select: { userId: true },
    });

    // Get current period
    const now = new Date();
    const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get contribution stats for current period
    const currentPeriodContributions = await this.prisma.contribution.findMany({
      where: {
        groupId,
        periodStart: { gte: currentPeriodStart },
        periodEnd: { lte: currentPeriodEnd },
        deletedAt: null,
      },
      select: { memberId: true, status: true, amount: true },
    });

    // Calculate member statuses
    const memberStatuses = members.map((member) => {
      const contribution = currentPeriodContributions.find(
        (c) => c.memberId === member.userId,
      );
      let status = 'OUTSTANDING';
      if (contribution) {
        if (contribution.status === 'APPROVED') status = 'PAID';
        else if (contribution.status === 'PENDING') status = 'PENDING_APPROVAL';
      }
      return { userId: member.userId, status };
    });

    const paidCount = memberStatuses.filter((m) => m.status === 'PAID').length;
    const pendingCount = memberStatuses.filter((m) => m.status === 'PENDING_APPROVAL').length;
    const outstandingCount = memberStatuses.filter((m) => m.status === 'OUTSTANDING').length;

    // Calculate target vs actual for the period
    const monthlyAmount = group.savingsRules?.monthlyAmount || new Decimal(0);
    const targetForPeriod = new Decimal(monthlyAmount.toString()).times(members.length);
    const actualForPeriod = currentPeriodContributions
      .filter((c) => c.status === 'APPROVED')
      .reduce((sum, c) => sum.plus(new Decimal(c.amount.toString())), new Decimal(0));

    // Get pending payouts
    const pendingPayouts = await this.prisma.savingsPayout.count({
      where: { groupId, status: 'PENDING', deletedAt: null },
    });

    return {
      groupId,
      groupName: group.name,
      potBalance: ledgerSummary.currentBalance.toString(),
      totalCredits: ledgerSummary.totalCredits.toString(),
      totalDebits: ledgerSummary.totalDebits.toString(),
      memberCount: members.length,
      currentPeriod: {
        start: currentPeriodStart,
        end: currentPeriodEnd,
        targetAmount: targetForPeriod.toString(),
        actualAmount: actualForPeriod.toString(),
        percentageCollected: targetForPeriod.isZero()
          ? '100'
          : actualForPeriod.dividedBy(targetForPeriod).times(100).toFixed(2),
      },
      memberStatus: {
        paid: paidCount,
        pendingApproval: pendingCount,
        outstanding: outstandingCount,
      },
      pendingPayouts,
      payoutModel: group.savingsRules?.payoutModel || 'YEAR_END',
      nextDueDate: this.getNextDueDate(group.savingsRules?.dueDay || 1),
    };
  }

  async getMemberSavingsStatus(groupId: string, userId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, type: 'SAVINGS', deletedAt: null },
      include: { savingsRules: true },
    });

    if (!group) {
      throw new NotFoundException('Savings group not found');
    }

    // Get all contributions for this member
    const contributions = await this.prisma.contribution.findMany({
      where: {
        groupId,
        memberId: userId,
        deletedAt: null,
      },
      orderBy: { periodStart: 'desc' },
    });

    const totalContributed = contributions
      .filter((c) => c.status === 'APPROVED')
      .reduce((sum, c) => sum.plus(new Decimal(c.amount.toString())), new Decimal(0));

    // Get current period status
    const now = new Date();
    const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentPeriodContribution = contributions.find(
      (c) => new Date(c.periodStart) >= currentPeriodStart,
    );

    let currentPeriodStatus = 'OUTSTANDING';
    if (currentPeriodContribution) {
      if (currentPeriodContribution.status === 'APPROVED') currentPeriodStatus = 'PAID';
      else if (currentPeriodContribution.status === 'PENDING') currentPeriodStatus = 'PENDING_APPROVAL';
    }

    // Check if late
    const dueDay = group.savingsRules?.dueDay || 1;
    const gracePeriod = group.savingsRules?.gracePeriodDays || 7;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    const graceDeadline = new Date(dueDate);
    graceDeadline.setDate(graceDeadline.getDate() + gracePeriod);

    const isLate = currentPeriodStatus === 'OUTSTANDING' && now > graceDeadline;

    // Calculate estimated share
    const balance = await this.ledgerService.getBalance(groupId);
    const memberCount = await this.prisma.groupMember.count({
      where: { groupId, status: 'ACTIVE', deletedAt: null },
    });
    const estimatedShare = memberCount > 0 ? balance.dividedBy(memberCount) : new Decimal(0);

    return {
      userId,
      groupId,
      totalContributed: totalContributed.toString(),
      contributionCount: contributions.filter((c) => c.status === 'APPROVED').length,
      currentPeriodStatus,
      isLate,
      nextDueDate: this.getNextDueDate(dueDay),
      estimatedShare: estimatedShare.toString(),
      recentContributions: contributions.slice(0, 5),
    };
  }

  private getNextDueDate(dueDay: number): Date {
    const now = new Date();
    let dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    
    if (now > dueDate) {
      dueDate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    }
    
    return dueDate;
  }
}
