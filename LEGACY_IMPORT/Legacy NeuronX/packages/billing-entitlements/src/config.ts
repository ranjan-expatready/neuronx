/**
 * Billing Configuration - WI-040: Billing & Entitlements Authority
 *
 * Configuration management for billing and entitlements.
 */

import { EnforcementMode } from './types';

export interface BillingConfig {
  enforcementMode: EnforcementMode;
  defaultPlanTier: string;
  enableUsageTracking: boolean;
  enableAuditLogging: boolean;
  gracePeriodDays: number;
}

export class BillingConfigService {
  private config: BillingConfig;

  constructor(env: Record<string, string | undefined> = process.env) {
    this.config = {
      enforcementMode: this.parseEnforcementMode(
        env.BILLING_ENFORCEMENT_MODE || 'monitor_only'
      ),
      defaultPlanTier: env.BILLING_DEFAULT_PLAN_TIER || 'FREE',
      enableUsageTracking: env.BILLING_ENABLE_USAGE_TRACKING !== 'false',
      enableAuditLogging: env.BILLING_ENABLE_AUDIT_LOGGING !== 'false',
      gracePeriodDays: parseInt(env.BILLING_GRACE_PERIOD_DAYS || '7'),
    };
  }

  getConfig(): BillingConfig {
    return { ...this.config };
  }

  getEnforcementMode(): EnforcementMode {
    return this.config.enforcementMode;
  }

  isUsageTrackingEnabled(): boolean {
    return this.config.enableUsageTracking;
  }

  isAuditLoggingEnabled(): boolean {
    return this.config.enableAuditLogging;
  }

  getGracePeriodDays(): number {
    return this.config.gracePeriodDays;
  }

  private parseEnforcementMode(mode: string): EnforcementMode {
    switch (mode.toLowerCase()) {
      case 'monitor_only':
        return EnforcementMode.MONITOR_ONLY;
      case 'block':
        return EnforcementMode.BLOCK;
      case 'grace_period':
        return EnforcementMode.GRACE_PERIOD;
      default:
        console.warn(
          `Unknown billing enforcement mode: ${mode}, defaulting to monitor_only`
        );
        return EnforcementMode.MONITOR_ONLY;
    }
  }
}

// Global config instance
export const billingConfig = new BillingConfigService();
