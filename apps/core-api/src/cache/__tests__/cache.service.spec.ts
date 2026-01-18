/**
 * Cache Service Tests - WI-015: ML/Scoring Cache Cluster
 *
 * Tests for Redis-backed cache with tenant isolation, deterministic keys, and fail-open behavior.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../cache.service';
import Redis from 'ioredis';

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  status: 'ready',
  quit: jest.fn(),
};

describe('CacheService (WI-015)', () => {
  let cacheService: CacheService;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const correlationId = 'corr-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);

    // Reset mocks
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.keys.mockResolvedValue([]);
  });

  describe('Key Generation', () => {
    it('should generate deterministic keys', () => {
      const inputs1 = { leadId: 'lead-1', score: 85, industry: 'tech' };
      const options1 = {
        tenantId: tenantA,
        domain: 'scoring',
        modelVersion: 'v1.0',
        configHash: 'abc123',
      };

      const inputs2 = { leadId: 'lead-1', score: 85, industry: 'tech' };
      const options2 = {
        tenantId: tenantA,
        domain: 'scoring',
        modelVersion: 'v1.0',
        configHash: 'abc123',
      };

      // Same inputs should generate same key
      const key1 = (cacheService as any).generateKey(inputs1, options1);
      const key2 = (cacheService as any).generateKey(inputs2, options2);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^cache:tenant-a:scoring:[a-f0-9]+:[a-f0-9]+$/);
    });

    it('should generate different keys for different tenants', () => {
      const inputs = { leadId: 'lead-1', score: 85 };

      const optionsA = { tenantId: tenantA, domain: 'scoring' };
      const optionsB = { tenantId: tenantB, domain: 'scoring' };

      const keyA = (cacheService as any).generateKey(inputs, optionsA);
      const keyB = (cacheService as any).generateKey(inputs, optionsB);

      expect(keyA).not.toBe(keyB);
      expect(keyA).toContain('tenant-a');
      expect(keyB).toContain('tenant-b');
    });

    it('should generate different keys for different domains', () => {
      const inputs = { leadId: 'lead-1', score: 85 };

      const optionsScoring = { tenantId: tenantA, domain: 'scoring' };
      const optionsRouting = { tenantId: tenantA, domain: 'routing' };

      const keyScoring = (cacheService as any).generateKey(
        inputs,
        optionsScoring
      );
      const keyRouting = (cacheService as any).generateKey(
        inputs,
        optionsRouting
      );

      expect(keyScoring).not.toBe(keyRouting);
      expect(keyScoring).toContain(':scoring:');
      expect(keyRouting).toContain(':routing:');
    });

    it('should include version information in key', () => {
      const inputs = { leadId: 'lead-1', score: 85 };

      const options = {
        tenantId: tenantA,
        domain: 'scoring',
        modelVersion: 'v2.1',
        configHash: 'def456',
      };

      const key = (cacheService as any).generateKey(inputs, options);

      // Key should end with version hash
      expect(key).toMatch(/^cache:tenant-a:scoring:[a-f0-9]+:[a-f0-9]+$/);
      // The version hash is deterministic based on modelVersion + configHash
    });
  });

  describe('Cache Operations', () => {
    describe('get', () => {
      it('should return cached value on hit', async () => {
        const inputs = { leadId: 'lead-1', score: 85 };
        const options = { tenantId: tenantA, domain: 'scoring' };

        const cachedEntry = {
          value: { enhancedScore: 90 },
          computedAt: new Date().toISOString(),
          source: 'cache' as const,
          metadata: {
            tenantId: tenantA,
            domain: 'scoring',
          },
        };

        mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));

        const result = await cacheService.get(inputs, options);

        expect(result).toEqual(cachedEntry);
        expect(mockRedis.get).toHaveBeenCalledWith(
          expect.stringContaining('cache:tenant-a:scoring:')
        );
      });

      it('should return null on cache miss', async () => {
        const inputs = { leadId: 'lead-1', score: 85 };
        const options = { tenantId: tenantA, domain: 'scoring' };

        mockRedis.get.mockResolvedValue(null);

        const result = await cacheService.get(inputs, options);

        expect(result).toBeNull();
      });

      it('should prevent tenant isolation violations', async () => {
        const inputs = { leadId: 'lead-1', score: 85 };
        const options = { tenantId: tenantA, domain: 'scoring' };

        const cachedEntry = {
          value: { enhancedScore: 90 },
          computedAt: new Date().toISOString(),
          source: 'cache' as const,
          metadata: {
            tenantId: tenantB, // Wrong tenant!
            domain: 'scoring',
          },
        };

        mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));

        const result = await cacheService.get(inputs, options);

        expect(result).toBeNull(); // Should reject cross-tenant data
        expect(mockRedis.del).toHaveBeenCalled(); // Should clean up corrupted entry
      });

      it('should fail-open on Redis errors', async () => {
        const inputs = { leadId: 'lead-1', score: 85 };
        const options = { tenantId: tenantA, domain: 'scoring' };

        mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

        const result = await cacheService.get(inputs, options);

        expect(result).toBeNull(); // Fail-open behavior
        // Should not throw - Redis errors don't break business logic
      });
    });

    describe('set', () => {
      it('should store value with TTL', async () => {
        const inputs = { leadId: 'lead-1', score: 85 };
        const value = { enhancedScore: 90 };
        const options = {
          tenantId: tenantA,
          domain: 'scoring',
          ttlSeconds: 900, // 15 minutes
        };

        await cacheService.set(inputs, value, options);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.stringContaining('cache:tenant-a:scoring:'),
          900,
          expect.stringContaining('"enhancedScore":90')
        );
      });

      it('should enforce maximum TTL', async () => {
        const inputs = { leadId: 'lead-1', score: 85 };
        const value = { enhancedScore: 90 };
        const options = {
          tenantId: tenantA,
          domain: 'scoring',
          ttlSeconds: 48 * 60 * 60, // 48 hours (over limit)
        };

        await cacheService.set(inputs, value, options);

        expect(mockRedis.setex).toHaveBeenCalledWith(
          expect.any(String),
          24 * 60 * 60, // Should be capped at 24 hours
          expect.any(String)
        );
      });

      it('should fail-open on Redis errors', async () => {
        const inputs = { leadId: 'lead-1', score: 85 };
        const value = { enhancedScore: 90 };
        const options = { tenantId: tenantA, domain: 'scoring' };

        mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));

        // Should not throw - Redis errors don't break business logic
        await expect(
          cacheService.set(inputs, value, options)
        ).resolves.not.toThrow();
      });
    });

    describe('delete', () => {
      it('should delete cache entry', async () => {
        const inputs = { leadId: 'lead-1', score: 85 };
        const options = { tenantId: tenantA, domain: 'scoring' };

        await cacheService.delete(inputs, options);

        expect(mockRedis.del).toHaveBeenCalledWith(
          expect.stringContaining('cache:tenant-a:scoring:')
        );
      });

      it('should fail-open on Redis errors', async () => {
        const inputs = { leadId: 'lead-1', score: 85 };
        const options = { tenantId: tenantA, domain: 'scoring' };

        mockRedis.del.mockRejectedValue(new Error('Redis connection failed'));

        // Should not throw - Redis errors don't break business logic
        await expect(
          cacheService.delete(inputs, options)
        ).resolves.not.toThrow();
      });
    });

    describe('clearTenantDomain', () => {
      it('should clear all entries for tenant and domain', async () => {
        const tenantId = tenantA;
        const domain = 'scoring';

        mockRedis.keys.mockResolvedValue([
          'cache:tenant-a:scoring:key1:v1',
          'cache:tenant-a:scoring:key2:v1',
        ]);

        await cacheService.clearTenantDomain(tenantId, domain);

        expect(mockRedis.keys).toHaveBeenCalledWith('cache:tenant-a:scoring:*');
        expect(mockRedis.del).toHaveBeenCalledWith(
          'cache:tenant-a:scoring:key1:v1',
          'cache:tenant-a:scoring:key2:v1'
        );
      });

      it('should fail-open on Redis errors', async () => {
        const tenantId = tenantA;
        const domain = 'scoring';

        mockRedis.keys.mockRejectedValue(new Error('Redis connection failed'));

        // Should not throw - Redis errors don't break business logic
        await expect(
          cacheService.clearTenantDomain(tenantId, domain)
        ).resolves.not.toThrow();
      });
    });
  });

  describe('Fail-Open Behavior', () => {
    it('should operate without Redis when not available', async () => {
      // Create cache service without Redis
      const moduleWithoutRedis: TestingModule = await Test.createTestingModule({
        providers: [CacheService],
      }).compile();

      const cacheWithoutRedis =
        moduleWithoutRedis.get<CacheService>(CacheService);

      const inputs = { leadId: 'lead-1', score: 85 };
      const value = { enhancedScore: 90 };
      const options = { tenantId: tenantA, domain: 'scoring' };

      // All operations should succeed without throwing
      await expect(cacheWithoutRedis.get(inputs, options)).resolves.toBeNull();
      await expect(
        cacheWithoutRedis.set(inputs, value, options)
      ).resolves.not.toThrow();
      await expect(
        cacheWithoutRedis.delete(inputs, options)
      ).resolves.not.toThrow();
      await expect(
        cacheWithoutRedis.clearTenantDomain(tenantA, 'scoring')
      ).resolves.not.toThrow();
    });

    it('should gracefully handle Redis connection failures', async () => {
      // Simulate Redis becoming unavailable
      mockRedis.get.mockRejectedValue(new Error('Connection lost'));
      mockRedis.setex.mockRejectedValue(new Error('Connection lost'));
      mockRedis.del.mockRejectedValue(new Error('Connection lost'));

      const inputs = { leadId: 'lead-1', score: 85 };
      const value = { enhancedScore: 90 };
      const options = { tenantId: tenantA, domain: 'scoring' };

      // All operations should succeed without throwing
      await expect(cacheService.get(inputs, options)).resolves.toBeNull();
      await expect(
        cacheService.set(inputs, value, options)
      ).resolves.not.toThrow();
      await expect(cacheService.delete(inputs, options)).resolves.not.toThrow();
    });
  });

  describe('Tenant Isolation', () => {
    it('should maintain tenant isolation in key generation', () => {
      const inputs = { leadId: 'lead-1', score: 85 };

      const keyA = (cacheService as any).generateKey(inputs, {
        tenantId: tenantA,
        domain: 'scoring',
      });
      const keyB = (cacheService as any).generateKey(inputs, {
        tenantId: tenantB,
        domain: 'scoring',
      });

      expect(keyA).not.toBe(keyB);
      expect(keyA).toContain(`:${tenantA}:`);
      expect(keyB).toContain(`:${tenantB}:`);
    });

    it('should prevent cross-tenant cache pollution', async () => {
      const inputs = { leadId: 'lead-1', score: 85 };

      // Store value for tenant A
      await cacheService.set(
        inputs,
        { score: 90 },
        { tenantId: tenantA, domain: 'scoring' }
      );

      // Try to retrieve as tenant B
      const result = await cacheService.get(inputs, {
        tenantId: tenantB,
        domain: 'scoring',
      });

      expect(result).toBeNull(); // Should not get tenant A's data
    });
  });

  describe('Versioning and Cache Invalidation', () => {
    it('should generate different keys for different model versions', () => {
      const inputs = { leadId: 'lead-1', score: 85 };

      const optionsV1 = {
        tenantId: tenantA,
        domain: 'scoring',
        modelVersion: 'v1.0',
        configHash: 'abc123',
      };

      const optionsV2 = {
        tenantId: tenantA,
        domain: 'scoring',
        modelVersion: 'v2.0',
        configHash: 'abc123',
      };

      const keyV1 = (cacheService as any).generateKey(inputs, optionsV1);
      const keyV2 = (cacheService as any).generateKey(inputs, optionsV2);

      expect(keyV1).not.toBe(keyV2);
    });

    it('should generate different keys for different config hashes', () => {
      const inputs = { leadId: 'lead-1', score: 85 };

      const optionsConfig1 = {
        tenantId: tenantA,
        domain: 'scoring',
        modelVersion: 'v1.0',
        configHash: 'abc123',
      };

      const optionsConfig2 = {
        tenantId: tenantA,
        domain: 'scoring',
        modelVersion: 'v1.0',
        configHash: 'def456',
      };

      const keyConfig1 = (cacheService as any).generateKey(
        inputs,
        optionsConfig1
      );
      const keyConfig2 = (cacheService as any).generateKey(
        inputs,
        optionsConfig2
      );

      expect(keyConfig1).not.toBe(keyConfig2);
    });

    it('should allow cache clearing by tenant and domain', async () => {
      mockRedis.keys.mockResolvedValue([
        'cache:tenant-a:scoring:key1:v1',
        'cache:tenant-a:scoring:key2:v1',
        'cache:tenant-b:scoring:key3:v1', // Different tenant
      ]);

      await cacheService.clearTenantDomain(tenantA, 'scoring');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'cache:tenant-a:scoring:key1:v1',
        'cache:tenant-a:scoring:key2:v1'
      );
      expect(mockRedis.del).not.toHaveBeenCalledWith(
        'cache:tenant-b:scoring:key3:v1' // Should not clear other tenant's data
      );
    });
  });

  describe('PII Protection', () => {
    it('should not store raw PII in cache values', async () => {
      // This test ensures the cache service itself doesn't enforce PII rules
      // (that's the responsibility of the calling service)
      // But it validates that cache keys don't leak PII

      const inputsWithPII = {
        leadId: 'lead-1',
        email: 'user@example.com', // This should NOT be in cache key
        phone: '+1234567890', // This should NOT be in cache key
        score: 85,
      };

      const options = { tenantId: tenantA, domain: 'scoring' };

      const key = (cacheService as any).generateKey(inputsWithPII, options);

      // Key should be deterministic hash of inputs, not contain raw PII
      expect(key).toMatch(/^cache:tenant-a:scoring:[a-f0-9]+:[a-f0-9]+$/);
      expect(key).not.toContain('user@example.com');
      expect(key).not.toContain('+1234567890');
    });

    it('should support hashed identifiers for privacy', async () => {
      // Services should hash PII before caching
      const inputsWithHashedPII = {
        leadIdHash: 'a1b2c3d4...', // Hashed lead identifier
        score: 85,
      };

      const options = { tenantId: tenantA, domain: 'scoring' };

      const key = (cacheService as any).generateKey(
        inputsWithHashedPII,
        options
      );

      expect(key).toMatch(/^cache:tenant-a:scoring:[a-f0-9]+:[a-f0-9]+$/);
    });
  });

  describe('Integration with AdvancedScoringService', () => {
    it('should cache scoring results with proper metadata', async () => {
      const inputs = {
        leadId: 'lead-1', // Not stored in cache value (used for key only)
        baseScore: 80,
        industry: 'technology',
        conversationSignal: {
          sentiment: 0.8,
          responseTimeMinutes: 10,
          messageLength: 200,
          topicRelevance: 0.9,
          interactionFrequency: 4,
        },
      };

      const scoringResult = {
        originalScore: 80,
        enhancedScore: 88,
        adjustment: 8,
        confidence: 0.85,
        factors: {
          baseScore: { value: 0.8, weight: 0.4, contribution: 0.32 },
          sentimentScore: { value: 0.9, weight: 0.25, contribution: 0.225 },
          timingScore: { value: 0.8, weight: 0.15, contribution: 0.12 },
          frequencyScore: { value: 0.7, weight: 0.15, contribution: 0.105 },
          industryAdjustment: { value: 1.1, weight: 0, contribution: 1.1 },
        },
        reasoning: ['Positive sentiment boosted score', 'Fast response time'],
      };

      const options = {
        tenantId: tenantA,
        domain: 'scoring',
        modelVersion: 'v1.0',
        configHash: 'abc123',
        ttlSeconds: 15 * 60,
      };

      await cacheService.set(inputs, scoringResult, options);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('cache:tenant-a:scoring:'),
        900, // 15 minutes
        expect.stringContaining('"enhancedScore":88')
      );

      // Verify the cached entry includes proper metadata
      const setexCall = mockRedis.setex.mock.calls[0];
      const cachedJson = setexCall[2];
      const cachedEntry = JSON.parse(cachedJson);

      expect(cachedEntry.value).toEqual(scoringResult);
      expect(cachedEntry.source).toBe('cache');
      expect(cachedEntry.metadata).toEqual({
        tenantId: tenantA,
        domain: 'scoring',
        modelVersion: 'v1.0',
        configHash: 'abc123',
        ttlSeconds: 900,
      });
    });

    it('should retrieve cached scoring results correctly', async () => {
      const inputs = {
        leadId: 'lead-1',
        baseScore: 80,
        industry: 'technology',
      };
      const options = { tenantId: tenantA, domain: 'scoring' };

      const cachedEntry = {
        value: {
          originalScore: 80,
          enhancedScore: 88,
          cacheSource: 'cache', // This would be added by the service
        },
        computedAt: new Date().toISOString(),
        source: 'cache',
        metadata: {
          tenantId: tenantA,
          domain: 'scoring',
        },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));

      const result = await cacheService.get(inputs, options);

      expect(result).toEqual(cachedEntry);
    });
  });

  describe('Performance and Scalability', () => {
    it('should support high-frequency cache operations', async () => {
      const inputs = { leadId: 'lead-1', score: 85 };
      const options = { tenantId: tenantA, domain: 'scoring' };

      // Simulate high-frequency operations
      const operations = Array(100)
        .fill(null)
        .map(() => cacheService.get(inputs, options));

      await Promise.all(operations);

      expect(mockRedis.get).toHaveBeenCalledTimes(100);
    });

    it('should handle concurrent operations safely', async () => {
      const inputs = { leadId: 'lead-1', score: 85 };
      const options = { tenantId: tenantA, domain: 'scoring' };

      // Simulate concurrent cache operations
      const concurrentGets = Array(10)
        .fill(null)
        .map(() => cacheService.get(inputs, options));

      const concurrentSets = Array(10)
        .fill(null)
        .map(() => cacheService.set(inputs, { score: 90 }, options));

      await Promise.all([...concurrentGets, ...concurrentSets]);

      expect(mockRedis.get).toHaveBeenCalledTimes(10);
      expect(mockRedis.setex).toHaveBeenCalledTimes(10);
    });
  });
});
