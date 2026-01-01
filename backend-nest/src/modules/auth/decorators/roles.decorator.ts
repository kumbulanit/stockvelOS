import { SetMetadata } from '@nestjs/common';

export type Role = 'MEMBER' | 'TREASURER' | 'SECRETARY' | 'CHAIRPERSON';

export interface RoleRequirement {
  roles: Role[];
  requireGroup?: boolean;
}

export const ROLES_KEY = 'roles';

/**
 * Decorator to require specific roles for an endpoint
 * @param roles - Array of roles that can access the endpoint
 */
export const Roles = (...roles: Role[]) =>
  SetMetadata(ROLES_KEY, { roles, requireGroup: true } as RoleRequirement);

/**
 * Decorator for treasurer or higher
 */
export const TreasurerOrHigher = () => Roles('TREASURER', 'CHAIRPERSON');

/**
 * Decorator for chairperson only
 */
export const ChairpersonOnly = () => Roles('CHAIRPERSON');

/**
 * Decorator for any member
 */
export const AnyMember = () => Roles('MEMBER', 'TREASURER', 'SECRETARY', 'CHAIRPERSON');
