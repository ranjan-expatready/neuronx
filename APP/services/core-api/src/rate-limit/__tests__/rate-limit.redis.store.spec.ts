/**
 * Redis Rate Limit Store Tests
 *
 * Tests for Redis-backed rate limiting store with multi-instance safety.
 * Runs against real Redis when available (CI) or uses mock for local development.
 */

import { RedisRateLimitStore } from '../rate-limit.redis.store';
import {
  RateLimitPolicy,
  RateLimitKey,
  RateLimitDecision,
} from '../rate-limit.types';

// Check if Redis is available (real connection or mocked)
let redisAvailable = false;
let useRealRedis = false;

try {
  require('ioredis');
  redisAvailable = true;
  // Check if we have a real Redis URL (CI environment)
  useRealRedis = !!process.env.REDIS_URL;
} catch {
  redisAvailable = false;
}

// Skip tests if Redis dependency is not available
const describeRedis = redisAvailable ? describe : describe.skip;

describeRedis('RedisRateLimitStore', () => {
  let store: RedisRateLimitStore;
  let mockRedis: any;
  let originalRedisUrl: string | undefined;

  const testPolicy: RateLimitPolicy = {
    limitPerMinute: 100,
    burst: 20,
    windowSeconds: 60,
    mode: 'fail_closed',
  };

  const testKey: RateLimitKey = {
    tenantId: 'test-tenant',
    scope: 'api',
    routeKey: 'leads',
    method: 'GET',
  };

  beforeEach(async () => {
    // Store original Redis URL
    originalRedisUrl = process.env.REDIS_URL;

    if (useRealRedis) {
      // Use real Redis for CI
      store = new RedisRateLimitStore();
    } else {
      // Mock Redis for local development
      const mockRedisInstance = {
        on: jest.fn(),
        eval: jest.fn().mockResolvedValue([1, 119, Date.now() + 60000]),
        hmget: jest
          .fn()
          .mockResolvedValue(['50', '1640995200000', '1640995260000']),
        hmset: jest.fn().mockResolvedValue('OK'),
        expire: jest.fn().mockResolvedValue(1),
        del: jest.fn().mockResolvedValue(1),
        keys: jest
          .fn()
          .mockResolvedValue(['ratelimit:test-tenant:api:leads:GET']),
        info: jest.fn().mockResolvedValue('used_memory_human:10.5M\n'),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn(),
        status: 'ready',
      };

      // Mock the Redis constructor
      jest.doMock('ioredis', () => ({
        default: jest.fn().mockImplementation(() => mockRedisInstance),
      }));

      // Re-import to use the mock
      const { RedisRateLimitStore: MockedRedisRateLimitStore } =
        await import('../rate-limit.redis.store');
      store = new MockedRedisRateLimitStore();
      mockRedis = mockRedisInstance;
    }
  });

  afterEach(async () => {
    // Restore original Redis URL
    if (originalRedisUrl !== undefined) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }

    await store.close?.();
  });

  describe('consume', () => {
    it('should allow initial request and set up bucket', async () => {
      // Mock Redis eval to return: [allowed: 1, remaining: 119, resetTime: timestamp]
      mockRedis.eval.mockResolvedValue([1, 119, Date.now() + 60000]);

      const result: RateLimitDecision = await store.consume(
        testPolicy,
        testKey
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(119);
      expect(result.reason).toBe('within_limit');

      // Verify Redis eval was called with correct parameters
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('local key = KEYS[1]'),
        1, // number of keys
        'ratelimit:test-tenant:api:leads:GET', // store key
        '120', // capacity (100 + 20)
        expect.any(String), // refill rate
        '60', // window seconds
        expect.any(String), // now timestamp
        '1800' // TTL
      );
    });

    it('should deny request when rate limit exceeded', async () => {
      // Mock Redis eval to return: [allowed: 0, remaining: 0, resetTime: timestamp]
      mockRedis.eval.mockResolvedValue([0, 0, Date.now() + 60000]);

      const result: RateLimitDecision = await store.consume(
        testPolicy,
        testKey
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      expect(result.reason).toBe('rate_limit_exceeded');
      expect(result.resetTime).toBeDefined();
    });

    it('should handle Redis errors gracefully (fail closed)', async () => {
      mockRedis.eval.mockRejectedValue(new Error('Redis connection failed'));

      const result: RateLimitDecision = await store.consume(
        testPolicy,
        testKey
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSeconds).toBe(60);
      expect(result.reason).toBe('redis_error');
    });

    it('should persist state across multiple calls', async () => {
      // First call - allow with 99 remaining
      mockRedis.eval.mockResolvedValueOnce([1, 99, Date.now() + 60000]);

      await store.consume(testPolicy, testKey);
      expect(mockRedis.eval).toHaveBeenCalledTimes(1);

      // Second call - should use same key and see updated state
      mockRedis.eval.mockResolvedValueOnce([1, 98, Date.now() + 60000]);

      await store.consume(testPolicy, testKey);
      expect(mockRedis.eval).toHaveBeenCalledTimes(2);

      // Both calls should use the same Redis key
      expect(mockRedis.eval).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        1,
        'ratelimit:test-tenant:api:leads:GET',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should isolate tenants with different tenantIds', async () => {
      const tenantAKey: RateLimitKey = { ...testKey, tenantId: 'tenant-a' };
      const tenantBKey: RateLimitKey = { ...testKey, tenantId: 'tenant-b' };

      mockRedis.eval.mockResolvedValue([1, 119, Date.now() + 60000]);

      await store.consume(testPolicy, tenantAKey);
      await store.consume(testPolicy, tenantBKey);

      // Should generate different keys for different tenants
      const calls = mockRedis.eval.mock.calls;
      expect(calls[0][2]).toBe('ratelimit:tenant-a:api:leads:GET');
      expect(calls[1][2]).toBe('ratelimit:tenant-b:api:leads:GET');
    });

    it('should isolate scopes correctly', async () => {
      const apiKey: RateLimitKey = { ...testKey, scope: 'api' };
      const webhookKey: RateLimitKey = { ...testKey, scope: 'webhook' };

      mockRedis.eval.mockResolvedValue([1, 119, Date.now() + 60000]);

      await store.consume(testPolicy, apiKey);
      await store.consume(testPolicy, webhookKey);

      const calls = mockRedis.eval.mock.calls;
      expect(calls[0][2]).toBe('ratelimit:test-tenant:api:leads:GET');
      expect(calls[1][2]).toBe('ratelimit:test-tenant:webhook:leads:GET');
    });

    it('should handle providerId in webhook keys', async () => {
      const webhookKey: RateLimitKey = {
        ...testKey,
        scope: 'webhook',
        providerId: 'ghl-webhook',
      };

      mockRedis.eval.mockResolvedValue([1, 119, Date.now() + 60000]);

      await store.consume(testPolicy, webhookKey);

      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'ratelimit:test-tenant:webhook:leads:GET:ghl-webhook',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('getState', () => {
    it('should return current state for existing key', async () => {
      mockRedis.hmget.mockResolvedValue([
        '50',
        '1640995200000',
        '1640995260000',
      ]);

      const state = await store.getState(testKey);

      expect(state).toEqual({
        tokens: 50,
        lastRefill: 1640995200000,
        resetTime: 1640995260000,
      });

      expect(mockRedis.hmget).toHaveBeenCalledWith(
        'ratelimit:test-tenant:api:leads:GET',
        'tokens',
        'lastRefill',
        'resetTime'
      );
    });

    it('should return null for non-existent key', async () => {
      mockRedis.hmget.mockResolvedValue([null, null, null]);

      const state = await store.getState(testKey);

      expect(state).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.hmget.mockRejectedValue(new Error('Redis error'));

      const state = await store.getState(testKey);

      expect(state).toBeNull();
    });
  });

  describe('reset', () => {
    it('should delete the rate limit key', async () => {
      mockRedis.del.mockResolvedValue(1);

      await store.reset(testKey);

      expect(mockRedis.del).toHaveBeenCalledWith(
        'ratelimit:test-tenant:api:leads:GET'
      );
    });

    it('should not throw on Redis errors (best effort)', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(store.reset(testKey)).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should attempt to get memory info (Redis handles TTL automatically)', async () => {
      mockRedis.info.mockResolvedValue('used_memory_human:10.5M\n');

      await store.cleanup();

      expect(mockRedis.info).toHaveBeenCalledWith('memory');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.info.mockRejectedValue(new Error('Redis error'));

      await expect(store.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return store statistics when healthy', async () => {
      mockRedis.keys.mockResolvedValue(['ratelimit:key1', 'ratelimit:key2']);
      mockRedis.info.mockResolvedValue('used_memory_human:15.2M\n');

      const stats = await store.getStats();

      expect(stats).toEqual({
        connected: true,
        totalKeys: 2,
        memoryUsage: '15.2M',
      });

      expect(mockRedis.keys).toHaveBeenCalledWith('ratelimit:*');
    });

    it('should return error state when Redis is unhealthy', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Connection failed'));

      const stats = await store.getStats();

      expect(stats).toEqual({
        connected: false,
        totalKeys: 0,
        memoryUsage: 'error',
      });
    });
  });

  describe('close', () => {
    it('should close Redis connection', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await store.close();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('isHealthy', () => {
    it('should return true when Redis responds to ping', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const healthy = await store.isHealthy();

      expect(healthy).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should return false when Redis ping fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const healthy = await store.isHealthy();

      expect(healthy).toBe(false);
    });
  });

  describe('initialization', () => {
    it('should use REDIS_URL from environment', () => {
      const originalUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://test:6379';

      try {
        // Re-import to trigger constructor with new env
        jest.resetModules();
        const { RedisRateLimitStore } = require('../rate-limit.redis.store');

        // Mock Redis constructor should be called with the URL
        const MockRedis = require('ioredis');
        expect(MockRedis).toHaveBeenCalledWith('redis://test:6379');
      } finally {
        process.env.REDIS_URL = originalUrl;
      }
    });

    it('should use default Redis URL when none provided', () => {
      const originalUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      try {
        jest.resetModules();
        const { RedisRateLimitStore } = require('../rate-limit.redis.store');

        const MockRedis = require('ioredis');
        expect(MockRedis).toHaveBeenCalledWith('redis://localhost:6379');
      } finally {
        process.env.REDIS_URL = originalUrl;
      }
    });

    it('should respect custom TTL configuration', () => {
      const store = new RedisRateLimitStore(undefined, 900); // 15 minutes

      // The TTL should be stored in the instance
      expect((store as any).ttlSeconds).toBe(900);
    });
  });
});
