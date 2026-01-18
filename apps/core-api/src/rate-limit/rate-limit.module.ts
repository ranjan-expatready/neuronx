/**
 * Rate Limit Module - REQ-RATE: Rate Limiting Infrastructure
 *
 * Provides complete rate limiting infrastructure with tenant isolation and tier awareness.
 * Includes store, policy service, guard, and tenant resolver.
 */

import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigEntitlementsModule } from '../config/config.module';
import { RateLimitPolicyService } from './rate-limit.policy';
import { RateLimitGuard } from './rate-limit.guard';
import { rateLimitStore } from './rate-limit.store';
import { createRedisRateLimitStore } from './rate-limit.redis.store';

@Global()
@Module({
  imports: [ConfigEntitlementsModule],
  providers: [
    // Rate limit services - conditionally use Redis or in-memory store
    {
      provide: 'RATE_LIMIT_STORE',
      useFactory: () => {
        // Use Redis if REDIS_URL is configured and Redis is available, otherwise fallback to in-memory
        if (process.env.REDIS_URL) {
          try {
            // Check if Redis dependency is available
            require('ioredis');
            console.log('Using Redis-backed rate limit store');
            return createRedisRateLimitStore();
          } catch (error) {
            console.warn(
              'Redis dependency not available or failed to initialize, falling back to in-memory:',
              error.message
            );
            return rateLimitStore;
          }
        } else {
          console.log(
            'Using in-memory rate limit store (Redis not configured)'
          );
          return rateLimitStore;
        }
      },
    },
    {
      provide: RateLimitPolicyService,
      useClass: RateLimitPolicyService,
    },
    RateLimitService,

    // Global rate limit guard
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [
    RateLimitPolicyService,
    RateLimitService,
    {
      provide: 'RATE_LIMIT_STORE',
      useExisting: 'RATE_LIMIT_STORE',
    },
  ],
})
export class RateLimitModule {}

/**
 * Alternative module for selective application
 * Use this instead of global guard for more control
 */
@Module({
  imports: [ConfigEntitlementsModule],
  providers: [
    {
      provide: 'RATE_LIMIT_STORE',
      useValue: rateLimitStore,
    },
    {
      provide: RateLimitPolicyService,
      useClass: RateLimitPolicyService,
    },
    RateLimitGuard,
  ],
  exports: [
    RateLimitGuard,
    RateLimitPolicyService,
    {
      provide: 'RATE_LIMIT_STORE',
      useExisting: 'RATE_LIMIT_STORE',
    },
  ],
})
export class SelectiveRateLimitModule {}

/**
 * Module for testing with mock services
 */
@Module({
  providers: [
    {
      provide: 'RATE_LIMIT_STORE',
      useValue: {
        consume: jest.fn(),
        getState: jest.fn(),
        reset: jest.fn(),
        cleanup: jest.fn(),
        getStats: jest.fn(),
        close: jest.fn(),
        isHealthy: jest.fn(),
      },
    },
    {
      provide: RateLimitPolicyService,
      useValue: {
        getPolicyForTenant: jest.fn(),
        getConservativePolicy: jest.fn(),
        isRouteExcluded: jest.fn(),
        getConfig: jest.fn(),
      },
    },
  ],
  exports: [
    {
      provide: 'RATE_LIMIT_STORE',
      useExisting: 'RATE_LIMIT_STORE',
    },
    RateLimitPolicyService,
  ],
})
export class MockRateLimitModule {}
