/**
 * Integration Mapping Tests - WI-038: Org Admin + Integration Mapping Ops Pack
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrgAuthorityService } from '../org-authority.service';
import { AuditService } from '../../audit/audit.service';
import { TenantContext } from '../../config/tenant-context';
import { PrincipalExtractorService } from '../../authz/principal.extractor';

// Mock dependencies
vi.mock('../org-authority.service', () => ({
  // We'll mock the actual service methods
}));

vi.mock('../../audit/audit.service');
vi.mock('../../config/tenant-context');
vi.mock('../../authz/principal.extractor');

describe('OrgAuthorityService Integration Mapping', () => {
  let service: OrgAuthorityService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockTenantContext: any;
  let mockPrincipalExtractor: any;

  beforeEach(() => {
    mockPrisma = {
      orgIntegrationMapping: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
    };

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    mockTenantContext = {
      tenantId: 'tenant_1',
    };

    mockPrincipalExtractor = {};

    service = new OrgAuthorityService(
      mockTenantContext,
      mockPrincipalExtractor,
      mockAuditService
    );

    (service as any).prisma = mockPrisma;
  });

  describe('createIntegrationMapping', () => {
    it('should create integration mapping and audit', async () => {
      const mockMapping = {
        id: 'mapping_1',
        tenantId: 'tenant_1',
        provider: 'ghl',
        locationId: 'loc_123',
        teamId: 'team_1',
        agencyId: 'agency_1',
        description: 'Test mapping',
        createdBy: 'user_1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.orgIntegrationMapping.create.mockResolvedValue({
        ...mockMapping,
        team: { id: 'team_1', name: 'Sales Team' },
        agency: { id: 'agency_1', name: 'Sales Agency' },
      });

      const result = await service.createIntegrationMapping(
        'tenant_1',
        'ghl',
        'loc_123',
        'team_1',
        'agency_1',
        'Test mapping',
        'user_1'
      );

      expect(mockPrisma.orgIntegrationMapping.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant_1',
          provider: 'ghl',
          locationId: 'loc_123',
          teamId: 'team_1',
          agencyId: 'agency_1',
          description: 'Test mapping',
          createdBy: 'user_1',
        },
        include: {
          team: true,
          agency: true,
        },
      });

      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        eventType: 'integration_mapping_created',
        tenantId: 'tenant_1',
        userId: 'user_1',
        resourceId: 'mapping_1',
        resourceType: 'org_integration_mapping',
        action: 'integration_mapping_created',
        details: {
          provider: 'ghl',
          locationId: 'loc_123',
          teamId: 'team_1',
          agencyId: 'agency_1',
          description: 'Test mapping',
        },
      });

      expect(result).toEqual({
        ...mockMapping,
        team: { id: 'team_1', name: 'Sales Team' },
        agency: { id: 'agency_1', name: 'Sales Agency' },
      });
    });

    it('should throw error for duplicate mapping', async () => {
      mockPrisma.orgIntegrationMapping.create.mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint violation',
      });

      await expect(
        service.createIntegrationMapping(
          'tenant_1',
          'ghl',
          'loc_123',
          'team_1',
          undefined,
          undefined,
          'user_1'
        )
      ).rejects.toThrow('Integration mapping already exists for ghl:loc_123');
    });
  });

  describe('listIntegrationMappings', () => {
    it('should list mappings with filters', async () => {
      const mockMappings = [
        {
          id: 'mapping_1',
          provider: 'ghl',
          locationId: 'loc_123',
          teamId: 'team_1',
          team: { id: 'team_1', name: 'Sales Team' },
          agency: { id: 'agency_1', name: 'Sales Agency' },
        },
      ];

      mockPrisma.orgIntegrationMapping.findMany.mockResolvedValue(mockMappings);

      const result = await service.listIntegrationMappings(
        'tenant_1',
        'ghl',
        'team_1'
      );

      expect(mockPrisma.orgIntegrationMapping.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant_1',
          provider: 'ghl',
          teamId: 'team_1',
        },
        include: {
          team: true,
          agency: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual(mockMappings);
    });

    it('should list all mappings without filters', async () => {
      const mockMappings = [
        {
          id: 'mapping_1',
          provider: 'ghl',
          locationId: 'loc_123',
          teamId: 'team_1',
        },
      ];

      mockPrisma.orgIntegrationMapping.findMany.mockResolvedValue(mockMappings);

      const result = await service.listIntegrationMappings('tenant_1');

      expect(mockPrisma.orgIntegrationMapping.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant_1' },
        include: {
          team: true,
          agency: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('deleteIntegrationMapping', () => {
    it('should delete mapping and audit', async () => {
      const mockMapping = {
        id: 'mapping_1',
        tenantId: 'tenant_1',
        provider: 'ghl',
        locationId: 'loc_123',
        teamId: 'team_1',
        agencyId: 'agency_1',
      };

      mockPrisma.orgIntegrationMapping.findUnique.mockResolvedValue(
        mockMapping
      );

      await service.deleteIntegrationMapping('tenant_1', 'mapping_1', 'user_1');

      expect(mockPrisma.orgIntegrationMapping.findUnique).toHaveBeenCalledWith({
        where: { id: 'mapping_1' },
        include: { team: true, agency: true },
      });

      expect(mockPrisma.orgIntegrationMapping.delete).toHaveBeenCalledWith({
        where: { id: 'mapping_1' },
      });

      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        eventType: 'integration_mapping_deleted',
        tenantId: 'tenant_1',
        userId: 'user_1',
        resourceId: 'mapping_1',
        resourceType: 'org_integration_mapping',
        action: 'integration_mapping_deleted',
        details: {
          provider: 'ghl',
          locationId: 'loc_123',
          teamId: 'team_1',
          agencyId: 'agency_1',
        },
      });
    });

    it('should throw error for non-existent mapping', async () => {
      mockPrisma.orgIntegrationMapping.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteIntegrationMapping('tenant_1', 'mapping_1', 'user_1')
      ).rejects.toThrow('Integration mapping not found');
    });

    it('should throw error for wrong tenant', async () => {
      const mockMapping = {
        id: 'mapping_1',
        tenantId: 'tenant_2', // Wrong tenant
        provider: 'ghl',
        locationId: 'loc_123',
        teamId: 'team_1',
      };

      mockPrisma.orgIntegrationMapping.findUnique.mockResolvedValue(
        mockMapping
      );

      await expect(
        service.deleteIntegrationMapping(
          'tenant_1', // Different tenant
          'mapping_1',
          'user_1'
        )
      ).rejects.toThrow('Integration mapping not found');
    });
  });
});
