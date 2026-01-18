/**
 * Configuration Schema - WI-026: Release & Environment Hardening
 *
 * Centralized schema for all environment variables with validation rules.
 * Used for boot-time validation to ensure safe deployments.
 */

export interface EnvironmentConfig {
  // Database
  database: {
    url: string;
  };

  // Secrets (WI-019)
  secrets: {
    provider: 'env' | 'db' | 'aws' | 'gcp';
    masterKey?: string; // For envelope encryption
  };

  // Storage (WI-021)
  storage: {
    provider: 'local' | 's3';
    localPath?: string;
    s3Bucket?: string;
    s3Region?: string;
  };

  // Redis (optional, for rate limiting and caching)
  redis?: {
    url: string;
  };

  // Webhooks & Outbox
  webhooks: {
    processingEnabled: boolean;
  };

  outbox: {
    processingEnabled: boolean;
  };

  // Cleanup & Retention (WI-023)
  cleanup: {
    enabled: boolean;
    retentionDays: {
      outboxPublished: number;
      outboxDead: number;
      webhooksDelivered: number;
      webhooksDead: number;
      audit: number;
      artifactsExpiredGrace: number;
      artifactsSoftDelete: number;
      usageRaw: number;
      usageAggregate: number;
    };
    batchSize: number;
    lockTimeoutSeconds: number;
    maxRuntimeMinutes: number;
  };

  // Voice (WI-013)
  voice: {
    retryEnabled: boolean;
  };

  // Metrics (WI-024)
  metrics: {
    enabled: boolean;
  };

  // Application
  app: {
    port: number;
    env: 'development' | 'staging' | 'production';
  };
}

// Environment variable mappings with validation rules
export interface ConfigValidationRule {
  envVar: string;
  required: boolean;
  validator: (value: string | undefined) => string | null; // Returns error message or null
  defaultValue?: string;
  sensitive?: boolean; // Don't log in summaries
}

