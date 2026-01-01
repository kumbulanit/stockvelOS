import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MemberRole, MembershipStatus } from '@prisma/client';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MembershipsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async addMember(groupId: string, dto: AddMemberDto, actorId: string) {
    // Check if user exists
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if already a member
    const existingMembership = await this.prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (existingMembership) {
      if (existingMembership.status === 'ACTIVE') {
        throw new BadRequestException('User is already a member of this group');
      }
      // Reactivate if left
      const updated = await this.prisma.groupMember.update({
        where: { id: existingMembership.id },
        data: {
          status: 'ACTIVE',
          role: dto.role || 'MEMBER',
          leftAt: null,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });

      await this.auditService.log({
        actorId,
        actorType: 'USER',
        action: 'MEMBER_REACTIVATED',
        resourceType: 'GROUP_MEMBER',
        resourceId: updated.id,
        groupId,
        afterState: { userId: user.id, role: updated.role },
        outcome: 'SUCCESS',
      });

      return updated;
    }

    // For CHAIRPERSON role in SAVINGS group, check constraint
    if (dto.role === 'CHAIRPERSON') {
      const group = await this.prisma.group.findUnique({ where: { id: groupId } });
      if (group?.type === 'SAVINGS') {
        const existingChairship = await this.prisma.groupMember.findFirst({
          where: {
            userId: user.id,
            role: 'CHAIRPERSON',
            status: 'ACTIVE',
            deletedAt: null,
            group: { type: 'SAVINGS', deletedAt: null },
          },
        });

        if (existingChairship) {
          throw new BadRequestException(
            'User is already chairperson of another savings group',
          );
        }
      }
    }

    const membership = await this.prisma.groupMember.create({
      data: {
        groupId,
        userId: user.id,
        role: dto.role || 'MEMBER',
        status: 'ACTIVE',
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await this.auditService.log({
      actorId,
      actorType: 'USER',
      action: 'MEMBER_ADDED',
      resourceType: 'GROUP_MEMBER',
      resourceId: membership.id,
      groupId,
      afterState: { userId: user.id, role: membership.role },
      outcome: 'SUCCESS',
    });

    return membership;
  }

  async getMembers(groupId: string) {
    return this.prisma.groupMember.findMany({
      where: {
        groupId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  async getMember(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    return membership;
  }

  async updateMember(groupId: string, memberId: string, dto: UpdateMemberDto, actorId: string) {
    const membership = await this.prisma.groupMember.findFirst({
      where: { id: memberId, groupId, deletedAt: null },
      include: { group: true },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    const beforeState = { role: membership.role, status: membership.status };

    // Validate chairperson constraint for savings groups
    if (dto.role === 'CHAIRPERSON' && membership.group.type === 'SAVINGS') {
      const existingChair = await this.prisma.groupMember.findFirst({
        where: {
          groupId,
          role: 'CHAIRPERSON',
          status: 'ACTIVE',
          deletedAt: null,
          id: { not: memberId },
        },
      });

      if (existingChair) {
        throw new BadRequestException(
          'Group already has a chairperson. Remove current chairperson first.',
        );
      }

      // Check if user is already chair of another savings group
      const userOtherChairship = await this.prisma.groupMember.findFirst({
        where: {
          userId: membership.userId,
          role: 'CHAIRPERSON',
          status: 'ACTIVE',
          deletedAt: null,
          groupId: { not: groupId },
          group: { type: 'SAVINGS', deletedAt: null },
        },
      });

      if (userOtherChairship) {
        throw new BadRequestException(
          'User is already chairperson of another savings group',
        );
      }
    }

    const updated = await this.prisma.groupMember.update({
      where: { id: memberId },
      data: {
        role: dto.role,
        status: dto.status,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await this.auditService.log({
      actorId,
      actorType: 'USER',
      action: 'MEMBER_UPDATED',
      resourceType: 'GROUP_MEMBER',
      resourceId: memberId,
      groupId,
      beforeState,
      afterState: { role: updated.role, status: updated.status },
      outcome: 'SUCCESS',
    });

    return updated;
  }

  async removeMember(groupId: string, memberId: string, actorId: string) {
    const membership = await this.prisma.groupMember.findFirst({
      where: { id: memberId, groupId, deletedAt: null },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // Cannot remove chairperson unless group is being dissolved
    if (membership.role === 'CHAIRPERSON') {
      throw new ForbiddenException(
        'Cannot remove chairperson. Transfer chairperson role first.',
      );
    }

    await this.prisma.groupMember.update({
      where: { id: memberId },
      data: {
        status: 'LEFT',
        leftAt: new Date(),
        deletedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorId,
      actorType: 'USER',
      action: 'MEMBER_REMOVED',
      resourceType: 'GROUP_MEMBER',
      resourceId: memberId,
      groupId,
      beforeState: { userId: membership.userId, role: membership.role },
      outcome: 'SUCCESS',
    });

    return { success: true };
  }
}
