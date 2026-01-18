/**
 * AI Worker Drift Detector - WI-053: Drift Detection Engine
 *
 * Detects drift in GHL AI worker configurations.
 */

import { Injectable } from '@nestjs/common';
import { BaseDriftDetector } from './base-drift.detector';
import { DriftChange, DriftChangeType } from '../drift-types';

@Injectable()
export class AiWorkerDriftDetector extends BaseDriftDetector {
  /**
   * Detect drift in AI worker snapshots
   */
  async detectDrift(
    beforeSnapshot: any,
    afterSnapshot: any,
    context: { tenantId: string; ghlAccountId: string; correlationId: string }
  ): Promise<DriftChange[]> {
    const beforeWorkers = beforeSnapshot.payload?.data || [];
    const afterWorkers = afterSnapshot.payload?.data || [];

    const changes: DriftChange[] = [];

    // First, detect AI worker-level changes
    changes.push(
      ...this.detectEntityChanges(beforeWorkers, afterWorkers, 'ai_worker')
    );

    // Then, detect nested configuration changes
    const beforeWorkerMap = this.createEntityMap(beforeWorkers);
    const afterWorkerMap = this.createEntityMap(afterWorkers);

    for (const [workerId, beforeWorker] of beforeWorkerMap) {
      const afterWorker = afterWorkerMap.get(workerId);
      if (afterWorker) {
        // Worker exists in both - check nested configurations
        const nestedChanges = this.detectNestedWorkerChanges(
          beforeWorker,
          afterWorker,
          workerId
        );
        changes.push(...nestedChanges);
      }
    }

    return changes;
  }

  /**
   * Detect changes in nested AI worker configurations
   */
  private detectNestedWorkerChanges(
    beforeWorker: any,
    afterWorker: any,
    workerId: string
  ): DriftChange[] {
    const changes: DriftChange[] = [];

    // Check configuration changes
    if (beforeWorker.configuration || afterWorker.configuration) {
      const configChanges = this.detectFieldChanges(
        beforeWorker.configuration || {},
        afterWorker.configuration || {},
        `ai_worker[${workerId}].configuration`
      );

      for (const change of configChanges) {
        change.entityId = workerId;
        change.entityType = 'ai_worker_configuration';
      }

      changes.push(...configChanges);
    }

    // Check capabilities array changes
    if (beforeWorker.capabilities || afterWorker.capabilities) {
      const beforeCaps = new Set(beforeWorker.capabilities || []);
      const afterCaps = new Set(afterWorker.capabilities || []);

      // Find added capabilities
      for (const cap of afterCaps) {
        if (!beforeCaps.has(cap)) {
          changes.push(
            this.createDriftChange(
              DriftChangeType.ADDED,
              workerId,
              'ai_worker_capability',
              `ai_worker[${workerId}].capabilities`,
              undefined,
              cap,
              `Capability '${cap}' added to AI worker '${workerId}'`
            )
          );
        }
      }

      // Find removed capabilities
      for (const cap of beforeCaps) {
        if (!afterCaps.has(cap)) {
          changes.push(
            this.createDriftChange(
              DriftChangeType.REMOVED,
              workerId,
              'ai_worker_capability',
              `ai_worker[${workerId}].capabilities`,
              cap,
              undefined,
              `Capability '${cap}' removed from AI worker '${workerId}'`
            )
          );
        }
      }
    }

    // Check integrations changes
    if (beforeWorker.integrations || afterWorker.integrations) {
      const integrationChanges = this.detectFieldChanges(
        beforeWorker.integrations || {},
        afterWorker.integrations || {},
        `ai_worker[${workerId}].integrations`
      );

      for (const change of integrationChanges) {
        change.entityId = workerId;
        change.entityType = 'ai_worker_integrations';
      }

      changes.push(...integrationChanges);
    }

    // Check limits changes
    if (beforeWorker.limits || afterWorker.limits) {
      const limitChanges = this.detectFieldChanges(
        beforeWorker.limits || {},
        afterWorker.limits || {},
        `ai_worker[${workerId}].limits`
      );

      for (const change of limitChanges) {
        change.entityId = workerId;
        change.entityType = 'ai_worker_limits';
      }

      changes.push(...limitChanges);
    }

    return changes;
  }
}
