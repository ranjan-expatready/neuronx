/**
 * Cache Module - WI-015: ML/Scoring Cache Cluster
 *
 * Redis-backed cache infrastructure with tenant isolation and fail-open safety.
 */

import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    CacheService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (): Redis | null => {
        if (process.env.REDIS_URL) {
          const redis = new Redis(process.env.REDIS_URL);
          redis.on('error', error => {
            console.warn(
              'Redis connection error in cache module:',
              error.message
            );
          });
          return redis;
        }
        return null;
      },
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
