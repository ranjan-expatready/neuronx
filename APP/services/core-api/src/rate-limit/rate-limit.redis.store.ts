/**
 * Redis Rate Limit Store - REQ-RATE: Distributed Rate Limiting
 *
 * Redis-backed token bucket store for multi-instance safe rate limiting.
 * Uses Lua scripts for atomic token bucket operations and automatic TTL cleanup.
 * Compatible with existing InMemoryRateLimitStore interface.
 */

// Conditionally import Redis
let Redis: any;
try {
  Redis = require('ioredis');
} catch {
  // Fallback for when Redis is not available
  Redis = class MockRedis {
    constructor() {
      throw new Error('Redis dependency not available');
    }
  };
}
import {
  IRateLimitStore,
  RateLimitKey,
  RateLimitPolicy,
  RateLimitDecision,
  TokenBucketState,
} from './rate-limit.types';

/**
 * Generate string key from RateLimitKey object
 * Ensures tenant isolation in the key structure
 */
function generateStoreKey(key: RateLimitKey): string {
  const { tenantId, scope, routeKey, method, providerId } = key;
  return `ratelimit:${tenantId}:${scope}:${routeKey}:${method}${providerId ? `:${providerId}` : ''}`;
}

/**
 * Redis-backed token bucket rate limit store
 * Provides multi-instance safe token bucket operations with automatic cleanup
 */
export class RedisRateLimitStore implements IRateLimitStore {
  private redis: Redis;
  private readonly ttlSeconds: number;

  constructor(
    redisUrl?: string,
    ttlSeconds: number = 1800 // 30 minutes default TTL
  ) {
    this.redis = new Redis(
      redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
    );

    // Handle connection events
    this.redis.on('connect', () => {
      console.log('Rate limit Redis store connected');
    });

    this.redis.on('error', err => {
      console.error('Rate limit Redis store error:', err);
    });

    this.redis.on('ready', () => {
      console.log('Rate limit Redis store ready');
    });

    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Consume tokens from the rate limit bucket using atomic Lua script
   * Implements token bucket algorithm with burst allowance
   */
  async consume(
    policy: RateLimitPolicy,
    key: RateLimitKey,
    now: number = Date.now()
  ): Promise<RateLimitDecision> {
    const storeKey = generateStoreKey(key);

    // Lua script for atomic token bucket operations
    const luaScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local windowSeconds = tonumber(ARGV[3])
      local requestedTokens = 1
      local now = tonumber(ARGV[4])
      local ttl = tonumber(ARGV[5])

      -- Get current state
      local state = redis.call('HMGET', key, 'tokens', 'lastRefill', 'resetTime')

      local currentTokens = tonumber(state[1] or capacity)
      local lastRefill = tonumber(state[2] or now)
      local resetTime = tonumber(state[3] or (now + (windowSeconds * 1000)))

      -- Calculate time elapsed and tokens to add
      local elapsedMs = now - lastRefill
      local elapsedSeconds = elapsedMs / 1000
      local tokensToAdd = math.floor(elapsedSeconds * refillRate)

      -- Update tokens (don't exceed capacity)
      if tokensToAdd > 0 then
        currentTokens = math.min(capacity, currentTokens + tokensToAdd)
        lastRefill = now
      end

      -- Check if request can be fulfilled
      local allowed = currentTokens >= requestedTokens
      local remaining = currentTokens

      if allowed then
        -- Consume token
        currentTokens = currentTokens - requestedTokens
        remaining = currentTokens
      end

      -- Update state in Redis
      redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefill', lastRefill, 'resetTime', resetTime)
      redis.call('EXPIRE', key, ttl)

      -- Return result
      return { allowed and 1 or 0, remaining, resetTime }
    `;

    try {
      const capacity = policy.limitPerMinute + policy.burst;
      const refillRate = policy.limitPerMinute / policy.windowSeconds; // tokens per second

      const result = (await this.redis.eval(
        luaScript,
        1, // number of keys
        storeKey, // KEYS[1]
        capacity.toString(), // ARGV[1]
        refillRate.toString(), // ARGV[2]
        policy.windowSeconds.toString(), // ARGV[3]
        now.toString(), // ARGV[4]
        this.ttlSeconds.toString() // ARGV[5]
      )) as [number, number, number];

      const [allowed, remaining, resetTime] = result;

      if (allowed === 1) {
        // Request allowed
        return {
          allowed: true,
          remaining: Math.max(0, remaining),
          reason: 'within_limit',
        };
      } else {
        // Request denied - calculate retry-after
        const retryAfterSeconds = policy.customRetryAfter
          ? policy.customRetryAfter(0, policy)
          : Math.ceil(policy.windowSeconds / (policy.limitPerMinute / 60));

        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, retryAfterSeconds),
          reason: 'rate_limit_exceeded',
          resetTime: new Date(resetTime).toISOString(),
        };
      }
    } catch (error) {
      console.error('Redis rate limit consume error:', error);

      // On Redis failure, fail closed for security
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 60,
        reason: 'redis_error',
      };
    }
  }

  /**
   * Get current state of a rate limit key
   */
  async getState(key: RateLimitKey): Promise<TokenBucketState | null> {
    try {
      const storeKey = generateStoreKey(key);
      const state = await this.redis.hmget(
        storeKey,
        'tokens',
        'lastRefill',
        'resetTime'
      );

      if (!state || state[0] === null) {
        return null;
      }

      return {
        tokens: parseInt(state[0]!, 10),
        lastRefill: parseInt(state[1]!, 10),
        resetTime: parseInt(state[2]!, 10),
      };
    } catch (error) {
      console.error('Redis getState error:', error);
      return null;
    }
  }

  /**
   * Reset rate limit state for a key
   * Useful for administrative operations or after payment
   */
  async reset(key: RateLimitKey): Promise<void> {
    try {
      const storeKey = generateStoreKey(key);
      await this.redis.del(storeKey);
    } catch (error) {
      console.error('Redis reset error:', error);
      // Don't throw - reset is best effort
    }
  }

  /**
   * Clean up expired entries
   * Note: Redis handles TTL automatically, but this method is kept for interface compatibility
   */
  async cleanup(): Promise<void> {
    // Redis handles cleanup automatically via TTL
    // This method exists for interface compatibility
    try {
      // Log some basic stats
      const info = await this.redis.info('memory');
      console.log('Redis memory info:', info.split('\n')[0]);
    } catch (error) {
      console.error('Redis cleanup error:', error);
    }
  }

  /**
   * Get store statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    totalKeys: number;
    memoryUsage: string;
  }> {
    try {
      const connected = this.redis.status === 'ready';

      // Get approximate key count for rate limit keys
      const keys = await this.redis.keys('ratelimit:*');
      const totalKeys = keys.length;

      // Get memory info
      const info = await this.redis.info('memory');
      const usedMemory =
        info
          .split('\n')
          .find(line => line.startsWith('used_memory_human:'))
          ?.split(':')[1]
          ?.trim() || 'unknown';

      return {
        connected,
        totalKeys,
        memoryUsage: usedMemory,
      };
    } catch (error) {
      console.error('Redis stats error:', error);
      return {
        connected: false,
        totalKeys: 0,
        memoryUsage: 'error',
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Check if Redis is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create Redis store instance with environment-based configuration
 */
export function createRedisRateLimitStore(): RedisRateLimitStore {
  const redisUrl = process.env.REDIS_URL;
  const ttlSeconds = parseInt(process.env.RATE_LIMIT_TTL_SECONDS || '1800', 10);

  return new RedisRateLimitStore(redisUrl, ttlSeconds);
}
