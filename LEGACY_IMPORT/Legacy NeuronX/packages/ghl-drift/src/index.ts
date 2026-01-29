/**
 * GHL Drift Detection Package - WI-053: Drift Detection Engine
 *
 * Detects meaningful changes in GHL configuration using snapshot comparison.
 */

// Types and schemas
export * from './drift-types';

// Import services and detectors for usage in PROVIDERS array and export
import { GhlDriftDetectionService } from './ghl-drift-detection.service';
import { DriftStorageService } from './drift-storage.service';
import { BaseDriftDetector } from './detection/base-drift.detector';
import { LocationDriftDetector } from './detection/location-drift.detector';
import { PipelineDriftDetector } from './detection/pipeline-drift.detector';
import { WorkflowDriftDetector } from './detection/workflow-drift.detector';
import { CalendarDriftDetector } from './detection/calendar-drift.detector';
import { AiWorkerDriftDetector } from './detection/ai-worker-drift.detector';
import { DriftClassifier } from './classifiers/drift-classifier';
import { DriftSeverityClassifier } from './classifiers/drift-severity.classifier';

// Exports
export {
  GhlDriftDetectionService,
  DriftStorageService,
  BaseDriftDetector,
  LocationDriftDetector,
  PipelineDriftDetector,
  WorkflowDriftDetector,
  CalendarDriftDetector,
  AiWorkerDriftDetector,
  DriftClassifier,
  DriftSeverityClassifier,
};

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
