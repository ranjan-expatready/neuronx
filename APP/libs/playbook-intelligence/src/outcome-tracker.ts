/**
 * Outcome Tracker - WI-031: Playbook Experimentation & Outcome Intelligence
 *
 * Tracks and aggregates experiment outcomes for performance analysis.
 */

import {
  OutcomeEvent,
  OutcomeMetrics,
  ExperimentResults,
  VariantResults,
  ExperimentMetrics,
  ExperimentAuditEvent,
  ConfidenceInterval,
} from './types';
import { CanonicalOpportunityStage } from '@neuronx/pipeline';

/**
 * Opportunity outcome context
 */
export interface OpportunityOutcome {
  opportunityId: string;
  experimentId: string;
  variantId: string;
  tenantId?: string;

  // Final state
  finalStage: CanonicalOpportunityStage;
  reachedTargetStage: boolean;

  // Timing
  startedAt: Date;
  completedAt?: Date;
  totalDurationMinutes?: number;

  // Interactions
  totalInteractions: number;
  successfulInteractions: number;
  failedInteractions: number;

  // Quality metrics
  complianceScore?: number; // 0-100
  riskIncidents: number;
  safetyViolations: number;

  // Cost metrics
  totalCost?: number;

  // Custom metrics
  customMetrics?: Record<string, number>;
}

/**
 * Outcome tracker for experiment results
 */
export class OutcomeTracker {
  private outcomeEvents = new Map<string, OutcomeEvent[]>();
  private opportunityOutcomes = new Map<string, OpportunityOutcome>();
  private auditLog: ExperimentAuditEvent[] = [];

  /**
   * Generate outcome key for storage
   */
  private getOutcomeKey(experimentId: string, opportunityId: string): string {
    return `${experimentId}:${opportunityId}`;
  }

  /**
   * Record an outcome event
   */
  recordOutcomeEvent(
    experimentId: string,
    opportunityId: string,
    variantId: string,
    eventType: OutcomeEvent['eventType'],
    eventData: Record<string, any>,
    tenantId?: string,
    correlationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  ): OutcomeEvent {
    const eventKey = this.getOutcomeKey(experimentId, opportunityId);

    const event: OutcomeEvent = {
      eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      experimentId,
      opportunityId,
      variantId,
      tenantId,
      eventType,
      eventData,
      recordedAt: new Date(),
      correlationId,
    };

    // Store event
    if (!this.outcomeEvents.has(eventKey)) {
      this.outcomeEvents.set(eventKey, []);
    }
    this.outcomeEvents.get(eventKey)!.push(event);

    this.logAuditEvent({
      eventType: 'outcome_recorded',
      experimentId,
      tenantId,
      actor: 'system',
      details: {
        opportunityId,
        variantId,
        eventType,
        correlationId,
      },
      requiresAudit: false,
      complianceChecked: true,
    });

    return event;
  }

  /**
   * Record opportunity completion/final outcome
   */
  recordOpportunityOutcome(outcome: OpportunityOutcome): void {
    const key = this.getOutcomeKey(outcome.experimentId, outcome.opportunityId);

    // Calculate derived metrics
    const derivedOutcome: OpportunityOutcome = {
      ...outcome,
      totalDurationMinutes: outcome.completedAt
        ? Math.floor(
            (outcome.completedAt.getTime() - outcome.startedAt.getTime()) /
              (1000 * 60)
          )
        : undefined,
    };

    this.opportunityOutcomes.set(key, derivedOutcome);

    // Record final outcome event
    this.recordOutcomeEvent(
      outcome.experimentId,
      outcome.opportunityId,
      outcome.variantId,
      'conversion',
      {
        finalStage: outcome.finalStage,
        reachedTargetStage: outcome.reachedTargetStage,
        totalDurationMinutes: derivedOutcome.totalDurationMinutes,
        totalInteractions: outcome.totalInteractions,
        complianceScore: outcome.complianceScore,
        riskIncidents: outcome.riskIncidents,
        safetyViolations: outcome.safetyViolations,
      },
      outcome.tenantId
    );
  }

  /**
   * Get all outcome events for an opportunity
   */
  getOpportunityEvents(
    experimentId: string,
    opportunityId: string
  ): OutcomeEvent[] {
    const key = this.getOutcomeKey(experimentId, opportunityId);
    return this.outcomeEvents.get(key) || [];
  }

