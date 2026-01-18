import { BaseSnapshotIngestion } from '../base-snapshot.ingestion';
import { SnapshotType, GhlSnapshot } from '../../snapshot-types';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock PrismaClient
const mockPrisma = {
  ghlSnapshot: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

// Create a concrete implementation for testing
class TestSnapshotIngestion extends BaseSnapshotIngestion {
  constructor() {
    super(mockPrisma as any, 'TestSnapshotIngestion');
  }

  async ingest(
    tenantId: string,
    ghlAccountId: string,
    correlationId: string
  ): Promise<GhlSnapshot> {
    const data = await this.fetchFromGhl(tenantId, ghlAccountId);
    return this.createSnapshot(
      tenantId,
      ghlAccountId,
      SnapshotType.LOCATIONS,
      data,
      correlationId
    );
  }

  protected async fetchFromGhl(
    tenantId: string,
    ghlAccountId: string
  ): Promise<any[]> {
    return [{ id: 'test_1', name: 'Test Location' }];
  }
}

describe('BaseSnapshotIngestion', () => {
  let ingestion: TestSnapshotIngestion;

  beforeEach(() => {
    ingestion = new TestSnapshotIngestion();
    vi.clearAllMocks();
  });

  describe('ingest', () => {
    it('should create and return a valid snapshot', async () => {
      const result = await ingestion.ingest('tenant_1', 'ghl_1', 'corr_1');

      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.payload).toBeDefined();
      expect(result.audit).toBeDefined();

      expect(result.metadata.tenantId).toBe('tenant_1');
      expect(result.metadata.ghlAccountId).toBe('ghl_1');
      expect(result.metadata.snapshotType).toBe(SnapshotType.LOCATIONS);
      expect(result.metadata.recordCount).toBe(1);
      expect(result.metadata.status).toBe('success');

      expect(result.payload.data).toHaveLength(1);
      expect(result.payload.data[0]).toEqual({
        id: 'test_1',
        name: 'Test Location',
      });

      expect(result.audit.correlationId).toBe('corr_1');
      expect(result.audit.source).toBe('scheduled');
    });

    it('should generate unique snapshot IDs', async () => {
      const result1 = await ingestion.ingest('tenant_1', 'ghl_1', 'corr_1');
      const result2 = await ingestion.ingest('tenant_1', 'ghl_1', 'corr_2');

      expect(result1.metadata.snapshotId).not.toBe(result2.metadata.snapshotId);
      expect(result1.metadata.snapshotId).toMatch(
        /^snapshot_tenant_1_ghl_1_LOCATIONS_/
      );
    });

    it('should calculate checksums for data integrity', async () => {
      const result = await ingestion.ingest('tenant_1', 'ghl_1', 'corr_1');

      expect(result.metadata.checksum).toBeDefined();
      expect(typeof result.metadata.checksum).toBe('string');
      expect(result.metadata.checksum.length).toBeGreaterThan(0);
    });

    it('should handle ingestion errors gracefully', async () => {
      // Mock fetchFromGhl to throw an error
      const errorIngestion = new (class extends BaseSnapshotIngestion {
        constructor() {
          super(mockPrisma as any, 'ErrorSnapshotIngestion');
        }
        async ingest(
          tenantId: string,
          ghlAccountId: string,
          correlationId: string
        ): Promise<GhlSnapshot> {
          try {
            await this.fetchFromGhl(tenantId, ghlAccountId);
            return this.createSnapshot(
              tenantId,
              ghlAccountId,
              SnapshotType.LOCATIONS,
              [],
              correlationId
            );
          } catch (error) {
            return this.handleIngestionError(
              tenantId,
              ghlAccountId,
              SnapshotType.LOCATIONS,
              error,
              correlationId
            );
          }
        }
        protected async fetchFromGhl(
          tenantId: string,
          ghlAccountId: string
        ): Promise<any[]> {
          throw new Error('GHL API unavailable');
        }
      })();

      const result = await errorIngestion.ingest('tenant_1', 'ghl_1', 'corr_1');

      expect(result.metadata.status).toBe('failed');
      expect(result.metadata.recordCount).toBe(0);
      expect(result.metadata.checksum).toBe('failed');
      expect(result.audit.correlationId).toBe('corr_1');
    });
  });

  describe('snapshot metadata', () => {
    it('should create snapshots with correct metadata structure', async () => {
      const result = await ingestion.ingest('tenant_1', 'ghl_1', 'corr_1');

      expect(result.metadata).toMatchObject({
        snapshotId: expect.any(String),
        tenantId: 'tenant_1',
        ghlAccountId: 'ghl_1',
        snapshotType: SnapshotType.LOCATIONS,
        capturedAt: expect.any(Date),
        version: '1.0.0',
        status: 'success',
        recordCount: 1,
        checksum: expect.any(String),
      });
    });

    it('should include request metadata in payload', async () => {
      const result = await ingestion.ingest('tenant_1', 'ghl_1', 'corr_1');

      expect(result.payload.metadata).toMatchObject({
        totalCount: 1,
        hasMore: false,
        ghlApiVersion: 'v1',
        requestTimestamp: expect.any(Date),
      });
    });
  });

  describe('audit information', () => {
    it('should include complete audit trail', async () => {
      const result = await ingestion.ingest('tenant_1', 'ghl_1', 'corr_1');

      expect(result.audit).toMatchObject({
        createdAt: expect.any(Date),
        createdBy: 'system',
        source: 'scheduled',
        correlationId: 'corr_1',
      });
    });
  });
});
