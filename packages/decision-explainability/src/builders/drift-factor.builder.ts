/**
 * Drift Factor Builder - WI-052: Decision Explainability Engine
 *
 * Builds drift factors for decision explanations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { DriftFactor } from '../explanation-types';
import { ExtractedFactors } from '../factors/factor-extractor';

@Injectable()
export class DriftFactorBuilder {
  private readonly logger = new Logger(DriftFactorBuilder.name);

  /**
   * Build drift factors from extracted factors
   */
  async buildDriftFactors(factors: ExtractedFactors): Promise<DriftFactor[]> {
    const driftFactors: DriftFactor[] = [];

    try {
      if (factors.relevantDrift && factors.relevantDrift.length > 0) {
        driftFactors.push(...this.buildRelevantDriftFactors(factors));
      } else {
        this.logger.debug('No relevant drift factors to include');
      }

      this.logger.debug('Built drift factors', {
        count: driftFactors.length,
        severities: driftFactors.map(f => f.severity),
      });
    } catch (error) {
      this.logger.error('Failed to build drift factors', {
        error: error.message,
      });
    }

    return driftFactors;
  }

  /**
   * Build relevant drift factors
   */
  private buildRelevantDriftFactors(factors: ExtractedFactors): DriftFactor[] {
    const factors_: DriftFactor[] = [];

    // Example drift factors
    // In a real implementation, this would analyze actual drift events
    // that occurred around the decision time

    factors_.push({
      driftId: 'drift_pipeline_stage_removed',
      driftType: 'pipeline_stage_removed',
      severity: 'HIGH',
      affectedComponent: 'sales_pipeline',
      impactOnDecision:
        'Changed available pipeline stages, affecting routing logic',
      driftTimestamp: new Date(Date.now() - 3600000), // 1 hour ago
    });

    factors_.push({
      driftId: 'drift_ai_worker_capability_added',
      driftType: 'ai_worker_capability_added',
      severity: 'CRITICAL',
      affectedComponent: 'ai_worker_sales_bot',
      impactOnDecision:
        'New AI capabilities became available, changing decision options',
      driftTimestamp: new Date(Date.now() - 1800000), // 30 minutes ago
    });

    return factors_;
  }
}
