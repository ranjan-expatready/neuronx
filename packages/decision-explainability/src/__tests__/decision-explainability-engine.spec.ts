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

describe('DecisionExplainabilityEngine', () => {
  let engine: DecisionExplainabilityEngine;

  beforeEach(() => {
    engine = new DecisionExplainabilityEngine(
      mockBuilder as any,
      mockFactorExtractor as any,
      mockStorage as any
    );
    vi.clearAllMocks();
  });

  describe('explainDecision', () => {
    const mockRequest: ExplanationRequest = {
      decisionId: 'decision_123',
      includeDriftFactors: true,
      correlationId: 'corr_123',
    };

    const mockExplanation = {
      explanationId: 'expl_123',
      decisionId: 'decision_123',
      timestamp: new Date(),
      tenantId: 'tenant_1',
      opportunityId: 'opp_1',
      decisionSummary: {},
      policyFactors: [],
      authorityFactors: [],
      billingFactors: [],
      driftFactors: [],
      constraints: [],
      finalJustification: { finalOutcome: 'allowed' },
      correlationIds: { decision: 'decision_123', audit: 'corr_123' },
      metadata: {
        engineVersion: '1.0.0',
        processingTimeMs: 100,
        dataCompleteness: 'complete',
      },
    };

    it('should generate explanation successfully', async () => {
      const mockFactors = { missingData: [] };

      mockFactorExtractor.extractFactors.mockResolvedValue(mockFactors);
      mockBuilder.buildExplanation.mockResolvedValue(mockExplanation);
      mockStorage.store.mockResolvedValue(undefined);

      const result = await engine.explainDecision(mockRequest);

      expect(result.success).toBe(true);
      expect(result.explanation).toEqual(mockExplanation);
      expect(result.processingTimeMs).toBeGreaterThan(0);

      expect(mockFactorExtractor.extractFactors).toHaveBeenCalledWith(
        mockRequest
      );
      expect(mockBuilder.buildExplanation).toHaveBeenCalledWith(
        mockRequest,
        mockFactors
      );
      expect(mockStorage.store).toHaveBeenCalledWith(mockExplanation);
    });

    it('should handle errors gracefully', async () => {
      mockFactorExtractor.extractFactors.mockRejectedValue(
        new Error('Factor extraction failed')
      );

      const result = await engine.explainDecision(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Factor extraction failed');
      expect(result.processingTimeMs).toBeGreaterThan(0);
      expect(result.explanation).toBeUndefined();
    });

    it('should measure processing time accurately', async () => {
      const mockFactors = { missingData: [] };

      mockFactorExtractor.extractFactors.mockResolvedValue(mockFactors);
      mockBuilder.buildExplanation.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate processing time
        return mockExplanation;
      });
      mockStorage.store.mockResolvedValue(undefined);

      const result = await engine.explainDecision(mockRequest);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(50);
    });
  });

  describe('getExplanation', () => {
    it('should retrieve explanation by ID', async () => {
      const mockExplanation = { explanationId: 'expl_123' };
      mockStorage.retrieve = vi.fn().mockResolvedValue(mockExplanation);

      const result = await engine.getExplanation('expl_123');

      expect(result).toEqual(mockExplanation);
      expect(mockStorage.retrieve).toHaveBeenCalledWith('expl_123');
    });

    it('should return null for non-existent explanation', async () => {
      mockStorage.retrieve = vi.fn().mockResolvedValue(null);

      const result = await engine.getExplanation('non_existent');

      expect(result).toBeNull();
    });
  });

  describe('getExplanationForDecision', () => {
    it('should retrieve explanation for decision ID', async () => {
      const mockExplanation = { decisionId: 'decision_123' };
      mockStorage.queryByDecision = vi.fn().mockResolvedValue(mockExplanation);

      const result = await engine.getExplanationForDecision('decision_123');

      expect(result).toEqual(mockExplanation);
      expect(mockStorage.queryByDecision).toHaveBeenCalledWith('decision_123');
    });
  });

  describe('queryExplanations', () => {
    it('should query explanations for tenant', async () => {
      const mockExplanations = [
        { explanationId: 'expl_1' },
        { explanationId: 'expl_2' },
      ];
      mockStorage.queryByTenant = vi.fn().mockResolvedValue(mockExplanations);

      const result = await engine.queryExplanations('tenant_1', 10);

      expect(result).toEqual(mockExplanations);
      expect(mockStorage.queryByTenant).toHaveBeenCalledWith('tenant_1', 10);
    });
  });
});
