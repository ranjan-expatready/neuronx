/**
 * UAT Service - WI-066: UAT Harness + Seed + Safety
 *
 * Service for UAT operations within the core API.
 * Provides UAT status, golden run triggers, and safety monitoring.
 */

import { Injectable, Logger } from '@nestjs/common';
import { UatGuardService, getUatConfig } from '@neuronx/uat-harness';
import { AuditService } from '../audit/audit.service';
import { GoldenRunService } from './golden-run.service';

@Injectable()
export class UatService {
  private readonly logger = new Logger(UatService.name);
  private readonly guardService: UatGuardService;
  private readonly prisma: any; // We'll get this from audit service if needed

  constructor(
    private readonly auditService: AuditService,
    private readonly goldenRunService: GoldenRunService
  ) {
    this.guardService = new UatGuardService();
  }

  /**
   * Get current UAT status
   */
  getUatStatus() {
    const config = getUatConfig();
    const status = this.guardService.getStatus();

    return {
      ...status,
      timestamp: new Date().toISOString(),
      version: '1.0.0', // WI-066 version
    };
  }

  /**
   * Trigger golden run through the proper service
   */
  async triggerGoldenRun(
    tenantId: string,
    correlationId?: string
  ): Promise<any> {
    this.logger.log(
      `Triggering golden run for tenant ${tenantId} with correlation ${correlationId}`
    );

    try {
      const result = await this.goldenRunService.executeGoldenRun(
        tenantId,
        correlationId || `uat_svc_${Date.now()}`
      );

      return {
        success: result.success,
        runId: result.runId,
        correlationId: result.correlationId,
        duration: result.duration,
        phases: result.phases,
        selectedOpportunity: result.selectedOpportunity,
        errors: result.errors,
        warnings: result.warnings,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Golden run execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Golden run execution failed',
        correlationId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Validate UAT readiness
   */
  validateUatReadiness(): {
    ready: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const config = getUatConfig();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check environment
    if (config.neuronxEnv !== 'uat') {
      issues.push(`Not in UAT environment (current: ${config.neuronxEnv})`);
      recommendations.push('Set NEURONX_ENV=uat to enable UAT features');
    }

    // Check tenant allowlist
    if (config.uatTenantIds.length === 0) {
      issues.push('No UAT tenants configured');
      recommendations.push(
        'Set UAT_TENANT_IDS to allowlist tenants for UAT testing'
      );
    }

    // Check kill switch
    if (!config.uatKillSwitch) {
      issues.push('Kill switch disabled - live execution allowed');
      recommendations.push('Keep UAT_KILL_SWITCH=true for safety (default)');
    }

    // Check provider allowlists if live mode enabled
    if (config.uatMode === 'live_uat') {
      const emptyAllowlists = [];
      if (config.uatTestPhoneAllowlist.length === 0)
        emptyAllowlists.push('SMS phones');
      if (config.uatEmailDomainAllowlist.length === 0)
        emptyAllowlists.push('Email domains');
      if (config.uatCalendarAllowlist.length === 0)
        emptyAllowlists.push('Calendars');
      if (config.uatGhlLocationIds.length === 0)
        emptyAllowlists.push('GHL locations');

      if (emptyAllowlists.length > 0) {
        issues.push(
          `LIVE_UAT mode but no allowlists configured: ${emptyAllowlists.join(', ')}`
        );
        recommendations.push(
          'Configure provider-specific allowlists before enabling live execution'
        );
      }
    }

    return {
      ready: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Get UAT audit events from durable audit log
   */
  async getUatAuditEvents(
    tenantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    events: any[];
    total: number;
  }> {
    this.logger.log(`Querying UAT audit events for tenant ${tenantId}`);

    try {
      const result = await this.auditService.queryEvents(
        tenantId,
        {
          resource: 'uat', // Filter for UAT-related events
        },
        { limit, offset }
      );

      // Transform events for API response
      const events = result.events.map(event => ({
        id: event.id,
        action: event.action,
        timestamp: event.createdAt,
        actorId: event.actorId,
        resourceId: event.resourceId,
        correlationId: event.metadata?.correlationId,
        details: {
          ...event.metadata,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
        },
      }));

      return {
        events,
        total: result.total,
      };
    } catch (error) {
      this.logger.error(`Failed to query UAT audit events: ${error}`);
      return {
        events: [],
        total: 0,
      };
    }
  }
}
