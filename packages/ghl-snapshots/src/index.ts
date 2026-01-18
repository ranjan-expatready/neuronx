/**
 * GHL Snapshots Package - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Read-only mirroring of GHL configuration for drift detection and explainability.
 */

// Types and schemas
export * from './snapshot-types';

// Core services
export { GhlSnapshotService } from './ghl-snapshot.service';
export { SnapshotStorageService } from './storage/snapshot-storage.service';

// Ingestion services
export { LocationSnapshotIngestion } from './ingestion/location-snapshot.ingestion';
export { PipelineSnapshotIngestion } from './ingestion/pipeline-snapshot.ingestion';
export { WorkflowSnapshotIngestion } from './ingestion/workflow-snapshot.ingestion';
export { CalendarSnapshotIngestion } from './ingestion/calendar-snapshot.ingestion';
export { AiWorkerSnapshotIngestion } from './ingestion/ai-worker-snapshot.ingestion';

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
  {
    provide: 'GhlBoundaryService',
    useFactory: prisma =>
      new (require('@neuronx/ghl-boundary-enforcer').GhlBoundaryService)(
        prisma
      ),
    inject: ['PrismaClient'],
  },
];

export const GHL_SNAPSHOTS_CONTROLLERS = [
  // Controllers will be added when manual trigger API is implemented
];
