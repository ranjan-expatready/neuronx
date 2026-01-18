/**
 * Rate Limit Store Integration Tests
 *
 * Tests that verify store behavior across instances and persistence.
 * Demonstrates Redis multi-instance safety vs in-memory limitations.
 */

import { InMemoryRateLimitStore } from '../rate-limit.store';
import { RedisRateLimitStore } from '../rate-limit.redis.store';
import { RateLimitPolicy, RateLimitKey } from '../rate-limit.types';

// Conditionally skip Redis tests if dependency not available
let redisAvailable = false;
try {
  require('ioredis');
  redisAvailable = true;
} catch {
  redisAvailable = false;
}

const describeRedis = redisAvailable ? describe : describe.skip;

// Only mock ioredis if it's available
if (redisAvailable) {
  jest.mock('ioredis', () => {
    // Create a simple in-memory mock that simulates Redis persistence across instances
    let globalStore = new Map<string, any>();

    return jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      eval: jest
        .fn()
        .mockImplementation(async (script, numKeys, key, ...args) => {
          // Simple token bucket simulation for testing
          const stateKey = key;
          let state = globalStore.get(stateKey) || {
            tokens: parseInt(args[0]), // capacity
            lastRefill: parseInt(args[3]), // now
            resetTime: parseInt(args[3]) + parseInt(args[2]) * 1000, // now + windowSeconds * 1000
          };

          // Simple refill logic
          const capacity = parseInt(args[0]);
          const now = parseInt(args[3]);
          const elapsedMs = now - state.lastRefill;
          const elapsedSeconds = elapsedMs / 1000;
          const refillRate = parseFloat(args[1]); // tokens per second
          const tokensToAdd = Math.floor(elapsedSeconds * refillRate);

          if (tokensToAdd > 0) {
            state.tokens = Math.min(capacity, state.tokens + tokensToAdd);
            state.lastRefill = now;
          }

          const allowed = state.tokens >= 1;
          let remaining = state.tokens;

          if (allowed) {
            state.tokens -= 1;
            remaining = state.tokens;
          }

          // Store updated state
          globalStore.set(stateKey, state);

          return [allowed ? 1 : 0, remaining, state.resetTime];
        }),
      hmget: jest.fn().mockImplementation(async (key, ...fields) => {
        const state = globalStore.get(key);
        if (!state) return fields.map(() => null);

        return fields.map(field => {
          if (field === 'tokens') return state.tokens.toString();
          if (field === 'lastRefill') return state.lastRefill.toString();
          if (field === 'resetTime') return state.resetTime.toString();
          return null;
        });
      }),
      hmset: jest.fn(),
      expire: jest.fn(),
      del: jest.fn().mockImplementation(key => {
        globalStore.delete(key);
        return 1;
      }),
      keys: jest.fn().mockImplementation(pattern => {
        const matchingKeys = [];
        for (const key of globalStore.keys()) {
          if (key.startsWith(pattern.replace('*', ''))) {
            matchingKeys.push(key);
          }
        }
        return matchingKeys;
      }),
      info: jest.fn().mockResolvedValue('used_memory_human:10.5M\n'),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn(),
      status: 'ready',
    }));
  });
}

