/**
 * Rate Limit Policy Service - REQ-RATE: Tier-Aware Policy Management
 *
 * Builds rate limit policies from entitlement tiers and handles policy resolution.
 * Ensures policies are never hardcoded and respect tenant entitlements.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EntitlementService } from '../config/entitlements/entitlement.service';
import {
  RateLimitScope,
  RateLimitPolicy,
  RateLimitConfig,
  DEFAULT_RATE_LIMIT_CONFIG,
} from './rate-limit.types';

@Injectable()
export class RateLimitPolicyService {
  private readonly logger = new Logger(RateLimitPolicyService.name);
  private readonly config: RateLimitConfig;

  constructor(
    private readonly entitlementService: EntitlementService,
    config: Partial<RateLimitConfig> = {}
  ) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  }

  /**
   * Get rate limit policy for a tenant and scope
   * Resolves tier-aware policies with entitlement checking
   */
  async getPolicyForTenant(
    tenantId: string,
    scope: RateLimitScope
  ): Promise<RateLimitPolicy> {
    try {
      // Get tenant entitlement tier
      const entitlement =
        await this.entitlementService.getTenantEntitlement(tenantId);

      // If no entitlement or not active, use conservative defaults
      if (!entitlement || entitlement.status !== 'active') {
        return this.getConservativePolicy(scope);
      }

      // Get tier-aware policy
      const tierPolicy = await this.getPolicyForTier(entitlement.tierId, scope);

      this.logger.debug(
        `Resolved policy for tenant ${tenantId}: tier=${entitlement.tierId}, scope=${scope}`,
        {
          limitPerMinute: tierPolicy.limitPerMinute,
          burst: tierPolicy.burst,
        }
      );

      return tierPolicy;
    } catch (error) {
      // On entitlement service failure, use conservative defaults
      this.logger.warn(
        `Failed to resolve policy for tenant ${tenantId}, using conservative defaults`,
        {
          error: error.message,
          scope,
        }
      );

      return this.getConservativePolicy(scope);
    }
  }

  /**
   * Get policy for a specific entitlement tier
   */
  async getPolicyForTier(
    tierId: string,
    scope: RateLimitScope
  ): Promise<RateLimitPolicy> {
    // Start with default policy for the scope
    let policy = { ...this.config.defaultPolicies[scope] };

    // Apply tier-specific overrides
    const tierOverrides = this.config.tierOverrides[tierId];
    if (tierOverrides && tierOverrides[scope]) {
      policy = { ...policy, ...tierOverrides[scope] };
    }

    // Ensure policy values are valid
    policy = this.validateAndNormalizePolicy(policy);

    return policy;
  }

  /**
   * Get conservative policy for unknown or problematic tenants
   * Used when entitlements cannot be determined or for security
   */
  getConservativePolicy(scope: RateLimitScope): RateLimitPolicy {
    const basePolicy = this.config.defaultPolicies[scope];

    // Apply conservative multipliers based on scope
    const conservativeMultipliers = {
      api: 0.1, // 10% of default
      webhook: 0.05, // 5% of default (webhooks more sensitive)
      admin: 0.2, // 20% of default (admin needs some access)
    };

    const multiplier = conservativeMultipliers[scope];

    return {
      limitPerMinute: Math.max(
        1,
        Math.floor(basePolicy.limitPerMinute * multiplier)
      ),
      burst: Math.max(1, Math.floor(basePolicy.burst * multiplier)),
      windowSeconds: basePolicy.windowSeconds,
      mode: 'fail_closed', // Conservative mode for unknown tenants
    };
  }

  /**
   * Get emergency policy for system overload situations
   * More restrictive than conservative policy
   */
  getEmergencyPolicy(scope: RateLimitScope): RateLimitPolicy {
    return {
      limitPerMinute: scope === 'admin' ? 10 : 5, // Very low limits
      burst: scope === 'admin' ? 5 : 2,
      windowSeconds: 60,
      mode: 'fail_closed',
    };
  }

  /**
   * Check if a route should be excluded from rate limiting
   */
  isRouteExcluded(route: string): boolean {
    return this.config.excludedRoutes.some(excluded =>
      route.startsWith(excluded)
    );
  }

  /**
   * Validate and normalize a rate limit policy
   */
  private validateAndNormalizePolicy(policy: RateLimitPolicy): RateLimitPolicy {
    return {
      limitPerMinute: Math.max(1, Math.floor(policy.limitPerMinute || 1)),
      burst: Math.max(0, Math.floor(policy.burst || 0)),
      windowSeconds: Math.max(1, Math.floor(policy.windowSeconds || 60)),
      mode: policy.mode || 'fail_closed',
    };
  }

  /**
   * Get all available tiers and their policies
   * Useful for administrative interfaces
   */
  async getAllTierPolicies(): Promise<
    Record<string, Record<RateLimitScope, RateLimitPolicy>>
  > {
    const tiers = await this.entitlementService.listTiers();
    const result: Record<string, Record<RateLimitScope, RateLimitPolicy>> = {};

    for (const tier of tiers) {
      result[tier.tierId] = {
        api: await this.getPolicyForTier(tier.tierId, 'api'),
        webhook: await this.getPolicyForTier(tier.tierId, 'webhook'),
        admin: await this.getPolicyForTier(tier.tierId, 'admin'),
      };
    }

    return result;
  }

  /**
   * Get policy comparison between tiers
   * Useful for understanding tier differentiation
   */
  async compareTierPolicies(
    tierIds: string[],
    scope: RateLimitScope
  ): Promise<Record<string, RateLimitPolicy>> {
    const result: Record<string, RateLimitPolicy> = {};

    for (const tierId of tierIds) {
      try {
        result[tierId] = await this.getPolicyForTier(tierId, scope);
      } catch (error) {
        this.logger.warn(`Failed to get policy for tier ${tierId}`, {
          error: error.message,
        });
        result[tierId] = this.getConservativePolicy(scope);
      }
    }

    return result;
  }

  /**
   * Update tier-specific policy overrides
   * Administrative function for dynamic policy adjustment
   */
  updateTierOverrides(
    tierId: string,
    scope: RateLimitScope,
    overrides: Partial<RateLimitPolicy>
  ): void {
    if (!this.config.tierOverrides[tierId]) {
      this.config.tierOverrides[tierId] = {};
    }

    if (!this.config.tierOverrides[tierId][scope]) {
      this.config.tierOverrides[tierId][scope] = {};
    }

    Object.assign(this.config.tierOverrides[tierId][scope], overrides);

    this.logger.log(`Updated tier overrides: ${tierId}:${scope}`, overrides);
  }

  /**
   * Reset tier overrides to defaults
   */
  resetTierOverrides(tierId?: string, scope?: RateLimitScope): void {
    if (tierId && scope) {
      // Reset specific tier/scope
      if (this.config.tierOverrides[tierId]?.[scope]) {
        delete this.config.tierOverrides[tierId][scope];
        this.logger.log(`Reset tier overrides: ${tierId}:${scope}`);
      }
    } else if (tierId) {
      // Reset entire tier
      delete this.config.tierOverrides[tierId];
      this.logger.log(`Reset tier overrides: ${tierId}`);
    } else {
      // Reset all overrides
      this.config.tierOverrides = {
        ...DEFAULT_RATE_LIMIT_CONFIG.tierOverrides,
      };
      this.logger.log('Reset all tier overrides');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Enable or disable rate limiting globally
   */
  setEnabled(enabled: boolean): void {
    (this.config as any).enabled = enabled;
    this.logger.log(`Rate limiting ${enabled ? 'enabled' : 'disabled'}`);
  }
}
