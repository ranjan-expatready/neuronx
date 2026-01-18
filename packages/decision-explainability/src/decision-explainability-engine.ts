/**
 * Decision Explainability Engine - WI-052: Decision Explainability Engine
 *
 * Core engine for generating structured explanations of NeuronX decisions.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  DecisionExplainabilityEngine as IDecisionExplainabilityEngine,
  ExplanationRequest,
  ExplanationResponse,
  DecisionExplanation,
  ExplainabilityConfig,
  DEFAULT_EXPLAINABILITY_CONFIG,
} from './explanation-types';
import { ExplanationBuilder } from './builders/explanation.builder';
import { FactorExtractor } from './factors/factor-extractor';
import { ExplanationStorageService } from './explanation-storage.service';

@Injectable()
export class DecisionExplainabilityEngine implements IDecisionExplainabilityEngine {
  private readonly logger = new Logger(DecisionExplainabilityEngine.name);
  private config: ExplainabilityConfig;

  constructor(
    private readonly builder: ExplanationBuilder,
    private readonly factorExtractor: FactorExtractor,
    private readonly storage: ExplanationStorageService,
    config?: Partial<ExplainabilityConfig>
  ) {
    this.config = { ...DEFAULT_EXPLAINABILITY_CONFIG, ...config };
  }

  /**
   * Generate explanation for a decision
   */
  async explainDecision(
    request: ExplanationRequest
  ): Promise<ExplanationResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Generating decision explanation', {
        decisionId: request.decisionId,
        correlationId: request.correlationId,
      });

      // Extract all factors that contributed to the decision
      const factors = await this.factorExtractor.extractFactors(request);

      // Build the structured explanation
      const explanation = await this.builder.buildExplanation(request, factors);

      // Store the explanation immutably
      await this.storage.store(explanation);

      // Audit the explanation generation
      await this.auditExplanationGeneration(explanation, request.correlationId);

      const processingTime = Date.now() - startTime;

      this.logger.log('Decision explanation generated successfully', {
        explanationId: explanation.explanationId,
        decisionId: request.decisionId,
        processingTimeMs: processingTime,
        correlationId: request.correlationId,
      });

      return {
        success: true,
        explanation,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Failed to generate decision explanation', {
        decisionId: request.decisionId,
        error: error.message,
        processingTimeMs: processingTime,
        correlationId: request.correlationId,
      });

      return {
        success: false,
        error: error.message,
        processingTimeMs: processingTime,
      };
    }
  }

  /**
   * Retrieve a stored explanation
   */
  async getExplanation(
    explanationId: string
  ): Promise<DecisionExplanation | null> {
    try {
      return await this.storage.retrieve(explanationId);
    } catch (error) {
      this.logger.error('Failed to retrieve explanation', {
        explanationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get explanation for a decision ID
   */
  async getExplanationForDecision(
    decisionId: string
  ): Promise<DecisionExplanation | null> {
    try {
      return await this.storage.queryByDecision(decisionId);
    } catch (error) {
      this.logger.error('Failed to retrieve explanation for decision', {
        decisionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Query explanations for a tenant
   */
  async queryExplanations(
    tenantId: string,
    limit?: number
  ): Promise<DecisionExplanation[]> {
    try {
      return await this.storage.queryByTenant(tenantId, limit);
    } catch (error) {
      this.logger.error('Failed to query explanations', {
        tenantId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Audit explanation generation
   */
  private async auditExplanationGeneration(
    explanation: DecisionExplanation,
    correlationId: string
  ): Promise<void> {
    // In a real implementation, this would create an audit event
    this.logger.log('Decision explanation audit event', {
      explanationId: explanation.explanationId,
      decisionId: explanation.decisionId,
      tenantId: explanation.tenantId,
      processingTimeMs: explanation.metadata.processingTimeMs,
      dataCompleteness: explanation.metadata.dataCompleteness,
      correlationId,
    });
  }
}
