import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerEntryType, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';

export interface CreateLedgerEntryInput {
  groupId: string;
  entryType: LedgerEntryType;
  amount: Decimal | string | number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdById?: string;
}

export interface LedgerSummary {
  groupId: string;
  currentBalance: Decimal;
  totalCredits: Decimal;
  totalDebits: Decimal;
  entryCount: number;
  lastEntryDate: Date | null;
}

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the current balance for a group
   * Returns the balance_after of the most recent ledger entry
   */
  async getBalance(groupId: string): Promise<Decimal> {
    const latestEntry = await this.prisma.ledgerEntry.findFirst({
      where: { groupId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { balanceAfter: true },
    });

    return latestEntry ? new Decimal(latestEntry.balanceAfter.toString()) : new Decimal(0);
  }

  /**
   * Create a new ledger entry with transactional balance update
   * This is the ONLY way to modify the pot balance
   */
  async createEntry(input: CreateLedgerEntryInput): Promise<{ entry: any; newBalance: Decimal }> {
    const amount = new Decimal(input.amount.toString());

    // Determine if this is a credit or debit based on entry type
    const isCredit = this.isCreditEntry(input.entryType);

    return this.prisma.$transaction(async (tx) => {
      // Get current balance with a row lock (serializable transaction)
      const currentBalance = await this.getBalanceInTransaction(tx, input.groupId);

      // Calculate new balance
      let newBalance: Decimal;
      if (isCredit) {
        newBalance = currentBalance.plus(amount);
      } else {
        newBalance = currentBalance.minus(amount);
        // Prevent negative balance for debits
        if (newBalance.lessThan(0)) {
          throw new BadRequestException(
            `Insufficient balance. Current: ${currentBalance.toString()}, Requested: ${amount.toString()}`,
          );
        }
      }

      // Create the ledger entry
      const entry = await tx.ledgerEntry.create({
        data: {
          groupId: input.groupId,
          entryType: input.entryType,
          amount: new Prisma.Decimal(amount.toString()),
          currency: 'ZAR',
          balanceAfter: new Prisma.Decimal(newBalance.toString()),
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          description: input.description,
          metadata: input.metadata,
          createdById: input.createdById,
        },
      });

      return { entry, newBalance };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /**
   * Credit a contribution to the ledger
   */
  async creditContribution(
    groupId: string,
    contributionId: string,
    amount: Decimal | string | number,
    memberId: string,
    period: string,
    createdById?: string,
  ): Promise<{ entry: any; newBalance: Decimal }> {
    return this.createEntry({
      groupId,
      entryType: 'CONTRIBUTION_CREDIT',
      amount,
      referenceType: 'CONTRIBUTION',
      referenceId: contributionId,
      description: `Contribution from member for ${period}`,
      metadata: { memberId, period },
      createdById,
    });
  }

  /**
   * Debit a payout from the ledger
   */
  async debitPayout(
    groupId: string,
    payoutId: string,
    amount: Decimal | string | number,
    payoutType: string,
    description?: string,
    createdById?: string,
  ): Promise<{ entry: any; newBalance: Decimal }> {
    return this.createEntry({
      groupId,
      entryType: 'PAYOUT_DEBIT',
      amount,
      referenceType: 'SAVINGS_PAYOUT',
      referenceId: payoutId,
      description: description || `Payout: ${payoutType}`,
      metadata: { payoutType },
      createdById,
    });
  }

  /**
   * Create a correction entry (for adjustments)
   * Always creates a pair of entries to maintain audit trail
   */
  async createCorrection(
    groupId: string,
    amount: Decimal | string | number,
    isCredit: boolean,
    reason: string,
    createdById?: string,
  ): Promise<{ entry: any; newBalance: Decimal }> {
    return this.createEntry({
      groupId,
      entryType: 'CORRECTION',
      amount: isCredit ? amount : new Decimal(amount.toString()).negated(),
      description: `Correction: ${reason}`,
      metadata: { reason, correctionType: isCredit ? 'CREDIT' : 'DEBIT' },
      createdById,
    });
  }

  /**
   * Get ledger entries for a group with pagination
   */
  async getEntries(
    groupId: string,
    options: {
      limit?: number;
      offset?: number;
      entryType?: LedgerEntryType;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ) {
    const { limit = 50, offset = 0, entryType, startDate, endDate } = options;

    const where: Prisma.LedgerEntryWhereInput = {
      groupId,
      ...(entryType && { entryType }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [entries, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return { entries, total, limit, offset };
  }

  /**
   * Get ledger summary for a group
   */
  async getSummary(groupId: string): Promise<LedgerSummary> {
    const [balance, aggregates, lastEntry] = await Promise.all([
      this.getBalance(groupId),
      this.prisma.ledgerEntry.aggregate({
        where: { groupId },
        _count: true,
      }),
      this.prisma.ledgerEntry.findFirst({
        where: { groupId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    // Calculate total credits and debits
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { groupId },
      select: { entryType: true, amount: true },
    });

    let totalCredits = new Decimal(0);
    let totalDebits = new Decimal(0);

    for (const entry of entries) {
      const amount = new Decimal(entry.amount.toString());
      if (this.isCreditEntry(entry.entryType)) {
        totalCredits = totalCredits.plus(amount);
      } else {
        totalDebits = totalDebits.plus(amount);
      }
    }

    return {
      groupId,
      currentBalance: balance,
      totalCredits,
      totalDebits,
      entryCount: aggregates._count,
      lastEntryDate: lastEntry?.createdAt || null,
    };
  }

  /**
   * Generate a statement for a member within a group
   */
  async getMemberStatement(
    groupId: string,
    memberId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    // Get member's contributions
    const contributions = await this.prisma.contribution.findMany({
      where: {
        groupId,
        memberId,
        status: 'APPROVED',
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate }),
              },
            }
          : {}),
      },
      orderBy: { periodStart: 'desc' },
    });

    // Calculate totals
    const totalContributed = contributions.reduce(
      (sum, c) => sum.plus(new Decimal(c.amount.toString())),
      new Decimal(0),
    );

    // Get group summary
    const groupSummary = await this.getSummary(groupId);

    // Get member count for equal share calculation
    const memberCount = await this.prisma.groupMember.count({
      where: {
        groupId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    const equalShare = memberCount > 0
      ? groupSummary.currentBalance.dividedBy(memberCount)
      : new Decimal(0);

    return {
      memberId,
      groupId,
      contributions,
      totalContributed,
      contributionCount: contributions.length,
      groupBalance: groupSummary.currentBalance,
      estimatedShare: equalShare,
      generatedAt: new Date(),
    };
  }

  private isCreditEntry(entryType: LedgerEntryType): boolean {
    return [
      'CONTRIBUTION_CREDIT',
      'CONTRIBUTION_ADJUSTMENT',
      'FINE_CREDIT',
      'INTEREST_CREDIT',
      'OPENING_BALANCE',
    ].includes(entryType);
  }

  private async getBalanceInTransaction(
    tx: Prisma.TransactionClient,
    groupId: string,
  ): Promise<Decimal> {
    const latestEntry = await tx.ledgerEntry.findFirst({
      where: { groupId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { balanceAfter: true },
    });

    return latestEntry ? new Decimal(latestEntry.balanceAfter.toString()) : new Decimal(0);
  }
}
