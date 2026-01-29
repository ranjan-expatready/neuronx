/**
 * GHL Drift Detection Service Factory - WI-053: Drift Detection Engine
 *
 * Factory functions for creating GHL drift detection services with dependencies.
 */

import { PrismaClient } from '@prisma/client';
import { GhlSnapshotService } from '@neuronx/ghl-snapshots';
import { GhlDriftDetectionService } from './ghl-drift-detection.service';
import { DriftStorageService } from './drift-storage.service';
import { LocationDriftDetector } from './detection/location-drift.detector';
import { PipelineDriftDetector } from './detection/pipeline-drift.detector';
import { WorkflowDriftDetector } from './detection/workflow-drift.detector';
import { CalendarDriftDetector } from './detection/calendar-drift.detector';
import { AiWorkerDriftDetector } from './detection/ai-worker-drift.detector';
import { DriftClassifier } from './classifiers/drift-classifier';
import { DriftDetectionConfig } from './drift-types';

/**
 * Create a complete GHL drift detection service with all dependencies
 */
export function createGhlDriftDetectionService(
  prisma: PrismaClient,
  snapshotService: GhlSnapshotService,
  config?: Partial<DriftDetectionConfig>
): GhlDriftDetectionService {
  // Create storage service
  const driftStorage = new DriftStorageService(prisma);

  // Create drift detectors
  const locationDetector = new LocationDriftDetector();
  const pipelineDetector = new PipelineDriftDetector();
  const workflowDetector = new WorkflowDriftDetector();
  const calendarDetector = new CalendarDriftDetector();
  const aiWorkerDetector = new AiWorkerDriftDetector();

  // Create classifier
  const driftClassifier = new DriftClassifier();

  // Create main service
  return new GhlDriftDetectionService(
    snapshotService,
    driftStorage,
    locationDetector,
    pipelineDetector,
    workflowDetector,
    calendarDetector,
    aiWorkerDetector,
    driftClassifier,
    config
  );
}
