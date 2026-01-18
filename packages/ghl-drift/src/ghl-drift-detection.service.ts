/**
 * GHL Drift Detection Service - WI-053: Drift Detection Engine
 *
 * Main service for detecting and classifying drift between GHL snapshots.
 */

import { Injectable, Logger } from '@nestjs/common';
import { GhlSnapshotService } from '@neuronx/ghl-snapshots';
import {
  DriftDetectionRequest,
  DriftDetectionResponse,
  DriftDetectionResult,
  SnapshotType,
  DriftChange,
  DriftChangeType,
  DriftCategory,
  DriftSeverity,
  DriftDetectionConfig,
  DEFAULT_DRIFT_DETECTION_CONFIG,
} from './drift-types';
import { DriftStorageService } from './drift-storage.service';
import { LocationDriftDetector } from './detection/location-drift.detector';
import { PipelineDriftDetector } from './detection/pipeline-drift.detector';
import { WorkflowDriftDetector } from './detection/workflow-drift.detector';
import { CalendarDriftDetector } from './detection/calendar-drift.detector';
import { AiWorkerDriftDetector } from './detection/ai-worker-drift.detector';
import { DriftClassifier } from './classifiers/drift-classifier';

@Injectable()
export class GhlDriftDetectionService {
  private readonly logger = new Logger(GhlDriftDetectionService.name);
  private config: DriftDetectionConfig;

  constructor(
    private readonly snapshotService: GhlSnapshotService,
    private readonly driftStorage: DriftStorageService,
    private readonly locationDetector: LocationDriftDetector,
    private readonly pipelineDetector: PipelineDriftDetector,
    private readonly workflowDetector: WorkflowDriftDetector,
    private readonly calendarDetector: CalendarDriftDetector,
    private readonly aiWorkerDetector: AiWorkerDriftDetector,
    private readonly driftClassifier: DriftClassifier,
    config?: Partial<DriftDetectionConfig>
  ) {
    this.config = { ...DEFAULT_DRIFT_DETECTION_CONFIG, ...config };
  }

