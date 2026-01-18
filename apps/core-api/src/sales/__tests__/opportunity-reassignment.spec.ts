/**
 * Opportunity Team Reassignment Tests - WI-038: Org Admin + Integration Mapping Ops Pack
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpportunityService } from '../opportunity.service';
import { AuditService } from '../../audit/audit.service';
import { TeamResolverService } from '../../org-authority/team-resolver.service';

// Mock dependencies
vi.mock('../opportunity.service', () => ({
  // We'll mock the actual service methods
}));

vi.mock('../../audit/audit.service');
vi.mock('../../org-authority/team-resolver.service');

describe('OpportunityService Team Reassignment', () => {
  let opportunityService: OpportunityService;
  let mockPrisma: any;
  let mockAuditService: any;
  let mockTeamResolver: any;

  beforeEach(() => {
    mockPrisma = {
      opportunity: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      team: {
        findUnique: vi.fn(),
      },
    };

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    mockTeamResolver = {};

    opportunityService = new OpportunityService(
      mockPrisma,
      mockTeamResolver,
      mockAuditService
    );
  });

  describe('reassignTeam', () => {
    it('should reassign opportunity to different team and audit', async () => {
      // Mock current opportunity
      const currentOpportunity = {
        id: 'opp_1',
        teamId: 'team_1',
        agencyId: 'agency_1',
        value: 50000,
        stage: 'QUALIFIED',
      };

      mockPrisma.opportunity.findUnique.mockResolvedValue(currentOpportunity);

      // Mock new team
      const newTeam = {
        id: 'team_2',
        agencyId: 'agency_2',
        name: 'New Sales Team',
      };

      mockPrisma.team.findUnique.mockResolvedValue(newTeam);

      // Mock updated opportunity
      const updatedOpportunity = {
        ...currentOpportunity,
        teamId: 'team_2',
        agencyId: 'agency_2',
        updatedAt: new Date(),
        updatedBy: 'user_123',
        team: { id: 'team_2', name: 'New Sales Team' },
        agency: { id: 'agency_2', name: 'New Sales Agency' },
      };

      mockPrisma.opportunity.update.mockResolvedValue(updatedOpportunity);

      const result = await opportunityService.reassignTeam(
        'opp_1',
        'tenant_1',
        {
          newTeamId: 'team_2',
          reason: 'Customer requested different team',
          reassignedBy: 'user_123',
          correlationId: 'corr_123',
        }
      );

      // Verify opportunity lookup
      expect(mockPrisma.opportunity.findUnique).toHaveBeenCalledWith({
        where: { id: 'opp_1', tenantId: 'tenant_1' },
        select: {
          id: true,
          teamId: true,
          agencyId: true,
          value: true,
          stage: true,
          externalId: true,
        },
      });

      // Verify new team lookup
      expect(mockPrisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: 'team_2' },
        select: {
          id: true,
          agencyId: true,
          name: true,
        },
      });

      // Verify opportunity update
      expect(mockPrisma.opportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp_1', tenantId: 'tenant_1' },
        data: {
          teamId: 'team_2',
          agencyId: 'agency_2',
          updatedAt: expect.any(Date),
          updatedBy: 'user_123',
        },
        include: {
          team: true,
          agency: true,
        },
      });

      // Verify audit logging
      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        eventType: 'opportunity_team_reassigned',
        tenantId: 'tenant_1',
        userId: 'user_123',
        resourceId: 'opp_1',
        resourceType: 'opportunity',
        action: 'opportunity_team_reassigned',
        details: {
          oldTeamId: 'team_1',
          newTeamId: 'team_2',
          oldAgencyId: 'agency_1',
          newAgencyId: 'agency_2',
          reason: 'Customer requested different team',
          dealValue: 50000,
          stage: 'QUALIFIED',
          externalId: undefined,
          correlationId: 'corr_123',
        },
      });

      expect(result).toEqual(updatedOpportunity);
    });

    it('should throw error for non-existent opportunity', async () => {
      mockPrisma.opportunity.findUnique.mockResolvedValue(null);

      await expect(
        opportunityService.reassignTeam('opp_nonexistent', 'tenant_1', {
          newTeamId: 'team_2',
          reason: 'Test',
          reassignedBy: 'user_123',
          correlationId: 'corr_123',
        })
      ).rejects.toThrow('Opportunity opp_nonexistent not found');
    });

    it('should throw error for non-existent new team', async () => {
      // Mock existing opportunity
      mockPrisma.opportunity.findUnique.mockResolvedValue({
        id: 'opp_1',
        teamId: 'team_1',
        agencyId: 'agency_1',
        value: 25000,
        stage: 'PROSPECT_IDENTIFIED',
      });

      // Mock non-existent new team
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(
        opportunityService.reassignTeam('opp_1', 'tenant_1', {
          newTeamId: 'team_nonexistent',
          reason: 'Test',
          reassignedBy: 'user_123',
          correlationId: 'corr_123',
        })
      ).rejects.toThrow('Team team_nonexistent not found');
    });

    it('should handle team-to-agency changes', async () => {
      // Mock opportunity in team_1 (agency_1)
      const currentOpportunity = {
        id: 'opp_1',
        teamId: 'team_1',
        agencyId: 'agency_1',
        value: 100000,
        stage: 'NEGOTIATION',
      };

      mockPrisma.opportunity.findUnique.mockResolvedValue(currentOpportunity);

      // Mock new team in different agency
      const newTeam = {
        id: 'team_2',
        agencyId: 'agency_2',
        name: 'Enterprise Team',
      };

      mockPrisma.team.findUnique.mockResolvedValue(newTeam);

      // Mock updated opportunity
      const updatedOpportunity = {
        ...currentOpportunity,
        teamId: 'team_2',
        agencyId: 'agency_2',
        team: newTeam,
        agency: { id: 'agency_2', name: 'Enterprise Agency' },
      };

      mockPrisma.opportunity.update.mockResolvedValue(updatedOpportunity);

      const result = await opportunityService.reassignTeam(
        'opp_1',
        'tenant_1',
        {
          newTeamId: 'team_2',
          reason: 'High-value deal requires enterprise team',
          reassignedBy: 'admin_user',
          correlationId: 'corr_123',
        }
      );

      expect(mockPrisma.opportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp_1', tenantId: 'tenant_1' },
        data: {
          teamId: 'team_2',
          agencyId: 'agency_2', // Changed agency
          updatedAt: expect.any(Date),
          updatedBy: 'admin_user',
        },
        include: {
          team: true,
          agency: true,
        },
      });

      // Verify audit includes agency change
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            oldTeamId: 'team_1',
            newTeamId: 'team_2',
            oldAgencyId: 'agency_1',
            newAgencyId: 'agency_2',
            reason: 'High-value deal requires enterprise team',
          }),
        })
      );
    });

    it('should handle reassignment from unassigned opportunity', async () => {
      // Mock unassigned opportunity
      const currentOpportunity = {
        id: 'opp_1',
        teamId: null, // Unassigned
        agencyId: null,
        value: 15000,
        stage: 'LEAD',
      };

      mockPrisma.opportunity.findUnique.mockResolvedValue(currentOpportunity);

      // Mock new team
      const newTeam = {
        id: 'team_3',
        agencyId: 'agency_1',
        name: 'Inbound Team',
      };

      mockPrisma.team.findUnique.mockResolvedValue(newTeam);

      const updatedOpportunity = {
        ...currentOpportunity,
        teamId: 'team_3',
        agencyId: 'agency_1',
        team: newTeam,
        agency: { id: 'agency_1', name: 'Sales Agency' },
      };

      mockPrisma.opportunity.update.mockResolvedValue(updatedOpportunity);

      const result = await opportunityService.reassignTeam(
        'opp_1',
        'tenant_1',
        {
          newTeamId: 'team_3',
          reason: 'Assigning to inbound team',
          reassignedBy: 'dispatcher_user',
          correlationId: 'corr_123',
        }
      );

      // Verify audit shows null old values
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            oldTeamId: null,
            newTeamId: 'team_3',
            oldAgencyId: null,
            newAgencyId: 'agency_1',
          }),
        })
      );
    });
  });
});