export const CONFIG_VALIDATION_RULES: Record<string, ConfigValidationRule[]> = {
  database: [
    {
      envVar: 'DATABASE_URL',
      required: true,
      validator: value => {
        if (!value) return 'DATABASE_URL is required';
        if (
          !value.startsWith('postgresql://') &&
          !value.startsWith('postgres://')
        ) {
          return 'DATABASE_URL must be a PostgreSQL connection string';
        }
        return null;
      },
      sensitive: true,
    },
  ],

  secrets: [
    {
      envVar: 'SECRETS_PROVIDER',
      required: true,
      validator: value => {
        const validProviders = ['env', 'db', 'aws', 'gcp'];
        if (!value) return 'SECRETS_PROVIDER is required';
        if (!validProviders.includes(value)) {
          return `SECRETS_PROVIDER must be one of: ${validProviders.join(', ')}`;
        }
        return null;
      },
      defaultValue: 'env',
    },
    {
      envVar: 'SECRETS_MASTER_KEY',
      required: false,
      validator: value => {
        // Only required for certain providers
        const provider = process.env.SECRETS_PROVIDER;
        if (provider === 'db' && !value) {
          return 'SECRETS_MASTER_KEY is required when SECRETS_PROVIDER=db';
        }
        if (value && value.length < 32) {
          return 'SECRETS_MASTER_KEY must be at least 32 characters';
        }
        return null;
      },
      sensitive: true,
    },
  ],

  storage: [
    {
      envVar: 'STORAGE_PROVIDER',
      required: true,
      validator: value => {
        const validProviders = ['local', 's3'];
        if (!value) return 'STORAGE_PROVIDER is required';
        if (!validProviders.includes(value)) {
          return `STORAGE_PROVIDER must be one of: ${validProviders.join(', ')}`;
        }
        return null;
      },
      defaultValue: 'local',
    },
    {
      envVar: 'STORAGE_LOCAL_PATH',
      required: false,
      validator: value => {
        const provider = process.env.STORAGE_PROVIDER;
        if (provider === 'local' && !value) {
          return 'STORAGE_LOCAL_PATH is required when STORAGE_PROVIDER=local';
        }
        return null;
      },
    },
    {
      envVar: 'STORAGE_S3_BUCKET',
      required: false,
      validator: value => {
        const provider = process.env.STORAGE_PROVIDER;
        if (provider === 's3' && !value) {
          return 'STORAGE_S3_BUCKET is required when STORAGE_PROVIDER=s3';
        }
        return null;
      },
    },
    {
      envVar: 'STORAGE_S3_REGION',
      required: false,
      validator: value => {
        const provider = process.env.STORAGE_PROVIDER;
        if (provider === 's3' && !value) {
          return 'STORAGE_S3_REGION is required when STORAGE_PROVIDER=s3';
        }
        return null;
      },
    },
  ],

  redis: [
    {
      envVar: 'REDIS_URL',
      required: false,
      validator: value => {
        if (
          value &&
          !value.startsWith('redis://') &&
          !value.startsWith('rediss://')
        ) {
          return 'REDIS_URL must be a valid Redis connection string';
        }
        return null;
      },
      sensitive: true,
    },
  ],

  webhooks: [
    {
      envVar: 'WEBHOOK_PROCESSING_ENABLED',
      required: false,
      validator: value => {
        if (value && !['true', 'false'].includes(value.toLowerCase())) {
          return 'WEBHOOK_PROCESSING_ENABLED must be true or false';
        }
        return null;
      },
      defaultValue: 'true',
    },
  ],

  outbox: [
    {
      envVar: 'OUTBOX_PROCESSING_ENABLED',
      required: false,
      validator: value => {
        if (value && !['true', 'false'].includes(value.toLowerCase())) {
          return 'OUTBOX_PROCESSING_ENABLED must be true or false';
        }
        return null;
      },
      defaultValue: 'true',
    },
  ],

  cleanup: [
    {
      envVar: 'CLEANUP_ENABLED',
      required: false,
      validator: value => {
        if (value && !['true', 'false'].includes(value.toLowerCase())) {
          return 'CLEANUP_ENABLED must be true or false';
        }
        return null;
      },
      defaultValue: 'true',
    },
    {
      envVar: 'OUTBOX_RETENTION_DAYS_PUBLISHED',
      required: false,
      validator: validateRetentionDays,
      defaultValue: '7',
    },
    {
      envVar: 'OUTBOX_RETENTION_DAYS_DEAD',
      required: false,
      validator: validateRetentionDays,
      defaultValue: '30',
    },
    {
      envVar: 'WEBHOOK_RETENTION_DAYS_DELIVERED',
      required: false,
      validator: validateRetentionDays,
      defaultValue: '14',
    },
    {
      envVar: 'WEBHOOK_RETENTION_DAYS_DEAD',
      required: false,
      validator: validateRetentionDays,
      defaultValue: '30',
    },
    {
      envVar: 'AUDIT_RETENTION_DAYS',
      required: false,
      validator: validateRetentionDays,
      defaultValue: '90',
    },
    {
      envVar: 'ARTIFACT_EXPIRED_DELETE_GRACE_DAYS',
      required: false,
      validator: validateRetentionDays,
      defaultValue: '7',
    },
    {
      envVar: 'ARTIFACT_SOFT_DELETE_RETENTION_DAYS',
      required: false,
      validator: validateRetentionDays,
      defaultValue: '30',
    },
    {
      envVar: 'USAGE_RAW_EVENT_RETENTION_DAYS',
      required: false,
      validator: validateRetentionDays,
      defaultValue: '30',
    },
    {
      envVar: 'USAGE_AGGREGATE_RETENTION_DAYS',
      required: false,
      validator: validateRetentionDays,
      defaultValue: '365',
    },
    {
      envVar: 'CLEANUP_BATCH_SIZE',
      required: false,
      validator: value => {
        if (value) {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 100 || num > 10000) {
            return 'CLEANUP_BATCH_SIZE must be between 100 and 10000';
          }
        }
        return null;
      },
      defaultValue: '1000',
    },
    {
      envVar: 'CLEANUP_LOCK_TIMEOUT_SECONDS',
      required: false,
      validator: value => {
        if (value) {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 60 || num > 3600) {
            return 'CLEANUP_LOCK_TIMEOUT_SECONDS must be between 60 and 3600';
          }
        }
        return null;
      },
      defaultValue: '300',
    },
    {
      envVar: 'CLEANUP_MAX_RUNTIME_MINUTES',
      required: false,
      validator: value => {
        if (value) {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 5 || num > 120) {
            return 'CLEANUP_MAX_RUNTIME_MINUTES must be between 5 and 120';
          }
        }
        return null;
      },
      defaultValue: '30',
    },
  ],

  voice: [
    {
      envVar: 'VOICE_RETRY_ENABLED',
      required: false,
      validator: value => {
        if (value && !['true', 'false'].includes(value.toLowerCase())) {
          return 'VOICE_RETRY_ENABLED must be true or false';
        }
        return null;
      },
      defaultValue: 'true',
    },
  ],

  metrics: [
    {
      envVar: 'METRICS_ENABLED',
      required: false,
      validator: value => {
        if (value && !['true', 'false'].includes(value.toLowerCase())) {
          return 'METRICS_ENABLED must be true or false';
        }
        return null;
      },
      defaultValue: 'true',
    },
  ],

  app: [
    {
      envVar: 'PORT',
      required: false,
      validator: value => {
        if (value) {
          const num = parseInt(value, 10);
          if (isNaN(num) || num < 1 || num > 65535) {
            return 'PORT must be between 1 and 65535';
          }
        }
        return null;
      },
      defaultValue: '3000',
    },
    {
      envVar: 'NODE_ENV',
      required: true,
      validator: value => {
        const validEnvs = ['development', 'staging', 'production'];
        if (!value) return 'NODE_ENV is required';
        if (!validEnvs.includes(value)) {
          return `NODE_ENV must be one of: ${validEnvs.join(', ')}`;
        }
        return null;
      },
      defaultValue: 'development',
    },
  ],
};

// Helper validation functions
function validateRetentionDays(value: string | undefined): string | null {
  if (value) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 365 * 2) {
      return 'Retention days must be between 1 and 730';
    }
  }
  return null;
}

// Cross-validation rules (relationships between config values)
export const CROSS_VALIDATION_RULES = [
  {
    name: 'cleanup-retention-relationship',
    validator: (config: Partial<EnvironmentConfig>) => {
      const cleanup = config.cleanup;
      if (cleanup) {
        if (
          cleanup.retentionDays.usageAggregate <= cleanup.retentionDays.usageRaw
        ) {
          return 'USAGE_AGGREGATE_RETENTION_DAYS must be greater than USAGE_RAW_EVENT_RETENTION_DAYS';
        }
        if (
          cleanup.retentionDays.outboxDead <
          cleanup.retentionDays.outboxPublished
        ) {
          return 'OUTBOX_RETENTION_DAYS_DEAD should not be less than OUTBOX_RETENTION_DAYS_PUBLISHED';
        }
        if (
          cleanup.retentionDays.webhooksDead <
          cleanup.retentionDays.webhooksDelivered
        ) {
          return 'WEBHOOK_RETENTION_DAYS_DEAD should not be less than WEBHOOK_RETENTION_DAYS_DELIVERED';
        }
      }
      return null;
    },
  },
];
