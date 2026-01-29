import { GhlDriftDetectionService } from '../ghl-drift-detection.service';
import { DriftStorageService } from '../drift-storage.service';
import { LocationDriftDetector } from '../detection/location-drift.detector';
import { PipelineDriftDetector } from '../detection/pipeline-drift.detector';
import { WorkflowDriftDetector } from '../detection/workflow-drift.detector';
import { CalendarDriftDetector } from '../detection/calendar-drift.detector';
import { AiWorkerDriftDetector } from '../detection/ai-worker-drift.detector';
import { DriftClassifier } from '../classifiers/drift-classifier';
import {
  SnapshotType,
  DriftChangeType,
  DriftCategory,
  DriftSeverity,
} from '../drift-types';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock all dependencies
const mockStorage = {
  store: vi.fn(),
  retrieve: vi.fn(),
  query: vi.fn(),
  getLatest: vi.fn(),
  delete: vi.fn(),
  getStats: vi.fn(),
};

const mockLocationDetector = {
  detectDrift: vi.fn(),
};

const mockPipelineDetector = {
  detectDrift: vi.fn(),
};

const mockWorkflowDetector = {
  detectDrift: vi.fn(),
};

const mockCalendarDetector = {
  detectDrift: vi.fn(),
};

const mockAiWorkerDetector = {
  detectDrift: vi.fn(),
};

const mockClassifier = {
  classifyChange: vi.fn(),
};

describe('GhlDriftDetectionService', () => {
  let service: GhlDriftDetectionService;

  beforeEach(() => {
    service = new GhlDriftDetectionService(
      mockStorage as any,
      mockLocationDetector as any,
      mockPipelineDetector as any,
      mockWorkflowDetector as any,
      mockCalendarDetector as any,
      mockAiWorkerDetector as any,
      mockClassifier as any
    );
    vi.clearAllMocks();
  });

  describe('detectDrift', () => {
    const mockBeforeSnapshot = {
      metadata: {
        snapshotId: 'snapshot_before',
        capturedAt: new Date('2024-01-01T00:00:00Z'),
      },
      payload: { data: [] },
      audit: {
        createdAt: new Date(),
        createdBy: 'system',
        source: 'scheduled',
        correlationId: 'corr_1',
      },
    };

    const mockAfterSnapshot = {
      metadata: {
        snapshotId: 'snapshot_after',
        capturedAt: new Date('2024-01-02T00:00:00Z'),
      },
      payload: { data: [] },
      audit: {
        createdAt: new Date(),
        createdBy: 'system',
        source: 'scheduled',
        correlationId: 'corr_1',
      },
    };

    it('should detect drift successfully for locations', async () => {
      const mockChanges = [
        {
          changeType: DriftChangeType.MODIFIED,
          entityId: 'loc_1',
          entityType: 'location',
          diffPath: 'location[loc_1].name',
          beforeValue: 'Old Name',
          afterValue: 'New Name',
          description: 'Location name changed',
        },
      ];

      const classifiedChanges = mockChanges.map(change => ({
        ...change,
        category: DriftCategory.COSMETIC_DRIFT,
        severity: DriftSeverity.LOW,
      }));

      mockStorage.getLatest
        .mockResolvedValueOnce(mockBeforeSnapshot) // before snapshot
        .mockResolvedValueOnce(mockAfterSnapshot); // after snapshot

      mockLocationDetector.detectDrift.mockResolvedValue(mockChanges);
      mockClassifier.classifyChange.mockImplementation(change => ({
        category: DriftCategory.COSMETIC_DRIFT,
        severity: DriftSeverity.LOW,
      }));
      mockStorage.store.mockResolvedValue(undefined);

      const result = await service.detectDrift({
        tenantId: 'tenant_1',
        ghlAccountId: 'ghl_1',
        snapshotType: SnapshotType.LOCATIONS,
        correlationId: 'test_corr',
      });

      expect(result.success).toBe(true);
      expect(result.driftResult).toBeDefined();
      expect(result.driftResult!.changes).toEqual(classifiedChanges);
      expect(result.driftResult!.summary.totalChanges).toBe(1);
      expect(result.driftResult!.summary.maxSeverity).toBe(DriftSeverity.LOW);
      expect(mockStorage.store).toHaveBeenCalled();
    });

    it('should handle insufficient snapshots', async () => {
      mockStorage.getLatest.mockResolvedValue(null);

      const result = await service.detectDrift({
        tenantId: 'tenant_1',
        ghlAccountId: 'ghl_1',
        snapshotType: SnapshotType.LOCATIONS,
        correlationId: 'test_corr',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient snapshots');
    });

    it('should filter out low severity changes', async () => {
      const mockChanges = [
        {
          changeType: DriftChangeType.MODIFIED,
          entityId: 'loc_1',
          entityType: 'location',
          diffPath: 'location[loc_1].description',
          beforeValue: 'Old desc',
          afterValue: 'New desc',
          description: 'Description changed',
        },
      ];

      mockStorage.getLatest
        .mockResolvedValueOnce(mockBeforeSnapshot)
        .mockResolvedValueOnce(mockAfterSnapshot);

      mockLocationDetector.detectDrift.mockResolvedValue(mockChanges);
      mockClassifier.classifyChange.mockReturnValue({
        category: DriftCategory.COSMETIC_DRIFT,
        severity: DriftSeverity.LOW,
      });

      const result = await service.detectDrift({
        tenantId: 'tenant_1',
        ghlAccountId: 'ghl_1',
        snapshotType: SnapshotType.LOCATIONS,
        correlationId: 'test_corr',
      });

      expect(result.success).toBe(true);
      expect(result.driftResult!.changes).toHaveLength(0); // Filtered out LOW severity
      expect(result.driftResult!.summary.totalChanges).toBe(0);
    });

    it('should handle detector errors gracefully', async () => {
      mockStorage.getLatest
        .mockResolvedValueOnce(mockBeforeSnapshot)
        .mockResolvedValueOnce(mockAfterSnapshot);

      mockLocationDetector.detectDrift.mockRejectedValue(
        new Error('Detector failed')
      );

      const result = await service.detectDrift({
        tenantId: 'tenant_1',
        ghlAccountId: 'ghl_1',
        snapshotType: SnapshotType.LOCATIONS,
        correlationId: 'test_corr',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Detector failed');
    });
  });

  describe('getDriftStats', () => {
    it('should return drift statistics', async () => {
      const mockStats = {
        totalDrifts: 10,
        driftsByType: { locations: 5, pipelines: 3 },
        driftsBySeverity: { LOW: 7, MEDIUM: 2, HIGH: 1 },
        oldestDrift: new Date('2024-01-01'),
        newestDrift: new Date('2024-01-10'),
        criticalDriftCount: 1,
      };

      mockStorage.getStats.mockResolvedValue(mockStats);

      const result = await service.getDriftStats('tenant_1');

      expect(result).toEqual(mockStats);
      expect(mockStorage.getStats).toHaveBeenCalledWith('tenant_1');
    });
  });
});
