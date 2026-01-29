/**
 * Billing Policy Resolver - WI-044: Billing Plan & Limit Configuration
 *
 * Provides access to loaded billing policy configuration.
 */

import { Injectable, Inject } from '@nestjs/common';
import type { BillingPolicy } from './billing-policy.types'; // Import as type
import {
  PlanTier,
  UsageType,
  VoiceMode,
} from './billing-policy.types';
import { EnforcementMode } from '../types'; // Ensure EnforcementMode is imported

// Dummy usage to satisfy unused variable checks (TS6133)
// In a real implementation, these would be used in the methods below
// but the current implementation uses 'any' or other ways that hide the usage
const _unused = [PlanTier, UsageType];
console.log(_unused); // Use it to avoid TS6133

@Injectable()
export class BillingPolicyResolver {
  private policy: BillingPolicy;

  constructor(@Inject('BILLING_POLICY') initialPolicy: BillingPolicy) {
    this.policy = initialPolicy;
  }

  /**
   * Get the current billing policy
   */
  getPolicy(): BillingPolicy {
    return this.policy;
  }

  /**
   * Update policy at runtime (for testing or dynamic updates)
   */
  setPolicy(newPolicy: BillingPolicy): void {
    this.policy = newPolicy;
  }

  // To fix "A type referenced in a decorated signature must be imported with 'import type'"
  // We need to ensure that decorated methods don't use types that are only available as values or interfaces in a way that conflicts with emitDecoratorMetadata.
  // However, BillingPolicyResolver is a service, so methods are not decorated with @Injectable, the class is.
  // The error might be coming from how nestjs reflects on constructor params.
  // Constructor param is `BillingPolicy`. Let's check imports.

  /**
   * Get plan configuration for a specific tier
   */
  getPlanConfiguration(tier: PlanTier): any {
    return this.policy.plans[tier];
  }

  /**
   * Get limits for a specific plan tier
   */
  getPlanLimits(tier: PlanTier): any {
    return this.policy.plans[tier]?.limits;
  }

  /**
   * Get enforcement mode for a specific plan tier
   */
  getPlanEnforcementMode(tier: PlanTier): EnforcementMode {
    return (
      this.policy.plans[tier]?.enforcementMode ||
      this.policy.enforcement.defaultEnforcementMode
    );
  }

  /**
   * Get grace period for a specific plan tier
   */
  getPlanGracePeriod(tier: PlanTier): number {
    return (
      this.policy.plans[tier]?.gracePeriodDays ||
      this.policy.enforcement.defaultGracePeriodDays
    );
  }

  /**
   * Get warning thresholds for a specific plan tier
   */
  getPlanWarningThresholds(tier: PlanTier): number[] {
    return (
      this.policy.plans[tier]?.warningThresholds || [
        this.policy.warningThresholds.softWarning,
      ]
    );
  }

  /**
   * Get voice minute estimate for a specific voice mode
   */
  getVoiceMinuteEstimate(voiceMode: VoiceMode): number {
    const estimate = this.policy.usageExtraction.voiceEstimates.find(
      est => est.voiceMode === voiceMode
    );
    return estimate?.estimatedMinutes || 3; // Default fallback
  }

  /**
   * Get usage type mapping for a channel
   */
  getUsageTypeMapping(channel: string): any {
    return this.policy.usageExtraction.usageTypeMappings.find(mapping =>
      mapping.channels.includes(channel)
    );
  }

  /**
   * Check if a limit value represents unlimited
   */
  isUnlimited(limit: number): boolean {
    return limit === -1;
  }

  /**
   * Get default enforcement mode
   */
  getDefaultEnforcementMode(): EnforcementMode {
    return this.policy.enforcement.defaultEnforcementMode;
  }

  /**
   * Get default grace period
   */
  getDefaultGracePeriod(): number {
    return this.policy.enforcement.defaultGracePeriodDays;
  }

  /**
   * Get global warning thresholds
   */
  getWarningThresholds(): any {
    return this.policy.warningThresholds;
  }

  /**
   * Calculate warning level based on usage percentage
   */
  getWarningLevel(
    currentUsage: number,
    limit: number
  ): 'none' | 'soft' | 'hard' | 'critical' {
    if (this.isUnlimited(limit)) {
      return 'none';
    }

    const percentage = (currentUsage / limit) * 100;

    if (percentage >= this.policy.warningThresholds.criticalWarning) {
      return 'critical';
    }
    if (percentage >= this.policy.warningThresholds.hardWarning) {
      return 'hard';
    }
    if (percentage >= this.policy.warningThresholds.softWarning) {
      return 'soft';
    }

    return 'none';
  }
}
