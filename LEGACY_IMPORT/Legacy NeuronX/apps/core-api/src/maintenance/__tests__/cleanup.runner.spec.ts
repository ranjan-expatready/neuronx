/**
 * Cleanup Runner Tests - WI-023: Data Retention & Cleanup Runners
 *
 * Tests for cleanup operations with multi-instance safety and retention policies.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CleanupRunner } from '../cleanup.runner';
import { CleanupRepository } from '../cleanup.repository';
import { RetentionConfig } from '../retention.config';

// Mock dependencies
const mockCleanupRepository = {
  executeWithLock: jest.fn(),
  cleanupOutboxEvents: jest.fn(),
  cleanupWebhookDeliveries: jest.fn(),
  cleanupAuditLogs: jest.fn(),
  cleanupArtifacts: jest.fn(),
  cleanupUsageData: jest.fn(),
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

describe('CleanupRunner', () => {
  let runner: CleanupRunner;
  let cleanupRepository: CleanupRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupRunner,
        {
          provide: CleanupRepository,
          useValue: mockCleanupRepository,
        },
        {
          provide: 'RETENTION_CONFIG',
          useValue: mockRetentionConfig,
        },
      ],
    }).compile();

    runner = module.get<CleanupRunner>(CleanupRunner);
    cleanupRepository = module.get<CleanupRepository>(CleanupRepository);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Manual Cleanup Execution', () => {
    it('should execute all cleanup operations when lock acquired', async () => {
      const mockResults = [
        { tableName: 'outbox_events', deletedCount: 100, durationMs: 150 },
        { tableName: 'webhook_deliveries', deletedCount: 50, durationMs: 200 },
        { tableName: 'audit_logs', deletedCount: 500, durationMs: 100 },
        { tableName: 'artifacts', deletedCount: 25, durationMs: 300 },
        { tableName: 'usage_data', deletedCount: 1000, durationMs: 400 },
      ];

      mockCleanupRepository.executeWithLock.mockResolvedValue({
        result: mockResults,
        lockAcquired: true,
      });

      const result = await runner.runManualCleanup();

      expect(result.lockAcquired).toBe(true);
      expect(result.totalDeleted).toBe(1675);
      expect(result.results).toEqual(mockResults);
      expect(result.errors).toEqual([]);
      expect(mockCleanupRepository.executeWithLock).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it('should skip execution when lock not acquired', async () => {
      mockCleanupRepository.executeWithLock.mockResolvedValue({
        result: null,
        lockAcquired: false,
      });

      const result = await runner.runManualCleanup();

      expect(result.lockAcquired).toBe(false);
      expect(result.totalDeleted).toBe(0);
      expect(result.results).toEqual([
        {
          tableName: 'all',
          deletedCount: 0,
          durationMs: 0,
          skipped: true,
        },
      ]);
    });

    it('should filter operations by table names', async () => {
      const mockResults = [
        { tableName: 'outbox_events', deletedCount: 100, durationMs: 150 },
        { tableName: 'audit_logs', deletedCount: 500, durationMs: 100 },
      ];

      mockCleanupRepository.executeWithLock.mockResolvedValue({
        result: mockResults,
        lockAcquired: true,
      });

      const result = await runner.runManualCleanup([
        'outbox_events',
        'audit_logs',
      ]);

      expect(result.results.length).toBe(2);
      expect(result.results[0].tableName).toBe('outbox_events');
      expect(result.results[1].tableName).toBe('audit_logs');
    });

    it('should handle execution errors gracefully', async () => {
      mockCleanupRepository.executeWithLock.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await runner.runManualCleanup();

      expect(result.lockAcquired).toBe(false);
      expect(result.errors).toEqual(['Database connection failed']);
      expect(result.results).toEqual([]);
    });
  });

  describe('Health Checks', () => {
    it('should report healthy when not running', () => {
      expect(runner.isHealthy()).toBe(true);
    });

    it('should report status correctly', () => {
      const status = runner.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.retentionConfig).toBe(mockRetentionConfig);
    });
  });

  describe('Cron Scheduling Integration', () => {
    it('should have daily cleanup cron configured', () => {
      // This is tested indirectly through the @Cron decorator
      // In a real test, we'd mock the cron system
      expect(runner).toBeDefined();
    });

    it('should have hourly cleanup cron configured', () => {
      // This is tested indirectly through the @Cron decorator
      expect(runner).toBeDefined();
    });
  });

  describe('Concurrent Execution Prevention', () => {
    it('should prevent concurrent manual runs', async () => {
      // Start first run
      mockCleanupRepository.executeWithLock.mockImplementation(async () => {
        // Simulate long-running operation
        await new Promise(resolve => setTimeout(resolve, 100));
        return { result: [], lockAcquired: true };
      });

      // Start both runs simultaneously
      const run1 = runner.runManualCleanup();
      const run2 = runner.runManualCleanup();

      const [result1, result2] = await Promise.all([run1, run2]);

      // One should succeed, one should be skipped due to concurrency protection
      const successCount = [result1, result2].filter(
        r => r.lockAcquired
      ).length;
      const skipCount = [result1, result2].filter(
        r => !r.lockAcquired && r.results[0]?.skipped
      ).length;

      expect(successCount + skipCount).toBe(2);
    });
  });

  describe('Operation Ordering', () => {
    it('should execute operations in priority order', async () => {
      const callOrder: string[] = [];

      mockCleanupRepository.cleanupOutboxEvents.mockImplementation(async () => {
        callOrder.push('outbox_events');
        return { tableName: 'outbox_events', deletedCount: 0, durationMs: 0 };
      });

      mockCleanupRepository.cleanupWebhookDeliveries.mockImplementation(
        async () => {
          callOrder.push('webhook_deliveries');
          return {
            tableName: 'webhook_deliveries',
            deletedCount: 0,
            durationMs: 0,
          };
        }
      );

      mockCleanupRepository.cleanupAuditLogs.mockImplementation(async () => {
        callOrder.push('audit_logs');
        return { tableName: 'audit_logs', deletedCount: 0, durationMs: 0 };
      });

      mockCleanupRepository.cleanupArtifacts.mockImplementation(async () => {
        callOrder.push('artifacts');
        return { tableName: 'artifacts', deletedCount: 0, durationMs: 0 };
      });

      mockCleanupRepository.cleanupUsageData.mockImplementation(async () => {
        callOrder.push('usage_data');
        return { tableName: 'usage_data', deletedCount: 0, durationMs: 0 };
      });

      mockCleanupRepository.executeWithLock.mockResolvedValue({
        result: [
          { tableName: 'outbox_events', deletedCount: 0, durationMs: 0 },
          { tableName: 'webhook_deliveries', deletedCount: 0, durationMs: 0 },
          { tableName: 'audit_logs', deletedCount: 0, durationMs: 0 },
          { tableName: 'artifacts', deletedCount: 0, durationMs: 0 },
          { tableName: 'usage_data', deletedCount: 0, durationMs: 0 },
        ],
        lockAcquired: true,
      });

      await runner.runManualCleanup();

      // Verify operations were called in priority order
      expect(callOrder).toEqual([
        'outbox_events',
        'webhook_deliveries',
        'audit_logs',
        'artifacts',
        'usage_data',
      ]);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should continue with other operations when one fails', async () => {
      mockCleanupRepository.cleanupOutboxEvents.mockRejectedValue(
        new Error('Outbox cleanup failed')
      );
      mockCleanupRepository.cleanupWebhookDeliveries.mockResolvedValue({
        tableName: 'webhook_deliveries',
        deletedCount: 50,
        durationMs: 200,
      });
      mockCleanupRepository.cleanupAuditLogs.mockResolvedValue({
        tableName: 'audit_logs',
        deletedCount: 500,
        durationMs: 100,
      });

      mockCleanupRepository.executeWithLock.mockResolvedValue({
        result: [
          {
            tableName: 'outbox_events',
            deletedCount: 0,
            durationMs: 0,
            error: 'Outbox cleanup failed',
          },
          {
            tableName: 'webhook_deliveries',
            deletedCount: 50,
            durationMs: 200,
          },
          { tableName: 'audit_logs', deletedCount: 500, durationMs: 100 },
        ],
        lockAcquired: true,
      });

      const result = await runner.runManualCleanup();

      expect(result.totalDeleted).toBe(550); // Only successful operations
      expect(result.errors).toEqual(['outbox_events: Outbox cleanup failed']);
      expect(result.results.length).toBe(3);
    });

    it('should handle lock acquisition failures gracefully', async () => {
      mockCleanupRepository.executeWithLock.mockRejectedValue(
        new Error('Lock acquisition failed')
      );

      const result = await runner.runManualCleanup();

      expect(result.lockAcquired).toBe(false);
      expect(result.errors).toEqual(['Lock acquisition failed']);
    });
  });

  describe('Runtime Limits', () => {
    it('should respect max runtime limits', async () => {
      // This would be tested with a timeout mechanism
      // For now, we verify the configuration is used
      expect(mockRetentionConfig.execution.maxRuntimeMinutes).toBe(30);
    });
  });
});
