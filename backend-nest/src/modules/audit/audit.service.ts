import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActorType, AuditOutcome } from '@prisma/client';

export interface AuditLogInput {
  actorId?: string;
  actorType: keyof typeof ActorType;
  action: string;
  resourceType: string;
  resourceId?: string;
  groupId?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  outcome: keyof typeof AuditOutcome;
  errorCode?: string;
  errorMessage?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId,
          actorType: input.actorType as ActorType,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          groupId: input.groupId,
          beforeState: input.beforeState,
          afterState: input.afterState,
          metadata: input.metadata,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          outcome: input.outcome as AuditOutcome,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
        },
      });
    } catch (error) {
      // Log to console but don't throw - audit logging should not break the main flow
      console.error('Failed to write audit log:', error);
    }
  }

  async getAuditLogs(filters: {
    groupId?: string;
    actorId?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const { limit = 50, offset = 0, ...where } = filters;

    const logs = await this.prisma.auditLog.findMany({
      where: {
        ...(where.groupId && { groupId: where.groupId }),
        ...(where.actorId && { actorId: where.actorId }),
        ...(where.resourceType && { resourceType: where.resourceType }),
        ...(where.resourceId && { resourceId: where.resourceId }),
        ...(where.action && { action: { contains: where.action } }),
        ...(where.startDate || where.endDate
          ? {
              createdAt: {
                ...(where.startDate && { gte: where.startDate }),
                ...(where.endDate && { lte: where.endDate }),
              },
            }
          : {}),
      },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.auditLog.count({
      where: {
        ...(where.groupId && { groupId: where.groupId }),
        ...(where.actorId && { actorId: where.actorId }),
        ...(where.resourceType && { resourceType: where.resourceType }),
        ...(where.action && { action: { contains: where.action } }),
      },
    });

    return { logs, total, limit, offset };
  }
}
