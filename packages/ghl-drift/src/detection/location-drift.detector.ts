/**
 * Location Drift Detector - WI-053: Drift Detection Engine
 *
 * Detects drift in GHL location configurations.
 */

import { Injectable } from '@nestjs/common';
import { BaseDriftDetector } from './base-drift.detector';
import { DriftChange, DriftChangeType } from '../drift-types';

@Injectable()
export class LocationDriftDetector extends BaseDriftDetector {
  /**
   * Detect drift in location snapshots
   */
  async detectDrift(
    beforeSnapshot: any,
    afterSnapshot: any,
    context: { tenantId: string; ghlAccountId: string; correlationId: string }
  ): Promise<DriftChange[]> {
    const beforeLocations = beforeSnapshot.payload?.data || [];
    const afterLocations = afterSnapshot.payload?.data || [];

    return this.detectEntityChanges(
      beforeLocations,
      afterLocations,
      'location'
    );
  }
}
