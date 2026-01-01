import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, RoleRequirement } from '../decorators/roles.decorator';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roleRequirement = this.reflector.getAllAndOverride<RoleRequirement>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roleRequirement) {
      return true; // No role requirement
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get groupId from params or body
    const groupId = request.params.groupId || request.body.groupId;

    if (!groupId && roleRequirement.requireGroup !== false) {
      throw new ForbiddenException('Group context required');
    }

    if (groupId) {
      // Check membership and role
      const membership = await this.prisma.groupMember.findFirst({
        where: {
          userId: user.id,
          groupId,
          status: 'ACTIVE',
          deletedAt: null,
        },
      });

      if (!membership) {
        throw new ForbiddenException('You are not a member of this group');
      }

      // Check if user has required role
      const hasRole = roleRequirement.roles.includes(membership.role as any);
      
      if (!hasRole) {
        throw new ForbiddenException(
          `Required role: ${roleRequirement.roles.join(' or ')}. Your role: ${membership.role}`,
        );
      }

      // Attach membership to request for later use
      request.membership = membership;
    }

    return true;
  }
}
