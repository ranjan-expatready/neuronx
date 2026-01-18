/**
 * Stage Evaluator - WI-028: Authoritative Playbook Engine
 *
 * Evaluates whether a stage can advance based on collected evidence
 * and playbook rules. Determines success/failure conditions.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  Playbook,
  PlaybookStage,
  ActionEvidence,
  StageEvaluationResult,
  EvidenceType,
  TransitionCondition,
} from './types';

export interface StageEvaluator {
  /**
   * Evaluate if a stage can advance based on current evidence
   */
  evaluateStage(
    playbook: Playbook,
    stageId: string,
    collectedEvidence: ActionEvidence[]
  ): StageEvaluationResult;

  /**
   * Check if a specific transition condition is met
   */
  checkCondition(
    condition: TransitionCondition,
    collectedEvidence: ActionEvidence[]
  ): boolean;

  /**
   * Get required evidence for a stage
   */
  getRequiredEvidence(stage: PlaybookStage): EvidenceType[];
}

@Injectable()
export class StageEvaluatorImpl implements StageEvaluator {
  private readonly logger = new Logger(StageEvaluatorImpl.name);

  evaluateStage(
    playbook: Playbook,
    stageId: string,
    collectedEvidence: ActionEvidence[]
  ): StageEvaluationResult {
    const stage = playbook.stages[stageId];
    if (!stage) {
      return {
        canAdvance: false,
        reason: `Stage '${stageId}' not found in playbook '${playbook.playbookId}'`,
        requiredEvidence: [],
        missingEvidence: [],
        blockingActions: [],
      };
    }

    // Get required evidence for this stage
    const requiredEvidence = this.getRequiredEvidence(stage);

    // Check what evidence we have for this stage
    const stageEvidence = collectedEvidence.filter(
      e =>
        e.stageId === stageId &&
        e.opportunityId === collectedEvidence[0]?.opportunityId // All evidence should be for same opportunity
    );

    // Check if all required evidence is present
    const missingEvidence = requiredEvidence.filter(
      requiredType =>
        !stageEvidence.some(evidence => evidence.evidenceType === requiredType)
    );

    // Check success condition
    const successMet = this.checkCondition(
      stage.onSuccess.condition,
      stageEvidence
    );

    // Check failure condition
    const failureMet = this.checkCondition(
      stage.onFailure.condition,
      stageEvidence
    );

    let canAdvance = false;
    let nextStage: string | undefined;
    let reason: string;

    if (successMet) {
      canAdvance = true;
      nextStage = stage.onSuccess.nextStage;
      reason = `Success condition met: ${this.conditionToString(stage.onSuccess.condition)}`;
    } else if (failureMet) {
      canAdvance = true;
      nextStage = stage.onFailure.nextStage;
      reason = `Failure condition met: ${this.conditionToString(stage.onFailure.condition)}`;
    } else if (missingEvidence.length > 0) {
      canAdvance = false;
      reason = `Missing required evidence: ${missingEvidence.join(', ')}`;
    } else {
      canAdvance = false;
      reason = `Waiting for success or failure condition to be met`;
    }

    // Identify blocking actions (actions that haven't produced required evidence)
    const blockingActions = stage.mustDo
      .filter(action => missingEvidence.includes(action.evidenceRequired))
      .map(action => action.actionId);

    return {
      canAdvance,
      nextStage,
      reason,
      requiredEvidence,
      missingEvidence,
      blockingActions,
    };
  }

  checkCondition(
    condition: TransitionCondition,
    evidence: ActionEvidence[]
  ): boolean {
    switch (condition.conditionType) {
      case 'evidence_present':
        if (!condition.evidenceType) return false;

        const evidenceCount = evidence.filter(
          e => e.evidenceType === condition.evidenceType
        ).length;
        const threshold = condition.threshold || 1;

        switch (condition.operator || 'gte') {
          case 'gte':
            return evidenceCount >= threshold;
          case 'lte':
            return evidenceCount <= threshold;
          case 'eq':
            return evidenceCount === threshold;
          default:
            return evidenceCount >= threshold;
        }

      case 'evidence_absent':
        if (!condition.evidenceType) return true; // No evidence type specified means always absent

        const absentCount = evidence.filter(
          e => e.evidenceType === condition.evidenceType
        ).length;
        return absentCount === 0;

      case 'time_elapsed':
        // This would require timestamp checking - for now return false
        // In a full implementation, this would check against stage entry time
        this.logger.warn('time_elapsed condition not fully implemented yet');
        return false;

      case 'manual_decision':
        // Manual decisions require explicit human input
        // This would be triggered by API calls or UI actions
        return false;

      default:
        this.logger.warn(`Unknown condition type: ${condition.conditionType}`);
        return false;
    }
  }

  getRequiredEvidence(stage: PlaybookStage): EvidenceType[] {
    return stage.mustDo.map(action => action.evidenceRequired);
  }

  /**
   * Helper to convert condition to human-readable string
   */
  private conditionToString(condition: TransitionCondition): string {
    switch (condition.conditionType) {
      case 'evidence_present':
        return `evidence '${condition.evidenceType}' ${condition.operator || 'gte'} ${condition.threshold || 1}`;
      case 'evidence_absent':
        return `evidence '${condition.evidenceType}' absent`;
      case 'time_elapsed':
        return `time elapsed ${condition.threshold} minutes`;
      case 'manual_decision':
        return 'manual decision';
      default:
        return condition.conditionType;
    }
  }
}
