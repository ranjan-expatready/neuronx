/**
 * Rate Limit Store - REQ-RATE: Token Bucket Implementation
 *
 * In-memory token bucket store for FAANG-grade rate limiting with tenant isolation.
 * Implements efficient token bucket algorithm with TTL cleanup.
 */

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
  return `${tenantId}:${scope}:${routeKey}:${method}${providerId ? `:${providerId}` : ''}`;
}

/**
 * In-memory token bucket rate limit store
 * Provides thread-safe token bucket operations with automatic cleanup
 */
export class InMemoryRateLimitStore implements IRateLimitStore {
  private buckets = new Map<string, TokenBucketState>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(private cleanupIntervalMs: number = 300000) {
    // 5 minutes default
    this.startCleanupInterval();
  }

  /**
   * Consume tokens from the rate limit bucket
   * Implements token bucket algorithm with burst allowance
   */
  async consume(
    policy: RateLimitPolicy,
    key: RateLimitKey,
    now: number = Date.now()
  ): Promise<RateLimitDecision> {
    const storeKey = generateStoreKey(key);
    const state = this.buckets.get(storeKey);

    // Initialize bucket if it doesn't exist
    if (!state) {
      const initialState: TokenBucketState = {
        tokens: policy.limitPerMinute + policy.burst,
        lastRefill: now,
        resetTime: now + policy.windowSeconds * 1000,
      };
      this.buckets.set(storeKey, initialState);

      return {
        allowed: true,
        remaining: policy.limitPerMinute + policy.burst - 1,
        reason: 'initial_request',
      };
    }

    // Refill tokens based on elapsed time
    const elapsedMs = now - state.lastRefill;
    const elapsedSeconds = elapsedMs / 1000;
    const refillRate = policy.limitPerMinute / policy.windowSeconds; // tokens per second
    const tokensToAdd = Math.floor(elapsedSeconds * refillRate);

    if (tokensToAdd > 0) {
      state.tokens = Math.min(
        policy.limitPerMinute + policy.burst, // Maximum capacity
        state.tokens + tokensToAdd
      );
      state.lastRefill = now;
    }

    // Check if request can be fulfilled
    if (state.tokens >= 1) {
      // Allow request and consume token
      state.tokens -= 1;

      // Calculate retry-after for informational purposes
      const retryAfter = policy.customRetryAfter
        ? policy.customRetryAfter(state.tokens, policy)
        : Math.ceil(policy.windowSeconds / (policy.limitPerMinute / 60));

      return {
        allowed: true,
        remaining: Math.max(0, state.tokens),
        reason: 'within_limit',
      };
    } else {
      // Deny request - calculate retry-after
      const retryAfterSeconds = policy.customRetryAfter
        ? policy.customRetryAfter(0, policy)
        : Math.ceil((policy.windowSeconds * 1000 - elapsedMs) / 1000);

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
        reason: 'rate_limit_exceeded',
        resetTime: new Date(state.resetTime).toISOString(),
      };
    }
  }

  /**
   * Get current state of a rate limit key
   */
  async getState(key: RateLimitKey): Promise<TokenBucketState | null> {
    const storeKey = generateStoreKey(key);
    const state = this.buckets.get(storeKey);

    if (!state) {
      return null;
    }

    // Return a copy to prevent external mutation
    return {
      tokens: state.tokens,
      lastRefill: state.lastRefill,
      resetTime: state.resetTime,
    };
  }

  /**
   * Reset rate limit state for a key
   * Useful for administrative operations or after payment
   */
  async reset(key: RateLimitKey): Promise<void> {
    const storeKey = generateStoreKey(key);
    this.buckets.delete(storeKey);
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, state] of this.buckets.entries()) {
      // Remove buckets that haven't been used in the last window
      // and have no tokens left to refill
      if (state.resetTime < now && state.tokens <= 0) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.buckets.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(
        `Cleaned up ${expiredKeys.length} expired rate limit buckets`
      );
    }
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalBuckets: number;
    estimatedMemoryUsage: number;
  } {
    const totalBuckets = this.buckets.size;

    // Rough estimate: each bucket is ~100 bytes (Map overhead + object)
    const estimatedMemoryUsage = totalBuckets * 100;

    return {
      totalBuckets,
      estimatedMemoryUsage,
    };
  }

  /**
   * Start periodic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        console.error('Failed to cleanup rate limit store:', error);
      }
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Destroy the store and clean up resources
   */
  destroy(): void {
    this.stopCleanup();
    this.buckets.clear();
  }
}

/**
 * Export default store instance
 */
export const rateLimitStore = new InMemoryRateLimitStore();
