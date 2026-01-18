/**
 * Billing Policy Resolver - WI-044: Billing Plan & Limit Configuration
 *
 * Provides access to loaded billing policy configuration.
 */

import { Injectable } from '@nestjs/common';
import {
  BillingPolicy,
  PlanTier,
  UsageType,
  VoiceMode,
} from './billing-policy.types';
import { EnforcementMode } from '../types';

@Injectable()
export class BillingPolicyResolver {
  private policy: BillingPolicy;

  constructor(initialPolicy: BillingPolicy) {
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
