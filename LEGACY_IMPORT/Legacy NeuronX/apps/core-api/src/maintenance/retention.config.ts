/**
 * Retention Configuration - WI-023: Data Retention & Cleanup Runners
 *
 * Environment-driven retention policies with secure defaults and validation.
 */

export interface RetentionConfig {
  // Outbox events (WI-014)
  outbox: {
    publishedRetentionDays: number; // Published events
    deadRetentionDays: number; // Failed/Dead-letter events
  };

  // Webhook deliveries (WI-018)
  webhooks: {
    deliveredRetentionDays: number; // Successfully delivered
    deadRetentionDays: number; // Dead-lettered
  };

  // Audit logs (WI-022)
  audit: {
    retentionDays: number;
  };

  // Artifacts (WI-021)
  artifacts: {
    expiredGraceDays: number; // Grace period after expiresAt before deletion
    softDeleteRetentionDays: number; // How long to keep soft-deleted artifacts
  };

  // Usage data (WI-009)
  usage: {
    rawEventRetentionDays: number; // Raw UsageEvent records
    aggregateRetentionDays: number; // UsageAggregate records
  };

  // Cleanup execution
  execution: {
    batchSize: number; // Rows to delete per batch
    lockTimeoutSeconds: number; // Advisory lock timeout
    maxRuntimeMinutes: number; // Maximum runtime before abort
  };
}

// Default retention values (secure defaults)
const DEFAULT_CONFIG: RetentionConfig = {
  outbox: {
    publishedRetentionDays: 7, // 7 days for published events
    deadRetentionDays: 30, // 30 days for failed/dead-letter
  },
  webhooks: {
    deliveredRetentionDays: 14, // 14 days for delivered webhooks
    deadRetentionDays: 30, // 30 days for dead-lettered
  },
  audit: {
    retentionDays: 90, // 90 days audit retention (compliance)
  },
  artifacts: {
    expiredGraceDays: 7, // 7 days grace after expiry
    softDeleteRetentionDays: 30, // 30 days for soft-deleted
  },
  usage: {
    rawEventRetentionDays: 30, // 30 days raw events
    aggregateRetentionDays: 365, // 1 year aggregates
  },
  execution: {
    batchSize: 1000, // 1000 rows per batch
    lockTimeoutSeconds: 300, // 5 minutes lock timeout
    maxRuntimeMinutes: 30, // 30 minutes max runtime
  },
};

// Environment variable mappings
const ENV_MAPPINGS = {
  // Outbox
  OUTBOX_RETENTION_DAYS_PUBLISHED: 'outbox.publishedRetentionDays',
  OUTBOX_RETENTION_DAYS_DEAD: 'outbox.deadRetentionDays',

  // Webhooks
  WEBHOOK_RETENTION_DAYS_DELIVERED: 'webhooks.deliveredRetentionDays',
  WEBHOOK_RETENTION_DAYS_DEAD: 'webhooks.deadRetentionDays',

  // Audit
  AUDIT_RETENTION_DAYS: 'audit.retentionDays',

  // Artifacts
  ARTIFACT_EXPIRED_DELETE_GRACE_DAYS: 'artifacts.expiredGraceDays',
  ARTIFACT_SOFT_DELETE_RETENTION_DAYS: 'artifacts.softDeleteRetentionDays',

  // Usage
  USAGE_RAW_EVENT_RETENTION_DAYS: 'usage.rawEventRetentionDays',
  USAGE_AGGREGATE_RETENTION_DAYS: 'usage.aggregateRetentionDays',

  // Execution
  CLEANUP_BATCH_SIZE: 'execution.batchSize',
  CLEANUP_LOCK_TIMEOUT_SECONDS: 'execution.lockTimeoutSeconds',
  CLEANUP_MAX_RUNTIME_MINUTES: 'execution.maxRuntimeMinutes',
} as const;

// Validation ranges
const VALIDATION_RANGES = {
  // Retention days
  minRetentionDays: 1,
  maxRetentionDays: 365 * 2, // 2 years max

  // Execution parameters
  minBatchSize: 100,
  maxBatchSize: 10000,
  minLockTimeoutSeconds: 60, // 1 minute
  maxLockTimeoutSeconds: 3600, // 1 hour
  minMaxRuntimeMinutes: 5,
  maxMaxRuntimeMinutes: 120, // 2 hours
} as const;

/**
 * Load retention configuration from environment variables
 */
