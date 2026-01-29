/**
 * Drift Classifier - WI-053: Drift Detection Engine
 *
 * Classifies drift changes by category and severity.
 */

import { Injectable } from '@nestjs/common';
import {
  DriftChange,
  DriftCategory,
  DriftSeverity,
  DriftClassifier as IDriftClassifier,
} from '../drift-types';

@Injectable()
export class DriftClassifier implements IDriftClassifier {
  /**
   * Classify a drift change into category and severity
   */
  classifyChange(change: Omit<DriftChange, 'category' | 'severity'>): {
    category: DriftCategory;
    severity: DriftSeverity;
  } {
    const category = this.classifyCategory(change);
    const severity = this.classifySeverity(change, category);

    return { category, severity };
  }

  /**
   * Classify drift change into category
   */
  private classifyCategory(
    change: Omit<DriftChange, 'category' | 'severity'>
  ): DriftCategory {
    const { entityType, diffPath, changeType } = change;

    // Pipeline-related changes
    if (entityType === 'pipeline' || entityType === 'pipeline_stage') {
      if (changeType === 'REMOVED' && entityType === 'pipeline_stage') {
        return DriftCategory.STRUCTURAL_DRIFT; // Removing stages is structural
      }
      return DriftCategory.CONFIG_DRIFT;
    }

    // Workflow-related changes
    if (entityType === 'workflow' || entityType === 'workflow_action') {
      if (diffPath.includes('trigger') || diffPath.includes('actions')) {
        return DriftCategory.CONFIG_DRIFT;
      }
      return DriftCategory.COSMETIC_DRIFT;
    }

    // AI Worker-related changes
    if (entityType === 'ai_worker' || entityType.startsWith('ai_worker_')) {
      if (
        entityType === 'ai_worker_capability' ||
        diffPath.includes('capabilities')
      ) {
        return DriftCategory.CAPABILITY_DRIFT; // Capability changes are critical
      }
      if (
        diffPath.includes('limits') ||
        diffPath.includes('configuration.model')
      ) {
        return DriftCategory.CONFIG_DRIFT;
      }
      return DriftCategory.COSMETIC_DRIFT;
    }

    // Calendar-related changes
    if (entityType === 'calendar' || entityType.startsWith('calendar_')) {
      if (
        entityType === 'calendar_appointment_type' &&
        changeType === 'REMOVED'
      ) {
        return DriftCategory.STRUCTURAL_DRIFT;
      }
      if (
        diffPath.includes('workingHours') ||
        diffPath.includes('bookingSettings')
      ) {
        return DriftCategory.CONFIG_DRIFT;
      }
      return DriftCategory.COSMETIC_DRIFT;
    }

    // Location changes
    if (entityType === 'location') {
      if (
        diffPath.includes('address') ||
        diffPath.includes('phone') ||
        changeType === 'REMOVED'
      ) {
        return DriftCategory.STRUCTURAL_DRIFT;
      }
      return DriftCategory.COSMETIC_DRIFT;
    }

    // Default to cosmetic for unknown types
    return DriftCategory.COSMETIC_DRIFT;
  }

  /**
   * Classify drift change severity
   */
  private classifySeverity(
    change: Omit<DriftChange, 'category' | 'severity'>,
    category: DriftCategory
  ): DriftSeverity {
    const { changeType, entityType } = change;

    // Structural changes are high severity
    if (category === DriftCategory.STRUCTURAL_DRIFT) {
      return DriftSeverity.HIGH;
    }

    // Capability changes are critical
    if (category === DriftCategory.CAPABILITY_DRIFT) {
      return DriftSeverity.CRITICAL;
    }

    // Removal of entities is high severity
    if (changeType === 'REMOVED') {
      // Removing AI workers or pipelines is critical
      if (entityType === 'ai_worker' || entityType === 'pipeline') {
        return DriftSeverity.CRITICAL;
      }
      return DriftSeverity.HIGH;
    }

    // Addition of entities is medium severity (needs review)
    if (changeType === 'ADDED') {
      if (entityType === 'ai_worker') {
        return DriftSeverity.HIGH; // New AI workers need review
      }
      return DriftSeverity.MEDIUM;
    }

    // Modifications depend on what's changing
    if (changeType === 'MODIFIED') {
      // Changes to AI worker models or limits are high severity
      if (
        entityType.startsWith('ai_worker') &&
        (change.diffPath.includes('model') ||
          change.diffPath.includes('limits'))
      ) {
        return DriftSeverity.HIGH;
      }

      // Changes to pipeline stages are medium severity
      if (entityType === 'pipeline_stage') {
        return DriftSeverity.MEDIUM;
      }
    }

    // Default to low severity for cosmetic/config changes
    return DriftSeverity.LOW;
  }
}
