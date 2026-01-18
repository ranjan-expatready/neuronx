/**
 * Factor Extractor - WI-052: Decision Explainability Engine
 *
 * Extracts all relevant factors that contributed to a decision.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ExplanationRequest } from './explanation-types';
import { DecisionResult } from '@neuronx/decision-engine';
import { ChannelRoutingPolicyResolver } from '@neuronx/execution-authority';
import { BillingSyncService } from '@neuronx/billing-entitlements';
import { AuthorityResolver } from '@neuronx/org-authority';
import { GhlDriftDetectionService } from '@neuronx/ghl-drift';

export interface ExtractedFactors {
  decisionResult?: DecisionResult;
  decisionContext?: any;
  decisionPolicy?: any;
  channelRoutingPolicy?: any;
  billingState?: any;
  orgAuthority?: any;
  relevantDrift?: any[];
  missingData: string[];
}

/**
 * Extracts all factors that contributed to a decision
 */
@Injectable()
export class FactorExtractor {
  private readonly logger = new Logger(FactorExtractor.name);

  constructor(
    private readonly channelRoutingResolver: ChannelRoutingPolicyResolver,
    private readonly billingService: BillingSyncService,
    private readonly authorityResolver: AuthorityResolver,
    private readonly driftService: GhlDriftDetectionService
  ) {}

  /**
   * Extract all factors for a decision explanation
   */
  async extractFactors(request: ExplanationRequest): Promise<ExtractedFactors> {
    const factors: ExtractedFactors = {
      missingData: [],
    };

    try {
      // Extract decision result and context (would need to be passed or retrieved)
      // For now, mark as missing since we don't have access to live decision data
      factors.missingData.push('decision_result');
      factors.missingData.push('decision_context');

      // Extract current policy snapshots
      try {
        factors.decisionPolicy = {}; // Would extract from decision engine
        factors.channelRoutingPolicy = this.channelRoutingResolver.getPolicy();
      } catch (error) {
        factors.missingData.push('policy_snapshots');
        this.logger.warn('Failed to extract policy snapshots', {
          error: error.message,
        });
      }

      // Extract billing state
      try {
        // This would need tenant ID from the request context
        // For now, mark as missing
        factors.missingData.push('billing_state');
      } catch (error) {
        factors.missingData.push('billing_state');
        this.logger.warn('Failed to extract billing state', {
          error: error.message,
        });
      }

      // Extract org authority context
      try {
        // This would need user/principal context
        factors.missingData.push('org_authority');
      } catch (error) {
        factors.missingData.push('org_authority');
        this.logger.warn('Failed to extract org authority', {
          error: error.message,
        });
      }

      // Extract relevant drift events if requested
      if (request.includeDriftFactors) {
        try {
          // This would need tenant ID and time window
          factors.relevantDrift = [];
          factors.missingData.push('drift_events');
        } catch (error) {
          factors.missingData.push('drift_events');
          this.logger.warn('Failed to extract drift events', {
            error: error.message,
          });
        }
      }

      this.logger.debug('Extracted factors for decision explanation', {
        decisionId: request.decisionId,
        missingDataCount: factors.missingData.length,
        correlationId: request.correlationId,
      });
    } catch (error) {
      this.logger.error('Failed to extract factors', {
        decisionId: request.decisionId,
        error: error.message,
        correlationId: request.correlationId,
      });
      // Continue with what we have
    }

    return factors;
  }
}
