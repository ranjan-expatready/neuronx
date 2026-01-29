/**
 * Drift Detection Engine - WI-053: GHL Drift Detection Engine
 *
 * Core engine for deterministic drift detection between GHL snapshots.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  SnapshotStorageService,
  GhlSnapshot,
  SnapshotType,
} from '@neuronx/ghl-snapshots';
import {
  DriftDetectionRequest,
  DriftDetectionResponse,
  DriftAnalysisResult,
  DriftDetection,
  DriftDetectionConfig,
  DEFAULT_DRIFT_DETECTION_CONFIG,
  getOverallSeverity,
  hasBreakingChanges,
  requiresReview,
} from '../drift-types';
import { BaseDriftComparator } from '../comparators/base-drift.comparator';

@Injectable()
export class DriftDetectionEngine {
  private readonly logger = new Logger(DriftDetectionEngine.name);
  private config: DriftDetectionConfig;

  constructor(
    private readonly snapshotStorage: SnapshotStorageService,
    private readonly comparators: Map<SnapshotType, BaseDriftComparator>,
    config?: Partial<DriftDetectionConfig>
  ) {
    this.config = { ...DEFAULT_DRIFT_DETECTION_CONFIG, ...config };
  }

  /**
   * Analyze drift between two snapshots
   */
  async analyzeDrift(
    request: DriftDetectionRequest
  ): Promise<DriftDetectionResponse> {
    const startTime = Date.now();
    const analysisId = this.generateAnalysisId();

    try {
      this.logger.debug(`Starting drift analysis`, {
        analysisId,
        tenantId: request.tenantId,
        snapshotType: request.snapshotType,
        correlationId: request.correlationId,
      });

      // Get snapshots to compare
      const { beforeSnapshot, afterSnapshot } =
        await this.getSnapshotsForComparison(request);

      // Get appropriate comparator
      const comparator = this.comparators.get(request.snapshotType);
      if (!comparator) {
        throw new Error(
          `No comparator available for snapshot type: ${request.snapshotType}`
        );
      }

      // Perform drift analysis
      const detections = await comparator.compare(
        beforeSnapshot,
        afterSnapshot
      );

      // Calculate summary statistics
      const changesByCategory = this.countByCategory(detections);
      const overallSeverity = getOverallSeverity(detections);
      const hasBreaking = hasBreakingChanges(detections);
      const needsReview = requiresReview(detections, this.config);

      const changesByType = detections.reduce((acc, d) => {
        acc[d.changeType] = (acc[d.changeType] || 0) + 1;
        return acc;
      }, {} as any);

      const hasCritical = detections.some(d => d.severity === 'CRITICAL');

      // Create analysis result
      const result: DriftAnalysisResult = {
        driftId: analysisId,
        analysisId,
        tenantId: request.tenantId,
        ghlAccountId: request.ghlAccountId,
        snapshotType: request.snapshotType,
        beforeSnapshotId: beforeSnapshot.metadata.snapshotId,
        afterSnapshotId: afterSnapshot.metadata.snapshotId,
        detectedAt: new Date(),
        analysisDurationMs: Date.now() - startTime,
        changes: detections,
        summary: {
          totalChanges: detections.length,
          changesByType,
          changesByCategory: changesByCategory as any,
          maxSeverity: overallSeverity,
          hasCriticalChanges: hasCritical,
          overallSeverity,
          hasBreakingChanges: hasBreaking,
          requiresReview: needsReview,
          riskAssessment: this.generateRiskAssessment(
            detections,
            overallSeverity,
            hasBreaking
          ),
        },
        metadata: {
          beforeCapturedAt: beforeSnapshot.metadata.capturedAt,
          afterCapturedAt: afterSnapshot.metadata.capturedAt,
          timeSpanMs:
            afterSnapshot.metadata.capturedAt.getTime() -
            beforeSnapshot.metadata.capturedAt.getTime(),
          correlationId: request.correlationId,
        },
      };

      // Audit the analysis
      await this.auditDriftAnalysis(result as any, request.correlationId);

      // Record metrics
      this.recordMetrics(result as any);

      this.logger.log(`Drift analysis completed`, {
        analysisId,
        tenantId: request.tenantId,
        snapshotType: request.snapshotType,
        totalChanges: detections.length,
        overallSeverity,
        hasBreakingChanges: hasBreaking,
        durationMs: result.analysisDurationMs,
        correlationId: request.correlationId,
      });

      return {
        analysisId,
        success: true,
        driftResult: result,
        correlationId: request.correlationId,
      } as any;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(`Drift analysis failed`, {
        analysisId,
        tenantId: request.tenantId,
        snapshotType: request.snapshotType,
        error: error.message,
        durationMs: duration,
        correlationId: request.correlationId,
      });

      return {
        analysisId,
        success: false,
        error: error.message,
        correlationId: request.correlationId,
      } as any;
    }
  }

  /**
   * Get snapshots for comparison
   */
  private async getSnapshotsForComparison(
    request: DriftDetectionRequest
  ): Promise<{
    beforeSnapshot: GhlSnapshot;
    afterSnapshot: GhlSnapshot;
  }> {
    let beforeSnapshot: GhlSnapshot;
    let afterSnapshot: GhlSnapshot;

    if (request.beforeSnapshotId && request.afterSnapshotId) {
      // Explicit snapshot IDs provided
      const snapshots = await Promise.all([
        this.snapshotStorage.retrieve(request.beforeSnapshotId),
        this.snapshotStorage.retrieve(request.afterSnapshotId),
      ]);
      beforeSnapshot = snapshots[0] as GhlSnapshot;
      afterSnapshot = snapshots[1] as GhlSnapshot;

      if (!beforeSnapshot || !afterSnapshot) {
        throw new Error('One or both specified snapshots not found');
      }
    } else {
      // Use latest snapshots with time window
      const latestSnapshots = await this.getSnapshotsInWindow(
        request.tenantId,
        request.ghlAccountId,
        request.snapshotType,
        this.config.comparisonWindowHours || 24
      );

      if (latestSnapshots.length < 2) {
        throw new Error(
          `Insufficient snapshots for comparison. Found ${latestSnapshots.length}, need at least 2`
        );
      }

      // Sort by capture time (most recent first)
      latestSnapshots.sort(
        (a, b) =>
          b.metadata.capturedAt.getTime() - a.metadata.capturedAt.getTime()
      );

      beforeSnapshot = latestSnapshots[1]; // Second most recent
      afterSnapshot = latestSnapshots[0]; // Most recent
    }

    // Validate snapshots are comparable
    this.validateSnapshotsForComparison(beforeSnapshot, afterSnapshot, request);

    return { beforeSnapshot, afterSnapshot };
  }

  /**
   * Get snapshots within a time window for comparison
   */
  private async getSnapshotsInWindow(
    tenantId: string,
    ghlAccountId: string,
    snapshotType: SnapshotType,
    windowHours: number
  ): Promise<GhlSnapshot[]> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

    const snapshots = await this.snapshotStorage.query({
      tenantId,
      ghlAccountId,
      snapshotType,
      fromDate: windowStart,
      toDate: now,
      limit: 10, // Get last 10 snapshots in window
    });

    return snapshots;
  }

  /**
   * Validate that snapshots can be compared
   */
  private validateSnapshotsForComparison(
    before: GhlSnapshot,
    after: GhlSnapshot,
    request: DriftDetectionRequest
  ): void {
    // Must be same snapshot type
    if (before.metadata.snapshotType !== after.metadata.snapshotType) {
      throw new Error('Cannot compare snapshots of different types');
    }

    // Must be same tenant and GHL account
    if (
      before.metadata.tenantId !== after.metadata.tenantId ||
      before.metadata.ghlAccountId !== after.metadata.ghlAccountId
    ) {
      throw new Error('Snapshots must be from same tenant and GHL account');
    }

    // Before snapshot must be older than after
    if (before.metadata.capturedAt >= after.metadata.capturedAt) {
      throw new Error('Before snapshot must be captured before after snapshot');
    }

    // Must match request parameters
    if (
      before.metadata.tenantId !== request.tenantId ||
      before.metadata.ghlAccountId !== request.ghlAccountId ||
      before.metadata.snapshotType !== request.snapshotType
    ) {
      throw new Error('Snapshot metadata does not match request parameters');
    }
  }

  /**
   * Generate unique analysis ID
   */
  private generateAnalysisId(): string {
    return `drift_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Count detections by category
   */
  private countByCategory(
    detections: DriftDetection[]
  ): Record<string, number> {
    const counts: Record<string, number> = {};
    detections.forEach(detection => {
      counts[detection.category] = (counts[detection.category] || 0) + 1;
    });
    return counts;
  }

  /**
   * Generate risk assessment summary
   */
  private generateRiskAssessment(
    detections: DriftDetection[],
    overallSeverity: string,
    hasBreaking: boolean
  ): string {
    if (hasBreaking) {
      return 'Breaking changes detected that may impact existing workflows or integrations';
    }

    if (overallSeverity === 'critical') {
      return 'Critical changes that require immediate review and potential rollback planning';
    }

    if (overallSeverity === 'high') {
      return 'High-impact changes that should be reviewed before next deployment';
    }

    if (overallSeverity === 'medium') {
      return 'Moderate operational changes that may affect performance or behavior';
    }

    if (detections.length > 0) {
      return 'Minor changes detected with low operational impact';
    }

    return 'No significant changes detected between snapshots';
  }

  /**
   * Audit drift analysis completion
   */
  private async auditDriftAnalysis(
    result: any,
    correlationId: string
  ): Promise<void> {
    // In a real implementation, this would create an audit event
    this.logger.log(`Auditing drift analysis`, {
        analysisId: result.analysisId,
        tenantId: result.tenantId,
        snapshotType: result.snapshotType,
        totalChanges: result.summary.totalChanges,
        overallSeverity: result.summary.overallSeverity,
        hasBreakingChanges: result.summary.hasBreakingChanges,
        correlationId,
      });
  }

  /**
   * Record metrics for observability
   */
  private recordMetrics(result: any): void {
    // In a real implementation, this would send metrics to monitoring system
    this.logger.debug('Drift analysis metrics', {
      tenantId: result.tenantId,
      snapshotType: result.snapshotType,
      totalChanges: result.totalChanges,
      overallSeverity: result.summary.overallSeverity,
      analysisDurationMs: result.analysisDurationMs,
      hasBreakingChanges: result.summary.hasBreakingChanges,
    });
  }
}
