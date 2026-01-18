import { Injectable } from '@nestjs/common';
import { NeuronxEvent } from '@neuronx/contracts';
import { ConfigLoader } from '../config/config.loader';
import {
  TenantContext,
  createSystemTenantContext,
} from '../config/tenant-context';
import { UsageService } from '../usage/usage.service';
import { UsageEventEmitter } from '../usage/usage.events';

export interface RoutingResult {
  routedTo: string;
  routingReason: string;
}

@Injectable()
export class LeadRouterService {
  constructor(
    private readonly configLoader: ConfigLoader,
    private readonly usageService: UsageService
  ) {}

  async routeLead(event: NeuronxEvent): Promise<RoutingResult | null> {
    // Get routing configuration with tenant isolation
    const routingConfig = await this.getRoutingConfig(event.tenantId);

    // Pure function: evaluate routing rules
    const routingResult = this.evaluateRoutingRules(event.data, routingConfig);

    // Emit usage events for metering
    if (routingResult) {
      try {
        const routingEvent = UsageEventEmitter.emitRoutingDecision(
          event.tenantId,
          event.data?.leadId || 'unknown',
          routingResult.routedTo,
          event.correlationId || event.id,
          'lead-router'
        );
        await this.usageService.recordUsage(routingEvent);
      } catch (error) {
        // Log but don't fail the routing operation
        console.warn(
          `Failed to emit routing usage event for tenant ${event.tenantId}`,
          {
            error: error.message,
            correlationId: event.correlationId || event.id,
          }
        );
      }
    }

    return routingResult;
  }

  /**
   * Get routing configuration with tenant isolation
   */
  private async getRoutingConfig(tenantId: string): Promise<any> {
    try {
      // Create tenant context - use system tenant as fallback
      const tenantContext = { tenantId, environment: 'prod' as const };

      // Load configuration with tenant isolation
      const config = await this.configLoader.loadConfig(
        'neuronx-config',
        tenantContext
      );

      if (!config) {
        return this.getDefaultRoutingConfig();
      }

      // Extract routing configuration from loaded config
      const routingConfig = config.domains.routing;

      // Validate configuration has required fields
      if (!routingConfig.geographicPreferences) {
        return this.getDefaultRoutingConfig();
      }

      // Build tenant-specific routing configuration
      return {
        geographicPreferences: routingConfig.geographicPreferences || {},
        algorithm: routingConfig.algorithm || 'capacity-based',
        teamCapacities: routingConfig.teamCapacities || {},
        thresholds: routingConfig.thresholds || {
          highLoadPercentage: 80,
          lowLoadPercentage: 20,
          rebalanceIntervalMinutes: 30,
        },
      };
    } catch (error) {
      // Return safe defaults on any configuration loading failure
      return this.getDefaultRoutingConfig();
    }
  }

  /**
   * Get default routing configuration
   */
  private getDefaultRoutingConfig(): any {
    return {
      geographicPreferences: {
        'asia-pacific': ['team-global'],
        europe: ['team-global'],
        'north-america': ['team-enterprise', 'team-startup'],
        'latin-america': ['team-global'],
      },
      algorithm: 'capacity-based',
      teamCapacities: {},
      thresholds: {
        highLoadPercentage: 80,
        lowLoadPercentage: 20,
        rebalanceIntervalMinutes: 30,
      },
    };
  }

  // Pure function: no side effects, deterministic
  private evaluateRoutingRules(
    leadData: any,
    routingConfig: any
  ): RoutingResult | null {
    // Rule: Geographic routing based on tenant configuration
    const region =
      leadData.region || this.inferRegionFromCountry(leadData.country);
    const regionTeams = routingConfig.geographicPreferences[region];

    if (regionTeams && regionTeams.length > 0) {
      // Use tenant-configured team assignment
      const selectedTeam = regionTeams[0]; // Simple selection - could be enhanced
      return {
        routedTo: selectedTeam,
        routingReason: `region_${region}`,
      };
    } else {
      // Fallback to default routing
      return {
        routedTo: 'global-team',
        routingReason: 'region_default',
      };
    }
  }

  /**
   * Infer region from country code (simple mapping)
   */
  private inferRegionFromCountry(countryCode?: string): string {
    if (!countryCode) return 'unknown';

    const regionMap: Record<string, string> = {
      US: 'north-america',
      CA: 'north-america',
      MX: 'north-america',
      GB: 'europe',
      DE: 'europe',
      FR: 'europe',
      IN: 'asia-pacific',
      JP: 'asia-pacific',
      AU: 'asia-pacific',
      BR: 'latin-america',
      AR: 'latin-america',
    };

    return regionMap[countryCode.toUpperCase()] || 'unknown';
  }
}
