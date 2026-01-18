/**
 * Channel Routing Policy Resolver - WI-043: Channel Routing Policy Configuration
 *
 * Provides access to loaded channel routing policy configuration.
 */

import { Injectable } from '@nestjs/common';
import { ChannelRoutingPolicy } from './channel-routing-policy.types';

@Injectable()
export class ChannelRoutingPolicyResolver {
  private policy: ChannelRoutingPolicy;

  constructor(initialPolicy: ChannelRoutingPolicy) {
    this.policy = initialPolicy;
  }

  /**
   * Get the current channel routing policy
   */
  getPolicy(): ChannelRoutingPolicy {
    return this.policy;
  }

  /**
   * Update policy at runtime (for testing or dynamic updates)
   */
  setPolicy(newPolicy: ChannelRoutingPolicy): void {
    this.policy = newPolicy;
  }

  /**
   * Get channel priority order
   */
  getChannelPriorityOrder(): string[] {
    return this.policy.channelPriorityOrder;
  }

  /**
   * Get risk-based channel constraints
   */
  getRiskChannelConstraints(): Record<string, string> {
    return this.policy.riskChannelConstraints;
  }

  /**
   * Get deal value routing rules
   */
  getDealValueRouting(): any[] {
    return this.policy.dealValueRouting;
  }

  /**
   * Get SLA urgency overrides
   */
  getSlaUrgencyOverrides(): any[] {
    return this.policy.slaUrgencyOverrides;
  }

  /**
   * Get retry fallbacks
   */
  getRetryFallbacks(): any[] {
    return this.policy.retryFallbacks;
  }

  /**
   * Get human-only channel requirements
   */
  getHumanOnlyChannels(): any[] {
    return this.policy.humanOnlyChannels;
  }

  /**
   * Get risk score thresholds
   */
  getRiskScoreThresholds(): any {
    return this.policy.riskScoreThresholds;
  }

  /**
   * Get command fallback routing
   */
  getCommandFallbacks(): any[] {
    return this.policy.commandFallbacks;
  }

  /**
   * Convert risk score to risk level using policy thresholds
   */
  getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    const thresholds = this.policy.riskScoreThresholds;
    if (riskScore >= thresholds.critical) return 'critical';
    if (riskScore >= thresholds.high) return 'high';
    if (riskScore >= thresholds.medium) return 'medium';
    return 'low';
  }
}
