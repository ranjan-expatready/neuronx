/**
 * AI Worker Drift Comparator - WI-053: GHL Drift Detection Engine
 *
 * Compares GHL AI worker snapshots for drift detection.
 */

import { Injectable } from '@nestjs/common';
import { GhlSnapshot, SnapshotType } from '@neuronx/ghl-snapshots';
import { DriftDetection } from '../drift-types';
import { BaseDriftComparator } from './base-drift.comparator';

@Injectable()
export class AiWorkerDriftComparator extends BaseDriftComparator {
  constructor() {
    super('AiWorkerDriftComparator');
  }

  /**
   * Compare AI worker snapshots
   */
  async compare(
    beforeSnapshot: GhlSnapshot,
    afterSnapshot: GhlSnapshot
  ): Promise<DriftDetection[]> {
    this.validateSnapshots(beforeSnapshot, afterSnapshot);

    const beforeData = beforeSnapshot.payload.data as any[];
    const afterData = afterSnapshot.payload.data as any[];

    this.logger.debug(`Comparing AI worker snapshots`, {
      beforeCount: beforeData.length,
      afterCount: afterData.length,
    });

    return this.compareEntities(beforeData, afterData);
  }

  /**
   * Get snapshot type
   */
  getSnapshotType(): SnapshotType {
    return SnapshotType.AI_WORKERS;
  }

  /**
   * Get entity ID from AI worker data
   */
  protected getEntityId(entity: any): string {
    return entity.id;
  }

  /**
   * Get entity type name
   */
  protected getEntityType(): string {
    return 'ai_worker';
  }

  /**
   * Validate snapshots are comparable
   */
  private validateSnapshots(before: GhlSnapshot, after: GhlSnapshot): void {
    if (
      before.metadata.snapshotType !== SnapshotType.AI_WORKERS ||
      after.metadata.snapshotType !== SnapshotType.AI_WORKERS
    ) {
      throw new Error('Both snapshots must be AI worker snapshots');
    }

    if (before.metadata.tenantId !== after.metadata.tenantId) {
      throw new Error('Snapshots must be from the same tenant');
    }
  }
}
