/**
 * Rate Limiting Types - REQ-RATE: Tenant-Aware Rate Limiting
 *
 * Types for FAANG-grade rate limiting with tenant isolation and tier-aware policies.
 * Supports both API requests and webhook processing with configurable fail modes.
 */

import { Request } from 'express';

/**
 * Rate limiting scope categories with fail-open/fail-closed policies
 *
 * SECURITY POLICY:
 * - webhook: fail-closed (security-critical - prevents abuse of external integrations)
 * - admin: fail-closed (security-critical - prevents admin API abuse)
 * - api: fail-open with logging (availability-critical - prefer to serve with monitoring)
 */
export type RateLimitScope = 'api' | 'webhook' | 'admin';

/**
 * Rate limit key components for tenant isolation
 */
export interface RateLimitKey {
  /** Tenant identifier */
  tenantId: string;

  /** Rate limiting scope */
  scope: RateLimitScope;

  /** Route identifier (controller + method or path pattern) */
  routeKey: string;

  /** HTTP method */
  method: string;

  /** Optional provider identifier for webhooks */
  providerId?: string;
}

/**
 * Rate limit policy definition
 */
export interface RateLimitPolicy {
  /** Requests allowed per minute */
  limitPerMinute: number;

  /** Burst allowance above the rate limit */
  burst: number;

  /** Time window in seconds for rate calculation */
  windowSeconds: number;

  /** Failure mode when rate limit is exceeded */
  mode: 'fail_open' | 'fail_closed';

  /** Custom retry-after calculation (optional) */
  customRetryAfter?: (remaining: number, policy: RateLimitPolicy) => number;
}

/**
 * Rate limit decision result
 */
export interface RateLimitDecision {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Remaining requests in current window */
  remaining: number;

  /** Retry-after seconds if blocked */
  retryAfterSeconds?: number;

  /** Reason for the decision */
  reason: string;

  /** Reset time for the current window */
  resetTime?: string;
}

/**
 * Rate limit store interface
 */
export interface IRateLimitStore {
  /**
   * Consume tokens from the rate limit bucket
   * @param policy The rate limit policy
   * @param key The rate limit key
   * @param now Current timestamp
   * @returns Rate limit decision
   */
  consume(
    policy: RateLimitPolicy,
    key: RateLimitKey,
    now: number
  ): Promise<RateLimitDecision>;

  /**
   * Get current state of a rate limit key
   */
  getState(key: RateLimitKey): Promise<{
    tokens: number;
    lastRefill: number;
    resetTime: number;
  } | null>;

  /**
   * Reset rate limit state for a key
   */
  reset(key: RateLimitKey): Promise<void>;

  /**
   * Clean up expired entries
   */
  cleanup(): Promise<void>;

  /**
   * Get store statistics (optional, for monitoring)
   */
  getStats?(): Promise<any> | any;

  /**
   * Close store connection (optional, for Redis)
   */
  close?(): Promise<void>;

  /**
   * Check store health (optional, for Redis)
   */
  isHealthy?(): Promise<boolean>;
}

/**
 * Token bucket state for in-memory store
 */
export interface TokenBucketState {
  /** Current token count */
  tokens: number;

  /** Timestamp of last token refill */
  lastRefill: number;

  /** Next reset timestamp */
  resetTime: number;
}

/**
 * Tenant resolution result
 */
export interface TenantResolutionResult {
  /** Resolved tenant ID */
  tenantId: string;

  /** Confidence level in the resolution */
  confidence: 'high' | 'medium' | 'low' | 'unknown';

  /** Source of the tenant ID */
  source: 'header' | 'jwt' | 'path' | 'query' | 'default';

  /** Whether tenant was explicitly provided */
  explicit: boolean;
}

/**
 * Rate limit policy configuration
 */
export interface RateLimitConfig {
  /** Whether rate limiting is enabled globally */
  enabled: boolean;

  /** Default policies per scope */
  defaultPolicies: Record<RateLimitScope, RateLimitPolicy>;

  /** Tier-specific policy overrides */
  tierOverrides: Record<
    string,
    Partial<Record<RateLimitScope, Partial<RateLimitPolicy>>>
  >;

  /** Routes excluded from rate limiting */
  excludedRoutes: string[];

  /** Store cleanup interval in milliseconds */
  cleanupIntervalMs: number;

  /** Whether to log rate limit violations */
  logViolations: boolean;

  /** Custom key generator function */
  customKeyGenerator?: (req: Request, tenantId: string) => string;
}

/**
 * Rate limit violation event
 */
export interface RateLimitViolationEvent {
  /** Event ID */
  eventId: string;

  /** Timestamp */
  timestamp: string;

  /** Rate limit key */
  key: RateLimitKey;

  /** Applied policy */
  policy: RateLimitPolicy;

  /** Request details */
  request: {
    method: string;
    path: string;
    userAgent?: string;
    ip?: string;
  };

  /** Violation details */
  violation: {
    attemptedRequests: number;
    remainingTokens: number;
    retryAfterSeconds: number;
  };
}

/**
 * Rate limit metrics
 */
export interface RateLimitMetrics {
  /** Total requests processed */
  totalRequests: number;

  /** Total requests blocked */
  blockedRequests: number;

  /** Current active buckets */
  activeBuckets: number;

  /** Buckets cleaned up */
  cleanedBuckets: number;

  /** Average processing time */
  avgProcessingTimeMs: number;
}

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  enabled: true,
  defaultPolicies: {
    api: {
      limitPerMinute: 1000,
      burst: 200,
      windowSeconds: 60,
      mode: 'fail_closed',
    },
    webhook: {
      limitPerMinute: 100,
      burst: 50,
      windowSeconds: 60,
      mode: 'fail_closed',
    },
    admin: {
      limitPerMinute: 100,
      burst: 20,
      windowSeconds: 60,
      mode: 'fail_closed',
    },
  },
  tierOverrides: {
    free: {
      api: { limitPerMinute: 100, burst: 10 },
      webhook: { limitPerMinute: 10, burst: 5 },
    },
    starter: {
      api: { limitPerMinute: 500, burst: 50 },
      webhook: { limitPerMinute: 50, burst: 10 },
    },
    professional: {
      api: { limitPerMinute: 2000, burst: 500 },
      webhook: { limitPerMinute: 200, burst: 50 },
    },
    enterprise: {
      api: { limitPerMinute: 10000, burst: 2000 },
      webhook: { limitPerMinute: 1000, burst: 200 },
    },
  },
  excludedRoutes: [
    '/health',
    '/healthz',
    '/readiness',
    '/liveness',
    '/api/docs',
    '/api/docs-json',
  ],
  cleanupIntervalMs: 300000, // 5 minutes
  logViolations: true,
};
