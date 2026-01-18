/**
 * Workflow Drift Detector - WI-053: Drift Detection Engine
 *
 * Detects drift in GHL workflow configurations.
 */

import { Injectable } from '@nestjs/common';
import { BaseDriftDetector } from './base-drift.detector';
import { DriftChange, DriftChangeType } from '../drift-types';

@Injectable()
export class WorkflowDriftDetector extends BaseDriftDetector {
  /**
   * Detect drift in workflow snapshots
   */
  async detectDrift(
    beforeSnapshot: any,
    afterSnapshot: any,
    context: { tenantId: string; ghlAccountId: string; correlationId: string }
  ): Promise<DriftChange[]> {
    const beforeWorkflows = beforeSnapshot.payload?.data || [];
    const afterWorkflows = afterSnapshot.payload?.data || [];

    const changes: DriftChange[] = [];

    // First, detect workflow-level changes
    changes.push(
      ...this.detectEntityChanges(beforeWorkflows, afterWorkflows, 'workflow')
    );

    // Then, detect action changes within workflows that exist in both snapshots
    const beforeWorkflowMap = this.createEntityMap(beforeWorkflows);
    const afterWorkflowMap = this.createEntityMap(afterWorkflows);

    for (const [workflowId, beforeWorkflow] of beforeWorkflowMap) {
      const afterWorkflow = afterWorkflowMap.get(workflowId);
      if (afterWorkflow) {
        // Workflow exists in both - check actions
        const actionChanges = this.detectActionChanges(
          beforeWorkflow.actions || [],
          afterWorkflow.actions || [],
          workflowId
        );
        changes.push(...actionChanges);
      }
    }

    return changes;
  }

  /**
   * Detect changes in workflow actions
   */
  private detectActionChanges(
    beforeActions: any[],
    afterActions: any[],
    workflowId: string
  ): DriftChange[] {
    const changes: DriftChange[] = [];

    // Actions are typically ordered, so we compare by index
    // For more sophisticated comparison, we could use action IDs if available
    const maxLength = Math.max(beforeActions.length, afterActions.length);

    for (let i = 0; i < maxLength; i++) {
      const beforeAction = beforeActions[i];
      const afterAction = afterActions[i];

      if (!beforeAction && afterAction) {
        // Action added
        changes.push(
          this.createDriftChange(
            DriftChangeType.ADDED,
            `action_${i}`,
            'workflow_action',
            `workflow[${workflowId}].actions[${i}]`,
            undefined,
            afterAction,
            `Action ${i} added to workflow '${workflowId}'`
          )
        );
      } else if (beforeAction && !afterAction) {
        // Action removed
        changes.push(
          this.createDriftChange(
            DriftChangeType.REMOVED,
            `action_${i}`,
            'workflow_action',
            `workflow[${workflowId}].actions[${i}]`,
            beforeAction,
            undefined,
            `Action ${i} removed from workflow '${workflowId}'`
          )
        );
      } else if (beforeAction && afterAction) {
        // Action potentially modified
        const actionChanges = this.detectFieldChanges(
          beforeAction,
          afterAction,
          `workflow[${workflowId}].actions[${i}]`
        );

        // Update entity info for action changes
        for (const change of actionChanges) {
          change.entityId = `action_${i}`;
          change.entityType = 'workflow_action';
          change.description = change.description.replace(
            'workflow_action',
            `action ${i} in workflow '${workflowId}'`
          );
        }

        changes.push(...actionChanges);
      }
    }

    return changes;
  }
}
