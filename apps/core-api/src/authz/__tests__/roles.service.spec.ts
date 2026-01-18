import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RolesService } from '../roles.service';
import { PrismaClient } from '@prisma/client';
import { CANONICAL_ROLES, PERMISSIONS } from '../authz.types';

describe('RolesService', () => {
  let service: RolesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findMany: vi.fn(),
      },
      role: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    service = new RolesService(mockPrisma as unknown as PrismaClient);
    vi.clearAllMocks();
  });

  describe('seedCanonicalRoles', () => {
    it('should seed roles for all tenants', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 't1' },
        { id: 't2' },
      ]);
      mockPrisma.role.findFirst.mockResolvedValue(null);

      // @ts-ignore - call private method
      await service.seedCanonicalRoles();

      expect(mockPrisma.tenant.findMany).toHaveBeenCalled();
      // 4 canonical roles * 2 tenants = 8 creations
      expect(mockPrisma.role.create).toHaveBeenCalledTimes(
        Object.keys(CANONICAL_ROLES).length * 2
      );
    });

    it('should skip if role already exists', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([{ id: 't1' }]);
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'r1' });

      // @ts-ignore
      await service.seedCanonicalRoles();

      expect(mockPrisma.role.create).not.toHaveBeenCalled();
    });
  });

  describe('createRole', () => {
    it('should create custom role', async () => {
      const request = {
        name: 'CustomRole',
        permissions: [PERMISSIONS.WEBHOOKS_READ],
      };
      mockPrisma.role.create.mockResolvedValue({
        id: 'r1',
        tenantId: 't1',
        ...request,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createRole('t1', request);
      expect(result.name).toBe('CustomRole');
      expect(mockPrisma.role.create).toHaveBeenCalled();
    });

    it('should throw if name is reserved', async () => {
      const request = { name: 'TenantAdmin', permissions: [] };
      await expect(service.createRole('t1', request)).rejects.toThrow(
        'Cannot create role with reserved name'
      );
    });
  });

  describe('getPermissionsForRoles', () => {
    it('should aggregate unique permissions', async () => {
      mockPrisma.role.findMany.mockResolvedValue([
        { permissions: ['p1', 'p2'] },
        { permissions: ['p2', 'p3'] },
      ]);

      const result = await service.getPermissionsForRoles(['r1', 'r2']);
      expect(result).toContain('p1');
      expect(result).toContain('p2');
      expect(result).toContain('p3');
      expect(result.length).toBe(3);
    });

    it('should return empty array if no roles provided', async () => {
      const result = await service.getPermissionsForRoles([]);
      expect(result).toEqual([]);
      expect(mockPrisma.role.findMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteRole', () => {
    it('should delete custom role', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'r1', name: 'Custom' });
      await service.deleteRole('t1', 'r1');
      expect(mockPrisma.role.delete).toHaveBeenCalled();
    });

    it('should throw when deleting canonical role', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'r1',
        name: 'TenantAdmin',
      });
      await expect(service.deleteRole('t1', 'r1')).rejects.toThrow(
        'Cannot delete canonical roles'
      );
    });
  });
});
