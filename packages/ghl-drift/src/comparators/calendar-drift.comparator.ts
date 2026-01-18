/**
 * Calendar Drift Comparator - WI-053: GHL Drift Detection Engine
 *
 * Compares GHL calendar snapshots for drift detection.
 */

import { Injectable } from '@nestjs/common';
import { GhlSnapshot, SnapshotType } from '@neuronx/ghl-snapshots';
import { DriftDetection } from '../drift-types';
import { BaseDriftComparator } from './base-drift.comparator';

@Injectable()
export class CalendarDriftComparator extends BaseDriftComparator {
  constructor() {
    super('CalendarDriftComparator');
  }

  /**
   * Compare calendar snapshots
   */
  async compare(
    beforeSnapshot: GhlSnapshot,
    afterSnapshot: GhlSnapshot
  ): Promise<DriftDetection[]> {
    this.validateSnapshots(beforeSnapshot, afterSnapshot);

    const beforeData = beforeSnapshot.payload.data as any[];
    const afterData = afterSnapshot.payload.data as any[];

    this.logger.debug(`Comparing calendar snapshots`, {
      beforeCount: beforeData.length,
      afterCount: afterData.length,
    });

    return this.compareEntities(beforeData, afterData);
  }

  /**
   * Get snapshot type
   */
  getSnapshotType(): SnapshotType {
    return SnapshotType.CALENDARS;
  }

  /**
   * Get entity ID from calendar data
   */
  protected getEntityId(entity: any): string {
    return entity.id;
  }

  /**
   * Get entity type name
   */
  protected getEntityType(): string {
    return 'calendar';
  }

  /**
   * Validate snapshots are comparable
   */
  private validateSnapshots(before: GhlSnapshot, after: GhlSnapshot): void {
    if (
      before.metadata.snapshotType !== SnapshotType.CALENDARS ||
      after.metadata.snapshotType !== SnapshotType.CALENDARS
    ) {
      throw new Error('Both snapshots must be calendar snapshots');
    }

    if (before.metadata.tenantId !== after.metadata.tenantId) {
      throw new Error('Snapshots must be from the same tenant');
    }
  }
}
