/**
 * Roles Service - WI-022: Access Control & API Key Governance
 *
 * Manages RBAC roles and seeds canonical roles.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CANONICAL_ROLES, RoleCreateRequest, RoleRecord } from './authz.types';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly prisma: PrismaClient) {}

  async onModuleInit() {
    await this.seedCanonicalRoles();
  }

  /**
   * Seed canonical roles for all tenants
   */
  private async seedCanonicalRoles(): Promise<void> {
    // Get all tenant IDs that need canonical roles
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true },
    });

    const tenantIds = tenants.map(t => t.id);

    for (const tenantId of tenantIds) {
      await this.seedTenantRoles(tenantId);
    }

    this.logger.log('Canonical roles seeded for all tenants', {
      tenantCount: tenantIds.length,
      rolesCount: Object.keys(CANONICAL_ROLES).length,
    });
  }

  /**
   * Seed canonical roles for a specific tenant
   */
  private async seedTenantRoles(tenantId: string): Promise<void> {
    for (const [roleName, roleDef] of Object.entries(CANONICAL_ROLES)) {
      const existingRole = await this.prisma.role.findFirst({
        where: {
          tenantId,
          name: roleName,
        },
      });

      if (!existingRole) {
        await this.prisma.role.create({
          data: {
            tenantId,
            name: roleName,
            permissions: roleDef.permissions,
          },
        });

        this.logger.debug('Seeded canonical role', {
          tenantId,
          roleName,
          permissions: roleDef.permissions,
        });
      }
    }
  }

  /**
   * Get role by ID
   */
  async getRole(tenantId: string, roleId: string): Promise<RoleRecord | null> {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId,
      },
    });

    return role ? this.mapPrismaToRole(role) : null;
  }

  /**
   * Get role by name
   */
  async getRoleByName(
    tenantId: string,
    roleName: string
  ): Promise<RoleRecord | null> {
    const role = await this.prisma.role.findFirst({
      where: {
        tenantId,
        name: roleName,
      },
    });

    return role ? this.mapPrismaToRole(role) : null;
  }

  /**
   * List roles for tenant
   */
  async listRoles(tenantId: string): Promise<RoleRecord[]> {
    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return roles.map(this.mapPrismaToRole);
  }

  /**
   * Create custom role
   */
  async createRole(
    tenantId: string,
    request: RoleCreateRequest
  ): Promise<RoleRecord> {
    // Validate role name doesn't conflict with canonical roles
    if (CANONICAL_ROLES[request.name as keyof typeof CANONICAL_ROLES]) {
      throw new Error(`Cannot create role with reserved name: ${request.name}`);
    }

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: request.name,
        permissions: request.permissions,
      },
    });

    this.logger.log('Custom role created', {
      tenantId,
      roleId: role.id,
      roleName: role.name,
      permissions: role.permissions,
    });

    return this.mapPrismaToRole(role);
  }

  /**
   * Update role permissions
   */
  async updateRole(
    tenantId: string,
    roleId: string,
    permissions: string[]
  ): Promise<RoleRecord> {
    // Check if it's a canonical role (cannot be modified)
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId,
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    if (CANONICAL_ROLES[role.name as keyof typeof CANONICAL_ROLES]) {
      throw new Error('Cannot modify canonical roles');
    }

    const updatedRole = await this.prisma.role.update({
      where: { id: roleId },
      data: { permissions },
    });

    this.logger.log('Role updated', {
      tenantId,
      roleId,
      roleName: updatedRole.name,
      permissions: updatedRole.permissions,
    });

    return this.mapPrismaToRole(updatedRole);
  }

  /**
   * Delete custom role
   */
  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId,
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    if (CANONICAL_ROLES[role.name as keyof typeof CANONICAL_ROLES]) {
      throw new Error('Cannot delete canonical roles');
    }

    await this.prisma.role.delete({
      where: { id: roleId },
    });

    this.logger.log('Role deleted', {
      tenantId,
      roleId,
      roleName: role.name,
    });
  }

  /**
   * Get permissions for role IDs
   */
  async getPermissionsForRoles(roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
      },
      select: {
        permissions: true,
      },
    });

    const permissions = new Set<string>();
    roles.forEach(role => {
      role.permissions.forEach(perm => permissions.add(perm));
    });

    return Array.from(permissions);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private mapPrismaToRole(prismaRole: any): RoleRecord {
    return {
      id: prismaRole.id,
      tenantId: prismaRole.tenantId,
      name: prismaRole.name,
      permissions: prismaRole.permissions,
      createdAt: prismaRole.createdAt,
      updatedAt: prismaRole.updatedAt,
    };
  }
}
