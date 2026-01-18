/**
 * Explanation Builder - WI-052: Decision Explainability Engine
 *
 * Builds structured decision explanations from extracted factors.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ExplanationRequest,
  DecisionExplanation,
  DecisionSummary,
  FinalJustification,
  CorrelationIds,
  ExplanationMetadata,
} from '../explanation-types';
import { ExtractedFactors } from '../factors/factor-extractor';
import { PolicyFactorBuilder } from './policy-factor.builder';
import { AuthorityFactorBuilder } from './authority-factor.builder';
import { BillingFactorBuilder } from './billing-factor.builder';
import { DriftFactorBuilder } from './drift-factor.builder';

@Injectable()
export class ExplanationBuilder {
  private readonly logger = new Logger(ExplanationBuilder.name);

  constructor(
    private readonly policyBuilder: PolicyFactorBuilder,
    private readonly authorityBuilder: AuthorityFactorBuilder,
    private readonly billingBuilder: BillingFactorBuilder,
    private readonly driftBuilder: DriftFactorBuilder
  ) {}

  /**
   * Build a complete decision explanation
   */
  async buildExplanation(
    request: ExplanationRequest,
    factors: ExtractedFactors
  ): Promise<DecisionExplanation> {
    const startTime = Date.now();

    try {
      // Generate unique explanation ID
      const explanationId = this.generateExplanationId(request.decisionId);

      // Build decision summary
      const decisionSummary = this.buildDecisionSummary(factors);

      // Build all factor arrays
      const policyFactors =
        await this.policyBuilder.buildPolicyFactors(factors);
      const authorityFactors =
        await this.authorityBuilder.buildAuthorityFactors(factors);
      const billingFactors =
        await this.billingBuilder.buildBillingFactors(factors);
      const driftFactors = request.includeDriftFactors
        ? await this.driftBuilder.buildDriftFactors(factors)
        : [];

      // Build constraints
      const constraints = this.buildConstraints(factors);

      // Build final justification
      const finalJustification = this.buildFinalJustification(
        decisionSummary,
        policyFactors,
        authorityFactors,
        billingFactors,
        driftFactors,
        constraints
      );

      // Build correlation IDs
      const correlationIds: CorrelationIds = {
        decision: request.decisionId,
        audit: request.correlationId,
        // execution and drift would be populated from actual data
      };

      // Determine data completeness
      const dataCompleteness = this.assessDataCompleteness(factors);

      // Build metadata
      const metadata: ExplanationMetadata = {
        engineVersion: '1.0.0',
        processingTimeMs: Date.now() - startTime,
        dataCompleteness,
        missingDataReasons:
          factors.missingData.length > 0 ? factors.missingData : undefined,
      };

      // Extract tenant and opportunity IDs (would come from decision context)
      const tenantId = 'unknown'; // Would be extracted from factors
      const opportunityId = 'unknown'; // Would be extracted from factors

      const explanation: DecisionExplanation = {
        explanationId,
        decisionId: request.decisionId,
        timestamp: new Date(),
        tenantId,
        opportunityId,
        decisionSummary,
        policyFactors,
        authorityFactors,
        billingFactors,
        driftFactors,
        constraints,
        finalJustification,
        correlationIds,
        metadata,
      };

      this.logger.debug('Built decision explanation', {
        explanationId,
        decisionId: request.decisionId,
        policyFactorsCount: policyFactors.length,
        authorityFactorsCount: authorityFactors.length,
        billingFactorsCount: billingFactors.length,
        driftFactorsCount: driftFactors.length,
        dataCompleteness,
        processingTimeMs: metadata.processingTimeMs,
      });

      return explanation;
    } catch (error) {
      this.logger.error('Failed to build decision explanation', {
        decisionId: request.decisionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Build decision summary from factors
   */
  private buildDecisionSummary(factors: ExtractedFactors): DecisionSummary {
    // This would extract from DecisionResult
    // For now, return a placeholder structure
    return {
      actionTaken: 'unknown',
      channelSelected: 'unknown',
      actorType: 'AI',
      executionAllowed: false,
    };
  }

  /**
   * Build constraints from factors
   */
  private buildConstraints(factors: ExtractedFactors): any[] {
    // This would analyze all factors to identify constraints
    // For now, return empty array
    return [];
  }

  /**
   * Build final justification from all factors
   */
  private buildFinalJustification(
    summary: DecisionSummary,
    policyFactors: any[],
    authorityFactors: any[],
    billingFactors: any[],
    driftFactors: any[],
    constraints: any[]
  ): FinalJustification {
    // Determine final outcome based on all factors
    let finalOutcome: 'allowed' | 'blocked' | 'escalated' = 'allowed';
    let blockingReason: string | undefined;
    let escalationReason: string | undefined;

    // Check for blocking factors
    const hasBlockingPolicy = policyFactors.some(f => f.result === 'denied');
    const hasBlockingAuthority = authorityFactors.some(f => !f.satisfied);
    const hasBlockingBilling = billingFactors.some(f => !f.allowed);

    if (hasBlockingBilling) {
      finalOutcome = 'blocked';
      blockingReason = 'Billing limit exceeded';
    } else if (hasBlockingAuthority) {
      finalOutcome = 'escalated';
      escalationReason = 'Authority requirement not satisfied';
    } else if (hasBlockingPolicy) {
      finalOutcome = 'blocked';
      blockingReason = 'Policy violation';
    }

    return {
      finalOutcome,
      blockingReason,
      escalationReason,
    };
  }

  /**
   * Assess data completeness
   */
  private assessDataCompleteness(
    factors: ExtractedFactors
  ): 'complete' | 'partial' | 'incomplete' {
    const missingCount = factors.missingData.length;

    if (missingCount === 0) {
      return 'complete';
    } else if (missingCount <= 2) {
      return 'partial';
    } else {
      return 'incomplete';
    }
  }

  /**
   * Generate unique explanation ID
   */
  private generateExplanationId(decisionId: string): string {
    const timestamp = Date.now();
    return `expl_${decisionId}_${timestamp}`;
  }
}
