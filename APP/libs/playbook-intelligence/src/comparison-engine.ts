/**
 * Comparison Engine - WI-031: Playbook Experimentation & Outcome Intelligence
 *
 * Provides statistical analysis and comparison capabilities for experiment variants.
 */

import {
  ExperimentResults,
  VariantResults,
  StatisticalSummary,
  ConfidenceInterval,
  ExperimentRecommendation,
  OutcomeMetrics,
} from './types';

/**
 * Statistical test result
 */
interface StatisticalTestResult {
  testName: string;
  statistic: number;
  pValue: number;
  significant: boolean;
  effectSize: number;
  confidenceInterval: [number, number];
  power: number;
}

/**
 * A/B test comparison result
 */
interface ABTestComparison {
  variantA: string;
  variantB: string;
  metric: string;
  meanA: number;
  meanB: number;
  difference: number;
  relativeDifference: number; // percentage
  statisticalTest: StatisticalTestResult;
  practicalSignificance: 'negligible' | 'small' | 'medium' | 'large';
}

/**
 * Multi-variant comparison result
 */
interface MultiVariantComparison {
  metric: string;
  bestVariant: string;
  worstVariant: string;
  rankings: Array<{ variantId: string; value: number; rank: number }>;
  statisticalTests: StatisticalTestResult[];
  confidenceIntervals: Record<string, [number, number]>;
}

/**
 * Comparison engine for statistical analysis
 */
export class ComparisonEngine {
  /**
   * Calculate statistical significance using t-test approximation
   * For two independent samples with unequal variances
   */
  private calculateTTest(
    sampleA: number[],
    sampleB: number[],
    alpha = 0.05
  ): StatisticalTestResult {
    if (sampleA.length < 2 || sampleB.length < 2) {
      return {
        testName: 't-test',
        statistic: 0,
        pValue: 1.0,
        significant: false,
        effectSize: 0,
        confidenceInterval: [0, 0],
        power: 0,
      };
    }

    const meanA = this.mean(sampleA);
    const meanB = this.mean(sampleB);
    const varA = this.variance(sampleA);
    const varB = this.variance(sampleB);
    const nA = sampleA.length;
    const nB = sampleB.length;

    // Welch's t-test for unequal variances
    const pooledVar = varA / nA + varB / nB;
    const tStatistic = (meanA - meanB) / Math.sqrt(pooledVar);

    // Degrees of freedom approximation
    const df =
      Math.pow(varA / nA + varB / nB, 2) /
      (Math.pow(varA / nA, 2) / (nA - 1) + Math.pow(varB / nB, 2) / (nB - 1));

    // Approximate p-value using t-distribution (simplified)
    const pValue = this.approximatePValue(Math.abs(tStatistic), df);

    // Cohen's d effect size
    const pooledStdDev = Math.sqrt(
      ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2)
    );
    const effectSize = Math.abs(meanA - meanB) / pooledStdDev;

    // Confidence interval for difference
    const se = Math.sqrt(pooledVar);
    const tCritical = 1.96; // Approximately for 95% confidence
    const ciLower = meanA - meanB - tCritical * se;
    const ciUpper = meanA - meanB + tCritical * se;

    // Statistical power (simplified approximation)
    const power =
      1 - this.approximatePValue(tCritical - Math.abs(tStatistic), df);

