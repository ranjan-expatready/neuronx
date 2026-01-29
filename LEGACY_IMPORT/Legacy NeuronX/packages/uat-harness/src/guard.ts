/**
 * UAT Guard Service - WI-066: UAT Harness + Seed + Safety
 *
 * Provides centralized UAT authorization and safety checks.
 * Used by all execution paths to prevent production corruption.
 */

import {
  UatConfig,
  UatContext,
  UatGuardResult,
  UatAuditEvent,
  UatExecutionMode,
} from './types';
import { getUatConfig } from './config';

/**
 * UAT Guard Service
 *
 * Central authority for all UAT-related safety checks.
 * Implements fail-closed behavior and comprehensive audit logging.
 */
export class UatGuardService {
  private readonly config: UatConfig;

  constructor(config?: UatConfig) {
    this.config = config || getUatConfig();
  }

  /**
   * Check if an operation is allowed in the current UAT context
   */
  checkOperationAllowed(context: UatContext): UatGuardResult {
    const { config, tenantId } = context;

    // Production environment - never allow UAT operations
    if (config.neuronxEnv === 'prod') {
      return {
        allowed: false,
        reason:
          'PRODUCTION SAFETY: UAT operations not allowed in production environment',
        mode: 'dry_run',
        killSwitchActive: true,
      };
    }

    // Development environment - allow with dry_run mode
    if (config.neuronxEnv === 'dev') {
      return {
        allowed: true,
        mode: 'dry_run',
        killSwitchActive: false,
      };
    }

    // UAT environment - strict tenant isolation required
    if (config.neuronxEnv === 'uat') {
      // Check tenant allowlist
      if (!config.uatTenantIds.includes(tenantId)) {
        return {
          allowed: false,
          reason: `UAT ISOLATION: Tenant ${tenantId} not in allowlist ${config.uatTenantIds.join(', ')}`,
          mode: 'dry_run',
          killSwitchActive: true,
        };
      }

      // Check kill switch
      if (config.uatKillSwitch) {
        return {
          allowed: true,
          mode: 'dry_run',
          killSwitchActive: true,
        };
      }

      // Kill switch disabled - allow live execution with warnings
      return {
        allowed: true,
        mode: config.uatMode,
        killSwitchActive: false,
      };
    }

    // Fallback - deny all
    return {
      allowed: false,
      reason: `UNKNOWN ENVIRONMENT: ${config.neuronxEnv}`,
      mode: 'dry_run',
      killSwitchActive: true,
    };
  }

  /**
   * Check if live external execution is allowed for a specific provider
   */
  checkProviderExecutionAllowed(
    context: UatContext,
    providerType: 'sms' | 'email' | 'calendar' | 'ghl',
    targetValue?: string
  ): { allowed: boolean; reason?: string } {
    const guardResult = this.checkOperationAllowed(context);

    // If basic operation not allowed, deny provider execution
    if (!guardResult.allowed) {
      return { allowed: false, reason: guardResult.reason };
    }

    // Dry run mode - never allow external calls
    if (guardResult.mode === 'dry_run') {
      return {
        allowed: false,
        reason: 'DRY_RUN MODE: External provider calls blocked',
      };
    }

    // Live UAT mode - check provider-specific allowlists
    return this.checkProviderAllowlist(providerType, targetValue);
  }

  /**
   * Check provider-specific allowlists
   */
  private checkProviderAllowlist(
    providerType: 'sms' | 'email' | 'calendar' | 'ghl',
    targetValue?: string
  ): { allowed: boolean; reason?: string } {
    const config = this.config;

    switch (providerType) {
      case 'sms':
        if (!targetValue) {
          return {
            allowed: false,
            reason: 'SMS requires phone number validation',
          };
        }
        if (config.uatTestPhoneAllowlist.length === 0) {
          return {
            allowed: false,
            reason: 'LIVE_UAT SMS: No test phone numbers configured',
          };
        }
        if (
          !config.uatTestPhoneAllowlist.some(phone =>
            targetValue.includes(phone)
          )
        ) {
          return {
            allowed: false,
            reason: `LIVE_UAT SMS: Phone ${targetValue} not in allowlist ${config.uatTestPhoneAllowlist.join(', ')}`,
          };
        }
        return { allowed: true };

      case 'email':
        if (!targetValue) {
          return { allowed: false, reason: 'EMAIL requires domain validation' };
        }
        const domain = targetValue.split('@')[1];
        if (!domain) {
          return { allowed: false, reason: 'EMAIL: Invalid email format' };
        }
        if (config.uatEmailDomainAllowlist.length === 0) {
          return {
            allowed: false,
            reason: 'LIVE_UAT EMAIL: No test domains configured',
          };
        }
        if (!config.uatEmailDomainAllowlist.includes(domain)) {
          return {
            allowed: false,
            reason: `LIVE_UAT EMAIL: Domain ${domain} not in allowlist ${config.uatEmailDomainAllowlist.join(', ')}`,
          };
        }
        return { allowed: true };

      case 'calendar':
        if (!targetValue) {
          return {
            allowed: false,
            reason: 'CALENDAR requires calendar ID validation',
          };
        }
        if (config.uatCalendarAllowlist.length === 0) {
          return {
            allowed: false,
            reason: 'LIVE_UAT CALENDAR: No test calendars configured',
          };
        }
        if (!config.uatCalendarAllowlist.includes(targetValue)) {
          return {
            allowed: false,
            reason: `LIVE_UAT CALENDAR: Calendar ${targetValue} not in allowlist ${config.uatCalendarAllowlist.join(', ')}`,
          };
        }
        return { allowed: true };

      case 'ghl':
        if (!targetValue) {
          return {
            allowed: false,
            reason: 'GHL requires location ID validation',
          };
        }
        if (config.uatGhlLocationIds.length === 0) {
          return {
            allowed: false,
            reason: 'LIVE_UAT GHL: No test locations configured',
          };
        }
        if (!config.uatGhlLocationIds.includes(targetValue)) {
          return {
            allowed: false,
            reason: `LIVE_UAT GHL: Location ${targetValue} not in allowlist ${config.uatGhlLocationIds.join(', ')}`,
          };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: `UNKNOWN PROVIDER: ${providerType}` };
    }
  }

  /**
   * Create audit event for UAT operations
   */
  createAuditEvent(
    eventType: UatAuditEvent['eventType'],
    context: UatContext,
    additionalDetails: Record<string, any> = {}
  ): UatAuditEvent {
    return {
      eventType,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      timestamp: context.timestamp,
      details: {
        ...additionalDetails,
        neuronxEnv: context.config.neuronxEnv,
        uatMode: context.config.uatMode,
        killSwitchActive: context.config.uatKillSwitch,
      },
    };
  }

  /**
   * Get current UAT status summary
   */
  getStatus(): {
    environment: string;
    mode: UatExecutionMode;
    killSwitch: boolean;
    allowedTenants: string[];
    providerAllowlists: Record<string, string[]>;
  } {
    return {
      environment: this.config.neuronxEnv,
      mode: this.config.uatMode,
      killSwitch: this.config.uatKillSwitch,
      allowedTenants: [...this.config.uatTenantIds],
      providerAllowlists: {
        sms: [...this.config.uatTestPhoneAllowlist],
        email: [...this.config.uatEmailDomainAllowlist],
        calendar: [...this.config.uatCalendarAllowlist],
        ghl: [...this.config.uatGhlLocationIds],
      },
    };
  }
}