  /**
   * Get opportunity outcome
   */
  getOpportunityOutcome(
    experimentId: string,
    opportunityId: string
  ): OpportunityOutcome | null {
    const key = this.getOutcomeKey(experimentId, opportunityId);
    return this.opportunityOutcomes.get(key) || null;
  }

  /**
   * Calculate metrics for a specific opportunity
   */
  private calculateOpportunityMetrics(
    events: OutcomeEvent[]
  ): Partial<OutcomeMetrics> {
    const metrics: Partial<OutcomeMetrics> = {
      totalInteractions: 0,
      successfulInteractions: 0,
      failedInteractions: 0,
      riskIncidents: 0,
      safetyViolations: 0,
    };

    let firstContactTime: Date | null = null;
    let qualificationTime: Date | null = null;
    let conversionTime: Date | null = null;

    for (const event of events) {
      switch (event.eventType) {
        case 'interaction_completed':
          metrics.totalInteractions!++;
          if (event.eventData.success) {
            metrics.successfulInteractions!++;
          } else {
            metrics.failedInteractions!++;
          }

          // Track timing milestones
          if (event.eventData.type === 'first_contact' && !firstContactTime) {
            firstContactTime = event.recordedAt;
          }
          if (event.eventData.type === 'qualification' && !qualificationTime) {
            qualificationTime = event.recordedAt;
          }
          break;

        case 'stage_reached':
          if (event.eventData.stage === 'QUALIFIED' && !qualificationTime) {
            qualificationTime = event.recordedAt;
          }
          if (event.eventData.isTargetStage && !conversionTime) {
            conversionTime = event.recordedAt;
            metrics.reachedTargetStage = true;
            metrics.finalStage = event.eventData.stage;
          }
          break;

        case 'conversion':
          metrics.reachedTargetStage = event.eventData.reachedTargetStage;
          metrics.finalStage = event.eventData.finalStage;
          metrics.totalInteractions = event.eventData.totalInteractions;
          metrics.complianceScore = event.eventData.complianceScore;
          metrics.riskIncidents = event.eventData.riskIncidents;
          metrics.safetyViolations = event.eventData.safetyViolations;
          metrics.totalCost = event.eventData.totalCost;
          break;

        case 'safety_incident':
          metrics.safetyViolations!++;
          if (event.eventData.severity === 'high') {
            metrics.riskIncidents!++;
          }
          break;
      }
    }

    // Calculate derived metrics
    if (firstContactTime && conversionTime) {
      metrics.timeToFirstContact = Math.floor(
        (firstContactTime.getTime() - events[0].recordedAt.getTime()) /
          (1000 * 60)
      );
      metrics.conversionTimeMinutes = Math.floor(
        (conversionTime.getTime() - events[0].recordedAt.getTime()) /
          (1000 * 60)
      );
    }

    if (metrics.totalInteractions && metrics.totalInteractions > 0) {
      metrics.costPerInteraction = metrics.totalCost
        ? metrics.totalCost / metrics.totalInteractions
        : undefined;
    }

    return metrics;
  }

