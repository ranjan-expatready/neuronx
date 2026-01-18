import { ExplanationBuilder } from '../explanation.builder';
import { PolicyFactorBuilder } from '../policy-factor.builder';
import { AuthorityFactorBuilder } from '../authority-factor.builder';
import { BillingFactorBuilder } from '../billing-factor.builder';
import { DriftFactorBuilder } from '../drift-factor.builder';
import { ExplanationRequest } from '../../explanation-types';
import { ExtractedFactors } from '../../factors/factor-extractor';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock all factor builders
const mockPolicyBuilder = {
  buildPolicyFactors: vi.fn(),
};

const mockAuthorityBuilder = {
  buildAuthorityFactors: vi.fn(),
};

const mockBillingBuilder = {
  buildBillingFactors: vi.fn(),
};

const mockDriftBuilder = {
  buildDriftFactors: vi.fn(),
};

describe('ExplanationBuilder', () => {
  let builder: ExplanationBuilder;

  beforeEach(() => {
    builder = new ExplanationBuilder(
      mockPolicyBuilder as any,
      mockAuthorityBuilder as any,
      mockBillingBuilder as any,
      mockDriftBuilder as any
    );
    vi.clearAllMocks();
  });

  describe('buildExplanation', () => {
    const mockRequest: ExplanationRequest = {
      decisionId: 'decision_123',
      includeDriftFactors: true,
      correlationId: 'corr_123',
    };

    const mockFactors: ExtractedFactors = {
      missingData: ['decision_result'],
    };

    it('should build a complete explanation', async () => {
      // Mock factor builders
      mockPolicyBuilder.buildPolicyFactors.mockResolvedValue([
        {
          policyType: 'decision',
          policyVersion: '1.0.0',
          ruleEvaluated: 'risk_check',
          result: 'allowed',
          reason: 'Risk within threshold',
        },
      ]);

      mockAuthorityBuilder.buildAuthorityFactors.mockResolvedValue([
        {
          authorityType: 'org_scope',
          scope: 'team',
          requirement: 'Team access',
          satisfied: true,
        },
      ]);

      mockBillingBuilder.buildBillingFactors.mockResolvedValue([
        {
          planTier: 'PRO',
          billingStatus: 'ACTIVE',
          quotaChecked: 'executions',
          allowed: true,
          reason: 'Quota available',
        },
      ]);

      mockDriftBuilder.buildDriftFactors.mockResolvedValue([
        {
          driftId: 'drift_123',
          driftType: 'pipeline_change',
          severity: 'MEDIUM',
          affectedComponent: 'sales_pipeline',
          impactOnDecision: 'Changed routing options',
          driftTimestamp: new Date(),
        },
      ]);

      const result = await builder.buildExplanation(mockRequest, mockFactors);

      expect(result).toBeDefined();
      expect(result.explanationId).toMatch(/^expl_decision_123_/);
      expect(result.decisionId).toBe('decision_123');
      expect(result.tenantId).toBe('unknown'); // Would be extracted from real data
      expect(result.opportunityId).toBe('unknown'); // Would be extracted from real data

      expect(result.decisionSummary).toBeDefined();
      expect(result.policyFactors).toHaveLength(1);
      expect(result.authorityFactors).toHaveLength(1);
      expect(result.billingFactors).toHaveLength(1);
      expect(result.driftFactors).toHaveLength(1);
      expect(result.constraints).toHaveLength(0); // No constraints in mock

      expect(result.finalJustification.finalOutcome).toBe('allowed');
      expect(result.correlationIds.decision).toBe('decision_123');
      expect(result.correlationIds.audit).toBe('corr_123');

      expect(result.metadata.engineVersion).toBe('1.0.0');
      expect(result.metadata.dataCompleteness).toBe('incomplete'); // Has missing data
      expect(result.metadata.missingDataReasons).toEqual(['decision_result']);
    });

    it('should exclude drift factors when not requested', async () => {
      const requestWithoutDrift = {
        ...mockRequest,
        includeDriftFactors: false,
      };

      mockPolicyBuilder.buildPolicyFactors.mockResolvedValue([]);
      mockAuthorityBuilder.buildAuthorityFactors.mockResolvedValue([]);
      mockBillingBuilder.buildBillingFactors.mockResolvedValue([]);
      // Note: drift builder should not be called

      const result = await builder.buildExplanation(
        requestWithoutDrift,
        mockFactors
      );

      expect(mockDriftBuilder.buildDriftFactors).not.toHaveBeenCalled();
      expect(result.driftFactors).toHaveLength(0);
    });

    it('should determine blocking outcome correctly', async () => {
      mockPolicyBuilder.buildPolicyFactors.mockResolvedValue([
        {
          policyType: 'decision',
          result: 'denied',
          reason: 'Policy violation',
        },
      ]);

      mockAuthorityBuilder.buildAuthorityFactors.mockResolvedValue([]);
      mockBillingBuilder.buildBillingFactors.mockResolvedValue([
        {
          allowed: false,
          reason: 'Billing limit exceeded',
        },
      ]);
      mockDriftBuilder.buildDriftFactors.mockResolvedValue([]);

      const result = await builder.buildExplanation(mockRequest, mockFactors);

      expect(result.finalJustification.finalOutcome).toBe('blocked');
      expect(result.finalJustification.blockingReason).toBe(
        'Billing limit exceeded'
      );
    });

    it('should assess data completeness correctly', async () => {
      const completeFactors: ExtractedFactors = {
        missingData: [], // No missing data
      };

      mockPolicyBuilder.buildPolicyFactors.mockResolvedValue([]);
      mockAuthorityBuilder.buildAuthorityFactors.mockResolvedValue([]);
      mockBillingBuilder.buildBillingFactors.mockResolvedValue([]);
      mockDriftBuilder.buildDriftFactors.mockResolvedValue([]);

      const result = await builder.buildExplanation(
        mockRequest,
        completeFactors
      );

      expect(result.metadata.dataCompleteness).toBe('complete');
      expect(result.metadata.missingDataReasons).toBeUndefined();
    });
  });

  describe('generateExplanationId', () => {
    it('should generate unique IDs', async () => {
      mockPolicyBuilder.buildPolicyFactors.mockResolvedValue([]);
      mockAuthorityBuilder.buildAuthorityFactors.mockResolvedValue([]);
      mockBillingBuilder.buildBillingFactors.mockResolvedValue([]);
      mockDriftBuilder.buildDriftFactors.mockResolvedValue([]);

      const result1 = await builder.buildExplanation(mockRequest, mockFactors);
      const result2 = await builder.buildExplanation(mockRequest, mockFactors);

      expect(result1.explanationId).not.toBe(result2.explanationId);
      expect(result1.explanationId).toMatch(/^expl_decision_123_/);
      expect(result2.explanationId).toMatch(/^expl_decision_123_/);
    });
  });
});
