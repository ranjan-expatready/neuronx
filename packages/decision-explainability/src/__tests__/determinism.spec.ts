import { DecisionExplainabilityEngine } from '../decision-explainability-engine';
import { ExplanationBuilder } from '../builders/explanation.builder';
import { FactorExtractor } from '../factors/factor-extractor';
import { ExplanationStorageService } from '../explanation-storage.service';
import { ExplanationRequest } from '../explanation-types';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock all dependencies
const mockBuilder = {
  buildExplanation: vi.fn(),
};

const mockFactorExtractor = {
  extractFactors: vi.fn(),
};

const mockStorage = {
  store: vi.fn(),
};

describe('Decision Explainability - Determinism Tests', () => {
  let engine: DecisionExplainabilityEngine;

  beforeEach(() => {
    engine = new DecisionExplainabilityEngine(
      mockBuilder as any,
      mockFactorExtractor as any,
      mockStorage as any
    );
    vi.clearAllMocks();
  });

  describe('Deterministic Output', () => {
    const testRequest: ExplanationRequest = {
      decisionId: 'decision_test_123',
      includeDriftFactors: true,
      correlationId: 'corr_test_123',
    };

    const mockFactors = {
      decisionResult: { action: 'approve', channel: 'email' },
      decisionContext: { riskLevel: 'medium', dealValue: 50000 },
      decisionPolicy: { version: '1.0.0', rules: [] },
      channelRoutingPolicy: { version: '1.0.0', rules: [] },
      billingState: { planTier: 'PRO', status: 'ACTIVE' },
      orgAuthority: { userRole: 'manager', scope: 'team' },
      relevantDrift: [],
      missingData: [],
    };

    const mockExplanation = {
      explanationId: 'expl_test_123',
      decisionId: 'decision_test_123',
      timestamp: new Date('2024-01-05T10:00:00Z'),
      tenantId: 'tenant_test',
      opportunityId: 'opp_test',
      decisionSummary: {
        actionTaken: 'approve',
        channelSelected: 'email',
        actorType: 'AI',
        executionAllowed: true,
      },
      policyFactors: [
        {
          policyType: 'decision',
          policyVersion: '1.0.0',
          ruleEvaluated: 'risk_threshold',
          threshold: 0.7,
          actualValue: 0.5,
          result: 'allowed',
          reason: 'Risk within acceptable threshold',
        },
      ],
      authorityFactors: [
        {
          authorityType: 'org_scope',
          scope: 'team',
          requirement: 'Team approval authority',
          satisfied: true,
          reason: 'User has team lead role',
        },
      ],
      billingFactors: [
        {
          planTier: 'PRO',
          billingStatus: 'ACTIVE',
          quotaChecked: 'monthly_executions',
          remaining: 450,
          allowed: true,
          reason: 'Sufficient quota remaining',
        },
      ],
      driftFactors: [],
      constraints: [],
      finalJustification: {
        finalOutcome: 'allowed',
      },
      correlationIds: {
        decision: 'decision_test_123',
        audit: 'corr_test_123',
      },
      metadata: {
        engineVersion: '1.0.0',
        processingTimeMs: 150,
        dataCompleteness: 'complete',
      },
    };

    it('should produce identical explanations for identical inputs (10 runs)', async () => {
      mockFactorExtractor.extractFactors.mockResolvedValue(mockFactors);
      mockBuilder.buildExplanation.mockResolvedValue(mockExplanation);
      mockStorage.store.mockResolvedValue(undefined);

      const results = [];

      // Run 10 times with identical inputs
      for (let i = 0; i < 10; i++) {
        const result = await engine.explainDecision(testRequest);
        results.push(result);
      }

      // All results should be successful
      expect(results.every(r => r.success)).toBe(true);

      // All explanations should be structurally identical
      const firstExplanation = results[0].explanation!;
      for (const result of results.slice(1)) {
        const explanation = result.explanation!;

        // Core identifiers should be identical
        expect(explanation.decisionId).toBe(firstExplanation.decisionId);
        expect(explanation.tenantId).toBe(firstExplanation.tenantId);
        expect(explanation.opportunityId).toBe(firstExplanation.opportunityId);

        // Decision summary should be identical
        expect(explanation.decisionSummary).toEqual(
          firstExplanation.decisionSummary
        );

        // Factors should be identical in content and order
        expect(explanation.policyFactors).toEqual(
          firstExplanation.policyFactors
        );
        expect(explanation.authorityFactors).toEqual(
          firstExplanation.authorityFactors
        );
        expect(explanation.billingFactors).toEqual(
          firstExplanation.billingFactors
        );
        expect(explanation.driftFactors).toEqual(firstExplanation.driftFactors);
        expect(explanation.constraints).toEqual(firstExplanation.constraints);

        // Final justification should be identical
        expect(explanation.finalJustification).toEqual(
          firstExplanation.finalJustification
        );

        // Correlation IDs should be identical
        expect(explanation.correlationIds).toEqual(
          firstExplanation.correlationIds
        );

        // Metadata should be consistent (processing time may vary slightly)
        expect(explanation.metadata.engineVersion).toBe(
          firstExplanation.metadata.engineVersion
        );
        expect(explanation.metadata.dataCompleteness).toBe(
          firstExplanation.metadata.dataCompleteness
        );
      }
    });

    it('should produce different explanation IDs for different timestamps', async () => {
      mockFactorExtractor.extractFactors.mockResolvedValue(mockFactors);

      // Mock builder to return different timestamps
      mockBuilder.buildExplanation
        .mockResolvedValueOnce({
          ...mockExplanation,
          explanationId: 'expl_001',
          timestamp: new Date('2024-01-05T10:00:00Z'),
        })
        .mockResolvedValueOnce({
          ...mockExplanation,
          explanationId: 'expl_002',
          timestamp: new Date('2024-01-05T10:01:00Z'),
        });

      mockStorage.store.mockResolvedValue(undefined);

      const result1 = await engine.explainDecision(testRequest);
      const result2 = await engine.explainDecision(testRequest);

      expect(result1.explanation!.explanationId).not.toBe(
        result2.explanation!.explanationId
      );
      expect(result1.explanation!.timestamp.getTime()).not.toBe(
        result2.explanation!.timestamp.getTime()
      );
    });

    it('should maintain factor attribution consistency', async () => {
      // Test that policy factors always reference the same policy version
      mockFactorExtractor.extractFactors.mockResolvedValue(mockFactors);
      mockBuilder.buildExplanation.mockResolvedValue(mockExplanation);
      mockStorage.store.mockResolvedValue(undefined);

      const result1 = await engine.explainDecision(testRequest);
      const result2 = await engine.explainDecision(testRequest);

      const policyFactors1 = result1.explanation!.policyFactors;
      const policyFactors2 = result2.explanation!.policyFactors;

      expect(policyFactors1.length).toBe(policyFactors2.length);

      for (let i = 0; i < policyFactors1.length; i++) {
        expect(policyFactors1[i].policyType).toBe(policyFactors2[i].policyType);
        expect(policyFactors1[i].policyVersion).toBe(
          policyFactors2[i].policyVersion
        );
        expect(policyFactors1[i].ruleEvaluated).toBe(
          policyFactors2[i].ruleEvaluated
        );
        expect(policyFactors1[i].result).toBe(policyFactors2[i].result);
        expect(policyFactors1[i].reason).toBe(policyFactors2[i].reason);
      }
    });

    it('should handle missing data consistently', async () => {
      const factorsWithMissingData = {
        ...mockFactors,
        missingData: ['decision_result', 'billing_state'],
      };

      const explanationWithMissingData = {
        ...mockExplanation,
        metadata: {
          ...mockExplanation.metadata,
          dataCompleteness: 'incomplete',
          missingDataReasons: ['decision_result', 'billing_state'],
        },
      };

      mockFactorExtractor.extractFactors.mockResolvedValue(
        factorsWithMissingData
      );
      mockBuilder.buildExplanation.mockResolvedValue(
        explanationWithMissingData
      );
      mockStorage.store.mockResolvedValue(undefined);

      const result1 = await engine.explainDecision(testRequest);
      const result2 = await engine.explainDecision(testRequest);

      expect(result1.explanation!.metadata.dataCompleteness).toBe('incomplete');
      expect(result2.explanation!.metadata.dataCompleteness).toBe('incomplete');

      expect(result1.explanation!.metadata.missingDataReasons).toEqual(
        result2.explanation!.metadata.missingDataReasons
      );
    });
  });
});
