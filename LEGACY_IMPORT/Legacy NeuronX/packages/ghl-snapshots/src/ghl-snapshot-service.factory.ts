/**
 * GHL Snapshot Service Factory - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Factory functions for creating GHL snapshot services with dependencies.
 */

import { PrismaClient } from '@prisma/client';
import { GhlSnapshotService } from './ghl-snapshot.service';
import { SnapshotStorageService } from './storage/snapshot-storage.service';
import { LocationSnapshotIngestion } from './ingestion/location-snapshot.ingestion';
import { PipelineSnapshotIngestion } from './ingestion/pipeline-snapshot.ingestion';
import { WorkflowSnapshotIngestion } from './ingestion/workflow-snapshot.ingestion';
import { CalendarSnapshotIngestion } from './ingestion/calendar-snapshot.ingestion';
import { AiWorkerSnapshotIngestion } from './ingestion/ai-worker-snapshot.ingestion';
import { SnapshotIngestionConfig } from './snapshot-types';

/**
 * Create a complete GHL snapshot service with all dependencies
 */
export function createGhlSnapshotService(
  prisma: PrismaClient,
  config?: Partial<SnapshotIngestionConfig>
): GhlSnapshotService {
  // Create storage service
  const storage = new SnapshotStorageService(prisma);

  // Create ingestion services
  const locationIngestion = new LocationSnapshotIngestion(prisma);
  const pipelineIngestion = new PipelineSnapshotIngestion(prisma);
  const workflowIngestion = new WorkflowSnapshotIngestion(prisma);
  const calendarIngestion = new CalendarSnapshotIngestion(prisma);
  const aiWorkerIngestion = new AiWorkerSnapshotIngestion(prisma);

  // Create main service
  return new GhlSnapshotService(
    storage,
    locationIngestion,
    pipelineIngestion,
    workflowIngestion,
    calendarIngestion,
    aiWorkerIngestion,
    config
  );
}
