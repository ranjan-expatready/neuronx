/**
 * Authority Factor Builder - WI-052: Decision Explainability Engine
 *
 * Builds authority factors for decision explanations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AuthorityFactor } from '../explanation-types';
import { ExtractedFactors } from '../factors/factor-extractor';

@Injectable()
export class AuthorityFactorBuilder {
  private readonly logger = new Logger(AuthorityFactorBuilder.name);

  /**
   * Build authority factors from extracted factors
   */
  async buildAuthorityFactors(
    factors: ExtractedFactors
  ): Promise<AuthorityFactor[]> {
    const authorityFactors: AuthorityFactor[] = [];

    try {
      // Org scope factors
      if (factors.orgAuthority) {
        authorityFactors.push(...this.buildOrgScopeFactors(factors));
      } else {
        this.logger.warn('Org authority not available for factor building');
      }

      // Capability factors
      authorityFactors.push(...this.buildCapabilityFactors(factors));

      // Approval requirement factors
      authorityFactors.push(...this.buildApprovalFactors(factors));

      this.logger.debug('Built authority factors', {
        count: authorityFactors.length,
        types: authorityFactors.map(f => f.authorityType),
      });
    } catch (error) {
      this.logger.error('Failed to build authority factors', {
        error: error.message,
      });
    }

    return authorityFactors;
  }

  /**
   * Build org scope factors
   */
  private buildOrgScopeFactors(factors: ExtractedFactors): AuthorityFactor[] {
    const factors_: AuthorityFactor[] = [];

    // Example org scope factors
    // In a real implementation, this would check if the user has access
    // to the opportunity's team/agency

    factors_.push({
      authorityType: 'org_scope',
      scope: 'team_lead',
      requirement: 'Can approve decisions for team opportunities',
      satisfied: true,
      reason: 'User is team lead for the opportunity team',
    });

    return factors_;
  }

  /**
   * Build capability factors
   */
  private buildCapabilityFactors(factors: ExtractedFactors): AuthorityFactor[] {
    const factors_: AuthorityFactor[] = [];

    // Example capability factors
    // In a real implementation, this would check required capabilities

    factors_.push({
      authorityType: 'capability',
      scope: 'decision_approval',
      requirement: 'Can approve medium-risk decisions',
      satisfied: true,
      reason: 'User has APPROVE_MEDIUM_RISK_EXECUTION capability',
    });

    factors_.push({
      authorityType: 'capability',
      scope: 'voice_execution',
      requirement: 'Can execute voice calls',
      satisfied: false,
      reason: 'User lacks VOICE_EXECUTION capability',
    });

    return factors_;
  }

  /**
   * Build approval requirement factors
   */
  private buildApprovalFactors(factors: ExtractedFactors): AuthorityFactor[] {
    const factors_: AuthorityFactor[] = [];

    // Example approval factors
    // In a real implementation, this would check approval chain requirements

    factors_.push({
      authorityType: 'approval_required',
      scope: 'high_risk_decision',
      requirement: 'High-risk decisions require supervisor approval',
      satisfied: false,
      reason: 'Decision exceeds approval threshold, requires escalation',
    });

    return factors_;
  }
}
