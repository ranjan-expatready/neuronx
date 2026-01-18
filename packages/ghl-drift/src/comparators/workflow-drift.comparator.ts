/**
 * Workflow Drift Comparator - WI-053: GHL Drift Detection Engine
 *
 * Compares GHL workflow snapshots for drift detection.
 */

import { Injectable } from '@nestjs/common';
import { GhlSnapshot, SnapshotType } from '@neuronx/ghl-snapshots';
import { DriftDetection } from '../drift-types';
import { BaseDriftComparator } from './base-drift.comparator';

@Injectable()
export class WorkflowDriftComparator extends BaseDriftComparator {
  constructor() {
    super('WorkflowDriftComparator');
  }

  /**
   * Compare workflow snapshots
   */
  async compare(
    beforeSnapshot: GhlSnapshot,
    afterSnapshot: GhlSnapshot
  ): Promise<DriftDetection[]> {
    this.validateSnapshots(beforeSnapshot, afterSnapshot);

    const beforeData = beforeSnapshot.payload.data as any[];
    const afterData = afterSnapshot.payload.data as any[];

    this.logger.debug(`Comparing workflow snapshots`, {
      beforeCount: beforeData.length,
      afterCount: afterData.length,
    });

    return this.compareEntities(beforeData, afterData);
  }

  /**
   * Get snapshot type
   */
  getSnapshotType(): SnapshotType {
    return SnapshotType.WORKFLOWS;
  }

  /**
   * Get entity ID from workflow data
   */
  protected getEntityId(entity: any): string {
    return entity.id;
  }

  /**
   * Get entity type name
   */
  protected getEntityType(): string {
    return 'workflow';
  }

  /**
   * Validate snapshots are comparable
   */
  private validateSnapshots(before: GhlSnapshot, after: GhlSnapshot): void {
    if (
      before.metadata.snapshotType !== SnapshotType.WORKFLOWS ||
      after.metadata.snapshotType !== SnapshotType.WORKFLOWS
    ) {
      throw new Error('Both snapshots must be workflow snapshots');
    }

    if (before.metadata.tenantId !== after.metadata.tenantId) {
      throw new Error('Snapshots must be from the same tenant');
    }
  }
}
