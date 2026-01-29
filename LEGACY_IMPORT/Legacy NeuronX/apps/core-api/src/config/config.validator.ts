/**
 * Configuration Validator - WI-026: Release & Environment Hardening
 *
 * Boot-time validation that fails fast on configuration errors.
 * Provides clear, actionable error messages for deployment issues.
 */

import {
  EnvironmentConfig,
  CONFIG_VALIDATION_RULES,
  CROSS_VALIDATION_RULES,
} from './config.schema';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  configSummary: Record<string, any>; // Sanitized config summary
}

export class ConfigValidator {
  /**
   * Validate configuration object
   */
  async validateOrThrow(
    config: any,
    context: { tenantId: string }
  ): Promise<void> {
    if (!config) {
      throw new Error('Configuration is required');
    }
    // TODO: Implement comprehensive configuration validation
  }

  /**
   * Validate all configuration at boot time
   * Throws error if validation fails (fail-fast)
   */
  static validateBootConfig(): EnvironmentConfig {
    const result = this.validateConfig();

    if (!result.isValid) {
      console.error('❌ Configuration validation failed:');
      result.errors.forEach(error => console.error(`   - ${error}`));

      console.error(
        '\n🔧 Fix the configuration issues above and restart the application.'
      );
      process.exit(1);
    }

    // Log sanitized config summary
    console.log('✅ Configuration validation passed');
    console.log('📋 Configuration Summary:');
    Object.entries(result.configSummary).forEach(([section, values]) => {
      console.log(`   ${section}:`, values);
    });
    console.log('');

    return this.buildConfig();
  }

  /**
   * Validate configuration without exiting (for testing/CI)
   */
  static validateConfig(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const configSummary: Record<string, any> = {};

    // Validate each section
    for (const [section, rules] of Object.entries(CONFIG_VALIDATION_RULES)) {
      const sectionConfig: Record<string, any> = {};

      for (const rule of rules) {
        const value = process.env[rule.envVar] || rule.defaultValue;
        const error = rule.validator(value);

        if (error) {
          if (rule.required) {
            errors.push(`${rule.envVar}: ${error}`);
          } else {
            warnings.push(
              `${rule.envVar}: ${error} (using default: ${rule.defaultValue})`
            );
          }
        } else if (value !== undefined) {
          // Add to summary (but not sensitive values)
          if (!rule.sensitive) {
            sectionConfig[rule.envVar] = value;
          } else {
            sectionConfig[rule.envVar] = '[REDACTED]';
          }
        }
      }

      if (Object.keys(sectionConfig).length > 0) {
        configSummary[section] = sectionConfig;
      }
    }

    // Cross-validation rules
    const partialConfig = this.buildConfig();
    for (const crossRule of CROSS_VALIDATION_RULES) {
      const error = crossRule.validator(partialConfig);
      if (error) {
        errors.push(`${crossRule.name}: ${error}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      configSummary,
    };
  }

  /**
   * Build validated configuration object
   */
  private static buildConfig(): EnvironmentConfig {
    const parseBoolean = (
      value: string | undefined,
      defaultValue = false
    ): boolean => {
      if (value === undefined) return defaultValue;
      return value.toLowerCase() === 'true';
    };

    const parseNumber = (
      value: string | undefined,
      defaultValue: number
    ): number => {
      if (value === undefined) return defaultValue;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    return {
      database: {
        url: process.env.DATABASE_URL!,
      },

      secrets: {
        provider: (process.env.SECRETS_PROVIDER as any) || 'env',
        masterKey: process.env.SECRETS_MASTER_KEY,
      },

      storage: {
        provider: (process.env.STORAGE_PROVIDER as any) || 'local',
        localPath: process.env.STORAGE_LOCAL_PATH,
        s3Bucket: process.env.STORAGE_S3_BUCKET,
        s3Region: process.env.STORAGE_S3_REGION,
      },

      redis: process.env.REDIS_URL
        ? {
            url: process.env.REDIS_URL,
          }
        : undefined,

      webhooks: {
        processingEnabled: parseBoolean(
          process.env.WEBHOOK_PROCESSING_ENABLED,
          true
        ),
      },

      outbox: {
        processingEnabled: parseBoolean(
          process.env.OUTBOX_PROCESSING_ENABLED,
          true
        ),
      },

      cleanup: {
        enabled: parseBoolean(process.env.CLEANUP_ENABLED, true),
        retentionDays: {
          outboxPublished: parseNumber(
            process.env.OUTBOX_RETENTION_DAYS_PUBLISHED,
            7
          ),
          outboxDead: parseNumber(process.env.OUTBOX_RETENTION_DAYS_DEAD, 30),
          webhooksDelivered: parseNumber(
            process.env.WEBHOOK_RETENTION_DAYS_DELIVERED,
            14
          ),
          webhooksDead: parseNumber(
            process.env.WEBHOOK_RETENTION_DAYS_DEAD,
            30
          ),
          audit: parseNumber(process.env.AUDIT_RETENTION_DAYS, 90),
          artifactsExpiredGrace: parseNumber(
            process.env.ARTIFACT_EXPIRED_DELETE_GRACE_DAYS,
            7
          ),
          artifactsSoftDelete: parseNumber(
            process.env.ARTIFACT_SOFT_DELETE_RETENTION_DAYS,
            30
          ),
          usageRaw: parseNumber(process.env.USAGE_RAW_EVENT_RETENTION_DAYS, 30),
          usageAggregate: parseNumber(
            process.env.USAGE_AGGREGATE_RETENTION_DAYS,
            365
          ),
        },
        batchSize: parseNumber(process.env.CLEANUP_BATCH_SIZE, 1000),
        lockTimeoutSeconds: parseNumber(
          process.env.CLEANUP_LOCK_TIMEOUT_SECONDS,
          300
        ),
        maxRuntimeMinutes: parseNumber(
          process.env.CLEANUP_MAX_RUNTIME_MINUTES,
          30
        ),
      },

      voice: {
        retryEnabled: parseBoolean(process.env.VOICE_RETRY_ENABLED, true),
      },

      metrics: {
        enabled: parseBoolean(process.env.METRICS_ENABLED, true),
      },

      app: {
        port: parseNumber(process.env.PORT, 3000),
        env: (process.env.NODE_ENV as any) || 'development',
      },
    };
  }
}
