/**
 * GHL Drift Detection Package - WI-053: Drift Detection Engine
 *
 * Detects meaningful changes in GHL configuration using snapshot comparison.
 */

// Types and schemas
export * from './drift-types';

// Core services
export { GhlDriftDetectionService } from './ghl-drift-detection.service';
export { DriftStorageService } from './drift-storage.service';

// Detection engines
export { BaseDriftDetector } from './detection/base-drift.detector';
export { LocationDriftDetector } from './detection/location-drift.detector';
export { PipelineDriftDetector } from './detection/pipeline-drift.detector';
export { WorkflowDriftDetector } from './detection/workflow-drift.detector';
export { CalendarDriftDetector } from './detection/calendar-drift.detector';
export { AiWorkerDriftDetector } from './detection/ai-worker-drift.detector';

// Classifiers
export { DriftClassifier } from './classifiers/drift-classifier';
export { DriftSeverityClassifier } from './classifiers/drift-severity.classifier';

// Triggers
export { ScheduledDriftTrigger } from './triggers/scheduled-drift.trigger';
export { ManualDriftTrigger } from './triggers/manual-drift.trigger';

// Factory functions
export { createGhlDriftDetectionService } from './ghl-drift-detection-service.factory';

// Module exports for NestJS
export const GHL_DRIFT_PROVIDERS = [
  GhlDriftDetectionService,
  DriftStorageService,
  LocationDriftDetector,
  PipelineDriftDetector,
  WorkflowDriftDetector,
  CalendarDriftDetector,
  AiWorkerDriftDetector,
  DriftClassifier,
  DriftSeverityClassifier,
];

export const GHL_DRIFT_CONTROLLERS = [
  // Controllers will be added when manual trigger API is implemented
];
