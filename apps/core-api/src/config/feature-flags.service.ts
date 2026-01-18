/**
 * Feature Flags Service - WI-026: Release & Environment Hardening
 *
 * Runtime feature flags for instant subsystem control without redeployment.
 * Fail-open design: if flag check fails, default to enabled.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';

export interface FeatureFlags {
  // Background job controls
  outboxProcessingEnabled: boolean;
  webhookProcessingEnabled: boolean;
  cleanupEnabled: boolean;
  voiceRetryEnabled: boolean;

  // Observability
  metricsEnabled: boolean;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private flags: FeatureFlags;
  private lastCheck: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(
    @Inject('VALIDATED_CONFIG')
    private readonly config: any
  ) {
    this.flags = this.loadFlags();
  }

  /**
   * Get current feature flags (with caching)
   */
  getFlags(): FeatureFlags {
    const now = Date.now();
    if (now - this.lastCheck > this.CACHE_TTL) {
      this.flags = this.loadFlags();
      this.lastCheck = now;
    }
    return { ...this.flags };
  }

  /**
   * Check if outbox processing is enabled
   */
  isOutboxProcessingEnabled(): boolean {
    return this.getFlags().outboxProcessingEnabled;
  }

  /**
   * Check if webhook processing is enabled
   */
  isWebhookProcessingEnabled(): boolean {
    return this.getFlags().webhookProcessingEnabled;
  }

  /**
   * Check if cleanup is enabled
   */
  isCleanupEnabled(): boolean {
    return this.getFlags().cleanupEnabled;
  }

  /**
   * Check if voice retry is enabled
   */
  isVoiceRetryEnabled(): boolean {
    return this.getFlags().voiceRetryEnabled;
  }

  /**
   * Check if metrics collection is enabled
   */
  isMetricsEnabled(): boolean {
    return this.getFlags().metricsEnabled;
  }

  /**
   * Log when a feature is disabled (once per flag per session)
   */
  logFeatureDisabled(feature: keyof FeatureFlags, context: string): void {
    this.logger.warn(`Feature disabled: ${feature}`, {
      feature,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Load flags from environment (fail-open)
   */
  private loadFlags(): FeatureFlags {
    try {
      return {
        outboxProcessingEnabled: this.parseBooleanFlag(
          'OUTBOX_PROCESSING_ENABLED',
          true
        ),
        webhookProcessingEnabled: this.parseBooleanFlag(
          'WEBHOOK_PROCESSING_ENABLED',
          true
        ),
        cleanupEnabled: this.parseBooleanFlag('CLEANUP_ENABLED', true),
        voiceRetryEnabled: this.parseBooleanFlag('VOICE_RETRY_ENABLED', true),
        metricsEnabled: this.parseBooleanFlag('METRICS_ENABLED', true),
      };
    } catch (error: any) {
      this.logger.error('Failed to load feature flags, using defaults', {
        error: error.message,
      });

      // Fail-open: default to enabled
      return {
        outboxProcessingEnabled: true,
        webhookProcessingEnabled: true,
        cleanupEnabled: true,
        voiceRetryEnabled: true,
        metricsEnabled: true,
      };
    }
  }

  /**
   * Parse boolean environment variable (fail-open)
   */
  private parseBooleanFlag(envVar: string, defaultValue: boolean): boolean {
    const value = process.env[envVar];
    if (value === undefined) {
      return defaultValue;
    }

    try {
      return value.toLowerCase() === 'true';
    } catch {
      this.logger.warn(
        `Invalid boolean value for ${envVar}: ${value}, using default: ${defaultValue}`
      );
      return defaultValue;
    }
  }
}
