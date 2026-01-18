import { GhlSnapshotService } from '../ghl-snapshot.service';
import { SnapshotStorageService } from '../storage/snapshot-storage.service';
import { LocationSnapshotIngestion } from '../ingestion/location-snapshot.ingestion';
import { PipelineSnapshotIngestion } from '../ingestion/pipeline-snapshot.ingestion';
import { WorkflowSnapshotIngestion } from '../ingestion/workflow-snapshot.ingestion';
import { CalendarSnapshotIngestion } from '../ingestion/calendar-snapshot.ingestion';
import { AiWorkerSnapshotIngestion } from '../ingestion/ai-worker-snapshot.ingestion';
import { SnapshotType } from '../snapshot-types';
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

const mockLocationIngestion = {
  ingest: vi.fn(),
};

const mockPipelineIngestion = {
  ingest: vi.fn(),
};

const mockWorkflowIngestion = {
  ingest: vi.fn(),
};

const mockCalendarIngestion = {
  ingest: vi.fn(),
};

const mockAiWorkerIngestion = {
  ingest: vi.fn(),
};

describe('GhlSnapshotService', () => {
  let service: GhlSnapshotService;

  beforeEach(() => {
    service = new GhlSnapshotService(
      mockStorage as any,
      mockLocationIngestion as any,
      mockPipelineIngestion as any,
      mockWorkflowIngestion as any,
      mockCalendarIngestion as any,
      mockAiWorkerIngestion as any
    );
    vi.clearAllMocks();
  });

  describe('runFullSnapshot', () => {
    it('should run all snapshot types successfully', async () => {
      const mockSnapshots = Object.values(SnapshotType).map(type => ({
        metadata: {
          snapshotId: `snapshot_${type}`,
          tenantId: 'tenant_1',
          ghlAccountId: 'ghl_1',
          snapshotType: type,
          capturedAt: new Date(),
          version: '1.0.0',
          status: 'success',
          recordCount: 5,
          checksum: 'abc123',
        },
        payload: { data: [], metadata: {} },
        audit: {
          createdAt: new Date(),
          createdBy: 'system',
          source: 'scheduled',
          correlationId: 'corr_1',
        },
      }));

      // Mock successful ingestion for all types
      mockLocationIngestion.ingest.mockResolvedValue(mockSnapshots[0]);
      mockPipelineIngestion.ingest.mockResolvedValue(mockSnapshots[1]);
      mockWorkflowIngestion.ingest.mockResolvedValue(mockSnapshots[2]);
      mockCalendarIngestion.ingest.mockResolvedValue(mockSnapshots[3]);
      mockAiWorkerIngestion.ingest.mockResolvedValue(mockSnapshots[4]);

      mockStorage.store.mockResolvedValue(undefined);

      const result = await service.runFullSnapshot(
        'tenant_1',
        'ghl_1',
        'corr_1'
      );

      expect(result.overallSuccess).toBe(true);
      expect(result.results).toHaveLength(5);
      expect(result.results.every(r => r.success)).toBe(true);
      expect(mockStorage.store).toHaveBeenCalledTimes(5);
    });

    it('should handle partial failures gracefully', async () => {
      const mockSuccessSnapshot = {
        metadata: {
          snapshotId: 'snapshot_locations',
          tenantId: 'tenant_1',
          ghlAccountId: 'ghl_1',
          snapshotType: SnapshotType.LOCATIONS,
          capturedAt: new Date(),
          version: '1.0.0',
          status: 'success',
          recordCount: 3,
          checksum: 'success',
        },
        payload: { data: [], metadata: {} },
        audit: {
          createdAt: new Date(),
          createdBy: 'system',
          source: 'scheduled',
          correlationId: 'corr_1',
        },
      };

      // Mock successful location ingestion
      mockLocationIngestion.ingest.mockResolvedValue(mockSuccessSnapshot);
      mockStorage.store.mockResolvedValue(undefined);

      // Mock failed pipeline ingestion
      mockPipelineIngestion.ingest.mockRejectedValue(
        new Error('GHL API timeout')
      );

      // Mock other ingestions to not be called due to early failure handling
      mockWorkflowIngestion.ingest.mockResolvedValue(mockSuccessSnapshot);
      mockCalendarIngestion.ingest.mockResolvedValue(mockSuccessSnapshot);
      mockAiWorkerIngestion.ingest.mockResolvedValue(mockSuccessSnapshot);

      const result = await service.runFullSnapshot(
        'tenant_1',
        'ghl_1',
        'corr_1'
      );

      expect(result.overallSuccess).toBe(false);
      expect(result.results).toHaveLength(5);
      expect(result.results.filter(r => r.success)).toHaveLength(4); // 4 success, 1 failure
      expect(result.results.filter(r => !r.success)).toHaveLength(1);
      expect(mockStorage.store).toHaveBeenCalledTimes(4); // Only successful snapshots stored
    });

    it('should store successful snapshots even when others fail', async () => {
      const mockSuccessSnapshot = {
        metadata: {
          snapshotId: 'snapshot_locations',
          tenantId: 'tenant_1',
          ghlAccountId: 'ghl_1',
          snapshotType: SnapshotType.LOCATIONS,
          capturedAt: new Date(),
          version: '1.0.0',
          status: 'success',
          recordCount: 3,
          checksum: 'success',
        },
        payload: { data: [], metadata: {} },
        audit: {
          createdAt: new Date(),
          createdBy: 'system',
          source: 'scheduled',
          correlationId: 'corr_1',
        },
      };

      mockLocationIngestion.ingest.mockResolvedValue(mockSuccessSnapshot);
      mockPipelineIngestion.ingest.mockRejectedValue(new Error('API Error'));
      mockWorkflowIngestion.ingest.mockResolvedValue(mockSuccessSnapshot);
      mockCalendarIngestion.ingest.mockResolvedValue(mockSuccessSnapshot);
      mockAiWorkerIngestion.ingest.mockResolvedValue(mockSuccessSnapshot);

      mockStorage.store.mockResolvedValue(undefined);

      const result = await service.runFullSnapshot(
        'tenant_1',
        'ghl_1',
        'corr_1'
      );

      expect(result.overallSuccess).toBe(false);
      expect(result.results.filter(r => r.success).length).toBe(4);
      expect(result.results.filter(r => !r.success).length).toBe(1);
      expect(mockStorage.store).toHaveBeenCalledTimes(4);
    });
  });

  describe('runSingleSnapshot', () => {
    it('should run a single snapshot type', async () => {
      const mockSnapshot = {
        metadata: {
          snapshotId: 'snapshot_locations',
          tenantId: 'tenant_1',
          ghlAccountId: 'ghl_1',
          snapshotType: SnapshotType.LOCATIONS,
          capturedAt: new Date(),
          version: '1.0.0',
          status: 'success',
          recordCount: 5,
          checksum: 'abc123',
        },
        payload: { data: [], metadata: {} },
        audit: {
          createdAt: new Date(),
          createdBy: 'system',
          source: 'scheduled',
          correlationId: 'corr_1',
        },
      };

      mockLocationIngestion.ingest.mockResolvedValue(mockSnapshot);
      mockStorage.store.mockResolvedValue(undefined);

      const result = await service.runSingleSnapshot(
        SnapshotType.LOCATIONS,
        'tenant_1',
        'ghl_1',
        'corr_1'
      );

      expect(result.success).toBe(true);
      expect(result.snapshotType).toBe(SnapshotType.LOCATIONS);
      expect(result.recordCount).toBe(5);
      expect(mockLocationIngestion.ingest).toHaveBeenCalledWith(
        'tenant_1',
        'ghl_1',
        'corr_1'
      );
      expect(mockStorage.store).toHaveBeenCalledWith(mockSnapshot);
    });

    it('should handle single snapshot failures', async () => {
      mockLocationIngestion.ingest.mockRejectedValue(
        new Error('GHL API error')
      );

      const result = await service.runSingleSnapshot(
        SnapshotType.LOCATIONS,
        'tenant_1',
        'ghl_1',
        'corr_1'
      );

      expect(result.success).toBe(false);
      expect(result.snapshotType).toBe(SnapshotType.LOCATIONS);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('GHL API error');
      expect(mockStorage.store).not.toHaveBeenCalled();
    });
  });

  describe('snapshot management', () => {
    it('should query snapshots', async () => {
      const mockSnapshots = [{ id: 'snapshot_1' }];
      mockStorage.query.mockResolvedValue(mockSnapshots);

      const result = await service.querySnapshots({
        tenantId: 'tenant_1',
        snapshotType: SnapshotType.LOCATIONS,
      });

      expect(result).toEqual(mockSnapshots);
      expect(mockStorage.query).toHaveBeenCalledWith({
        tenantId: 'tenant_1',
        snapshotType: SnapshotType.LOCATIONS,
      });
    });

    it('should get latest snapshot', async () => {
      const mockSnapshot = { id: 'latest_snapshot' };
      mockStorage.getLatest.mockResolvedValue(mockSnapshot);

      const result = await service.getLatestSnapshot(
        'tenant_1',
        SnapshotType.PIPELINES
      );

      expect(result).toEqual(mockSnapshot);
      expect(mockStorage.getLatest).toHaveBeenCalledWith(
        'tenant_1',
        SnapshotType.PIPELINES
      );
    });

    it('should get snapshot stats', async () => {
      const mockStats = { totalSnapshots: 10, snapshotsByType: {} };
      mockStorage.getStats.mockResolvedValue(mockStats);

      const result = await service.getSnapshotStats('tenant_1');

      expect(result).toEqual(mockStats);
      expect(mockStorage.getStats).toHaveBeenCalledWith('tenant_1');
    });
  });
});