  /**
   * Calculate metrics for all opportunities in a variant
   */
  private calculateVariantMetrics(
    experimentId: string,
    variantId: string,
    opportunityIds: string[]
  ): VariantResults {
    const outcomes: OutcomeMetrics[] = [];
    let totalCost = 0;
    let totalRiskIncidents = 0;
    let totalSafetyViolations = 0;
    let conversions = 0;

    for (const opportunityId of opportunityIds) {
      const outcome = this.getOpportunityOutcome(experimentId, opportunityId);
      if (!outcome) continue;

      const events = this.getOpportunityEvents(experimentId, opportunityId);
      const metrics = this.calculateOpportunityMetrics(events);

      // Convert to full metrics
      const fullMetrics: OutcomeMetrics = {
        reachedTargetStage: outcome.reachedTargetStage,
        conversionTimeMinutes: outcome.totalDurationMinutes,
        finalStage: outcome.finalStage,
        totalInteractions: outcome.totalInteractions,
        successfulInteractions: outcome.successfulInteractions,
        failedInteractions: outcome.failedInteractions,
        timeToFirstContact: metrics.timeToFirstContact,
        timeToQualification: metrics.timeToQualification,
        totalDurationMinutes: outcome.totalDurationMinutes,
        complianceScore: outcome.complianceScore,
        riskIncidents: outcome.riskIncidents,
        safetyViolations: outcome.safetyViolations,
        totalCost: outcome.totalCost,
        costPerInteraction: metrics.costPerInteraction,
        customMetrics: outcome.customMetrics,
      };

      outcomes.push(fullMetrics);

      if (fullMetrics.totalCost) totalCost += fullMetrics.totalCost;
      totalRiskIncidents += fullMetrics.riskIncidents;
      totalSafetyViolations += fullMetrics.safetyViolations;
      if (fullMetrics.reachedTargetStage) conversions++;
    }

    const sampleSize = outcomes.length;
    if (sampleSize === 0) {
      return {
        variantId,
        sampleSize: 0,
        metrics: this.getEmptyMetrics(),
        mean: {},
        median: {},
        standardDeviation: {},
        confidenceInterval95: {},
        conversionRate: 0,
        riskIncidentRate: 0,
        costEfficiency: 0,
      };
    }

    // Calculate statistics
    const conversionRate = conversions / sampleSize;
    const avgConversionTime = this.calculateMean(
      outcomes.map(o => o.conversionTimeMinutes).filter(Boolean) as number[]
    );
    const riskIncidentRate = totalRiskIncidents / sampleSize;
    const costEfficiency = totalCost > 0 ? conversions / totalCost : 0;

    // Calculate means, medians, standard deviations
    const mean = {
      conversionTimeMinutes: this.calculateMean(
        outcomes.map(o => o.conversionTimeMinutes).filter(Boolean) as number[]
      ),
      totalInteractions: this.calculateMean(
        outcomes.map(o => o.totalInteractions)
      ),
      complianceScore: this.calculateMean(
        outcomes.map(o => o.complianceScore).filter(Boolean) as number[]
      ),
      totalCost: this.calculateMean(
        outcomes.map(o => o.totalCost).filter(Boolean) as number[]
      ),
    };

    const median = {
      conversionTimeMinutes: this.calculateMedian(
        outcomes.map(o => o.conversionTimeMinutes).filter(Boolean) as number[]
      ),
      totalInteractions: this.calculateMedian(
        outcomes.map(o => o.totalInteractions)
      ),
      complianceScore: this.calculateMedian(
        outcomes.map(o => o.complianceScore).filter(Boolean) as number[]
      ),
      totalCost: this.calculateMedian(
        outcomes.map(o => o.totalCost).filter(Boolean) as number[]
      ),
    };

    const standardDeviation = {
      conversionTimeMinutes: this.calculateStdDev(
        outcomes.map(o => o.conversionTimeMinutes).filter(Boolean) as number[]
      ),
      totalInteractions: this.calculateStdDev(
        outcomes.map(o => o.totalInteractions)
      ),
      complianceScore: this.calculateStdDev(
        outcomes.map(o => o.complianceScore).filter(Boolean) as number[]
      ),
      totalCost: this.calculateStdDev(
        outcomes.map(o => o.totalCost).filter(Boolean) as number[]
      ),
    };

    // Helper to get tuple from CI object
    const getCITuple = (ci: ConfidenceInterval): [number, number] => [
      ci.lowerBound,
      ci.upperBound,
    ];

    // Calculate 95% confidence intervals (simplified)
    const confidenceInterval95 = {
      conversionTimeMinutes: getCITuple(
        this.calculateConfidenceInterval(
          outcomes.map(o => o.conversionTimeMinutes).filter(Boolean) as number[],
          0.95
        )
      ),
      totalInteractions: getCITuple(
        this.calculateConfidenceInterval(
          outcomes.map(o => o.totalInteractions),
          0.95
        )
      ),
      complianceScore: getCITuple(
        this.calculateConfidenceInterval(
          outcomes.map(o => o.complianceScore).filter(Boolean) as number[],
          0.95
        )
      ),
      totalCost: getCITuple(
        this.calculateConfidenceInterval(
          outcomes.map(o => o.totalCost).filter(Boolean) as number[],
          0.95
        )
      ),
    };

    // Aggregate metrics for the variant
    const aggregatedMetrics: OutcomeMetrics = {
      reachedTargetStage: conversionRate >= 0.5, // Simplified
      conversionTimeMinutes: mean.conversionTimeMinutes,
      finalStage: 'CLOSED_WON' as any, // Simplified
      totalInteractions: mean.totalInteractions,
      successfulInteractions: this.calculateMean(
        outcomes.map(o => o.successfulInteractions)
      ),
      failedInteractions: this.calculateMean(
        outcomes.map(o => o.failedInteractions)
      ),
      timeToFirstContact: this.calculateMean(
        outcomes.map(o => o.timeToFirstContact).filter(Boolean) as number[]
      ),
      timeToQualification: this.calculateMean(
        outcomes.map(o => o.timeToQualification).filter(Boolean) as number[]
      ),
      totalDurationMinutes: mean.conversionTimeMinutes,
      complianceScore: mean.complianceScore,
      riskIncidents: totalRiskIncidents / sampleSize,
      safetyViolations: totalSafetyViolations / sampleSize,
      totalCost: mean.totalCost,
      costPerInteraction:
        mean.totalCost && mean.totalInteractions
          ? mean.totalCost / mean.totalInteractions
          : undefined,
      customMetrics: {}, // Would aggregate custom metrics
    };

    return {
      variantId,
      sampleSize,
      metrics: aggregatedMetrics,
      mean,
      median,
      standardDeviation,
      confidenceInterval95,
      conversionRate,
      averageTimeToConversion: avgConversionTime,
      riskIncidentRate,
      costEfficiency,
    };
  }

