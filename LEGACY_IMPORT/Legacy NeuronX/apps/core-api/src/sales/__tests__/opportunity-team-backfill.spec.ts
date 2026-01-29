/**
 * Opportunity Team Backfill Tests - WI-038: Org Admin + Integration Mapping Ops Pack
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpportunityTeamBackfillRunner } from '../opportunity-team-backfill.runner';
import { TeamResolverService } from '../../org-authority/team-resolver.service';
import { AuditService } from '../../audit/audit.service';

// Mock dependencies
vi.mock('../opportunity-team-backfill.runner', () => ({
  // We'll mock the actual runner methods
}));

vi.mock('../../org-authority/team-resolver.service');
vi.mock('../../audit/audit.service');

describe('OpportunityTeamBackfillRunner', () => {
  let runner: OpportunityTeamBackfillRunner;
  let mockPrisma: any;
  let mockTeamResolver: any;
  let mockAuditService: any;

  beforeEach(() => {
    mockPrisma = {
      opportunity: {
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
    };

    mockTeamResolver = {
      resolveTeam: vi.fn(),
    };

    mockAuditService = {
      logEvent: vi.fn().mockResolvedValue(undefined),
    };

    runner = new OpportunityTeamBackfillRunner(
      mockPrisma,
      mockTeamResolver,
      mockAuditService,
      {} as any // ConfigService
    );
  });

  describe('run backfill', () => {
    it('should backfill teams for opportunities with location IDs', async () => {
      const mockOpportunities = [
        {
          id: 'opp_1',
          externalId: 'ext_1',
          locationId: 'loc_123',
          pipelineId: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'opp_2',
          externalId: 'ext_2',
          locationId: null,
          pipelineId: 'pipe_456',
          createdAt: new Date('2024-01-02'),
        },
      ];

      mockPrisma.opportunity.findMany.mockResolvedValue(mockOpportunities);

      // Mock team resolution for first opportunity
      mockTeamResolver.resolveTeam
        .mockResolvedValueOnce({
          teamId: 'team_1',
          agencyId: 'agency_1',
          resolutionSource: 'mapping',
          confidence: 0.95,
        })
        // Mock team resolution for second opportunity
        .mockResolvedValueOnce({
          teamId: 'team_2',
          agencyId: 'agency_1',
          resolutionSource: 'default',
          confidence: 0.7,
        });

      const options = {
        tenantId: 'tenant_1',
        dryRun: false,
        batchSize: 10,
        maxRows: 100,
        correlationId: 'corr_123',
      };

      const result = await runner.run(options);

      expect(mockPrisma.opportunity.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant_1',
          teamId: null,
          OR: [{ locationId: { not: null } }, { pipelineId: { not: null } }],
        },
        select: {
          id: true,
          externalId: true,
          locationId: true,
          pipelineId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      // Should update first opportunity
      expect(mockPrisma.opportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp_1' },
        data: {
          teamId: 'team_1',
          agencyId: 'agency_1',
          updatedAt: expect.any(Date),
        },
      });

      // Should update second opportunity
      expect(mockPrisma.opportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp_2' },
        data: {
          teamId: 'team_2',
          agencyId: 'agency_1',
          updatedAt: expect.any(Date),
        },
      });

      // Should audit both updates
      expect(mockAuditService.logEvent).toHaveBeenCalledTimes(2);
      expect(mockAuditService.logEvent).toHaveBeenNthCalledWith(1, {
        eventType: 'opportunity_team_backfilled',
        tenantId: 'tenant_1',
        userId: 'system',
        resourceId: 'opp_1',
        resourceType: 'opportunity',
        action: 'opportunity_team_backfilled',
        details: {
          teamId: 'team_1',
          agencyId: 'agency_1',
          resolutionSource: 'mapping',
          confidence: 0.95,
          locationId: 'loc_123',
          pipelineId: null,
          correlationId: 'corr_123',
        },
      });

      expect(result).toEqual({
        processed: 2,
        updated: 2,
        errors: 0,
        skipped: 0,
        dryRun: false,
        duration: expect.any(Number),
      });
    });

    it('should handle dry run mode', async () => {
      const mockOpportunities = [
        {
          id: 'opp_1',
          externalId: 'ext_1',
          locationId: 'loc_123',
          pipelineId: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      mockPrisma.opportunity.findMany.mockResolvedValue(mockOpportunities);
      mockTeamResolver.resolveTeam.mockResolvedValue({
        teamId: 'team_1',
        agencyId: 'agency_1',
        resolutionSource: 'mapping',
        confidence: 0.95,
      });

      const options = {
        tenantId: 'tenant_1',
        dryRun: true,
        batchSize: 10,
        maxRows: 100,
        correlationId: 'corr_123',
      };

      const result = await runner.run(options);

      // Should not update opportunities in dry run
      expect(mockPrisma.opportunity.update).not.toHaveBeenCalled();
      expect(mockAuditService.logEvent).not.toHaveBeenCalled();

      expect(result).toEqual({
        processed: 1,
        updated: 1,
        errors: 0,
        skipped: 0,
        dryRun: true,
        duration: expect.any(Number),
      });
    });

    it('should skip opportunities that cannot be resolved', async () => {
      const mockOpportunities = [
        {
          id: 'opp_1',
          externalId: 'ext_1',
          locationId: 'loc_unknown',
          pipelineId: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      mockPrisma.opportunity.findMany.mockResolvedValue(mockOpportunities);
      mockTeamResolver.resolveTeam.mockResolvedValue({
        teamId: null, // No team resolved
        resolutionSource: 'unmapped',
      });

      const options = {
        tenantId: 'tenant_1',
        dryRun: false,
        batchSize: 10,
        maxRows: 100,
        correlationId: 'corr_123',
      };

      const result = await runner.run(options);

      // Should not update opportunity
      expect(mockPrisma.opportunity.update).not.toHaveBeenCalled();
      expect(mockAuditService.logEvent).not.toHaveBeenCalled();

      expect(result).toEqual({
        processed: 1,
        updated: 0,
        errors: 0,
        skipped: 1,
        dryRun: false,
        duration: expect.any(Number),
      });
    });

    it('should handle resolution errors gracefully', async () => {
      const mockOpportunities = [
        {
          id: 'opp_1',
          externalId: 'ext_1',
          locationId: 'loc_error',
          pipelineId: null,
          createdAt: new Date('2024-01-01'),
        },
      ];

      mockPrisma.opportunity.findMany.mockResolvedValue(mockOpportunities);
      mockTeamResolver.resolveTeam.mockRejectedValue(
        new Error('Resolution failed')
      );

      const options = {
        tenantId: 'tenant_1',
        dryRun: false,
        batchSize: 10,
        maxRows: 100,
        correlationId: 'corr_123',
      };

      const result = await runner.run(options);

      // Should not update opportunity
      expect(mockPrisma.opportunity.update).not.toHaveBeenCalled();
      expect(mockAuditService.logEvent).not.toHaveBeenCalled();

      expect(result).toEqual({
        processed: 1,
        updated: 0,
        errors: 1,
        skipped: 0,
        dryRun: false,
        duration: expect.any(Number),
      });
    });

    it('should respect maxRows limit', async () => {
      const mockOpportunities = Array(150)
        .fill(null)
        .map((_, i) => ({
          id: `opp_${i}`,
          externalId: `ext_${i}`,
          locationId: `loc_${i}`,
          pipelineId: null,
          createdAt: new Date('2024-01-01'),
        }));

      mockPrisma.opportunity.findMany.mockResolvedValue(
        mockOpportunities.slice(0, 50)
      ); // Simulate maxRows limit
      mockTeamResolver.resolveTeam.mockResolvedValue({
        teamId: 'team_1',
        agencyId: 'agency_1',
        resolutionSource: 'mapping',
        confidence: 0.95,
      });

      const options = {
        tenantId: 'tenant_1',
        dryRun: false,
        batchSize: 10,
        maxRows: 50,
        correlationId: 'corr_123',
      };

      const result = await runner.run(options);

      expect(mockPrisma.opportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );

      expect(result.processed).toBe(50);
    });
  });

  describe('getBackfillStats', () => {
    it('should return comprehensive backfill statistics', async () => {
      mockPrisma.opportunity.count
        .mockResolvedValueOnce(1000) // totalOpportunities
        .mockResolvedValueOnce(200) // unassignedOpportunities
        .mockResolvedValueOnce(800) // assignedOpportunities
        .mockResolvedValueOnce(300) // opportunitiesWithLocationId
        .mockResolvedValueOnce(150); // opportunitiesWithPipelineId

      const stats = await runner.getBackfillStats('tenant_1');

      expect(mockPrisma.opportunity.count).toHaveBeenCalledTimes(5);
      expect(mockPrisma.opportunity.count).toHaveBeenNthCalledWith(1, {
        where: { tenantId: 'tenant_1' },
      });
      expect(mockPrisma.opportunity.count).toHaveBeenNthCalledWith(2, {
        where: { tenantId: 'tenant_1', teamId: null },
      });
      expect(mockPrisma.opportunity.count).toHaveBeenNthCalledWith(3, {
        where: { tenantId: 'tenant_1', teamId: { not: null } },
      });
      expect(mockPrisma.opportunity.count).toHaveBeenNthCalledWith(4, {
        where: { tenantId: 'tenant_1', locationId: { not: null } },
      });
      expect(mockPrisma.opportunity.count).toHaveBeenNthCalledWith(5, {
        where: { tenantId: 'tenant_1', pipelineId: { not: null } },
      });

      expect(stats).toEqual({
        totalOpportunities: 1000,
        unassignedOpportunities: 200,
        assignedOpportunities: 800,
        opportunitiesWithLocationId: 300,
        opportunitiesWithPipelineId: 150,
      });
    });
  });
});