  /**
   * Detect drift for a specific request
   */
  async detectDrift(
    request: DriftDetectionRequest
  ): Promise<DriftDetectionResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Starting drift detection', {
        tenantId: request.tenantId,
        snapshotType: request.snapshotType,
        correlationId: request.correlationId,
      });

      // Get snapshots
      const { beforeSnapshot, afterSnapshot } =
        await this.getSnapshotsForComparison(request);

      // Detect changes
      const changes = await this.detectChanges(
        request.snapshotType,
        beforeSnapshot,
        afterSnapshot,
        {
          tenantId: request.tenantId,
          ghlAccountId: request.ghlAccountId,
          correlationId: request.correlationId,
        }
      );

      // Classify and filter changes
      const classifiedChanges = this.classifyAndFilterChanges(changes);

      // Create result
      const result: DriftDetectionResult = {
        driftId: this.generateDriftId(
          request.tenantId,
          request.snapshotType,
          beforeSnapshot.metadata.capturedAt,
          afterSnapshot.metadata.capturedAt
        ),
        tenantId: request.tenantId,
        ghlAccountId: request.ghlAccountId,
        snapshotType: request.snapshotType,
        beforeSnapshotId: beforeSnapshot.metadata.snapshotId,
        afterSnapshotId: afterSnapshot.metadata.snapshotId,
        detectedAt: new Date(),
        changes: classifiedChanges,
        summary: this.createSummary(classifiedChanges),
        metadata: {
          beforeCapturedAt: beforeSnapshot.metadata.capturedAt,
          afterCapturedAt: afterSnapshot.metadata.capturedAt,
          timeSpanMs:
            afterSnapshot.metadata.capturedAt.getTime() -
            beforeSnapshot.metadata.capturedAt.getTime(),
          correlationId: request.correlationId,
        },
      };

      // Store result
      await this.driftStorage.store(result);

      // Audit the detection
      await this.auditDriftDetection(result, request.correlationId);

      const duration = Date.now() - startTime;

      this.logger.log('Drift detection completed', {
        driftId: result.driftId,
        totalChanges: result.changes.length,
        maxSeverity: result.summary.maxSeverity,
        durationMs: duration,
        correlationId: request.correlationId,
      });

      return {
        success: true,
        driftResult: result,
        durationMs: duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Drift detection failed', {
        tenantId: request.tenantId,
        snapshotType: request.snapshotType,
        error: error.message,
        correlationId: request.correlationId,
        durationMs: duration,
      });

      return {
        success: false,
        error: error.message,
        durationMs: duration,
      };
    }
  }

  /**
   * Get snapshots for comparison
   */
  private async getSnapshotsForComparison(
    request: DriftDetectionRequest
  ): Promise<{
    beforeSnapshot: any;
    afterSnapshot: any;
  }> {
    let beforeSnapshot, afterSnapshot;

    if (request.beforeSnapshotId) {
      beforeSnapshot = await this.snapshotService
        .getSnapshotStorage()
        .retrieve(request.beforeSnapshotId);
      if (!beforeSnapshot) {
        throw new Error(
          `Before snapshot not found: ${request.beforeSnapshotId}`
        );
      }
    } else {
      // Use latest - 1
      const snapshots = await this.snapshotService.getSnapshotStorage().query({
        tenantId: request.tenantId,
        snapshotType: request.snapshotType,
        limit: 2,
      });

      if (snapshots.length < 2) {
        throw new Error(
          `Insufficient snapshots for comparison: found ${snapshots.length}, need 2`
        );
      }

      beforeSnapshot = snapshots[1]; // Second most recent
      afterSnapshot = snapshots[0]; // Most recent
    }

    if (request.afterSnapshotId) {
      afterSnapshot = await this.snapshotService
        .getSnapshotStorage()
        .retrieve(request.afterSnapshotId);
      if (!afterSnapshot) {
        throw new Error(`After snapshot not found: ${request.afterSnapshotId}`);
      }
    } else if (!afterSnapshot) {
      // Use latest
      afterSnapshot = await this.snapshotService
        .getSnapshotStorage()
        .getLatest(request.tenantId, request.snapshotType);

      if (!afterSnapshot) {
        throw new Error(
          `No snapshots found for tenant ${request.tenantId} and type ${request.snapshotType}`
        );
      }
    }

    // Validate snapshots are comparable
    if (beforeSnapshot.metadata.tenantId !== afterSnapshot.metadata.tenantId) {
      throw new Error('Snapshots must be from the same tenant');
    }

    if (
      beforeSnapshot.metadata.snapshotType !==
      afterSnapshot.metadata.snapshotType
    ) {
      throw new Error('Snapshots must be of the same type');
    }

    if (
      beforeSnapshot.metadata.capturedAt >= afterSnapshot.metadata.capturedAt
    ) {
      throw new Error('Before snapshot must be captured before after snapshot');
    }

    return { beforeSnapshot, afterSnapshot };
  }

  /**
   * Detect changes using appropriate detector
   */
  private async detectChanges(
    snapshotType: SnapshotType,
    beforeSnapshot: any,
    afterSnapshot: any,
    context: { tenantId: string; ghlAccountId: string; correlationId: string }
  ): Promise<DriftChange[]> {
    let detector;

    switch (snapshotType) {
      case SnapshotType.LOCATIONS:
        detector = this.locationDetector;
        break;
      case SnapshotType.PIPELINES:
        detector = this.pipelineDetector;
        break;
      case SnapshotType.WORKFLOWS:
        detector = this.workflowDetector;
        break;
      case SnapshotType.CALENDARS:
        detector = this.calendarDetector;
        break;
      case SnapshotType.AI_WORKERS:
        detector = this.aiWorkerDetector;
        break;
      default:
        throw new Error(`Unknown snapshot type: ${snapshotType}`);
    }

    return detector.detectDrift(beforeSnapshot, afterSnapshot, context);
  }

  /**
   * Classify and filter changes
   */
  private classifyAndFilterChanges(changes: DriftChange[]): DriftChange[] {
    return changes
      .map(change => {
        const classification = this.driftClassifier.classifyChange(change);
        return {
          ...change,
          category: classification.category,
          severity: classification.severity,
        };
      })
      .filter(change => change.severity !== DriftSeverity.LOW) // Filter out cosmetic changes
      .slice(0, this.config.maxChangesPerDetection); // Limit for performance
  }

  /**
   * Create summary statistics
   */
  private createSummary(
    changes: DriftChange[]
  ): DriftDetectionResult['summary'] {
    const changesByType: Record<DriftChangeType, number> = {
      [DriftChangeType.ADDED]: 0,
      [DriftChangeType.REMOVED]: 0,
      [DriftChangeType.MODIFIED]: 0,
    };

    const changesByCategory: Record<DriftCategory, number> = {
      [DriftCategory.CONFIG_DRIFT]: 0,
      [DriftCategory.CAPABILITY_DRIFT]: 0,
      [DriftCategory.STRUCTURAL_DRIFT]: 0,
      [DriftCategory.COSMETIC_DRIFT]: 0,
    };

    let maxSeverity = DriftSeverity.LOW;
    let hasCriticalChanges = false;

    for (const change of changes) {
      changesByType[change.changeType]++;
      changesByCategory[change.category]++;

      if (change.severity === DriftSeverity.CRITICAL) {
        hasCriticalChanges = true;
      }

      if (
        this.getSeverityLevel(change.severity) >
        this.getSeverityLevel(maxSeverity)
      ) {
        maxSeverity = change.severity;
      }
    }

    return {
      totalChanges: changes.length,
      changesByType,
      changesByCategory,
      maxSeverity,
      hasCriticalChanges,
    };
  }

  /**
   * Get numeric severity level for comparison
   */
  private getSeverityLevel(severity: DriftSeverity): number {
    switch (severity) {
      case DriftSeverity.LOW:
        return 0;
      case DriftSeverity.MEDIUM:
        return 1;
      case DriftSeverity.HIGH:
        return 2;
      case DriftSeverity.CRITICAL:
        return 3;
    }
  }

  /**
   * Generate unique drift ID
   */
  private generateDriftId(
    tenantId: string,
    snapshotType: SnapshotType,
    beforeTime: Date,
    afterTime: Date
  ): string {
    const timestamp = Date.now();
    return `drift_${tenantId}_${snapshotType}_${beforeTime.getTime()}_${afterTime.getTime()}_${timestamp}`;
  }

  /**
   * Audit drift detection run
   */
  private async auditDriftDetection(
    result: DriftDetectionResult,
    correlationId: string
  ): Promise<void> {
    // In a real implementation, this would create an audit event
    this.logger.log('Drift detection audit event', {
      driftId: result.driftId,
      tenantId: result.tenantId,
      snapshotType: result.snapshotType,
      totalChanges: result.summary.totalChanges,
      maxSeverity: result.summary.maxSeverity,
      hasCriticalChanges: result.summary.hasCriticalChanges,
      correlationId,
      timestamp: result.detectedAt.toISOString(),
    });
  }

  /**
   * Get drift detection statistics
   */
  async getDriftStats(tenantId: string): Promise<{
    totalDrifts: number;
    driftsByType: Record<string, number>;
    driftsBySeverity: Record<string, number>;
    recentCriticalDrifts: DriftDetectionResult[];
  }> {
    const drifts = await this.driftStorage.query(tenantId);

    const driftsByType: Record<string, number> = {};
    const driftsBySeverity: Record<string, number> = {};

    for (const drift of drifts) {
      const type = drift.snapshotType;
      const severity = drift.summary.maxSeverity;

      driftsByType[type] = (driftsByType[type] || 0) + 1;
      driftsBySeverity[severity] = (driftsBySeverity[severity] || 0) + 1;
    }

    const recentCriticalDrifts = drifts
      .filter(d => d.summary.hasCriticalChanges)
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
      .slice(0, 5);

    return {
      totalDrifts: drifts.length,
      driftsByType,
      driftsBySeverity,
      recentCriticalDrifts,
    };
  }
}
