/**
 * Cleanup Repository Tests - WI-023: Data Retention & Cleanup Runners
 *
 * Tests for safe batched deletion operations with retention policy validation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CleanupRepository } from '../cleanup.repository';
import { RetentionConfig, getRetentionCutoff } from '../retention.config';

// Mock dependencies
const mockPrisma = {
  outboxEvent: {
    deleteMany: jest.fn(),
  },
  webhookDelivery: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  webhookAttempt: {
    deleteMany: jest.fn(),
  },
  auditLog: {
    deleteMany: jest.fn(),
  },
  artifactRecord: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    delete: jest.fn(),
  },
  usageEvent: {
    deleteMany: jest.fn(),
  },
  usageAggregate: {
    deleteMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockStorageProvider = {
  deleteObject: jest.fn(),
};

const mockRetentionConfig: RetentionConfig = {
  outbox: {
    publishedRetentionDays: 7,
    deadRetentionDays: 30,
  },
  webhooks: {
    deliveredRetentionDays: 14,
    deadRetentionDays: 30,
  },
  audit: {
    retentionDays: 90,
  },
  artifacts: {
    expiredGraceDays: 7,
    softDeleteRetentionDays: 30,
  },
  usage: {
    rawEventRetentionDays: 30,
    aggregateRetentionDays: 365,
  },
  execution: {
    batchSize: 1000,
    lockTimeoutSeconds: 300,
    maxRuntimeMinutes: 30,
  },
};

describe('CleanupRepository', () => {
  let repository: CleanupRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupRepository,
        {
          provide: 'PrismaClient',
          useValue: mockPrisma,
        },
        {
          provide: 'STORAGE_PROVIDER',
          useValue: mockStorageProvider,
        },
        {
          provide: 'RETENTION_CONFIG',
          useValue: mockRetentionConfig,
        },
      ],
    }).compile();

    repository = module.get<CleanupRepository>(CleanupRepository);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Outbox Events Cleanup', () => {
    it('should delete published events older than retention', async () => {
      const publishedCutoff = getRetentionCutoff(
        mockRetentionConfig.outbox.publishedRetentionDays
      );
      const deadCutoff = getRetentionCutoff(
        mockRetentionConfig.outbox.deadRetentionDays
      );

      mockPrisma.outboxEvent.deleteMany
        .mockResolvedValueOnce({ count: 100 }) // Published events
        .mockResolvedValueOnce({ count: 50 }); // Dead events

      const result = await repository.cleanupOutboxEvents();

      expect(result.tableName).toBe('outbox_events');
      expect(result.deletedCount).toBe(150);

      expect(mockPrisma.outboxEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          status: 'PUBLISHED',
          publishedAt: { lt: publishedCutoff },
        },
      });

      expect(mockPrisma.outboxEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['FAILED', 'DEAD_LETTER'] },
          createdAt: { lt: deadCutoff },
          NOT: {
            status: { in: ['PENDING', 'PROCESSING'] },
          },
        },
      });
    });

    it('should not delete PENDING or PROCESSING events', async () => {
      mockPrisma.outboxEvent.deleteMany
        .mockResolvedValueOnce({ count: 100 })
        .mockResolvedValueOnce({ count: 0 }); // No dead events

      await repository.cleanupOutboxEvents();

      // Verify the second call excludes PENDING and PROCESSING
      const secondCall = mockPrisma.outboxEvent.deleteMany.mock.calls[1][0];
      expect(secondCall.where.NOT).toEqual({
        status: { in: ['PENDING', 'PROCESSING'] },
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.outboxEvent.deleteMany.mockRejectedValue(
        new Error('Database error')
      );

      const result = await repository.cleanupOutboxEvents();

      expect(result.deletedCount).toBe(0);
      expect(result.error).toBe('Database error');
    });
  });

  describe('Webhook Deliveries Cleanup', () => {
    it('should delete delivered and dead-lettered deliveries with attempts', async () => {
      const cleanableDeliveries = [
        { id: 'delivery-1', tenantId: 'tenant-a' },
        { id: 'delivery-2', tenantId: 'tenant-b' },
      ];

      mockPrisma.webhookDelivery.findMany.mockResolvedValue(
        cleanableDeliveries
      );
      mockPrisma.webhookAttempt.deleteMany.mockResolvedValue({ count: 25 });
      mockPrisma.webhookDelivery.deleteMany
        .mockResolvedValueOnce({ count: 10 }) // Delivered
        .mockResolvedValueOnce({ count: 5 }); // Dead-lettered

      const result = await repository.cleanupWebhookDeliveries();

      expect(result.tableName).toBe('webhook_deliveries');
      expect(result.deletedCount).toBe(40); // 25 attempts + 10 delivered + 5 dead

      // Verify attempts deleted first
      expect(mockPrisma.webhookAttempt.deleteMany).toHaveBeenCalledWith({
        where: {
          deliveryId: { in: ['delivery-1', 'delivery-2'] },
          createdAt: { lt: expect.any(Date) },
        },
      });

      // Verify deliveries deleted with correct status filters
      expect(mockPrisma.webhookDelivery.deleteMany).toHaveBeenCalledTimes(2);
    });

    it('should not delete PENDING or SENDING deliveries', async () => {
      mockPrisma.webhookDelivery.findMany.mockResolvedValue([]);
      mockPrisma.webhookAttempt.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.webhookDelivery.deleteMany.mockResolvedValue({ count: 0 });

      await repository.cleanupWebhookDeliveries();

      // Verify only DELIVERED and DEAD_LETTER statuses are cleaned
      const deliveredCall =
        mockPrisma.webhookDelivery.deleteMany.mock.calls.find(
          call => call[0].where.status === 'DELIVERED'
        );
      const deadCall = mockPrisma.webhookDelivery.deleteMany.mock.calls.find(
        call => call[0].where.status === 'DEAD_LETTER'
      );

      expect(deliveredCall).toBeDefined();
      expect(deadCall).toBeDefined();
    });
  });

  describe('Audit Logs Cleanup', () => {
    it('should delete audit logs older than retention', async () => {
      const cutoff = getRetentionCutoff(
        mockRetentionConfig.audit.retentionDays
      );

      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 500 });

      const result = await repository.cleanupAuditLogs();

      expect(result.tableName).toBe('audit_logs');
      expect(result.deletedCount).toBe(500);

      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: { lt: cutoff },
        },
      });
    });
  });

  describe('Artifacts Cleanup', () => {
    it('should cleanup expired artifacts and soft-deleted artifacts', async () => {
      // Mock expired artifacts
      const expiredArtifacts = [
        {
          id: 'artifact-1',
          tenantId: 'tenant-a',
          objectKey: 'tenant-a/voice/file.webm',
        },
        {
          id: 'artifact-2',
          tenantId: 'tenant-b',
          objectKey: 'tenant-b/document/file.pdf',
        },
      ];

      mockPrisma.artifactRecord.findMany.mockResolvedValue(expiredArtifacts);
      mockStorageProvider.deleteObject.mockResolvedValue(undefined);
      mockPrisma.artifactRecord.deleteMany.mockResolvedValue({ count: 5 }); // Soft-deleted

      const result = await repository.cleanupArtifacts();

      expect(result.tableName).toBe('artifacts');
      expect(result.deletedCount).toBe(7); // 2 expired + 5 soft-deleted

      // Verify storage deletion called for expired artifacts
      expect(mockStorageProvider.deleteObject).toHaveBeenCalledTimes(2);
      expect(mockStorageProvider.deleteObject).toHaveBeenCalledWith(
        'tenant-a',
        'tenant-a/voice/file.webm'
      );
      expect(mockStorageProvider.deleteObject).toHaveBeenCalledWith(
        'tenant-b',
        'tenant-b/document/file.pdf'
      );

      // Verify records deleted after storage deletion
      expect(mockPrisma.artifactRecord.delete).toHaveBeenCalledTimes(2);

      // Verify soft-deleted cleanup
      expect(mockPrisma.artifactRecord.deleteMany).toHaveBeenCalledWith({
        where: {
          deletedAt: { lt: expect.any(Date) },
          NOT: { deletedAt: null },
        },
      });
    });

    it('should not delete records if storage deletion fails', async () => {
      const expiredArtifacts = [
        {
          id: 'artifact-1',
          tenantId: 'tenant-a',
          objectKey: 'tenant-a/voice/file.webm',
        },
      ];

      mockPrisma.artifactRecord.findMany.mockResolvedValue(expiredArtifacts);
      mockStorageProvider.deleteObject.mockRejectedValue(
        new Error('Storage error')
      );

      await repository.cleanupArtifacts();

      // Verify record not deleted when storage deletion fails
      expect(mockPrisma.artifactRecord.delete).not.toHaveBeenCalled();
    });

    it('should handle artifacts with null deletedAt (not soft-deleted)', async () => {
      mockPrisma.artifactRecord.findMany.mockResolvedValue([]);
      mockPrisma.artifactRecord.deleteMany.mockResolvedValue({ count: 0 });

      await repository.cleanupArtifacts();

      // Verify soft-deleted query excludes non-deleted records
      const softDeleteCall =
        mockPrisma.artifactRecord.deleteMany.mock.calls[0][0];
      expect(softDeleteCall.where.NOT).toEqual({ deletedAt: null });
    });
  });

  describe('Usage Data Cleanup', () => {
    it('should delete raw events and aggregates respecting retention', async () => {
      const rawCutoff = getRetentionCutoff(
        mockRetentionConfig.usage.rawEventRetentionDays
      );
      const aggregateCutoff = getRetentionCutoff(
        mockRetentionConfig.usage.aggregateRetentionDays
      );

      mockPrisma.usageEvent.deleteMany.mockResolvedValue({ count: 1000 });
      mockPrisma.usageAggregate.deleteMany.mockResolvedValue({ count: 50 });

      const result = await repository.cleanupUsageData();

      expect(result.tableName).toBe('usage_data');
      expect(result.deletedCount).toBe(1050);

      expect(mockPrisma.usageEvent.deleteMany).toHaveBeenCalledWith({
        where: { occurredAt: { lt: rawCutoff } },
      });

      expect(mockPrisma.usageAggregate.deleteMany).toHaveBeenCalledWith({
        where: { periodEnd: { lt: aggregateCutoff } },
      });
    });

    it('should maintain aggregate retention longer than raw events', () => {
      expect(mockRetentionConfig.usage.aggregateRetentionDays).toBeGreaterThan(
        mockRetentionConfig.usage.rawEventRetentionDays
      );
    });
  });

  describe('Advisory Lock Safety', () => {
    it('should execute operations with advisory lock', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ pg_try_advisory_lock: true }]) // Lock acquired
        .mockResolvedValueOnce(undefined); // Unlock

      mockPrisma.outboxEvent.deleteMany.mockResolvedValue({ count: 100 });

      const result = await repository.executeWithLock(async () => {
        return await repository.cleanupOutboxEvents();
      });

      expect(result.lockAcquired).toBe(true);
      expect(result.result?.deletedCount).toBe(100);

      // Verify lock acquisition
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('pg_try_advisory_lock'),
          BigInt(0x4e6575726f6e58), // 'NeuronX' in hex
        ])
      );

      // Verify lock release
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('pg_advisory_unlock')])
      );
    });

    it('should skip operations when lock not acquired', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ pg_try_advisory_lock: false }]);

      const result = await repository.executeWithLock(async () => {
        return { test: 'data' };
      });

      expect(result.lockAcquired).toBe(false);
      expect(result.result).toBe(null);
    });

    it('should always release lock in finally block', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ pg_try_advisory_lock: true }])
        .mockRejectedValueOnce(new Error('Unlock failed')); // Unlock fails

      // Operation succeeds but unlock fails
      mockPrisma.outboxEvent.deleteMany.mockResolvedValue({ count: 100 });

      await expect(
        repository.executeWithLock(async () => {
          return await repository.cleanupOutboxEvents();
        })
      ).rejects.toThrow('Unlock failed');

      // Verify unlock was attempted
      expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('pg_advisory_unlock')])
      );
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should continue processing other tables when one fails', async () => {
      // This is tested at the runner level, but repository should handle individual failures
      mockPrisma.outboxEvent.deleteMany.mockRejectedValue(
        new Error('Outbox failed')
      );

      const result = await repository.cleanupOutboxEvents();

      expect(result.error).toBe('Outbox failed');
      expect(result.deletedCount).toBe(0);
    });

    it('should handle database connection issues', async () => {
      mockPrisma.outboxEvent.deleteMany.mockRejectedValue(
        new Error('Connection lost')
      );

      const result = await repository.cleanupOutboxEvents();

      expect(result.error).toBe('Connection lost');
      expect(result.deletedCount).toBe(0);
    });
  });

  describe('Batch Size and Performance', () => {
    it('should be configured with reasonable batch sizes', () => {
      expect(mockRetentionConfig.execution.batchSize).toBe(1000);
      expect(mockRetentionConfig.execution.batchSize).toBeGreaterThanOrEqual(
        100
      );
      expect(mockRetentionConfig.execution.batchSize).toBeLessThanOrEqual(
        10000
      );
    });

    it('should have appropriate lock timeouts', () => {
      expect(mockRetentionConfig.execution.lockTimeoutSeconds).toBe(300); // 5 minutes
      expect(
        mockRetentionConfig.execution.lockTimeoutSeconds
      ).toBeGreaterThanOrEqual(60);
      expect(
        mockRetentionConfig.execution.lockTimeoutSeconds
      ).toBeLessThanOrEqual(3600);
    });
  });
});
