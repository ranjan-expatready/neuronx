/**
 * GHL Snapshots Package - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Read-only mirroring of GHL configuration for drift detection and explainability.
 */

// Types and schemas
export * from './snapshot-types';

// Core services
import { GhlSnapshotService } from './ghl-snapshot.service';
import { SnapshotStorageService } from './storage/snapshot-storage.service';

// Ingestion services
import { LocationSnapshotIngestion } from './ingestion/location-snapshot.ingestion';
import { PipelineSnapshotIngestion } from './ingestion/pipeline-snapshot.ingestion';
import { WorkflowSnapshotIngestion } from './ingestion/workflow-snapshot.ingestion';
import { CalendarSnapshotIngestion } from './ingestion/calendar-snapshot.ingestion';
import { AiWorkerSnapshotIngestion } from './ingestion/ai-worker-snapshot.ingestion';

export { GhlSnapshotService, SnapshotStorageService };
export {
  LocationSnapshotIngestion,
  PipelineSnapshotIngestion,
  WorkflowSnapshotIngestion,
  CalendarSnapshotIngestion,
  AiWorkerSnapshotIngestion,
};

// Triggers
export { ScheduledSnapshotTrigger } from './triggers/scheduled-snapshot.trigger';
export { ManualSnapshotTrigger } from './triggers/manual-snapshot.trigger';

// Factory functions
export { createGhlSnapshotService } from './ghl-snapshot-service.factory';

// Module exports for NestJS
export const GHL_SNAPSHOTS_PROVIDERS = [
  GhlSnapshotService,
  SnapshotStorageService,
  LocationSnapshotIngestion,
  PipelineSnapshotIngestion,
  WorkflowSnapshotIngestion,
  CalendarSnapshotIngestion,
  AiWorkerSnapshotIngestion,
  // Boundary enforcement integration (WI-029)
  // {
  //   provide: 'GhlBoundaryService',
  //   useFactory: prisma =>
  //     new (require('@neuronx/ghl-boundary-enforcer').GhlBoundaryService)(
  //       prisma
  //     ),
  //   inject: ['PrismaClient'],
  // },
];

export const GHL_SNAPSHOTS_CONTROLLERS = [
  // Controllers will be added when manual trigger API is implemented
];