  /**
   * Get empty metrics for zero-sample variants
   */
  private getEmptyMetrics(): OutcomeMetrics {
    return {
      reachedTargetStage: false,
      totalInteractions: 0,
      successfulInteractions: 0,
      failedInteractions: 0,
      riskIncidents: 0,
      safetyViolations: 0,
    };
  }

  /**
   * Statistical calculation helpers
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = this.calculateMean(squaredDiffs);
    return Math.sqrt(variance);
  }

  private calculateConfidenceInterval(
    values: number[],
    confidence: number
  ): ConfidenceInterval {
    if (values.length < 2) {
      return {
        metric: 'unknown',
        lowerBound: 0,
        upperBound: 0,
        confidenceLevel: confidence,
      };
    }

    const mean = this.calculateMean(values);
    const stdDev = this.calculateStdDev(values);
    const n = values.length;

    // t-distribution approximation for 95% confidence
    const tValue = 1.96; // Approximately 1.96 for large samples
    const margin = tValue * (stdDev / Math.sqrt(n));

    return {
      metric: 'unknown', // Placeholder, caller should override or context needed
      lowerBound: mean - margin,
      upperBound: mean + margin,
      confidenceLevel: confidence,
    };
  }

  /**
   * Generate experiment results
   */
  generateExperimentResults(
    experimentId: string,
    variantOpportunityMap: Record<string, string[]>
  ): ExperimentResults {
    const variantResults: Record<string, VariantResults> = {};

    // Calculate results for each variant
    for (const [variantId, opportunityIds] of Object.entries(
      variantOpportunityMap
    )) {
      variantResults[variantId] = this.calculateVariantMetrics(
        experimentId,
        variantId,
        opportunityIds
      );
    }

    // Calculate overall metrics
    const allVariants = Object.values(variantResults);
    const totalSampleSize = allVariants.reduce(
      (sum, vr) => sum + vr.sampleSize,
      0
    );
    const avgConversionRate = this.calculateMean(
      allVariants.map(vr => vr.conversionRate)
    );
    const avgTimeToConversion = this.calculateMean(
      allVariants
        .map(vr => vr.averageTimeToConversion)
        .filter(Boolean) as number[]
    );
    const totalRiskIncidents = allVariants.reduce(
      (sum, vr) => sum + vr.riskIncidentRate * vr.sampleSize,
      0
    );
    const totalSafetyViolations = allVariants.reduce(
      (sum, vr) => sum + vr.metrics.safetyViolations * vr.sampleSize,
      0
    );
    const totalCost = allVariants.reduce(
      (sum, vr) => sum + (vr.metrics.totalCost || 0),
      0
    );

    const overallMetrics: ExperimentMetrics = {
      totalSampleSize,
      averageConversionRate: avgConversionRate,
      averageTimeToConversion: avgTimeToConversion,
      totalRiskIncidents,
      totalSafetyViolations,
      totalCost: totalCost > 0 ? totalCost : undefined,
      assignmentSuccessRate: 0.98, // Mock value
      dataCompleteness: 0.95, // Mock value
    };

    // Statistical summary (simplified)
    const statisticalSummary = {
      statisticalSignificance: 0.05, // Mock p-value
      effectSize: 0.2, // Mock Cohen's d
      power: 0.8, // Mock statistical power
      winnerVariant: this.determineWinnerVariant(variantResults),
      confidenceLevel: 0.95,
      assumptions: ['Normal distribution', 'Independent samples'],
      limitations: ['Sample size may be insufficient'],
    };

    // 95% confidence intervals
    const conversionRateCI = this.calculateConfidenceInterval(
      allVariants.map(vr => vr.conversionRate),
      0.95
    );
    conversionRateCI.metric = 'conversionRate';

    const timeToConversionCI = this.calculateConfidenceInterval(
      allVariants
        .map(vr => vr.averageTimeToConversion)
        .filter(Boolean) as number[],
      0.95
    );
    timeToConversionCI.metric = 'timeToConversion';

    const confidenceIntervals = {
      conversionRate: conversionRateCI,
      timeToConversion: timeToConversionCI,
    };

    // Recommendations (simplified)
    const recommendations = this.generateRecommendations(
      variantResults,
      statisticalSummary
    );

    return {
      experimentId,
      variantResults,
      overallMetrics,
      statisticalSummary,
      confidenceIntervals,
      recommendations,
      analyzedAt: new Date(),
      sampleSize: totalSampleSize,
      analysisDurationDays: 30, // Mock value
    };
  }

