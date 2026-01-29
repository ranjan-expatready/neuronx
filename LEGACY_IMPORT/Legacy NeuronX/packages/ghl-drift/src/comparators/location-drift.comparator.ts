/**
 * Location Drift Comparator - WI-053: GHL Drift Detection Engine
 *
 * Compares GHL location snapshots for drift detection.
 */

import { Injectable } from '@nestjs/common';
import { GhlSnapshot, SnapshotType } from '@neuronx/ghl-snapshots';
import { DriftDetection } from '../drift-types';
import { BaseDriftComparator } from './base-drift.comparator';

@Injectable()
export class LocationDriftComparator extends BaseDriftComparator {
  constructor() {
    super('LocationDriftComparator');
  }

  /**
   * Compare location snapshots
   */
  async compare(
    beforeSnapshot: GhlSnapshot,
    afterSnapshot: GhlSnapshot
  ): Promise<DriftDetection[]> {
    this.validateSnapshots(beforeSnapshot, afterSnapshot);

    const beforeData = beforeSnapshot.payload.data as any[];
    const afterData = afterSnapshot.payload.data as any[];

    this.logger.debug(`Comparing location snapshots`, {
      beforeCount: beforeData.length,
      afterCount: afterData.length,
    });

    return this.compareEntities(beforeData, afterData);
  }

  /**
   * Get snapshot type
   */
  getSnapshotType(): SnapshotType {
    return SnapshotType.LOCATIONS;
  }

  /**
   * Get entity ID from location data
   */
  protected getEntityId(entity: any): string {
    return entity.id;
  }

  /**
   * Get entity type name
   */
  protected getEntityType(): string {
    return 'location';
  }

  /**
   * Validate snapshots are comparable
   */
  private validateSnapshots(before: GhlSnapshot, after: GhlSnapshot): void {
    if (
      before.metadata.snapshotType !== SnapshotType.LOCATIONS ||
      after.metadata.snapshotType !== SnapshotType.LOCATIONS
    ) {
      throw new Error('Both snapshots must be location snapshots');
    }

    if (before.metadata.tenantId !== after.metadata.tenantId) {
      throw new Error('Snapshots must be from the same tenant');
    }
  }
}
