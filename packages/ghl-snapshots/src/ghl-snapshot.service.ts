/**
 * GHL Snapshot Service - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Main service for orchestrating GHL configuration snapshot ingestion.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SnapshotStorageService } from './storage/snapshot-storage.service';
import {
  SnapshotType,
  SnapshotIngestionResult,
  GhlSnapshot,
  SnapshotIngestionConfig,
  DEFAULT_SNAPSHOT_INGESTION_CONFIG,
} from './snapshot-types';
import { LocationSnapshotIngestion } from './ingestion/location-snapshot.ingestion';
import { PipelineSnapshotIngestion } from './ingestion/pipeline-snapshot.ingestion';
import { WorkflowSnapshotIngestion } from './ingestion/workflow-snapshot.ingestion';
import { CalendarSnapshotIngestion } from './ingestion/calendar-snapshot.ingestion';
import { AiWorkerSnapshotIngestion } from './ingestion/ai-worker-snapshot.ingestion';
import { GhlBoundaryService } from '@neuronx/ghl-boundary-enforcer';

@Injectable()
export class GhlSnapshotService {
  private readonly logger = new Logger(GhlSnapshotService.name);
  private config: SnapshotIngestionConfig;

  constructor(
    private readonly storage: SnapshotStorageService,
    private readonly locationIngestion: LocationSnapshotIngestion,
    private readonly pipelineIngestion: PipelineSnapshotIngestion,
    private readonly workflowIngestion: WorkflowSnapshotIngestion,
    private readonly calendarIngestion: CalendarSnapshotIngestion,
    private readonly aiWorkerIngestion: AiWorkerSnapshotIngestion,
    private readonly boundaryService?: GhlBoundaryService,
    config?: Partial<SnapshotIngestionConfig>
  ) {
    this.config = { ...DEFAULT_SNAPSHOT_INGESTION_CONFIG, ...config };
  }

  /**
   * Run full snapshot ingestion for a tenant
   */
  async runFullSnapshot(
    tenantId: string,
    ghlAccountId: string,
    correlationId: string
  ): Promise<{
    overallSuccess: boolean;
    results: SnapshotIngestionResult[];
    durationMs: number;
  }> {
    const startTime = Date.now();
    const results: SnapshotIngestionResult[] = [];

    this.logger.log(`Starting full GHL snapshot ingestion`, {
      tenantId,
      ghlAccountId,
      correlationId,
    });

    try {
      // Run all snapshot types in parallel, but handle failures gracefully
      const snapshotPromises = [
        this.runSnapshotType(
          SnapshotType.LOCATIONS,
          tenantId,
          ghlAccountId,
          correlationId
        ),
        this.runSnapshotType(
          SnapshotType.PIPELINES,
          tenantId,
          ghlAccountId,
          correlationId
        ),
        this.runSnapshotType(
          SnapshotType.WORKFLOWS,
          tenantId,
          ghlAccountId,
          correlationId
        ),
        this.runSnapshotType(
          SnapshotType.CALENDARS,
          tenantId,
          ghlAccountId,
          correlationId
        ),
        this.runSnapshotType(
          SnapshotType.AI_WORKERS,
          tenantId,
          ghlAccountId,
          correlationId
        ),
      ];

      const snapshotResults = await Promise.allSettled(snapshotPromises);

      // Process results
      snapshotResults.forEach((result, index) => {
        const snapshotType = Object.values(SnapshotType)[index];
        if (result.status === 'fulfilled') {
          results.push(result.value);
          this.logger.log(`Snapshot completed`, {
            snapshotType,
            success: result.value.success,
            recordCount: result.value.recordCount,
            correlationId,
          });
        } else {
          // Create failure result
          const failureResult: SnapshotIngestionResult = {
            snapshotId: `failed_${snapshotType}_${Date.now()}`,
            snapshotType: snapshotType as any,
            success: false,
            recordCount: 0,
            errors: [
              {
                entityType: snapshotType,
                error: result.reason.message || 'Unknown error',
                timestamp: new Date(),
              },
            ],
            durationMs: 0,
            checksum: 'failed',
          };
          results.push(failureResult);

          this.logger.error(`Snapshot failed`, {
            snapshotType,
            error: result.reason.message,
            correlationId,
          });
        }
      });

      const overallSuccess = results.every(r => r.success);
      const totalDuration = Date.now() - startTime;

      // Run boundary enforcement analysis after successful snapshots (WI-029)
      if (overallSuccess && this.boundaryService) {
        try {
          // Aggregate all snapshot data for boundary analysis
          const aggregatedSnapshotData: any = {};

          // Collect data from successful snapshots
          for (const result of results) {
            if (result.success && result.data) {
              const snapshotType = result.snapshotType.toLowerCase();
              aggregatedSnapshotData[snapshotType] = result.data;
            }
          }

          // Run boundary analysis
          const boundaryResult = await this.boundaryService.analyzeSnapshot(
            tenantId,
            `full-snapshot-${Date.now()}`,
            aggregatedSnapshotData,
            correlationId
          );

          this.logger.log(`Boundary enforcement analysis completed`, {
            tenantId,
            violationsFound: boundaryResult.violations.length,
            analysisDuration: boundaryResult.analysisDuration,
            correlationId,
          });

          // Log violations if any
          if (boundaryResult.violations.length > 0) {
            this.logger.warn(`Boundary violations detected`, {
              tenantId,
              violationCount: boundaryResult.violations.length,
              violationsBySeverity: boundaryResult.summary.violationsBySeverity,
              correlationId,
            });
          }
        } catch (boundaryError) {
          this.logger.error(`Boundary enforcement analysis failed`, {
            tenantId,
            error: boundaryError.message,
            correlationId,
          });
          // Don't fail the snapshot ingestion due to boundary analysis errors
        }
      }

      // Audit the full snapshot run
      await this.auditFullSnapshot(
        tenantId,
        ghlAccountId,
        results,
        overallSuccess,
        correlationId
      );

      this.logger.log(`Full GHL snapshot ingestion completed`, {
        tenantId,
        ghlAccountId,
        overallSuccess,
        totalSnapshots: results.length,
        successfulSnapshots: results.filter(r => r.success).length,
        totalDuration,
        correlationId,
      });

      return {
        overallSuccess,
        results,
        durationMs: totalDuration,
      };
    } catch (error) {
      this.logger.error(`Full GHL snapshot ingestion failed`, {
        tenantId,
        ghlAccountId,
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Run snapshot for a specific type
   */
  private async runSnapshotType(
    snapshotType: SnapshotType,
    tenantId: string,
    ghlAccountId: string,
    correlationId: string
  ): Promise<SnapshotIngestionResult> {
    const startTime = Date.now();

    try {
      let snapshot: GhlSnapshot;

      switch (snapshotType) {
        case SnapshotType.LOCATIONS:
          snapshot = await this.locationIngestion.ingest(
            tenantId,
            ghlAccountId,
            correlationId
          );
          break;
        case SnapshotType.PIPELINES:
          snapshot = await this.pipelineIngestion.ingest(
            tenantId,
            ghlAccountId,
            correlationId
          );
          break;
        case SnapshotType.WORKFLOWS:
          snapshot = await this.workflowIngestion.ingest(
            tenantId,
            ghlAccountId,
            correlationId
          );
          break;
        case SnapshotType.CALENDARS:
          snapshot = await this.calendarIngestion.ingest(
            tenantId,
            ghlAccountId,
            correlationId
          );
          break;
        case SnapshotType.AI_WORKERS:
          snapshot = await this.aiWorkerIngestion.ingest(
            tenantId,
            ghlAccountId,
            correlationId
          );
          break;
        default:
          throw new Error(`Unknown snapshot type: ${snapshotType}`);
      }

      // Store the snapshot
      await this.storage.store(snapshot);

      const duration = Date.now() - startTime;

      return {
        snapshotId: snapshot.metadata.snapshotId,
        snapshotType,
        success: true,
        recordCount: snapshot.metadata.recordCount,
        errors: [],
        durationMs: duration,
        checksum: snapshot.metadata.checksum,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        snapshotId: `error_${snapshotType}_${Date.now()}`,
        snapshotType,
        success: false,
        recordCount: 0,
        errors: [
          {
            entityType: snapshotType,
            error: error.message,
            timestamp: new Date(),
          },
        ],
        durationMs: duration,
        checksum: 'error',
      };
    }
  }

  /**
   * Run snapshot for a specific type only
   */
  async runSingleSnapshot(
    snapshotType: SnapshotType,
    tenantId: string,
    ghlAccountId: string,
    correlationId: string
  ): Promise<SnapshotIngestionResult> {
    this.logger.log(`Running single snapshot`, {
      snapshotType,
      tenantId,
      ghlAccountId,
      correlationId,
    });

    const result = await this.runSnapshotType(
      snapshotType,
      tenantId,
      ghlAccountId,
      correlationId
    );

    // Audit single snapshot run
    await this.auditSingleSnapshot(
      snapshotType,
      tenantId,
      ghlAccountId,
      result,
      correlationId
    );

    return result;
  }

  /**
   * Get snapshot storage statistics
   */
  async getSnapshotStats(tenantId?: string) {
    return this.storage.getStats(tenantId);
  }

  /**
   * Record metrics for observability
   */
  private recordMetrics(eventType: string, metrics: Record<string, any>): void {
    // In a real implementation, this would send metrics to a monitoring system
    // For now, we log structured metrics that can be scraped by monitoring tools

    const metricData = {
      eventType,
      timestamp: Date.now(),
      ...metrics,
    };

    this.logger.debug('GHL snapshot metrics', metricData);
  }

  /**
   * Query snapshots
   */
  async querySnapshots(query: any) {
    return this.storage.query(query);
  }

  /**
   * Get latest snapshot for a type
   */
  async getLatestSnapshot(tenantId: string, snapshotType: SnapshotType) {
    return this.storage.getLatest(tenantId, snapshotType);
  }

  /**
   * Audit full snapshot run
   */
  private async auditFullSnapshot(
    tenantId: string,
    ghlAccountId: string,
    results: SnapshotIngestionResult[],
    overallSuccess: boolean,
    correlationId: string
  ): Promise<void> {
    // Emit audit event for observability
    const auditEvent = {
      eventType: 'ghl_snapshot_full_run',
      tenantId,
      ghlAccountId,
      correlationId,
      timestamp: new Date().toISOString(),
      success: overallSuccess,
      totalSnapshots: results.length,
      successfulSnapshots: results.filter(r => r.success).length,
      failedSnapshots: results.filter(r => !r.success).length,
      totalRecords: results.reduce((sum, r) => sum + r.recordCount, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      durationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
      snapshotTypes: results.map(r => r.snapshotType),
      source: 'scheduled',
    };

    this.logger.log('GHL snapshot audit event', auditEvent);

    // Record metrics for observability
    this.recordMetrics('ghl_snapshot_full_run', {
      tenantId,
      success: overallSuccess ? 1 : 0,
      total_snapshots: results.length,
      successful_snapshots: results.filter(r => r.success).length,
      total_records: results.reduce((sum, r) => sum + r.recordCount, 0),
      total_duration_ms: results.reduce((sum, r) => sum + r.durationMs, 0),
    });
  }

  /**
   * Audit single snapshot run
   */
  private async auditSingleSnapshot(
    snapshotType: SnapshotType,
    tenantId: string,
    ghlAccountId: string,
    result: SnapshotIngestionResult,
    correlationId: string
  ): Promise<void> {
    // Emit audit event for observability
    const auditEvent = {
      eventType: 'ghl_snapshot_single_run',
      tenantId,
      ghlAccountId,
      snapshotType,
      correlationId,
      timestamp: new Date().toISOString(),
      success: result.success,
      recordCount: result.recordCount,
      errorCount: result.errors.length,
      durationMs: result.durationMs,
      checksum: result.checksum,
      source: 'manual',
    };

    this.logger.log('GHL single snapshot audit event', auditEvent);

    // Record metrics for observability
    this.recordMetrics('ghl_snapshot_single_run', {
      tenantId,
      snapshotType,
      success: result.success ? 1 : 0,
      record_count: result.recordCount,
      error_count: result.errors.length,
      duration_ms: result.durationMs,
    });
  }
}
