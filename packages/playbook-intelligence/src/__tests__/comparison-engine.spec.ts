/**
 * Comparison Engine Tests - WI-031: Playbook Experimentation & Outcome Intelligence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ComparisonEngine } from '../comparison-engine';
import { VariantResults } from '../types';

describe('ComparisonEngine', () => {
  let comparisonEngine: ComparisonEngine;

  beforeEach(() => {
    comparisonEngine = new ComparisonEngine();
  });

  describe('compareVariants', () => {
    let controlVariant: VariantResults;
    let testVariant: VariantResults;

    beforeEach(() => {
      controlVariant = {
        variantId: 'control',
        sampleSize: 100,
        conversionRate: 0.15, // 15% conversion
        averageTimeToConversion: 120, // 120 minutes
        riskIncidentRate: 0.02, // 2% risk incidents
        metrics: {
          reachedTargetStage: true,
          totalInteractions: 3.2,
          successfulInteractions: 2.8,
          failedInteractions: 0.4,
          complianceScore: 85,
          riskIncidents: 2,
          safetyViolations: 0,
        },
        mean: {
          conversionTimeMinutes: 120,
          totalInteractions: 3.2,
          complianceScore: 85,
        },
        median: {
          conversionTimeMinutes: 115,
          totalInteractions: 3,
          complianceScore: 85,
        },
        standardDeviation: {
          conversionTimeMinutes: 25,
          totalInteractions: 0.8,
          complianceScore: 5,
        },
        confidenceInterval95: {
          conversionTimeMinutes: [110, 130],
          totalInteractions: [3.0, 3.4],
          complianceScore: [80, 90],
        },
      };

      testVariant = {
        variantId: 'test-variant',
        sampleSize: 100,
        conversionRate: 0.18, // 18% conversion (20% improvement)
        averageTimeToConversion: 110, // 110 minutes (8% faster)
        riskIncidentRate: 0.015, // 1.5% risk incidents (25% reduction)
        metrics: {
          reachedTargetStage: true,
          totalInteractions: 3.0,
          successfulInteractions: 2.7,
          failedInteractions: 0.3,
          complianceScore: 88,
          riskIncidents: 1.5,
          safetyViolations: 0,
        },
        mean: {
          conversionTimeMinutes: 110,
          totalInteractions: 3.0,
          complianceScore: 88,
        },
        median: {
          conversionTimeMinutes: 105,
          totalInteractions: 3,
          complianceScore: 88,
        },
        standardDeviation: {
          conversionTimeMinutes: 22,
          totalInteractions: 0.7,
          complianceScore: 4,
        },
        confidenceInterval95: {
          conversionTimeMinutes: [100, 120],
          totalInteractions: [2.8, 3.2],
          complianceScore: [85, 91],
        },
      };
    });

    it('should compare variants on conversion rate', () => {
      const comparison = comparisonEngine.compareVariants(
        controlVariant,
        testVariant,
        'conversionRate'
      );

      expect(comparison.variantA).toBe('control');
      expect(comparison.variantB).toBe('test-variant');
      expect(comparison.metric).toBe('conversionRate');
      expect(comparison.meanA).toBe(0.15);
      expect(comparison.meanB).toBe(0.18);
      expect(comparison.difference).toBeCloseTo(0.03, 2);
      expect(comparison.relativeDifference).toBeCloseTo(20, 0); // 20% improvement

      // Statistical test results
      expect(comparison.statisticalTest).toBeDefined();
      expect(comparison.statisticalTest.testName).toBe("Welch's t-test");
      expect(typeof comparison.statisticalTest.pValue).toBe('number');
      expect(typeof comparison.statisticalTest.significant).toBe('boolean');
      expect(comparison.practicalSignificance).toBeDefined();
    });

    it('should compare variants on time metrics', () => {
      const comparison = comparisonEngine.compareVariants(
        controlVariant,
        testVariant,
        'averageTimeToConversion'
      );

      expect(comparison.meanA).toBe(120);
      expect(comparison.meanB).toBe(110);
      expect(comparison.difference).toBe(-10); // Test variant is faster
      expect(comparison.relativeDifference).toBeCloseTo(-8.33, 1); // ~8.3% faster
    });

    it('should assess practical significance', () => {
      // Large effect size
      const largeImprovement = { ...testVariant, conversionRate: 0.25 }; // 67% improvement
      const largeComparison = comparisonEngine.compareVariants(
        controlVariant,
        largeImprovement,
        'conversionRate'
      );

      expect(largeComparison.practicalSignificance).toBe('large');

      // Small effect size
      const smallImprovement = { ...testVariant, conversionRate: 0.158 }; // ~5% improvement
      const smallComparison = comparisonEngine.compareVariants(
        controlVariant,
        smallImprovement,
        'conversionRate'
      );

      expect(smallComparison.practicalSignificance).toBe('small');
    });
  });

  describe('compareMultipleVariants', () => {
    let variants: VariantResults[];

    beforeEach(() => {
      variants = [
        {
          variantId: 'control',
          sampleSize: 100,
          conversionRate: 0.15,
          metrics: {
            reachedTargetStage: true,
            totalInteractions: 3.2,
            successfulInteractions: 2.8,
            failedInteractions: 0.4,
            riskIncidents: 2,
            safetyViolations: 0,
          },
          mean: {},
          median: {},
          standardDeviation: {},
          confidenceInterval95: {},
        },
        {
          variantId: 'variant-a',
          sampleSize: 100,
          conversionRate: 0.18,
          metrics: {
            reachedTargetStage: true,
            totalInteractions: 3.0,
            successfulInteractions: 2.7,
            failedInteractions: 0.3,
            riskIncidents: 1.5,
            safetyViolations: 0,
          },
          mean: {},
          median: {},
          standardDeviation: {},
          confidenceInterval95: {},
        },
        {
          variantId: 'variant-b',
          sampleSize: 100,
          conversionRate: 0.12,
          metrics: {
            reachedTargetStage: true,
            totalInteractions: 3.5,
            successfulInteractions: 3.0,
            failedInteractions: 0.5,
            riskIncidents: 3,
            safetyViolations: 0,
          },
          mean: {},
          median: {},
          standardDeviation: {},
          confidenceInterval95: {},
        },
      ];
    });

    it('should rank multiple variants by metric', () => {
      const comparison = comparisonEngine.compareMultipleVariants(
        variants,
        'conversionRate'
      );

      expect(comparison.metric).toBe('conversionRate');
      expect(comparison.bestVariant).toBe('variant-a'); // 18%
      expect(comparison.worstVariant).toBe('variant-b'); // 12%

      expect(comparison.rankings).toHaveLength(3);
      expect(comparison.rankings[0].variantId).toBe('variant-a');
      expect(comparison.rankings[0].rank).toBe(1);
      expect(comparison.rankings[1].variantId).toBe('control');
      expect(comparison.rankings[1].rank).toBe(2);
      expect(comparison.rankings[2].variantId).toBe('variant-b');
      expect(comparison.rankings[2].rank).toBe(3);
    });

    it('should perform statistical tests between variants', () => {
      const comparison = comparisonEngine.compareMultipleVariants(
        variants,
        'conversionRate'
      );

      expect(comparison.statisticalTests).toHaveLength(3); // All pairwise comparisons
      comparison.statisticalTests.forEach(test => {
        expect(test.testName).toBe("Welch's t-test");
        expect(typeof test.pValue).toBe('number');
        expect(typeof test.significant).toBe('boolean');
      });
    });
  });

  describe('analyzeExperimentResults', () => {
    let mockResults: any;

    beforeEach(() => {
      mockResults = {
        experimentId: 'exp-123',
        variantResults: {
          control: {
            variantId: 'control',
            sampleSize: 100,
            conversionRate: 0.15,
            riskIncidentRate: 0.02,
            metrics: { complianceScore: 85, totalCost: 1000 },
          },
          'variant-a': {
            variantId: 'variant-a',
            sampleSize: 100,
            conversionRate: 0.18,
            riskIncidentRate: 0.015,
            metrics: { complianceScore: 88, totalCost: 950 },
          },
        },
        overallMetrics: {
          totalSampleSize: 200,
          averageConversionRate: 0.165,
        },
        statisticalSummary: {
          statisticalSignificance: 0.03,
          effectSize: 0.3,
          power: 0.85,
          winnerVariant: 'variant-a',
          confidenceLevel: 0.95,
        },
        confidenceIntervals: {
          conversionRate: [0.15, 0.18],
        },
        recommendations: [],
      };
    });

    it('should generate key findings from results', () => {
      const analysis = comparisonEngine.analyzeExperimentResults(mockResults);

      expect(analysis.keyFindings).toBeDefined();
      expect(analysis.keyFindings.length).toBeGreaterThan(0);
      expect(
        analysis.keyFindings.some(
          finding =>
            finding.includes('variant-a') &&
            finding.includes('higher conversion rate')
        )
      ).toBe(true);
    });

    it('should generate statistical summary', () => {
      const analysis = comparisonEngine.analyzeExperimentResults(mockResults);

      expect(analysis.statisticalSummary).toBeDefined();
      expect(analysis.statisticalSummary.statisticalSignificance).toBeLessThan(
        0.05
      );
      expect(analysis.statisticalSummary.winnerVariant).toBe('variant-a');
    });

    it('should generate recommendations', () => {
      const analysis = comparisonEngine.analyzeExperimentResults(mockResults);

      expect(analysis.recommendations).toBeDefined();
      expect(analysis.recommendations.length).toBeGreaterThan(0);

      const promoteRecommendation = analysis.recommendations.find(
        r => r.type === 'promote_variant'
      );
      expect(promoteRecommendation).toBeDefined();
      expect(promoteRecommendation?.variantId).toBe('variant-a');
      expect(promoteRecommendation?.priority).toBe('high');
    });

    it('should generate investigation recommendations for high-risk variants', () => {
      const highRiskResults = {
        ...mockResults,
        variantResults: {
          ...mockResults.variantResults,
          'risky-variant': {
            variantId: 'risky-variant',
            sampleSize: 100,
            conversionRate: 0.16,
            riskIncidentRate: 0.15, // 15% risk incidents - very high
            metrics: { complianceScore: 70, totalCost: 1200 },
          },
        },
      };

      const analysis =
        comparisonEngine.analyzeExperimentResults(highRiskResults);

      const investigationRec = analysis.recommendations.find(
        r => r.type === 'investigate_anomaly'
      );
      expect(investigationRec).toBeDefined();
      expect(investigationRec?.priority).toBe('high');
    });
  });

  describe('calculateRequiredSampleSize', () => {
    it('should calculate required sample size for statistical power', () => {
      const requiredSize = comparisonEngine.calculateRequiredSampleSize(
        0.15, // baseline conversion rate
        10, // 10% improvement
        0.8, // 80% power
        0.05 // 5% significance
      );

      expect(requiredSize).toBeGreaterThan(0);
      expect(typeof requiredSize).toBe('number');
      expect(requiredSize).toBe(Math.round(requiredSize)); // Should be integer
    });

    it('should require larger sample for smaller effects', () => {
      const largeEffect = comparisonEngine.calculateRequiredSampleSize(
        0.15,
        20,
        0.8,
        0.05
      );
      const smallEffect = comparisonEngine.calculateRequiredSampleSize(
        0.15,
        5,
        0.8,
        0.05
      );

      expect(smallEffect).toBeGreaterThan(largeEffect);
    });
  });

  describe('validateExperimentStatistics', () => {
    it('should validate statistically sound experiments', () => {
      const validResults = {
        experimentId: 'exp-123',
        variantResults: {
          control: { sampleSize: 500, conversionRate: 0.15 },
          variant: { sampleSize: 500, conversionRate: 0.18 },
        },
        statisticalSummary: {
          statisticalSignificance: 0.02,
          power: 0.9,
        },
      } as any;

      const validation =
        comparisonEngine.validateExperimentStatistics(validResults);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should identify statistical issues', () => {
      const invalidResults = {
        experimentId: 'exp-123',
        variantResults: {
          control: { sampleSize: 10, conversionRate: 0.15 }, // Too small sample
          variant: { sampleSize: 10, conversionRate: 0.18 },
        },
        statisticalSummary: {
          statisticalSignificance: 0.15, // Not significant
          power: 0.3, // Low power
        },
      } as any;

      const validation =
        comparisonEngine.validateExperimentStatistics(invalidResults);

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.recommendations.length).toBeGreaterThan(0);
    });
  });
});
