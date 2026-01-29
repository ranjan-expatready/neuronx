import { describe, it, expect } from 'vitest';
import {
  CONFIG_VALIDATION_RULES,
  CROSS_VALIDATION_RULES,
} from '../config.schema';

describe('Config Schema Validation', () => {
  describe('database rules', () => {
    const rules = CONFIG_VALIDATION_RULES.database;
    const dbRule = rules.find(r => r.envVar === 'DATABASE_URL')!;

    it('should require DATABASE_URL', () => {
      expect(dbRule.validator(undefined)).toBe('DATABASE_URL is required');
      expect(dbRule.validator('')).toBe('DATABASE_URL is required');
    });

    it('should validate postgres prefix', () => {
      expect(dbRule.validator('mysql://localhost')).toBe(
        'DATABASE_URL must be a PostgreSQL connection string'
      );
      expect(dbRule.validator('postgresql://localhost')).toBeNull();
      expect(dbRule.validator('postgres://localhost')).toBeNull();
    });
  });

  describe('secrets rules', () => {
    const rules = CONFIG_VALIDATION_RULES.secrets;
    const providerRule = rules.find(r => r.envVar === 'SECRETS_PROVIDER')!;
    const keyRule = rules.find(r => r.envVar === 'SECRETS_MASTER_KEY')!;

    it('should validate SECRETS_PROVIDER', () => {
      expect(providerRule.validator(undefined)).toBe(
        'SECRETS_PROVIDER is required'
      );
      expect(providerRule.validator('invalid')).toContain(
        'SECRETS_PROVIDER must be one of'
      );
      expect(providerRule.validator('env')).toBeNull();
    });

    it('should require 32 char key if provided', () => {
      expect(keyRule.validator('short')).toBe(
        'SECRETS_MASTER_KEY must be at least 32 characters'
      );
      expect(keyRule.validator('a'.repeat(32))).toBeNull();
    });

    it('should require key when provider is db', () => {
      // Mock environment
      const originalProvider = process.env.SECRETS_PROVIDER;
      process.env.SECRETS_PROVIDER = 'db';
      expect(keyRule.validator(undefined)).toBe(
        'SECRETS_MASTER_KEY is required when SECRETS_PROVIDER=db'
      );
      process.env.SECRETS_PROVIDER = originalProvider;
    });
  });

  describe('storage rules', () => {
    const rules = CONFIG_VALIDATION_RULES.storage;
    const providerRule = rules.find(r => r.envVar === 'STORAGE_PROVIDER')!;
    const localPathRule = rules.find(r => r.envVar === 'STORAGE_LOCAL_PATH')!;
    const s3BucketRule = rules.find(r => r.envVar === 'STORAGE_S3_BUCKET')!;
    const s3RegionRule = rules.find(r => r.envVar === 'STORAGE_S3_REGION')!;

    it('should validate STORAGE_PROVIDER', () => {
      expect(providerRule.validator(undefined)).toBe(
        'STORAGE_PROVIDER is required'
      );
      expect(providerRule.validator('invalid')).toContain(
        'STORAGE_PROVIDER must be one of'
      );
      expect(providerRule.validator('local')).toBeNull();
      expect(providerRule.validator('s3')).toBeNull();
    });

    it('should validate local path if provider is local', () => {
      const originalProvider = process.env.STORAGE_PROVIDER;
      process.env.STORAGE_PROVIDER = 'local';
      expect(localPathRule.validator(undefined)).toBe(
        'STORAGE_LOCAL_PATH is required when STORAGE_PROVIDER=local'
      );
      expect(localPathRule.validator('/tmp')).toBeNull();
      process.env.STORAGE_PROVIDER = originalProvider;
    });

    it('should validate s3 bucket/region if provider is s3', () => {
      const originalProvider = process.env.STORAGE_PROVIDER;
      process.env.STORAGE_PROVIDER = 's3';
      expect(s3BucketRule.validator(undefined)).toBe(
        'STORAGE_S3_BUCKET is required when STORAGE_PROVIDER=s3'
      );
      expect(s3RegionRule.validator(undefined)).toBe(
        'STORAGE_S3_REGION is required when STORAGE_PROVIDER=s3'
      );
      expect(s3BucketRule.validator('my-bucket')).toBeNull();
      expect(s3RegionRule.validator('us-east-1')).toBeNull();
      process.env.STORAGE_PROVIDER = originalProvider;
    });
  });

  describe('redis rules', () => {
    const rules = CONFIG_VALIDATION_RULES.redis;
    const redisRule = rules.find(r => r.envVar === 'REDIS_URL')!;

    it('should validate redis prefix if provided', () => {
      expect(redisRule.validator('http://localhost')).toBe(
        'REDIS_URL must be a valid Redis connection string'
      );
      expect(redisRule.validator('redis://localhost')).toBeNull();
      expect(redisRule.validator('rediss://localhost')).toBeNull();
      expect(redisRule.validator(undefined)).toBeNull(); // Optional
    });
  });

  describe('app rules', () => {
    const rules = CONFIG_VALIDATION_RULES.app;
    const portRule = rules.find(r => r.envVar === 'PORT')!;
    const envRule = rules.find(r => r.envVar === 'NODE_ENV')!;

    it('should validate PORT range', () => {
      expect(portRule.validator('0')).toBe('PORT must be between 1 and 65535');
      expect(portRule.validator('70000')).toBe(
        'PORT must be between 1 and 65535'
      );
      expect(portRule.validator('3000')).toBeNull();
      expect(portRule.validator('abc')).toBe(
        'PORT must be between 1 and 65535'
      );
    });

    it('should validate NODE_ENV', () => {
      expect(envRule.validator(undefined)).toBe('NODE_ENV is required');
      expect(envRule.validator('other')).toContain('NODE_ENV must be one of');
      expect(envRule.validator('production')).toBeNull();
    });
  });

  describe('outbox/webhook rules', () => {
    it('should validate boolean strings', () => {
      const webhookRule = CONFIG_VALIDATION_RULES.webhooks.find(
        r => r.envVar === 'WEBHOOK_PROCESSING_ENABLED'
      )!;
      expect(webhookRule.validator('invalid')).toBe(
        'WEBHOOK_PROCESSING_ENABLED must be true or false'
      );
      expect(webhookRule.validator('TRUE')).toBeNull();
      expect(webhookRule.validator('false')).toBeNull();
    });
  });

  describe('cleanup rules', () => {
    const rules = CONFIG_VALIDATION_RULES.cleanup;
    const batchRule = rules.find(r => r.envVar === 'CLEANUP_BATCH_SIZE')!;
    const lockRule = rules.find(
      r => r.envVar === 'CLEANUP_LOCK_TIMEOUT_SECONDS'
    )!;
    const runtimeRule = rules.find(
      r => r.envVar === 'CLEANUP_MAX_RUNTIME_MINUTES'
    )!;

    it('should validate batch size range', () => {
      expect(batchRule.validator('50')).toBe(
        'CLEANUP_BATCH_SIZE must be between 100 and 10000'
      );
      expect(batchRule.validator('20000')).toBe(
        'CLEANUP_BATCH_SIZE must be between 100 and 10000'
      );
      expect(batchRule.validator('1000')).toBeNull();
    });

    it('should validate lock timeout range', () => {
      expect(lockRule.validator('30')).toBe(
        'CLEANUP_LOCK_TIMEOUT_SECONDS must be between 60 and 3600'
      );
      expect(lockRule.validator('4000')).toBe(
        'CLEANUP_LOCK_TIMEOUT_SECONDS must be between 60 and 3600'
      );
      expect(lockRule.validator('300')).toBeNull();
    });

    it('should validate runtime range', () => {
      expect(runtimeRule.validator('2')).toBe(
        'CLEANUP_MAX_RUNTIME_MINUTES must be between 5 and 120'
      );
      expect(runtimeRule.validator('150')).toBe(
        'CLEANUP_MAX_RUNTIME_MINUTES must be between 5 and 120'
      );
      expect(runtimeRule.validator('30')).toBeNull();
    });
  });

  describe('Cross-validation rules', () => {
    const cleanupRule = CROSS_VALIDATION_RULES.find(
      r => r.name === 'cleanup-retention-relationship'
    )!;

    it('should validate usage retention relationship', () => {
      const config = {
        cleanup: {
          retentionDays: {
            usageRaw: 30,
            usageAggregate: 10,
          },
        },
      };
      expect(cleanupRule.validator(config as any)).toBe(
        'USAGE_AGGREGATE_RETENTION_DAYS must be greater than USAGE_RAW_EVENT_RETENTION_DAYS'
      );
    });

    it('should validate outbox retention relationship', () => {
      const config = {
        cleanup: {
          retentionDays: {
            usageRaw: 10,
            usageAggregate: 30,
            outboxPublished: 30,
            outboxDead: 10,
          },
        },
      };
      expect(cleanupRule.validator(config as any)).toBe(
        'OUTBOX_RETENTION_DAYS_DEAD should not be less than OUTBOX_RETENTION_DAYS_PUBLISHED'
      );
    });

    it('should validate webhooks retention relationship', () => {
      const config = {
        cleanup: {
          retentionDays: {
            usageRaw: 10,
            usageAggregate: 30,
            outboxPublished: 10,
            outboxDead: 30,
            webhooksDelivered: 30,
            webhooksDead: 10,
          },
        },
      };
      expect(cleanupRule.validator(config as any)).toBe(
        'WEBHOOK_RETENTION_DAYS_DEAD should not be less than WEBHOOK_RETENTION_DAYS_DELIVERED'
      );
    });

    it('should pass if relationships are valid', () => {
      const config = {
        cleanup: {
          retentionDays: {
            usageRaw: 10,
            usageAggregate: 30,
            outboxPublished: 10,
            outboxDead: 30,
            webhooksDelivered: 10,
            webhooksDead: 30,
          },
        },
      };
      expect(cleanupRule.validator(config as any)).toBeNull();
    });

    it('should pass if cleanup config is missing', () => {
      expect(cleanupRule.validator({})).toBeNull();
    });
  });
});
