/**
 * Opportunity Team Backfill Runner - WI-038: Org Admin + Integration Mapping Ops Pack
 *
 * Idempotent runner to backfill team assignments for existing opportunities
 * that were created before team binding was implemented.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TeamResolverService } from '../org-authority/team-resolver.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';

export interface BackfillOptions {
  tenantId: string;
  dryRun?: boolean;
  batchSize?: number;
  maxRows?: number;
  correlationId: string;
}

export interface BackfillResult {
  processed: number;
  updated: number;
  errors: number;
  skipped: number;
  dryRun: boolean;
  duration: number;
}

@Injectable()
export class OpportunityTeamBackfillRunner {
  private readonly logger = new Logger(OpportunityTeamBackfillRunner.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly teamResolver: TeamResolverService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Run the opportunity team backfill
   */
  async run(options: BackfillOptions): Promise<BackfillResult> {
    const startTime = Date.now();
    const {
      tenantId,
      dryRun = false,
      batchSize = 100,
      maxRows = 10000,
      correlationId,
    } = options;

    this.logger.log(`Starting opportunity team backfill`, {
      tenantId,
      dryRun,
      batchSize,
      maxRows,
      correlationId,
    });

    let processed = 0;
    let updated = 0;
    let errors = 0;
    let skipped = 0;

    try {
      // Find opportunities without team binding
      const opportunities = await this.prisma.opportunity.findMany({
        where: {
          tenantId,
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
        take: maxRows,
      });

      this.logger.log(
        `Found ${opportunities.length} opportunities to process`,
        {
          tenantId,
          correlationId,
        }
      );

      // Process in batches
      for (let i = 0; i < opportunities.length; i += batchSize) {
        const batch = opportunities.slice(i, i + batchSize);

        for (const opportunity of batch) {
          try {
            processed++;

            // Try to resolve team
            const resolution = await this.teamResolver.resolveTeam({
              tenantId,
              provider: 'ghl', // Assume GHL for now, could be extended
              locationId: opportunity.locationId || undefined,
              pipelineId: opportunity.pipelineId || undefined,
              correlationId,
            });

            if (resolution.teamId) {
              if (!dryRun) {
                // Update opportunity with team binding
                await this.prisma.opportunity.update({
                  where: { id: opportunity.id },
                  data: {
                    teamId: resolution.teamId,
                    agencyId: resolution.agencyId || undefined,
                    updatedAt: new Date(),
                  },
                });

                // Audit the backfill
                await this.auditService.logEvent({
                  eventType: 'opportunity_team_backfilled',
                  tenantId,
                  userId: 'system',
                  resourceId: opportunity.id,
                  resourceType: 'opportunity',
                  action: 'opportunity_team_backfilled',
                  details: {
                    teamId: resolution.teamId,
                    agencyId: resolution.agencyId,
                    resolutionSource: resolution.resolutionSource,
                    confidence: resolution.confidence,
                    locationId: opportunity.locationId,
                    pipelineId: opportunity.pipelineId,
                    correlationId,
                  },
                });
              }

              updated++;
              this.logger.debug(
                `Backfilled team for opportunity ${opportunity.id}`,
                {
                  teamId: resolution.teamId,
                  resolutionSource: resolution.resolutionSource,
                  correlationId,
                }
              );
            } else {
              skipped++;
              this.logger.debug(
                `No team mapping found for opportunity ${opportunity.id}`,
                {
                  locationId: opportunity.locationId,
                  pipelineId: opportunity.pipelineId,
                  correlationId,
                }
              );
            }
          } catch (error) {
            errors++;
            this.logger.error(
              `Failed to backfill opportunity ${opportunity.id}: ${error.message}`,
              {
                opportunityId: opportunity.id,
                locationId: opportunity.locationId,
                pipelineId: opportunity.pipelineId,
                correlationId,
                error: error.stack,
              }
            );
          }
        }

        // Log progress
        this.logger.log(
          `Processed ${processed}/${opportunities.length} opportunities`,
          {
            updated,
            errors,
            skipped,
            tenantId,
            correlationId,
          }
        );
      }

      const duration = Date.now() - startTime;
      const result: BackfillResult = {
        processed,
        updated,
        errors,
        skipped,
        dryRun,
        duration,
      };

      this.logger.log(`Completed opportunity team backfill`, {
        ...result,
        tenantId,
        correlationId,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Opportunity team backfill failed: ${error.message}`, {
        tenantId,
        correlationId,
        processed,
        updated,
        errors,
        duration,
        error: error.stack,
      });

      throw error;
    }
  }

  /**
   * Get backfill statistics for a tenant
   */
  async getBackfillStats(tenantId: string): Promise<{
    totalOpportunities: number;
    unassignedOpportunities: number;
    assignedOpportunities: number;
    opportunitiesWithLocationId: number;
    opportunitiesWithPipelineId: number;
  }> {
    const [
      totalOpportunities,
      unassignedOpportunities,
      assignedOpportunities,
      opportunitiesWithLocationId,
      opportunitiesWithPipelineId,
    ] = await Promise.all([
      this.prisma.opportunity.count({ where: { tenantId } }),
      this.prisma.opportunity.count({ where: { tenantId, teamId: null } }),
      this.prisma.opportunity.count({
        where: { tenantId, teamId: { not: null } },
      }),
      this.prisma.opportunity.count({
        where: { tenantId, locationId: { not: null } },
      }),
      this.prisma.opportunity.count({
        where: { tenantId, pipelineId: { not: null } },
      }),
    ]);

    return {
      totalOpportunities,
      unassignedOpportunities,
      assignedOpportunities,
      opportunitiesWithLocationId,
      opportunitiesWithPipelineId,
    };
  }
}
