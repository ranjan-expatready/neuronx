/**
 * Pipeline Drift Detector - WI-053: Drift Detection Engine
 *
 * Detects drift in GHL pipeline and stage configurations.
 */

import { Injectable } from '@nestjs/common';
import { BaseDriftDetector } from './base-drift.detector';
import { DriftChange } from '../drift-types';

@Injectable()
export class PipelineDriftDetector extends BaseDriftDetector {
  /**
   * Detect drift in pipeline snapshots
   */
  async detectDrift(
    beforeSnapshot: any,
    afterSnapshot: any,
    _context: { tenantId: string; ghlAccountId: string; correlationId: string }
  ): Promise<DriftChange[]> {
    const beforePipelines = beforeSnapshot.payload?.data || [];
    const afterPipelines = afterSnapshot.payload?.data || [];

    const changes: DriftChange[] = [];

    // First, detect pipeline-level changes
    changes.push(
      ...this.detectEntityChanges(beforePipelines, afterPipelines, 'pipeline')
    );

    // Then, detect stage-level changes within pipelines that exist in both snapshots
    const beforePipelineMap = this.createEntityMap(beforePipelines);
    const afterPipelineMap = this.createEntityMap(afterPipelines);

    for (const [pipelineId, beforePipeline] of beforePipelineMap) {
      const afterPipeline = afterPipelineMap.get(pipelineId);
      if (afterPipeline) {
        // Pipeline exists in both - check stages
        const stageChanges = this.detectStageChanges(
          beforePipeline.stages || [],
          afterPipeline.stages || [],
          pipelineId
        );
        changes.push(...stageChanges);
      }
    }

    return changes;
  }

  /**
   * Detect changes in pipeline stages
   */
  private detectStageChanges(
    beforeStages: any[],
    afterStages: any[],
    pipelineId: string
  ): DriftChange[] {
    const changes: DriftChange[] = [];

    // Detect stage-level changes
    const stageChanges = this.detectEntityChanges(
      beforeStages,
      afterStages,
      'pipeline_stage'
    );

    // Update diff paths to include pipeline context
    for (const change of stageChanges) {
      change.diffPath = `pipeline[${pipelineId}].stages.${change.diffPath}`;
      change.description = change.description.replace(
        'pipeline_stage',
        `stage in pipeline '${pipelineId}'`
      );
    }

    changes.push(...stageChanges);

    return changes;
  }
}
