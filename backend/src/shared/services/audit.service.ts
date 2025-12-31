import { prisma } from '../../infrastructure/database.js';
import type { Prisma } from '@prisma/client';

export interface AuditLogData {
  actorId?: string;
  actorType: 'user' | 'system' | 'api_key';
  action: string;
  resourceType: string;
  resourceId?: string;
  stokvelId?: string;
  payload?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    request?: Record<string, unknown>;
  };
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
  outcome: 'success' | 'failure';
  errorCode?: string;
}

export class AuditService {
  async log(data: AuditLogData): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        actorType: data.actorType,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        stokvelId: data.stokvelId,
        payload: data.payload as Prisma.InputJsonValue,
        metadata: data.metadata as Prisma.InputJsonValue,
        outcome: data.outcome,
        errorCode: data.errorCode,
      },
    });
  }

  async getByResource(resourceType: string, resourceId: string) {
    return prisma.auditLog.findMany({
      where: {
        resourceType,
        resourceId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getByActor(actorId: string, limit = 100) {
    return prisma.auditLog.findMany({
      where: {
        actorId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  async getByStokvel(stokvelId: string, limit = 100) {
    return prisma.auditLog.findMany({
      where: {
        stokvelId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }
}

export const auditService = new AuditService();
