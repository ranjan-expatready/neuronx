/**
 * Scorecard Service - WI-065: Scorecard Engine & Analytics Integration
 *
 * Core API service for scorecard generation and drill-down operations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  ScorecardResolver,
  ScorecardQuery,
  DrilldownQuery,
  Scorecard,
  MetricDrilldown,
} from '../../../packages/scorecard-engine/src';

@Injectable()
export class ScorecardService {
  private readonly logger = new Logger(ScorecardService.name);
  private readonly resolver: ScorecardResolver;

  constructor(private readonly auditService: AuditService) {
    this.resolver = new ScorecardResolver(auditService);
  }

  /**
   * Generate scorecard for given parameters
   */
  async generateScorecard(
    tenantId: string,
    surface: string,
    timeRange: string,
    teamId?: string,
    userId?: string,
    correlationId?: string
  ): Promise<Scorecard> {
    const correlationIdToUse =
      correlationId ||
      `scorecard_svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(
      `Generating scorecard for tenant ${tenantId}, surface ${surface}, correlation ${correlationIdToUse}`
    );

    try {
      const query: ScorecardQuery = {
        tenantId,
        surface: surface as any, // Will be validated by resolver
        timeRange: timeRange as any,
        teamId,
        userId,
        includeDetails: true,
      };

      const scorecard = await this.resolver.resolveScorecard(query);

      // Audit the scorecard generation
      await this.auditService.logEvent(
        'scorecard_generated',
        {
          surface,
          timeRange,
          teamId,
          userId,
          sectionCount: scorecard.sections.length,
          metricCount: scorecard.sections.reduce(
            (sum, s) => sum + s.metrics.length,
            0
          ),
          overallBand: scorecard.overallBand,
          policyVersion: scorecard.policyVersion,
        },
        'scorecard-service',
        tenantId
      );

      this.logger.log(
        `Scorecard generated successfully: ${scorecard.sections.length} sections, ${scorecard.overallBand} overall band`
      );

      return scorecard;
    } catch (error) {
      this.logger.error(
        `Scorecard generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Audit the failure
      await this.auditService.logEvent(
        'scorecard_generation_failed',
        {
          surface,
          timeRange,
          teamId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'scorecard-service',
        tenantId
      );

      throw error;
    }
  }

  /**
   * Get drill-down data for a specific metric
   */
  async getMetricDrilldown(
    tenantId: string,
    metricKey: string,
    timeRange: string,
    teamId?: string,
    userId?: string,
    page?: number,
    limit?: number,
    correlationId?: string
  ): Promise<MetricDrilldown> {
    const correlationIdToUse =
      correlationId ||
      `drilldown_svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(
      `Getting drill-down for metric ${metricKey}, tenant ${tenantId}, correlation ${correlationIdToUse}`
    );

    try {
      const query: DrilldownQuery = {
        tenantId,
        metricKey,
        timeRange: timeRange as any,
        teamId,
        userId,
        page: page || 1,
        limit: limit || 50,
      };

      const drilldown = await this.resolver.getMetricDrilldown(query);

      // Audit the drill-down access
      await this.auditService.logEvent(
        'scorecard_drilldown_accessed',
        {
          metricKey,
          timeRange,
          teamId,
          userId,
          page: query.page,
          limit: query.limit,
          recordCount: drilldown.records.length,
          totalRecords: drilldown.pagination.total,
        },
        'scorecard-service',
        tenantId
      );

      this.logger.log(
        `Drill-down completed: ${drilldown.records.length} records returned`
      );

      return drilldown;
    } catch (error) {
      this.logger.error(
        `Drill-down failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      // Audit the failure
      await this.auditService.logEvent(
        'scorecard_drilldown_failed',
        {
          metricKey,
          timeRange,
          teamId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'scorecard-service',
        tenantId
      );

      throw error;
    }
  }

  /**
   * Get scorecard metadata and available options
   */
  async getScorecardMetadata(tenantId: string): Promise<{
    availableSurfaces: string[];
    availableTimeRanges: string[];
    policyVersion: string;
    lastUpdated: Date;
  }> {
    // Import the policy loader to get metadata
    const { scorecardPolicyLoader } =
      await import('../../../packages/scorecard-engine/src');

    const policy = scorecardPolicyLoader.loadPolicy();
    const global = scorecardPolicyLoader.getGlobalConfig();

    return {
      availableSurfaces: global.enabledSurfaces,
      availableTimeRanges: global.defaultTimeRanges,
      policyVersion: policy.version,
      lastUpdated: new Date(), // Would be file modification time in real implementation
    };
  }
}