export function loadRetentionConfig(): RetentionConfig {
  const config = { ...DEFAULT_CONFIG };

  // Apply environment overrides
  for (const [envVar, configPath] of Object.entries(ENV_MAPPINGS)) {
    const envValue = process.env[envVar];
    if (envValue !== undefined) {
      const parsedValue = parseInt(envValue, 10);
      if (isNaN(parsedValue)) {
        throw new Error(
          `Invalid value for ${envVar}: ${envValue}. Must be a number.`
        );
      }

      // Apply value to nested config object
      setNestedValue(config, configPath, parsedValue);
    }
  }

  // Validate configuration
  validateRetentionConfig(config);

  return config;
}

/**
 * Validate retention configuration ranges
 */
function validateRetentionConfig(config: RetentionConfig): void {
  const errors: string[] = [];

  // Validate retention days
  const retentionFields = [
    {
      value: config.outbox.publishedRetentionDays,
      field: 'outbox.publishedRetentionDays',
    },
    {
      value: config.outbox.deadRetentionDays,
      field: 'outbox.deadRetentionDays',
    },
    {
      value: config.webhooks.deliveredRetentionDays,
      field: 'webhooks.deliveredRetentionDays',
    },
    {
      value: config.webhooks.deadRetentionDays,
      field: 'webhooks.deadRetentionDays',
    },
    { value: config.audit.retentionDays, field: 'audit.retentionDays' },
    {
      value: config.artifacts.expiredGraceDays,
      field: 'artifacts.expiredGraceDays',
    },
    {
      value: config.artifacts.softDeleteRetentionDays,
      field: 'artifacts.softDeleteRetentionDays',
    },
    {
      value: config.usage.rawEventRetentionDays,
      field: 'usage.rawEventRetentionDays',
    },
    {
      value: config.usage.aggregateRetentionDays,
      field: 'usage.aggregateRetentionDays',
    },
  ];

  for (const { value, field } of retentionFields) {
    if (
      value < VALIDATION_RANGES.minRetentionDays ||
      value > VALIDATION_RANGES.maxRetentionDays
    ) {
      errors.push(
        `${field} must be between ${VALIDATION_RANGES.minRetentionDays} and ${VALIDATION_RANGES.maxRetentionDays} days, got ${value}`
      );
    }
  }

  // Validate batch size
  if (
    config.execution.batchSize < VALIDATION_RANGES.minBatchSize ||
    config.execution.batchSize > VALIDATION_RANGES.maxBatchSize
  ) {
    errors.push(
      `execution.batchSize must be between ${VALIDATION_RANGES.minBatchSize} and ${VALIDATION_RANGES.maxBatchSize}, got ${config.execution.batchSize}`
    );
  }

  // Validate lock timeout
  if (
    config.execution.lockTimeoutSeconds <
      VALIDATION_RANGES.minLockTimeoutSeconds ||
    config.execution.lockTimeoutSeconds >
      VALIDATION_RANGES.maxLockTimeoutSeconds
  ) {
    errors.push(
      `execution.lockTimeoutSeconds must be between ${VALIDATION_RANGES.minLockTimeoutSeconds} and ${VALIDATION_RANGES.maxLockTimeoutSeconds} seconds, got ${config.execution.lockTimeoutSeconds}`
    );
  }

  // Validate max runtime
  if (
    config.execution.maxRuntimeMinutes <
      VALIDATION_RANGES.minMaxRuntimeMinutes ||
    config.execution.maxRuntimeMinutes > VALIDATION_RANGES.maxMaxRuntimeMinutes
  ) {
    errors.push(
      `execution.maxRuntimeMinutes must be between ${VALIDATION_RANGES.minMaxRuntimeMinutes} and ${VALIDATION_RANGES.maxMaxRuntimeMinutes} minutes, got ${config.execution.maxRuntimeMinutes}`
    );
  }

  // Business rule validations
  if (
    config.usage.aggregateRetentionDays <= config.usage.rawEventRetentionDays
  ) {
    errors.push(
      'usage.aggregateRetentionDays must be greater than usage.rawEventRetentionDays to preserve aggregates'
    );
  }

  if (config.outbox.deadRetentionDays < config.outbox.publishedRetentionDays) {
    errors.push(
      'outbox.deadRetentionDays should not be less than outbox.publishedRetentionDays'
    );
  }

  if (
    config.webhooks.deadRetentionDays < config.webhooks.deliveredRetentionDays
  ) {
    errors.push(
      'webhooks.deadRetentionDays should not be less than webhooks.deliveredRetentionDays'
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Retention configuration validation failed:\n${errors.join('\n')}`
    );
  }
}

/**
 * Set a nested value in an object using dot notation
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Get retention cutoff date for a given retention period
 */
export function getRetentionCutoff(retentionDays: number): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff;
}

/**
 * Check if a date is older than retention period
 */
export function isOlderThanRetention(
  date: Date,
  retentionDays: number
): boolean {
  const cutoff = getRetentionCutoff(retentionDays);
  return date < cutoff;
}
