import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { ApproveContributionDto, RejectContributionDto } from './dto/approve-contribution.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class ContributionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private ledgerService: LedgerService,
  ) {}

  async create(groupId: string, dto: CreateContributionDto, userId: string) {
    // Verify user is member of the group
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Check for idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.contribution.findFirst({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return existing; // Return existing for idempotent request
      }
    }

    // Check for duplicate contribution (same member, same period, approved)
    const existingApproved = await this.prisma.contribution.findFirst({
      where: {
        groupId,
        memberId: userId,
        periodStart: new Date(dto.periodStart),
        status: 'APPROVED',
        deletedAt: null,
      },
    });

    if (existingApproved) {
      throw new BadRequestException(
        'You already have an approved contribution for this period',
      );
    }

    // Check for pending contribution
    const existingPending = await this.prisma.contribution.findFirst({
      where: {
        groupId,
        memberId: userId,
        periodStart: new Date(dto.periodStart),
        status: 'PENDING',
        deletedAt: null,
      },
    });

    if (existingPending) {
      throw new BadRequestException(
        'You already have a pending contribution for this period',
      );
    }

    const contribution = await this.prisma.contribution.create({
      data: {
        groupId,
        memberId: userId,
        amount: dto.amount,
        currency: dto.currency || 'ZAR',
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        paymentMethod: dto.paymentMethod,
        popDocumentId: dto.popDocumentId,
        notes: dto.notes,
        idempotencyKey: dto.idempotencyKey,
        status: 'PENDING',
      },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        popDocument: true,
      },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'CONTRIBUTION_CREATED',
      resourceType: 'CONTRIBUTION',
      resourceId: contribution.id,
      groupId,
      afterState: {
        amount: dto.amount.toString(),
        period: `${dto.periodStart} to ${dto.periodEnd}`,
        paymentMethod: dto.paymentMethod,
      },
      outcome: 'SUCCESS',
    });

    return contribution;
  }

  async findAll(
    groupId: string,
    options: {
      status?: string;
      memberId?: string;
      periodStart?: string;
      periodEnd?: string;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const { status, memberId, periodStart, periodEnd, limit = 50, offset = 0 } = options;

    const where = {
      groupId,
      deletedAt: null,
      ...(status && { status: status as any }),
      ...(memberId && { memberId }),
      ...(periodStart && { periodStart: { gte: new Date(periodStart) } }),
      ...(periodEnd && { periodEnd: { lte: new Date(periodEnd) } }),
    };

    const [contributions, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where,
        include: {
          member: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          popDocument: {
            select: { id: true, filename: true, mimeType: true },
          },
          approvedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.contribution.count({ where }),
    ]);

    return { contributions, total, limit, offset };
  }

  async findOne(id: string) {
    const contribution = await this.prisma.contribution.findFirst({
      where: { id, deletedAt: null },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        popDocument: true,
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        group: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!contribution) {
      throw new NotFoundException('Contribution not found');
    }

    return contribution;
  }

  async approve(id: string, dto: ApproveContributionDto, approverId: string) {
    const contribution = await this.prisma.contribution.findFirst({
      where: { id, deletedAt: null },
      include: {
        member: true,
        group: true,
      },
    });

    if (!contribution) {
      throw new NotFoundException('Contribution not found');
    }

    if (contribution.status !== 'PENDING') {
      throw new BadRequestException(
        `Contribution is already ${contribution.status.toLowerCase()}`,
      );
    }

    // Verify approver has permission (treasurer or chairperson)
    const approverMembership = await this.prisma.groupMember.findFirst({
      where: {
        groupId: contribution.groupId,
        userId: approverId,
        status: 'ACTIVE',
        deletedAt: null,
        role: { in: ['TREASURER', 'CHAIRPERSON'] },
      },
    });

    if (!approverMembership) {
      throw new ForbiddenException(
        'Only treasurer or chairperson can approve contributions',
      );
    }

    // Cannot approve your own contribution
    if (contribution.memberId === approverId) {
      throw new ForbiddenException('Cannot approve your own contribution');
    }

    // Approve the contribution
    const updated = await this.prisma.contribution.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: approverId,
        approvedAt: new Date(),
        notes: dto.notes ? `${contribution.notes || ''}\n[Approval Note]: ${dto.notes}` : contribution.notes,
      },
    });

    // Credit the ledger
    const periodStr = `${contribution.periodStart.toISOString().split('T')[0]} to ${contribution.periodEnd.toISOString().split('T')[0]}`;
    await this.ledgerService.creditContribution(
      contribution.groupId,
      contribution.id,
      contribution.amount,
      contribution.memberId,
      periodStr,
      approverId,
    );

    await this.auditService.log({
      actorId: approverId,
      actorType: 'USER',
      action: 'CONTRIBUTION_APPROVED',
      resourceType: 'CONTRIBUTION',
      resourceId: id,
      groupId: contribution.groupId,
      beforeState: { status: 'PENDING' },
      afterState: {
        status: 'APPROVED',
        amount: contribution.amount.toString(),
        memberId: contribution.memberId,
      },
      outcome: 'SUCCESS',
    });

    return this.findOne(id);
  }

  async reject(id: string, dto: RejectContributionDto, approverId: string) {
    const contribution = await this.prisma.contribution.findFirst({
      where: { id, deletedAt: null },
    });

    if (!contribution) {
      throw new NotFoundException('Contribution not found');
    }

    if (contribution.status !== 'PENDING') {
      throw new BadRequestException(
        `Contribution is already ${contribution.status.toLowerCase()}`,
      );
    }

    // Verify approver has permission
    const approverMembership = await this.prisma.groupMember.findFirst({
      where: {
        groupId: contribution.groupId,
        userId: approverId,
        status: 'ACTIVE',
        deletedAt: null,
        role: { in: ['TREASURER', 'CHAIRPERSON'] },
      },
    });

    if (!approverMembership) {
      throw new ForbiddenException(
        'Only treasurer or chairperson can reject contributions',
      );
    }

    await this.prisma.contribution.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.reason,
      },
    });

    await this.auditService.log({
      actorId: approverId,
      actorType: 'USER',
      action: 'CONTRIBUTION_REJECTED',
      resourceType: 'CONTRIBUTION',
      resourceId: id,
      groupId: contribution.groupId,
      beforeState: { status: 'PENDING' },
      afterState: {
        status: 'REJECTED',
        reason: dto.reason,
      },
      outcome: 'SUCCESS',
    });

    return this.findOne(id);
  }

  async cancel(id: string, userId: string) {
    const contribution = await this.prisma.contribution.findFirst({
      where: { id, deletedAt: null },
    });

    if (!contribution) {
      throw new NotFoundException('Contribution not found');
    }

    if (contribution.status !== 'PENDING') {
      throw new BadRequestException('Can only cancel pending contributions');
    }

    // Only the contributor can cancel
    if (contribution.memberId !== userId) {
      throw new ForbiddenException('Only the contributor can cancel this contribution');
    }

    await this.prisma.contribution.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'CONTRIBUTION_CANCELLED',
      resourceType: 'CONTRIBUTION',
      resourceId: id,
      groupId: contribution.groupId,
      outcome: 'SUCCESS',
    });

    return { success: true };
  }

  async getMyContributions(userId: string, groupId?: string) {
    const where = {
      memberId: userId,
      deletedAt: null,
      ...(groupId && { groupId }),
    };

    return this.prisma.contribution.findMany({
      where,
      include: {
        group: {
          select: { id: true, name: true, type: true },
        },
        popDocument: {
          select: { id: true, filename: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
