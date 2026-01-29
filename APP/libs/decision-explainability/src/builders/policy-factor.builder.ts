/**
 * Policy Factor Builder - WI-052: Decision Explainability Engine
 *
 * Builds policy factors for decision explanations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PolicyFactor } from '../explanation-types';
import { ExtractedFactors } from '../factors/factor-extractor';

@Injectable()
export class PolicyFactorBuilder {
  private readonly logger = new Logger(PolicyFactorBuilder.name);

  /**
   * Build policy factors from extracted factors
   */
  async buildPolicyFactors(factors: ExtractedFactors): Promise<PolicyFactor[]> {
    const policyFactors: PolicyFactor[] = [];

    try {
      // Decision policy factors
      if (factors.decisionPolicy) {
        policyFactors.push(...this.buildDecisionPolicyFactors(factors));
      } else {
        this.logger.warn('Decision policy not available for factor building');
      }

      // Channel routing policy factors
      if (factors.channelRoutingPolicy) {
        policyFactors.push(...this.buildChannelRoutingPolicyFactors(factors));
      } else {
        this.logger.warn(
          'Channel routing policy not available for factor building'
        );
      }

      this.logger.debug('Built policy factors', {
        count: policyFactors.length,
        types: policyFactors.map(f => f.policyType),
      });
    } catch (error) {
      this.logger.error('Failed to build policy factors', {
        error: error.message,
      });
    }

    return policyFactors;
  }

  /**
   * Build decision policy factors
   */
  private buildDecisionPolicyFactors(
    factors: ExtractedFactors
  ): PolicyFactor[] {
    const factors_: PolicyFactor[] = [];

    // Example decision policy factors
    // In a real implementation, this would analyze the decision policy
    // against the decision result and context

    factors_.push({
      policyType: 'decision',
      policyVersion: '1.0.0',
      ruleEvaluated: 'risk_threshold_check',
      threshold: 0.7,
      actualValue: 0.8,
      result: 'denied',
      reason: 'Deal value exceeded risk threshold',
    });

    factors_.push({
      policyType: 'decision',
      policyVersion: '1.0.0',
      ruleEvaluated: 'voice_mode_eligibility',
      threshold: 'HUMAN_ONLY',
      actualValue: 'SCRIPTED',
      result: 'denied',
      reason: 'Voice mode not allowed for high-risk decisions',
    });

    return factors_;
  }

  /**
   * Build channel routing policy factors
   */
  private buildChannelRoutingPolicyFactors(
    factors: ExtractedFactors
  ): PolicyFactor[] {
    const factors_: PolicyFactor[] = [];

    // Example channel routing policy factors
    // In a real implementation, this would analyze the channel routing policy

    factors_.push({
      policyType: 'channel_routing',
      policyVersion: '1.0.0',
      ruleEvaluated: 'channel_priority_selection',
      threshold: 'email_fallback',
      actualValue: 'voice_primary',
      result: 'allowed',
      reason: 'Channel routing policy allows voice as primary',
    });

    return factors_;
  }
}