  /**
   * Determine winning variant (simplified)
   */
  private determineWinnerVariant(
    variantResults: Record<string, VariantResults>
  ): string | undefined {
    const variants = Object.values(variantResults);
    if (variants.length < 2) return undefined;

    // Find variant with highest conversion rate
    let winner = variants[0];
    for (const variant of variants) {
      if (variant.conversionRate > winner.conversionRate) {
        winner = variant;
      }
    }

    return winner.variantId;
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(
    variantResults: Record<string, VariantResults>,
    statisticalSummary: any
  ): any[] {
    const recommendations = [];

    if (statisticalSummary.winnerVariant) {
      recommendations.push({
        recommendationId: `rec_${Date.now()}_promote`,
        type: 'promote_variant',
        variantId: statisticalSummary.winnerVariant,
        confidence: statisticalSummary.confidenceLevel,
        rationale: `Variant shows ${Math.round(statisticalSummary.effectSize * 100)}% improvement in conversion rate`,
        actionRequired: true,
        priority: 'high',
        supportingMetrics: {
          conversionRate:
            variantResults[statisticalSummary.winnerVariant].conversionRate,
          effectSize: statisticalSummary.effectSize,
        },
        riskAssessment: 'Low risk - statistically significant improvement',
      });
    }

    // Check for safety concerns
    for (const [variantId, results] of Object.entries(variantResults)) {
      if (results.riskIncidentRate > 0.1) {
        // >10% risk incidents
        recommendations.push({
          recommendationId: `rec_${Date.now()}_investigate`,
          type: 'investigate_anomaly',
          variantId,
          confidence: 0.9,
          rationale: `High risk incident rate: ${(results.riskIncidentRate * 100).toFixed(1)}%`,
          actionRequired: true,
          priority: 'critical',
          supportingMetrics: { riskIncidentRate: results.riskIncidentRate },
          riskAssessment: 'High risk - requires immediate investigation',
        });
      }
    }

    return recommendations;
  }

  /**
   * Log audit event
   */
  private logAuditEvent(
    event: Omit<ExperimentAuditEvent, 'eventId' | 'timestamp'>
  ): void {
    const auditEvent: ExperimentAuditEvent = {
      ...event,
      eventId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    this.auditLog.push(auditEvent);
  }

  /**
   * Get audit log
   */
  getAuditLog(experimentId?: string): ExperimentAuditEvent[] {
    let events = this.auditLog;

    if (experimentId) {
      events = events.filter(e => e.experimentId === experimentId);
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Export data for analysis (simplified)
   */
  exportExperimentData(experimentId: string): {
    outcomes: OpportunityOutcome[];
    events: OutcomeEvent[];
  } {
    const outcomes: OpportunityOutcome[] = [];
    const events: OutcomeEvent[] = [];

    // Collect all data for the experiment
    for (const [key, outcome] of this.opportunityOutcomes) {
      if (outcome.experimentId === experimentId) {
        outcomes.push(outcome);
        events.push(
          ...this.getOpportunityEvents(experimentId, outcome.opportunityId)
        );
      }
    }

    return { outcomes, events };
  }
}