    return {
      testName: "Welch's t-test",
      statistic: tStatistic,
      pValue,
      significant: pValue < alpha,
      effectSize,
      confidenceInterval: [ciLower, ciUpper],
      power,
    };
  }

  /**
   * Approximate p-value for t-distribution (simplified)
   */
  private approximatePValue(tStatistic: number, df: number): number {
    // Simplified approximation using normal distribution for large df
    if (df > 30) {
      // Use normal approximation
      const z = tStatistic;
      return 2 * (1 - this.normalCDF(Math.abs(z)));
    }

    // For smaller df, use conservative approximation
    if (Math.abs(tStatistic) < 2) return 0.1;
    if (Math.abs(tStatistic) < 3) return 0.01;
    return 0.001;
  }

  /**
   * Normal cumulative distribution function approximation
   */
  private normalCDF(x: number): number {
    // Abramowitz & Stegun approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Calculate chi-square test for proportions
   */
  private calculateChiSquareTest(
    successA: number,
    totalA: number,
    successB: number,
    totalB: number,
    alpha = 0.05
  ): StatisticalTestResult {
    // Chi-square test for proportions
    const p1 = successA / totalA;
    const p2 = successB / totalB;
    const pPooled = (successA + successB) / (totalA + totalB);

    const expectedA = totalA * pPooled;
    const expectedB = totalB * pPooled;

    const chiSquare =
      Math.pow(successA - expectedA, 2) / expectedA +
      Math.pow(successB - expectedB, 2) / expectedB;

    // Chi-square distribution approximation (df = 1)
    // For df=1, p-value approximation
    const pValue = chiSquare < 3.84 ? 0.05 : 0.001; // Simplified

    // Effect size (Cohen's h for proportions)
    const effectSize =
      2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p2));

    // Confidence interval for difference
    const diff = p1 - p2;
    const se = Math.sqrt((p1 * (1 - p1)) / totalA + (p2 * (1 - p2)) / totalB);
    const ciLower = diff - 1.96 * se;
    const ciUpper = diff + 1.96 * se;

    // Power calculation (simplified)
    const power = chiSquare > 10 ? 0.95 : 0.8;

    return {
      testName: 'Chi-square test',
      statistic: chiSquare,
      pValue,
      significant: pValue < alpha,
      effectSize: Math.abs(effectSize),
      confidenceInterval: [ciLower, ciUpper],
      power,
    };
  }

  /**
   * Statistical helper functions
   */
  private mean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private variance(values: number[]): number {
    const mean = this.mean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return this.mean(squaredDiffs);
  }

  private standardDeviation(values: number[]): number {
    return Math.sqrt(this.variance(values));
  }

  /**
   * Assess practical significance using Cohen's benchmarks
   */
  private assessPracticalSignificance(
    effectSize: number,
    metricType: 'proportion' | 'difference'
  ): 'negligible' | 'small' | 'medium' | 'large' {
    if (metricType === 'proportion') {
      // For proportions, use Cohen's h
      if (effectSize < 0.2) return 'negligible';
      if (effectSize < 0.5) return 'small';
      if (effectSize < 0.8) return 'medium';
      return 'large';
    } else {
      // For differences, use Cohen's d
      if (effectSize < 0.2) return 'negligible';
      if (effectSize < 0.5) return 'small';
      if (effectSize < 0.8) return 'medium';
      return 'large';
    }
  }

  /**
   * Compare two variants on a specific metric
   */
  compareVariants(
    variantA: VariantResults,
    variantB: VariantResults,
    metric: string
  ): ABTestComparison {
    // Extract metric values (simplified - would need actual sample data)
    // In real implementation, would have access to raw sample data
    const meanA = this.extractMetricValue(variantA, metric);
    const meanB = this.extractMetricValue(variantB, metric);

    const difference = meanA - meanB;
    const relativeDifference = meanB !== 0 ? (difference / meanB) * 100 : 0;

    // Perform appropriate statistical test
    let statisticalTest: StatisticalTestResult;

    if (metric === 'reachedTargetStage' || metric === 'conversionRate') {
      // Use chi-square for proportions
      const successesA = Math.round(
        variantA.conversionRate * variantA.sampleSize
      );
      const successesB = Math.round(
        variantB.conversionRate * variantB.sampleSize
      );

      statisticalTest = this.calculateChiSquareTest(
        successesA,
        variantA.sampleSize,
        successesB,
        variantB.sampleSize
      );
    } else {
      // Use t-test for continuous metrics (simplified with mock samples)
      const sampleA = this.generateMockSample(meanA, variantA.sampleSize);
      const sampleB = this.generateMockSample(meanB, variantB.sampleSize);

      statisticalTest = this.calculateTTest(sampleA, sampleB);
    }

    const practicalSignificance = this.assessPracticalSignificance(
      statisticalTest.effectSize,
      metric === 'reachedTargetStage' || metric === 'conversionRate'
        ? 'proportion'
        : 'difference'
    );

    return {
      variantA: variantA.variantId,
      variantB: variantB.variantId,
      metric: metric as string,
      meanA,
      meanB,
      difference,
      relativeDifference,
      statisticalTest,
      practicalSignificance,
    };
  }

  /**
   * Extract metric value from variant results
   */
  private extractMetricValue(
    variant: VariantResults,
    metric: string
  ): number {
    switch (metric) {
      case 'conversionRate':
        return variant.conversionRate;
      case 'averageTimeToConversion':
        return variant.averageTimeToConversion || 0;
      case 'riskIncidentRate':
        return variant.riskIncidentRate;
      case 'totalInteractions':
        return variant.metrics.totalInteractions;
      case 'complianceScore':
        return variant.metrics.complianceScore || 0;
      case 'totalCost':
        return variant.metrics.totalCost || 0;
      case 'costPerInteraction':
        return variant.metrics.costPerInteraction || 0;
      default:
        return 0;
    }
  }

  /**
   * Generate mock sample data for statistical testing (simplified)
   */
  private generateMockSample(
    mean: number,
    sampleSize: number,
    stdDev = mean * 0.2
  ): number[] {
    const sample: number[] = [];
    for (let i = 0; i < sampleSize; i++) {
      // Generate normal-like distribution around mean
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      sample.push(mean + z * stdDev);
    }
    return sample;
  }

  /**
   * Perform multi-variant comparison
   */
  compareMultipleVariants(
    variants: VariantResults[],
    metric: string
  ): MultiVariantComparison {
    if (variants.length < 2) {
      throw new Error('Need at least 2 variants for comparison');
    }

    // Sort variants by metric value
    const sortedVariants = [...variants].sort((a, b) => {
      const valueA = this.extractMetricValue(a, metric);
      const valueB = this.extractMetricValue(b, metric);
      return valueB - valueA; // Higher values first
    });

    const rankings = sortedVariants.map((variant, index) => ({
      variantId: variant.variantId,
      value: this.extractMetricValue(variant, metric),
      rank: index + 1,
    }));

    // Perform pairwise statistical tests
    const statisticalTests: StatisticalTestResult[] = [];
    const confidenceIntervals: Record<string, [number, number]> = {};

    for (let i = 0; i < variants.length; i++) {
      for (let j = i + 1; j < variants.length; j++) {
        const comparison = this.compareVariants(
          variants[i],
          variants[j],
          metric
        );
        statisticalTests.push(comparison.statisticalTest);

        // Store confidence intervals
        confidenceIntervals[
          `${variants[i].variantId}_vs_${variants[j].variantId}`
        ] = comparison.statisticalTest.confidenceInterval;
      }
    }

    return {
      metric: metric as string,
      bestVariant: rankings[0].variantId,
      worstVariant: rankings[rankings.length - 1].variantId,
      rankings,
      statisticalTests,
      confidenceIntervals,
    };
  }

  /**
   * Analyze experiment results and generate insights
   */
  analyzeExperimentResults(results: ExperimentResults): {
    keyFindings: string[];
    statisticalSummary: StatisticalSummary;
    confidenceIntervals: Record<string, ConfidenceInterval>;
    recommendations: ExperimentRecommendation[];
  } {
    const keyFindings: string[] = [];

    // Analyze conversion rates
    const conversionComparison = this.compareMultipleVariants(
      Object.values(results.variantResults),
      'conversionRate'
    );

    if (
      conversionComparison.rankings[0].value >
      conversionComparison.rankings[1].value * 1.05
    ) {
      keyFindings.push(
        `${conversionComparison.bestVariant} shows ${Math.round((conversionComparison.rankings[0].value / conversionComparison.rankings[1].value - 1) * 100)}% higher conversion rate`
      );
    }

    // Analyze risk incidents
    const riskComparison = this.compareMultipleVariants(
      Object.values(results.variantResults),
      'riskIncidentRate'
    );

    const bestRiskVariant =
      riskComparison.rankings[riskComparison.rankings.length - 1]; // Lowest risk
    if (bestRiskVariant.value < riskComparison.rankings[0].value * 0.8) {
      keyFindings.push(
        `${bestRiskVariant.variantId} shows ${Math.round((1 - bestRiskVariant.value / riskComparison.rankings[0].value) * 100)}% lower risk incident rate`
      );
    }

    // Generate statistical summary
    const statisticalSummary: StatisticalSummary = {
      statisticalSignificance:
        results.statisticalSummary.statisticalSignificance,
      effectSize: results.statisticalSummary.effectSize,
      power: results.statisticalSummary.power,
      winnerVariant: results.statisticalSummary.winnerVariant,
      confidenceLevel: results.statisticalSummary.confidenceLevel,
      assumptions: [
        'Independent random assignment',
        'Sufficient sample size for statistical power',
        'No external confounding factors',
      ],
      limitations: [
        'May require longer run time for conclusive results',
        'External factors may influence outcomes',
        'Sample size may limit statistical precision',
      ],
    };

    // Enhanced confidence intervals
    const confidenceIntervals: Record<string, ConfidenceInterval> = {
      conversionRate: {
        metric: 'conversionRate',
        lowerBound: results.confidenceIntervals.conversionRate.lowerBound,
        upperBound: results.confidenceIntervals.conversionRate.upperBound,
        confidenceLevel: 0.95,
      },
      timeToConversion: {
        metric: 'timeToConversion',
        lowerBound: results.confidenceIntervals.timeToConversion.lowerBound,
        upperBound: results.confidenceIntervals.timeToConversion.upperBound,
        confidenceLevel: 0.95,
      },
    };

    // Generate recommendations based on analysis
    const recommendations: ExperimentRecommendation[] = [];

    // Primary recommendation: promote winner if statistically significant
    if (
      statisticalSummary.winnerVariant &&
      statisticalSummary.statisticalSignificance < 0.05
    ) {
      recommendations.push({
        recommendationId: `rec_${Date.now()}_promote_winner`,
        type: 'promote_variant',
        variantId: statisticalSummary.winnerVariant,
        confidence: statisticalSummary.confidenceLevel,
        rationale: `Statistical analysis shows ${statisticalSummary.winnerVariant} outperforms other variants with ${Math.round(statisticalSummary.confidenceLevel * 100)}% confidence`,
        actionRequired: true,
        priority: 'high',
        supportingMetrics: {
          effectSize: statisticalSummary.effectSize,
          statisticalSignificance: statisticalSummary.statisticalSignificance,
          sampleSize: results.sampleSize,
        },
        riskAssessment: 'Low risk - statistically validated improvement',
      });
    }

    // Secondary recommendation: continue experiment if inconclusive
    if (
      !statisticalSummary.winnerVariant ||
      statisticalSummary.statisticalSignificance >= 0.05
    ) {
      recommendations.push({
        recommendationId: `rec_${Date.now()}_continue_experiment`,
        type: 'continue_experiment',
        confidence: 0.7,
        rationale:
          'Results are inconclusive - experiment needs more data for statistical significance',
        actionRequired: false,
        priority: 'medium',
        supportingMetrics: {
          currentSampleSize: results.sampleSize,
          requiredSampleSize: Math.max(results.sampleSize * 2, 1000), // Estimate
        },
        riskAssessment: 'Minimal risk - continuing data collection',
      });
    }

    // Safety recommendation: investigate high-risk variants
    const highRiskVariants = Object.values(results.variantResults).filter(
      vr => vr.riskIncidentRate > 0.1
    );

    if (highRiskVariants.length > 0) {
      recommendations.push({
        recommendationId: `rec_${Date.now()}_investigate_risk`,
        type: 'investigate_anomaly',
        confidence: 0.95,
        rationale: `Variants ${highRiskVariants.map(v => v.variantId).join(', ')} show elevated risk incident rates`,
        actionRequired: true,
        priority: 'high',
        supportingMetrics: {
          highRiskVariants: highRiskVariants.map(v => ({
            variantId: v.variantId,
            riskRate: v.riskIncidentRate,
          })),
        },
        riskAssessment: 'Medium risk - requires investigation before promotion',
      });
    }

    return {
      keyFindings,
      statisticalSummary,
      confidenceIntervals,
      recommendations,
    };
  }

  /**
   * Calculate required sample size for desired statistical power
   */
  calculateRequiredSampleSize(
    baselineConversionRate: number,
    expectedImprovement: number, // percentage
    desiredPower = 0.8,
    significanceLevel = 0.05
  ): number {
    const p1 = baselineConversionRate;
    const p2 = baselineConversionRate * (1 + expectedImprovement / 100);

    // Simplified sample size calculation for proportions
    const delta = Math.abs(p1 - p2);
    const pAvg = (p1 + p2) / 2;

    // Z-scores for 95% confidence and 80% power
    const zAlpha = 1.96;
    const zBeta = 0.84;

    const numerator = Math.pow(
      zAlpha * Math.sqrt(2 * pAvg * (1 - pAvg)) +
        zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
      2
    );
    const denominator = Math.pow(delta, 2);

    return Math.ceil(numerator / denominator);
  }

  /**
   * Validate experiment statistical validity
   */
  validateExperimentStatistics(results: ExperimentResults): {
    valid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check sample sizes
    const minSampleSize = 100; // Arbitrary minimum
    const smallSampleVariants = Object.values(results.variantResults).filter(
      vr => vr.sampleSize < minSampleSize
    );

    if (smallSampleVariants.length > 0) {
      issues.push(
        `Small sample sizes detected for variants: ${smallSampleVariants.map(v => v.variantId).join(', ')}`
      );
      recommendations.push(
        'Continue experiment to reach minimum sample size for statistical validity'
      );
    }

    // Check for extreme outliers
    for (const [variantId, variantRes] of Object.entries(results.variantResults)) {
      if (variantRes.conversionRate < 0.01 || variantRes.conversionRate > 0.95) {
        issues.push(
          `Extreme conversion rate detected for ${variantId}: ${(variantRes.conversionRate * 100).toFixed(1)}%`
        );
        recommendations.push('Investigate data quality for outlier variants');
      }
    }

    // Check statistical power
    if (results.statisticalSummary.power < 0.7) {
      issues.push('Low statistical power - results may be unreliable');
      recommendations.push(
        'Increase sample size or extend experiment duration'
      );
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations,
    };
  }
}
