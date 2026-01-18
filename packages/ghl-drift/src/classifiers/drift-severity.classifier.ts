/**
 * Drift Severity Classifier - WI-053: Drift Detection Engine
 *
 * Additional severity classification logic for drift changes.
 */

import { Injectable } from '@nestjs/common';
import { DriftChange, DriftSeverity } from '../drift-types';

@Injectable()
export class DriftSeverityClassifier {
  /**
   * Apply additional severity rules based on change content
   */
  classifyContentSeverity(change: DriftChange): DriftSeverity {
    // If already critical, keep it
    if (change.severity === DriftSeverity.CRITICAL) {
      return DriftSeverity.CRITICAL;
    }

    // Check for high-risk content patterns
    if (this.isHighRiskContent(change)) {
      return DriftSeverity.HIGH;
    }

    // Check for medium-risk patterns
    if (this.isMediumRiskContent(change)) {
      return DriftSeverity.MEDIUM;
    }

    // Return existing severity
    return change.severity;
  }

  /**
   * Check if change content indicates high risk
   */
  private isHighRiskContent(change: DriftChange): boolean {
    const description = change.description.toLowerCase();
    const beforeValue = JSON.stringify(change.beforeValue || '').toLowerCase();
    const afterValue = JSON.stringify(change.afterValue || '').toLowerCase();

    // High-risk patterns
    const highRiskPatterns = [
      // AI model changes
      'model.*gpt-4.*gpt-3',
      'model.*gpt-3.*gpt-4',

      // Complete removal of capabilities
      'capability.*removed',
      'removed.*ai_worker',

      // Working hours completely disabled
      'workinghours.*enabled.*false',

      // Critical pipeline changes
      'pipeline.*removed',
      'stage.*removed.*final',
      'stage.*removed.*closed',

      // Integration changes
      'integration.*disabled',
      'integration.*removed',
    ];

    return highRiskPatterns.some(
      pattern =>
        description.includes(pattern) ||
        beforeValue.includes(pattern) ||
        afterValue.includes(pattern)
    );
  }

  /**
   * Check if change content indicates medium risk
   */
  private isMediumRiskContent(change: DriftChange): boolean {
    const description = change.description.toLowerCase();

    // Medium-risk patterns
    const mediumRiskPatterns = [
      // Schedule changes
      'working.*hours.*changed',
      'timezone.*changed',

      // New capabilities added
      'capability.*added',
      'ai_worker.*added',

      // Configuration changes
      'limit.*increased',
      'limit.*decreased',

      // Workflow trigger changes
      'trigger.*changed',
      'condition.*changed',
    ];

    return mediumRiskPatterns.some(pattern => description.includes(pattern));
  }

  /**
   * Get severity level as number for comparison
   */
  static getSeverityLevel(severity: DriftSeverity): number {
    switch (severity) {
      case DriftSeverity.LOW:
        return 1;
      case DriftSeverity.MEDIUM:
        return 2;
      case DriftSeverity.HIGH:
        return 3;
      case DriftSeverity.CRITICAL:
        return 4;
    }
  }

  /**
   * Check if severity meets or exceeds threshold
   */
  static meetsSeverityThreshold(
    severity: DriftSeverity,
    threshold: DriftSeverity
  ): boolean {
    return this.getSeverityLevel(severity) >= this.getSeverityLevel(threshold);
  }
}
