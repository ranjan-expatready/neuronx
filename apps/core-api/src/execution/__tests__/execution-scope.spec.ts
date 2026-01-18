/**
 * Execution Scope Enforcement Tests - WI-037: Opportunity → Team Binding
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionService } from '../execution.service';
import { Principal } from '../../authz/principal';
import { RiskLevel } from '@neuronx/org-authority';

// Mock dependencies
vi.mock('../execution.repository');
vi.mock('../../audit/audit.service');
vi.mock('../../config/tenant-context');
vi.mock('../../org-authority/org-authority.service');

describe('ExecutionService Scope Enforcement', () => {
  let executionService: ExecutionService;
  let mockPrisma: any;
  let mockOrgAuthority: any;
  let mockTenantContext: any;

  beforeEach(() => {
    mockPrisma = {
      opportunity: {
        findUnique: vi.fn(),
      },
    };

    mockOrgAuthority = {
      getAuthorityContext: vi.fn(),
      assertCanActOnTeam: vi.fn(),
      requireCapability: vi.fn(),
      getApprovalRequirement: vi.fn().mockReturnValue({
        required: true,
        requiredCapabilities: ['APPROVE_MEDIUM_RISK_EXECUTION'],
        reason: 'Medium risk requires approval',
      }),
    };

    mockTenantContext = {
      tenantId: 'tenant_1',
    };

    executionService = new ExecutionService(
      {} as any, // token repo
      {} as any, // idempotency repo
      {} as any, // audit service
      mockTenantContext,
      mockOrgAuthority
    );

    (executionService as any).prisma = mockPrisma;
  });

  describe('approveExecution scope enforcement', () => {
    const mockPrincipal: Principal = {
      tenantId: 'tenant_1',
      userId: 'user_123',
      authType: 'api_key',
      correlationId: 'corr_123',
    };

    it('should enforce team scope for opportunity approval', async () => {
      // Mock opportunity with team binding
      mockPrisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp_1',
        tenantId: 'tenant_1',
        teamId: 'team_1',
        agencyId: 'agency_1',
        value: 50000,
        stage: 'QUALIFIED',
      });

      // Mock authority context
      mockOrgAuthority.getAuthorityContext.mockResolvedValue({
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [],
        resolvedCapabilities: new Set(['APPROVE_MEDIUM_RISK_EXECUTION']),
      });

      // Mock execution authority
      (executionService as any).executionAuthority = {
        issueToken: vi.fn().mockResolvedValue({ tokenId: 'token_123' }),
      };

      const result = await executionService.approveExecution(
        mockPrincipal,
        'opp_1',
        'Approval note',
        'corr_123',
        RiskLevel.MEDIUM,
        50000
      );

      // Verify opportunity was loaded
      expect(mockPrisma.opportunity.findUnique).toHaveBeenCalledWith({
        where: { id: 'opp_1' },
        select: {
          id: true,
          tenantId: true,
          teamId: true,
          agencyId: true,
          value: true,
          stage: true,
        },
      });

      // Verify team scope check was performed
      expect(mockOrgAuthority.assertCanActOnTeam).toHaveBeenCalledWith(
        expect.any(Object), // authority context
        'team_1'
      );

      // Verify approval requirement was checked
      expect(mockOrgAuthority.requireCapability).toHaveBeenCalledWith(
        mockPrincipal,
        'APPROVE_MEDIUM_RISK_EXECUTION'
      );

      expect(result).toHaveProperty('token');
    });

    it('should reject approval for unassigned opportunities', async () => {
      // Mock opportunity without team binding
      mockPrisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp_1',
        tenantId: 'tenant_1',
        teamId: null,
        agencyId: null,
        value: 25000,
        stage: 'PROSPECT_IDENTIFIED',
      });

      await expect(
        executionService.approveExecution(
          mockPrincipal,
          'opp_1',
          'Approval note',
          'corr_123'
        )
      ).rejects.toThrow('is not assigned to a team and cannot be approved');
    });

    it('should reject approval when operator lacks team scope', async () => {
      // Mock opportunity with team binding
      mockPrisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp_1',
        tenantId: 'tenant_1',
        teamId: 'team_1',
        value: 50000,
        stage: 'QUALIFIED',
      });

      // Mock authority context
      mockOrgAuthority.getAuthorityContext.mockResolvedValue({
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [],
        resolvedCapabilities: new Set(['APPROVE_MEDIUM_RISK_EXECUTION']),
      });

      // Mock scope check to fail
      mockOrgAuthority.assertCanActOnTeam.mockRejectedValue(
        new Error('Insufficient scope to act on team team_1')
      );

      await expect(
        executionService.approveExecution(
          mockPrincipal,
          'opp_1',
          'Approval note',
          'corr_123'
        )
      ).rejects.toThrow('Insufficient scope to act on team team_1');
    });

    it('should reject approval when operator lacks capability', async () => {
      // Mock opportunity with team binding
      mockPrisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp_1',
        tenantId: 'tenant_1',
        teamId: 'team_1',
        value: 50000,
        stage: 'QUALIFIED',
      });

      // Mock authority context
      mockOrgAuthority.getAuthorityContext.mockResolvedValue({
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [],
        resolvedCapabilities: new Set(), // No capabilities
      });

      // Mock scope check to pass
      mockOrgAuthority.assertCanActOnTeam.mockResolvedValue(undefined);

      // Mock capability check to fail
      mockOrgAuthority.requireCapability.mockRejectedValue(
        new Error('Insufficient capabilities')
      );

      await expect(
        executionService.approveExecution(
          mockPrincipal,
          'opp_1',
          'Approval note',
          'corr_123'
        )
      ).rejects.toThrow('Insufficient capabilities');
    });
  });

  describe('executeCommand scope enforcement', () => {
    const mockPrincipal: Principal = {
      tenantId: 'tenant_1',
      userId: 'user_123',
      authType: 'api_key',
      correlationId: 'corr_123',
    };

    it('should enforce team scope during execution', async () => {
      // Mock token verification
      (executionService as any).executionAuthority = {
        verifyToken: vi.fn().mockResolvedValue({
          valid: true,
          canUse: true,
          token: {
            tokenId: 'token_123',
            opportunityId: 'opp_1',
          },
        }),
        markTokenUsed: vi.fn().mockResolvedValue(undefined),
      };

      // Mock opportunity lookup
      mockPrisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp_1',
        teamId: 'team_1',
      });

      // Mock authority context
      mockOrgAuthority.getAuthorityContext.mockResolvedValue({
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [],
        resolvedCapabilities: new Set(),
      });

      // Mock scope check
      mockOrgAuthority.assertCanActOnTeam.mockResolvedValue(undefined);

      const result = await executionService.executeCommand(
        'token_123',
        'idempotency_123',
        mockPrincipal,
        'corr_123'
      );

      // Verify opportunity was looked up
      expect(mockPrisma.opportunity.findUnique).toHaveBeenCalledWith({
        where: { id: 'opp_1' },
        select: { teamId: true },
      });

      // Verify team scope check was performed
      expect(mockOrgAuthority.assertCanActOnTeam).toHaveBeenCalledWith(
        expect.any(Object),
        'team_1'
      );

      // Verify token was marked as used
      expect(
        (executionService as any).executionAuthority.markTokenUsed
      ).toHaveBeenCalledWith('token_123', 'user_123');

      expect(result).toHaveProperty('status', 'success');
    });

    it('should skip scope check for tokens without opportunity ID', async () => {
      (executionService as any).executionAuthority = {
        verifyToken: vi.fn().mockResolvedValue({
          valid: true,
          canUse: true,
          token: {
            tokenId: 'token_123',
            opportunityId: null, // No opportunity
          },
        }),
        markTokenUsed: vi.fn().mockResolvedValue(undefined),
      };

      const result = await executionService.executeCommand(
        'token_123',
        'idempotency_123',
        mockPrincipal,
        'corr_123'
      );

      // Should not check opportunity or scope
      expect(mockPrisma.opportunity.findUnique).not.toHaveBeenCalled();
      expect(mockOrgAuthority.assertCanActOnTeam).not.toHaveBeenCalled();

      expect(result).toHaveProperty('status', 'success');
    });
  });

  describe('planExecution opportunity enrichment', () => {
    it('should enrich execution context with opportunity data', async () => {
      // Mock opportunity lookup
      mockPrisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp_1',
        tenantId: 'tenant_1',
        teamId: 'team_1',
        agencyId: 'agency_1',
        value: 75000,
        stage: 'NEGOTIATION',
      });

      // Mock execution authority
      (executionService as any).executionAuthority = {
        planExecution: vi.fn().mockResolvedValue({
          allowed: true,
          channel: 'voice',
          actor: 'AI',
          mode: 'AUTONOMOUS',
        }),
      };

      const context = {
        tenantId: 'tenant_1',
        opportunityId: 'opp_1',
        executionCommand: {
          commandId: 'cmd_1',
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'high',
        },
        decisionResult: {
          allowed: true,
          actor: 'AI' as any,
          mode: 'AUTONOMOUS',
          voiceMode: 'SCRIPTED',
        },
        correlationId: 'corr_123',
      };

      const result = await executionService.planExecution(context);

      // Verify opportunity was looked up
      expect(mockPrisma.opportunity.findUnique).toHaveBeenCalledWith({
        where: { id: 'opp_1' },
        select: {
          id: true,
          tenantId: true,
          teamId: true,
          agencyId: true,
          value: true,
          stage: true,
        },
      });

      // Verify enriched context was passed to execution authority
      expect(
        (executionService as any).executionAuthority.planExecution
      ).toHaveBeenCalledWith({
        ...context,
        currentStage: 'NEGOTIATION',
        dealValue: 75000,
      });
    });

    it('should handle missing opportunities', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(null);

      const context = {
        tenantId: 'tenant_1',
        opportunityId: 'opp_missing',
        executionCommand: {
          commandId: 'cmd_1',
          commandType: 'EXECUTE_CONTACT',
        },
        decisionResult: {
          allowed: true,
          actor: 'AI' as any,
          mode: 'AUTONOMOUS',
        },
        correlationId: 'corr_123',
      };

      await expect(executionService.planExecution(context)).rejects.toThrow(
        'Opportunity opp_missing not found'
      );
    });
  });
});
