/**
 * Plan Mapping Policy Resolver - WI-045: GHL Product → Plan Mapping Hardening
 *
 * Provides access to loaded plan mapping policy configuration with resolution logic.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  PlanMappingPolicy,
  PlanMappingResult,
  PlanMappingResolutionContext,
  PlanTier,
  ProductMapping,
  FallbackBehavior,
} from './plan-mapping-policy.types';

@Injectable()
export class PlanMappingPolicyResolver {
  private readonly logger = new Logger(PlanMappingPolicyResolver.name);
  private policy: PlanMappingPolicy;

  constructor(initialPolicy: PlanMappingPolicy) {
    this.policy = initialPolicy;
  }

  /**
   * Get the current plan mapping policy
   */
  getPolicy(): PlanMappingPolicy {
    return this.policy;
  }

  /**
   * Update policy at runtime (for testing or dynamic updates)
   */
  setPolicy(newPolicy: PlanMappingPolicy): void {
    this.policy = newPolicy;
  }

  /**
   * Resolve GHL product ID to NeuronX plan tier
   */
  resolvePlanTier(context: PlanMappingResolutionContext): PlanMappingResult {
    const { ghlProductId, sku, priceId, variantId, environment, tenantId } =
      context;

    // First, try environment-specific overrides
    const envOverride = this.findEnvironmentOverride(environment);
    if (envOverride) {
      const mapping = this.findBestMapping(
        envOverride.mappings,
        ghlProductId,
        sku,
        priceId,
        variantId
      );
      if (mapping && mapping.enabled) {
        return {
          planTier: mapping.neuronxPlanTier,
          mapping,
          fallbackUsed: false,
          reason: `Mapped via environment override (${environment})`,
        };
      }
    }

    // Then, try default mappings
    const mapping = this.findBestMapping(
      this.policy.productMappings,
      ghlProductId,
      sku,
      priceId,
      variantId
    );
    if (mapping && mapping.enabled) {
      return {
        planTier: mapping.neuronxPlanTier,
        mapping,
        fallbackUsed: false,
        reason: 'Mapped via default product mapping',
      };
    }

    // No mapping found - use fallback behavior
    return this.handleFallback(ghlProductId, tenantId);
  }

  /**
   * Find the best matching product mapping
   */
  private findBestMapping(
    mappings: ProductMapping[],
    ghlProductId: string,
    sku?: string,
    priceId?: string,
    variantId?: string
  ): ProductMapping | null {
    // First, try exact product ID match
    let mapping = mappings.find(
      m => m.ghlProductId === ghlProductId && m.enabled
    );

    if (mapping) {
      // Check if additional criteria match (if specified)
      if (sku && mapping.sku && mapping.sku !== sku) return null;
      if (priceId && mapping.priceId && mapping.priceId !== priceId)
        return null;
      if (variantId && mapping.variantId && mapping.variantId !== variantId)
        return null;
      return mapping;
    }

    return null;
  }

  /**
   * Find environment-specific override
   */
  private findEnvironmentOverride(environment: string): any | null {
    if (!this.policy.environmentOverrides) return null;

    // First, try specific environment match
    let override = this.policy.environmentOverrides.find(
      o => o.environment === environment
    );
    if (override) return override;

    // Then, try 'all' environments
    override = this.policy.environmentOverrides.find(
      o => o.environment === 'all'
    );
    return override || null;
  }

  /**
   * Handle fallback behavior for unmapped products
   */
  private handleFallback(
    ghlProductId: string,
    tenantId: string
  ): PlanMappingResult {
    const fallback = this.policy.fallback;

    switch (fallback.behavior) {
      case FallbackBehavior.BLOCK:
        this.logger.error(
          `Blocking tenant due to unmapped product: ${ghlProductId}`,
          { tenantId, ghlProductId }
        );
        throw new Error(
          `Product ${ghlProductId} is not mapped to any plan tier. Blocking access.`
        );

      case FallbackBehavior.GRACE_WITH_ALERT:
        const graceTier = PlanTier.FREE; // Always use FREE for grace periods
        this.logger.warn(
          `Using grace period fallback for unmapped product: ${ghlProductId}`,
          {
            tenantId,
            ghlProductId,
            graceTier,
            gracePeriodDays: fallback.gracePeriodDays,
          }
        );

        // Alert if enabled
        if (this.policy.alertOnFallback) {
          this.sendFallbackAlert(ghlProductId, tenantId, 'grace');
        }

        return {
          planTier: graceTier,
          mapping: null,
          fallbackUsed: true,
          reason: `Unmapped product - grace period (${fallback.gracePeriodDays} days)`,
        };

      case FallbackBehavior.DEFAULT_TIER:
        if (!fallback.defaultTier) {
          throw new Error(
            'Fallback behavior is DEFAULT_TIER but no defaultTier specified'
          );
        }

        this.logger.warn(
          `Using default tier fallback for unmapped product: ${ghlProductId}`,
          {
            tenantId,
            ghlProductId,
            defaultTier: fallback.defaultTier,
          }
        );

        // Alert if enabled
        if (this.policy.alertOnFallback) {
          this.sendFallbackAlert(ghlProductId, tenantId, 'default');
        }

        return {
          planTier: fallback.defaultTier,
          mapping: null,
          fallbackUsed: true,
          reason: `Unmapped product - default tier (${fallback.defaultTier})`,
        };

      default:
        throw new Error(`Unknown fallback behavior: ${fallback.behavior}`);
    }
  }

  /**
   * Send alert for fallback usage
   */
  private sendFallbackAlert(
    ghlProductId: string,
    tenantId: string,
    fallbackType: string
  ): void {
    const alertMessage = {
      alertType: 'PLAN_MAPPING_FALLBACK',
      timestamp: new Date().toISOString(),
      ghlProductId,
      tenantId,
      fallbackType,
      policyVersion: this.policy.version,
    };

    this.logger.warn('Plan mapping fallback alert', alertMessage);

    // In a real implementation, this would send to configured alert channels
    // For now, we just log it
  }

  /**
   * Get all enabled product mappings
   */
  getEnabledMappings(): ProductMapping[] {
    return this.policy.productMappings.filter(m => m.enabled);
  }

  /**
   * Validate that a product ID is mappable
   */
  isProductMappable(
    ghlProductId: string,
    environment: string = 'production'
  ): boolean {
    const context: PlanMappingResolutionContext = {
      ghlProductId,
      environment,
      tenantId: 'validation', // Dummy tenant ID for validation
    };

    try {
      const result = this.resolvePlanTier(context);
      return !result.fallbackUsed;
    } catch {
      return false; // Blocked products are not "mappable"
    }
  }

  /**
   * Get fallback configuration
   */
  getFallbackConfig(): any {
    return this.policy.fallback;
  }

  /**
   * Check if audit is enabled
   */
  isAuditEnabled(): boolean {
    return this.policy.auditEnabled;
  }
}
