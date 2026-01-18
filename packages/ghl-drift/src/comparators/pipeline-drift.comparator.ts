/**
 * Pipeline Drift Comparator - WI-053: GHL Drift Detection Engine
 *
 * Compares GHL pipeline snapshots for drift detection, including nested stages.
 */

import { Injectable } from '@nestjs/common';
import { GhlSnapshot, SnapshotType } from '@neuronx/ghl-snapshots';
import { DriftDetection, DriftChangeType } from '../drift-types';
import { BaseDriftComparator } from './base-drift.comparator';

@Injectable()
export class PipelineDriftComparator extends BaseDriftComparator {
  constructor() {
    super('PipelineDriftComparator');
  }

  /**
   * Compare pipeline snapshots, including nested stages
   */
  async compare(
    beforeSnapshot: GhlSnapshot,
    afterSnapshot: GhlSnapshot
  ): Promise<DriftDetection[]> {
    this.validateSnapshots(beforeSnapshot, afterSnapshot);

    const beforeData = beforeSnapshot.payload.data as any[];
    const afterData = afterSnapshot.payload.data as any[];

    this.logger.debug(`Comparing pipeline snapshots`, {
      beforeCount: beforeData.length,
      afterCount: afterData.length,
    });

    const detections: DriftDetection[] = [];

    // First, compare pipeline entities themselves
    const pipelineDetections = this.compareEntities(beforeData, afterData);
    detections.push(...pipelineDetections);

    // Then, compare stages within pipelines that exist in both snapshots
    const stageDetections = await this.comparePipelineStages(
      beforeData,
      afterData
    );
    detections.push(...stageDetections);

    return detections;
  }

  /**
   * Compare stages within pipelines that exist in both snapshots
   */
  private async comparePipelineStages(
    beforeData: any[],
    afterData: any[]
  ): Promise<DriftDetection[]> {
    const detections: DriftDetection[] = [];

    // Create maps for pipeline lookup
    const beforeMap = new Map<string, any>();
    const afterMap = new Map<string, any>();

    beforeData.forEach(pipeline => {
      beforeMap.set(pipeline.id, pipeline);
    });

    afterData.forEach(pipeline => {
      afterMap.set(pipeline.id, pipeline);
    });

    // Compare stages for pipelines that exist in both snapshots
    for (const [pipelineId, beforePipeline] of beforeMap) {
      const afterPipeline = afterMap.get(pipelineId);
      if (afterPipeline) {
        const stageDetections = this.comparePipelineStagesForPipeline(
          pipelineId,
          beforePipeline.stages || [],
          afterPipeline.stages || []
        );
        detections.push(...stageDetections);
      }
    }

    return detections;
  }

  /**
   * Compare stages within a specific pipeline
   */
  private comparePipelineStagesForPipeline(
    pipelineId: string,
    beforeStages: any[],
    afterStages: any[]
  ): DriftDetection[] {
    const detections: DriftDetection[] = [];

    // Create maps for stage lookup
    const beforeStageMap = new Map<string, any>();
    const afterStageMap = new Map<string, any>();

    beforeStages.forEach(stage => {
      beforeStageMap.set(stage.id, stage);
    });

    afterStages.forEach(stage => {
      afterStageMap.set(stage.id, stage);
    });

    // Find added stages
    for (const [stageId, stage] of afterStageMap) {
      if (!beforeStageMap.has(stageId)) {
        detections.push(
          this.createDriftDetection(
            pipelineId,
            DriftChangeType.ADDED,
            `stages[${this.findStageIndex(afterStages, stageId)}]`,
            undefined,
            stage,
            `New stage added to pipeline: ${stage.name || stageId}`
          )
        );
      }
    }

    // Find removed stages
    for (const [stageId, stage] of beforeStageMap) {
      if (!afterStageMap.has(stageId)) {
        detections.push(
          this.createDriftDetection(
            pipelineId,
            DriftChangeType.REMOVED,
            `stages[${this.findStageIndex(beforeStages, stageId)}]`,
            stage,
            undefined,
            `Stage removed from pipeline: ${stage.name || stageId}`
          )
        );
      }
    }

    // Find modified stages
    for (const [stageId, beforeStage] of beforeStageMap) {
      const afterStage = afterStageMap.get(stageId);
      if (afterStage) {
        const stageChanges = this.compareEntityFields(
          beforeStage,
          afterStage,
          pipelineId
        );
        // Adjust diff paths to include stages context
        stageChanges.forEach(change => {
          change.diffPath = `stages[${this.findStageIndex(beforeStages, stageId)}].${change.diffPath}`;
        });
        detections.push(...stageChanges);
      }
    }

    return detections;
  }

  /**
   * Get snapshot type
   */
  getSnapshotType(): SnapshotType {
    return SnapshotType.PIPELINES;
  }

  /**
   * Get entity ID from pipeline data
   */
  protected getEntityId(entity: any): string {
    return entity.id;
  }

  /**
   * Get entity type name
   */
  protected getEntityType(): string {
    return 'pipeline';
  }

  /**
   * Validate snapshots are comparable
   */
  private validateSnapshots(before: GhlSnapshot, after: GhlSnapshot): void {
    if (
      before.metadata.snapshotType !== SnapshotType.PIPELINES ||
      after.metadata.snapshotType !== SnapshotType.PIPELINES
    ) {
      throw new Error('Both snapshots must be pipeline snapshots');
    }

    if (before.metadata.tenantId !== after.metadata.tenantId) {
      throw new Error('Snapshots must be from the same tenant');
    }
  }

  /**
   * Find the index of a stage in stages array
   */
  private findStageIndex(stages: any[], targetId: string): number {
    return stages.findIndex(stage => stage.id === targetId);
  }
}
