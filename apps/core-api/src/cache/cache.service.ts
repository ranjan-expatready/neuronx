/**
 * Redis-Backed Cache Service - WI-015: ML/Scoring Cache Cluster
 *
 * Tenant-isolated, deterministic Redis cache for ML/scoring operations.
 * Fail-open design: cache failures never break business operations.
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';

export interface CacheEntry<T = any> {
  value: T;
  computedAt: string;
  source: 'cache' | 'computed';
  metadata?: {
    tenantId: string;
    domain: string;
    modelVersion?: string;
    configHash?: string;
    ttlSeconds?: number;
  };
}

export interface CacheOptions {
  ttlSeconds?: number; // Default 15 minutes, max 24 hours
  tenantId: string;
  domain: string; // 'scoring', 'segmentation', 'routing', etc.
  modelVersion?: string;
  configHash?: string; // From WI-012 effective config metadata
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null = null;
  private readonly DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes
  private readonly MAX_TTL_SECONDS = 24 * 60 * 60; // 24 hours
  private readonly CACHE_KEY_PREFIX = 'cache';

  constructor(
    @Optional()
    @Inject('REDIS_CLIENT')
    injectedRedis?: Redis
  ) {
    // Initialize Redis client if available
    if (injectedRedis) {
      this.redis = injectedRedis;
    } else if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL);
      this.redis.on('error', (error: Error) => {
        this.logger.warn(
          'Redis connection error (continuing without cache)',
          {
            error: error.message,
          }
        );
      });
        this.redis.on('connect', () => {
          this.logger.log('Connected to Redis for caching');
        });
      } catch (error: any) {
        this.logger.warn(
          'Failed to initialize Redis client (continuing without cache)',
          {
            error: error.message,
          }
        );
      }
    } else {
      this.logger.warn(
        'No Redis configuration found - operating without cache'
      );
    }
  }

  /**
   * Get value from cache with deterministic key generation
   */
  async get<T = any>(
    inputs: any,
    options: CacheOptions
  ): Promise<CacheEntry<T> | null> {
    if (!this.redis) {
      return null; // No cache available
    }

    const key = this.generateKey(inputs, options);

    try {
      const cachedValue = await this.redis.get(key);
      if (!cachedValue) {
        return null; // Cache miss
      }

      const entry: CacheEntry<T> = JSON.parse(cachedValue);

      // Verify tenant isolation (defense in depth)
      if (entry.metadata?.tenantId !== options.tenantId) {
        this.logger.error('Cache tenant isolation violation detected', {
          key,
          expectedTenant: options.tenantId,
          cachedTenant: entry.metadata?.tenantId,
        });
        // Remove corrupted entry
        await this.redis.del(key);
        return null;
      }

      this.logger.debug('Cache hit', {
        key,
        tenantId: options.tenantId,
        domain: options.domain,
      });

      return entry;
    } catch (error: any) {
      // Fail-open: log error but don't break business logic
      this.logger.warn('Cache read error (continuing without cache)', {
        key,
        tenantId: options.tenantId,
        domain: options.domain,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Set value in cache with deterministic key generation
   */
  async set<T = any>(
    inputs: any,
    value: T,
    options: CacheOptions
  ): Promise<void> {
    if (!this.redis) {
      return; // No cache available
    }

    const key = this.generateKey(inputs, options);
    const ttlSeconds = Math.min(
      options.ttlSeconds || this.DEFAULT_TTL_SECONDS,
      this.MAX_TTL_SECONDS
    );

    const entry: CacheEntry<T> = {
      value,
      computedAt: new Date().toISOString(),
      source: 'cache',
      metadata: {
        tenantId: options.tenantId,
        domain: options.domain,
        modelVersion: options.modelVersion,
        configHash: options.configHash,
        ttlSeconds,
      },
    };

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(entry));

      this.logger.debug('Cache set', {
        key,
        tenantId: options.tenantId,
        domain: options.domain,
        ttlSeconds,
      });
    } catch (error: any) {
      // Fail-open: log error but don't break business logic
      this.logger.warn('Cache write error (continuing without cache)', {
        key,
        tenantId: options.tenantId,
        domain: options.domain,
        error: error.message,
      });
    }
  }

  /**
   * Delete cache entry
   */
  async delete(inputs: any, options: CacheOptions): Promise<void> {
    if (!this.redis) {
      return;
    }

    const key = this.generateKey(inputs, options);

    try {
      await this.redis.del(key);

      this.logger.debug('Cache deleted', {
        key,
        tenantId: options.tenantId,
        domain: options.domain,
      });
    } catch (error: any) {
      this.logger.warn('Cache delete error (continuing)', {
        key,
        tenantId: options.tenantId,
        domain: options.domain,
        error: error.message,
      });
    }
  }

  /**
   * Clear all cache entries for a tenant and domain
   */
  async clearTenantDomain(tenantId: string, domain: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    const pattern = `${this.CACHE_KEY_PREFIX}:${tenantId}:${domain}:*`;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Cleared ${keys.length} cache entries`, {
          tenantId,
          domain,
          pattern,
        });
      }
    } catch (error: any) {
      this.logger.warn('Cache clear error (continuing)', {
        tenantId,
        domain,
        pattern,
        error: error.message,
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    redisConnected: boolean;
    cacheHits: number;
    cacheMisses: number;
    errors: number;
  }> {
    // In a production implementation, these would be Prometheus metrics
    // For now, return basic connectivity status
    return {
      redisConnected: this.redis?.status === 'ready',
      cacheHits: 0, // Would be tracked with metrics
      cacheMisses: 0, // Would be tracked with metrics
      errors: 0, // Would be tracked with metrics
    };
  }

  /**
   * Generate deterministic cache key
   * Format: cache:{tenantId}:{domain}:{hash(inputs)}:{version}
   */
  private generateKey(inputs: any, options: CacheOptions): string {
    // Create deterministic hash of inputs
    const inputString = JSON.stringify(inputs, Object.keys(inputs).sort());
    const inputHash = createHash('sha256')
      .update(inputString)
      .digest('hex')
      .substring(0, 16);

    // Include version information for cache invalidation
    const versionParts = [
      options.modelVersion || 'v1',
      options.configHash || 'default',
    ].filter(Boolean);

    const version = createHash('md5')
      .update(versionParts.join('|'))
      .digest('hex')
      .substring(0, 8);

    // Format: cache:{tenantId}:{domain}:{inputHash}:{version}
    return `${this.CACHE_KEY_PREFIX}:${options.tenantId}:${options.domain}:${inputHash}:${version}`;
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.redis?.status === 'ready';
  }

  /**
   * Graceful shutdown
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}