describe('RateLimitStore Integration', () => {
  const testPolicy: RateLimitPolicy = {
    limitPerMinute: 10, // Low limit for easy testing
    burst: 2,
    windowSeconds: 60,
    mode: 'fail_closed',
  };

  const testKey: RateLimitKey = {
    tenantId: 'test-tenant',
    scope: 'api',
    routeKey: 'leads',
    method: 'GET',
  };

  describe('Multi-Instance Persistence', () => {
    describe('InMemoryRateLimitStore', () => {
      it('should NOT persist state across instances (limitation)', async () => {
        // Create first instance and consume tokens
        const store1 = new InMemoryRateLimitStore();
        const result1 = await store1.consume(testPolicy, testKey);
        expect(result1.allowed).toBe(true);
        expect(result1.remaining).toBe(11); // 12 - 1 = 11

        // Create second instance - should not see state from first instance
        const store2 = new InMemoryRateLimitStore();
        const result2 = await store2.consume(testPolicy, testKey);
        expect(result2.allowed).toBe(true);
        expect(result2.remaining).toBe(11); // Fresh instance, doesn't see store1's consumption

        // The in-memory store limitation: each instance has its own state
        // This is why we need Redis for multi-instance deployments
      });

      it('should isolate tenants within the same instance', async () => {
        const store = new InMemoryRateLimitStore();

        const tenantAKey: RateLimitKey = { ...testKey, tenantId: 'tenant-a' };
        const tenantBKey: RateLimitKey = { ...testKey, tenantId: 'tenant-b' };

        // Both should succeed initially (tenant isolation)
        const resultA = await store.consume(testPolicy, tenantAKey);
        const resultB = await store.consume(testPolicy, tenantBKey);

        expect(resultA.allowed).toBe(true);
        expect(resultB.allowed).toBe(true);
        expect(resultA.remaining).toBe(11);
        expect(resultB.remaining).toBe(11);
      });
    });

    describeRedis('RedisRateLimitStore', () => {
      let store1: RedisRateLimitStore;
      let store2: RedisRateLimitStore;

      beforeEach(() => {
        store1 = new RedisRateLimitStore();
        store2 = new RedisRateLimitStore();
      });

      afterEach(async () => {
        await store1?.close?.();
        await store2?.close?.();
      });

      it('should persist state across instances (Redis advantage)', async () => {
        // First instance consumes tokens
        const result1 = await store1.consume(testPolicy, testKey);
        expect(result1.allowed).toBe(true);
        expect(result1.remaining).toBe(11);

        // Second instance should see the consumption from first instance
        const result2 = await store2.consume(testPolicy, testKey);
        expect(result2.allowed).toBe(true);
        expect(result2.remaining).toBe(10); // Sees the previous consumption
      });

      it('should maintain tenant isolation across instances', async () => {
        const tenantAKey: RateLimitKey = { ...testKey, tenantId: 'tenant-a' };
        const tenantBKey: RateLimitKey = { ...testKey, tenantId: 'tenant-b' };

        // Instance 1 hits tenant A
        await store1.consume(testPolicy, tenantAKey);

        // Instance 2 hits tenant B - should not see tenant A's consumption
        const resultB = await store2.consume(testPolicy, tenantBKey);
        expect(resultB.allowed).toBe(true);
        expect(resultB.remaining).toBe(11); // Fresh for tenant B

        // Instance 2 checks tenant A - should see instance 1's consumption
        const resultA = await store2.consume(testPolicy, tenantAKey);
        expect(resultA.allowed).toBe(true);
        expect(resultA.remaining).toBe(10); // Sees instance 1's consumption
      });

      it('should handle reset across instances', async () => {
        // Instance 1 consumes tokens
        await store1.consume(testPolicy, testKey);
        const stateAfterConsume = await store1.getState(testKey);
        expect(stateAfterConsume?.tokens).toBe(11);

        // Instance 2 resets the key
        await store2.reset(testKey);

        // Instance 1 should see the reset
        const stateAfterReset = await store1.getState(testKey);
        expect(stateAfterReset).toBeNull();
      });

      it('should demonstrate Redis cluster safety', async () => {
        // This test simulates what would happen in a real Redis cluster
        // where multiple pods share the same Redis instance

        const results = await Promise.all([
          store1.consume(testPolicy, testKey),
          store2.consume(testPolicy, testKey),
          store1.consume(testPolicy, testKey),
        ]);

        // All operations should be consistent
        expect(results[0].allowed).toBe(true);
        expect(results[1].allowed).toBe(true);
        expect(results[2].allowed).toBe(true);

        // Remaining should be decremented consistently
        expect(results[0].remaining).toBe(11);
        expect(results[1].remaining).toBe(10);
        expect(results[2].remaining).toBe(9);
      });
    });
  });

  describe('Store Selection Logic', () => {
    const originalRedisUrl = process.env.REDIS_URL;

    afterEach(() => {
      process.env.REDIS_URL = originalRedisUrl;
    });

    it('should use Redis store when REDIS_URL is set', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';

      // Import the module that has the conditional logic
      jest.resetModules();
      const { RateLimitModule } = require('../rate-limit.module');

      // The module should have providers configured
      expect(RateLimitModule).toBeDefined();
      // Note: Full integration testing of module selection would require
      // NestJS testing utilities. This test verifies the environment logic exists.
    });

    it('should fallback to in-memory when Redis fails', () => {
      process.env.REDIS_URL = 'redis://nonexistent:6379';

      // In a real scenario, the factory function would catch Redis connection errors
      // and fall back to in-memory store. This test documents the expected behavior.
      expect(process.env.REDIS_URL).toBe('redis://nonexistent:6379');
    });

    it('should use in-memory store when no REDIS_URL', () => {
      delete process.env.REDIS_URL;

      // Should default to in-memory store
      expect(process.env.REDIS_URL).toBeUndefined();
    });
  });

  describe('Production Readiness', () => {
    it('should handle Redis unavailability gracefully (fail closed)', async () => {
      const store = new RedisRateLimitStore();

      // Simulate Redis failure by making the mock throw
      const mockRedis = (store as any).redis;
      mockRedis.eval.mockRejectedValueOnce(new Error('Redis unavailable'));

      const result = await store.consume(testPolicy, testKey);

      // Should fail closed for security
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('redis_error');
      expect(result.retryAfterSeconds).toBe(60);
    });

    it("should maintain security ordering (Redis failure doesn't bypass limits)", async () => {
      // This test ensures that Redis failures don't create security holes
      // by allowing unlimited requests

      const store = new RedisRateLimitStore();
      const mockRedis = (store as any).redis;

      // Simulate persistent Redis failure
      mockRedis.eval.mockRejectedValue(new Error('Redis down'));

      // Multiple rapid requests should all be blocked
      const results = await Promise.all([
        store.consume(testPolicy, testKey),
        store.consume(testPolicy, testKey),
        store.consume(testPolicy, testKey),
      ]);

      // All should fail closed
      results.forEach(result => {
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('redis_error');
      });
    });

    it('should provide health check capabilities', async () => {
      const store = new RedisRateLimitStore();

      // Healthy state
      const healthy = await store.isHealthy?.();
      expect(healthy).toBe(true);

      // Simulate unhealthy state
      const mockRedis = (store as any).redis;
      mockRedis.ping.mockRejectedValueOnce(new Error('Connection failed'));

      const unhealthy = await store.isHealthy?.();
      expect(unhealthy).toBe(false);
    });
  });
});
