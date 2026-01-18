/**
 * Work Queue Scope Filtering Tests - WI-037: Opportunity → Team Binding
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkQueueService } from '../work-queue.service';
import { Principal } from '../../authz/principal';

describe('WorkQueueService Scope Filtering', () => {
  let workQueueService: WorkQueueService;
  let mockPrisma: any;
  let mockOrgAuthority: any;

  beforeEach(() => {
    mockPrisma = {
      opportunity: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      team: {
        findMany: vi.fn(),
      },
      agency: {
        findMany: vi.fn(),
      },
    };

    mockOrgAuthority = {
      getAuthorityContext: vi.fn(),
    };

    workQueueService = new WorkQueueService(mockPrisma, mockOrgAuthority);
  });

  describe('getWorkQueue scope filtering', () => {
    const mockPrincipal: Principal = {
      tenantId: 'tenant_1',
      userId: 'user_123',
      authType: 'api_key',
      correlationId: 'corr_123',
    };

    it('should filter opportunities by team scope for operators', async () => {
      // Mock authority context for operator with team scope
      mockOrgAuthority.getAuthorityContext.mockResolvedValue({
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [
          {
            id: 'ra_1',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: 'OPERATOR',
            scopeType: 'team',
            scopeId: 'team_1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        resolvedCapabilities: new Set(),
      });

      // Mock accessible scopes
      const getAccessibleScopesSpy = vi.spyOn(
        workQueueService as any,
        'getAccessibleScopes'
      );
      getAccessibleScopesSpy.mockResolvedValue({
        teams: ['team_1'],
        agencies: [],
      });

      // Mock opportunity query
      mockPrisma.opportunity.findMany.mockResolvedValue([
        {
          id: 'opp_1',
          name: 'Test Opportunity',
          stage: 'QUALIFIED',
          teamId: 'team_1',
          team: { id: 'team_1', name: 'Sales Team' },
        },
      ]);
      mockPrisma.opportunity.count.mockResolvedValue(1);

      const result = await workQueueService.getWorkQueue(mockPrincipal);

      // Verify authority context was retrieved
      expect(mockOrgAuthority.getAuthorityContext).toHaveBeenCalledWith(
        mockPrincipal
      );

      // Verify accessible scopes were determined
      expect(getAccessibleScopesSpy).toHaveBeenCalledWith(
        expect.any(Object),
        'tenant_1'
      );

      // Verify query included team scope filtering
      expect(mockPrisma.opportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant_1',
            isActive: true,
            OR: [{ teamId: { in: ['team_1'] } }],
          }),
        })
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter opportunities by enterprise scope for admins', async () => {
      // Mock authority context for enterprise admin
      mockOrgAuthority.getAuthorityContext.mockResolvedValue({
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [
          {
            id: 'ra_1',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: 'ENTERPRISE_ADMIN',
            scopeType: 'enterprise',
            scopeId: 'ent_1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        resolvedCapabilities: new Set(),
      });

      // Mock accessible scopes (enterprise scope expands to all teams/agencies)
      mockPrisma.team.findMany.mockResolvedValue([
        { id: 'team_1' },
        { id: 'team_2' },
      ]);
      mockPrisma.agency.findMany.mockResolvedValue([{ id: 'agency_1' }]);

      // Mock opportunity query
      mockPrisma.opportunity.findMany.mockResolvedValue([
        {
          id: 'opp_1',
          name: 'Enterprise Opportunity',
          stage: 'CLOSED_WON',
          teamId: 'team_1',
        },
      ]);
      mockPrisma.opportunity.count.mockResolvedValue(1);

      const result = await workQueueService.getWorkQueue(mockPrincipal);

      // Verify enterprise expansion to all teams
      expect(mockPrisma.team.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant_1',
          agency: {
            enterpriseId: 'ent_1',
          },
        },
        select: { id: true },
      });

      expect(result.items).toHaveLength(1);
    });

    it('should return empty queue when user has no accessible scopes', async () => {
      // Mock authority context with no role assignments
      mockOrgAuthority.getAuthorityContext.mockResolvedValue({
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [],
        resolvedCapabilities: new Set(),
      });

      const result = await workQueueService.getWorkQueue(mockPrincipal);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(mockPrisma.opportunity.findMany).not.toHaveBeenCalled();
    });

    it('should include unassigned opportunities for agency admins', async () => {
      // Mock authority context for agency admin
      mockOrgAuthority.getAuthorityContext.mockResolvedValue({
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [
          {
            id: 'ra_1',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: 'AGENCY_ADMIN',
            scopeType: 'agency',
            scopeId: 'agency_1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        resolvedCapabilities: new Set(),
      });

      const result = await workQueueService.getWorkQueue(mockPrincipal);

      // Verify query includes unassigned opportunities for agency scope
      expect(mockPrisma.opportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { teamId: { in: [] } }, // No direct team access
              { teamId: null, agencyId: { in: ['agency_1'] } }, // Unassigned in agency
            ],
          }),
        })
      );
    });
  });

  describe('getAccessibleScopes', () => {
    it('should determine accessible teams from role assignments', async () => {
      const authorityContext = {
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [
          {
            id: 'ra_1',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: 'OPERATOR',
            scopeType: 'team',
            scopeId: 'team_1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'ra_2',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: 'TEAM_LEAD',
            scopeType: 'team',
            scopeId: 'team_2',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        resolvedCapabilities: new Set(),
      };

      const result = await (workQueueService as any).getAccessibleScopes(
        authorityContext,
        'tenant_1'
      );

      expect(result.teams).toEqual(['team_1', 'team_2']);
      expect(result.agencies).toEqual([]);
    });

    it('should expand enterprise scope to all teams and agencies', async () => {
      const authorityContext = {
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [
          {
            id: 'ra_1',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: 'ENTERPRISE_ADMIN',
            scopeType: 'enterprise',
            scopeId: 'ent_1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        resolvedCapabilities: new Set(),
      };

      mockPrisma.team.findMany.mockResolvedValue([
        { id: 'team_1' },
        { id: 'team_2' },
        { id: 'team_3' },
      ]);
      mockPrisma.agency.findMany.mockResolvedValue([
        { id: 'agency_1' },
        { id: 'agency_2' },
      ]);

      const result = await (workQueueService as any).getAccessibleScopes(
        authorityContext,
        'tenant_1'
      );

      expect(mockPrisma.team.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant_1',
          agency: {
            enterpriseId: 'ent_1',
          },
        },
        select: { id: true },
      });

      expect(result.teams).toEqual(['team_1', 'team_2', 'team_3']);
      expect(result.agencies).toEqual(['agency_1', 'agency_2']);
    });

    it('should ignore revoked role assignments', async () => {
      const authorityContext = {
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [
          {
            id: 'ra_1',
            tenantId: 'tenant_1',
            memberId: 'member_1',
            role: 'OPERATOR',
            scopeType: 'team',
            scopeId: 'team_1',
            createdAt: new Date(),
            updatedAt: new Date(),
            revokedAt: new Date(), // Revoked
          },
        ],
        resolvedCapabilities: new Set(),
      };

      const result = await (workQueueService as any).getAccessibleScopes(
        authorityContext,
        'tenant_1'
      );

      expect(result.teams).toEqual([]);
      expect(result.agencies).toEqual([]);
    });
  });
});
