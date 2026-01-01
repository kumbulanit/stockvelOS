import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { GroupType, GroupStatus, MemberRole } from '@prisma/client';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateGroupDto, userId: string) {
    // For SAVINGS groups, check if user is already chair of another savings group
    if (dto.type === 'SAVINGS') {
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
    }

    // Create group with creator as chairperson
    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        type: dto.type as GroupType,
        description: dto.description,
        currency: dto.currency || 'ZAR',
        contributionAmount: dto.contributionAmount,
        contributionFrequency: dto.contributionFrequency as any,
        rules: dto.rules,
        members: {
          create: {
            userId,
            role: 'CHAIRPERSON',
            status: 'ACTIVE',
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });

    // Audit log
    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROUP_CREATED',
      resourceType: 'GROUP',
      resourceId: group.id,
      groupId: group.id,
      afterState: { name: group.name, type: group.type },
      outcome: 'SUCCESS',
    });

    return group;
  }

  async findAll(userId: string, type?: GroupType) {
    return this.prisma.group.findMany({
      where: {
        deletedAt: null,
        ...(type && { type }),
        members: {
          some: {
            userId,
            status: 'ACTIVE',
            deletedAt: null,
          },
        },
      },
      include: {
        _count: {
          select: {
            members: {
              where: { status: 'ACTIVE', deletedAt: null },
            },
          },
        },
        members: {
          where: { userId, deletedAt: null },
          select: { role: true, status: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, deletedAt: null },
      include: {
        members: {
          where: { deletedAt: null },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            },
          },
        },
        savingsRules: true,
        _count: {
          select: {
            contributions: { where: { status: 'APPROVED', deletedAt: null } },
            ledgerEntries: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return group;
  }

  async update(id: string, dto: UpdateGroupDto, userId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, deletedAt: null },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const beforeState = { name: group.name, description: group.description };

    const updated = await this.prisma.group.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        contributionAmount: dto.contributionAmount,
        contributionFrequency: dto.contributionFrequency as any,
        rules: dto.rules,
      },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROUP_UPDATED',
      resourceType: 'GROUP',
      resourceId: id,
      groupId: id,
      beforeState,
      afterState: { name: updated.name, description: updated.description },
      outcome: 'SUCCESS',
    });

    return updated;
  }

  async remove(id: string, userId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id, deletedAt: null },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    await this.prisma.group.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DISSOLVED' },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'GROUP_DELETED',
      resourceType: 'GROUP',
      resourceId: id,
      groupId: id,
      outcome: 'SUCCESS',
    });

    return { success: true };
  }

  async getMemberRole(groupId: string, userId: string): Promise<MemberRole | null> {
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    return membership?.role as MemberRole || null;
  }
}
