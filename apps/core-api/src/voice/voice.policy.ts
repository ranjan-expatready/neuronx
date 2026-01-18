/**
 * Voice Policy Engine - REQ-001: Voice Orchestration Gating
 *
 * Authoritative voice policy enforcement with strict PAID → CaseOpen gating.
 * Voice actions are ONLY permitted for opportunities in CaseOpen state with verified PAID payments.
 */

import {
  VoiceActionRequest,
  VoicePolicyCheckResult,
  VoicePolicyReason,
  VoiceConfiguration,
  VoiceChannel,
} from './voice.types';

/**
 * Voice Policy Engine
 * Enforces voice authorization rules based on opportunity state and payment verification
 */
export class VoicePolicyEngine {
  /**
   * Evaluate voice action authorization
   * CRITICAL: Only allows voice actions for CaseOpen opportunities with verified PAID payments
   */
  async evaluateAuthorization(
    request: VoiceActionRequest,
    opportunityState: string,
    paymentVerified: boolean,
    voiceConfig: VoiceConfiguration | null,
    attemptCount: number = 0
  ): Promise<VoicePolicyCheckResult> {
    // Policy Rule 1: Voice must be enabled for tenant
    if (!voiceConfig?.enabled) {
      return {
        allowed: false,
        reason: 'denied_voice_disabled',
        context: { configurationIssue: 'voice_disabled_for_tenant' },
      };
    }

    // Policy Rule 2: Voice channel must be allowed
    if (!voiceConfig.allowedChannels.includes(request.channel)) {
      return {
        allowed: false,
        reason: 'denied_channel_not_allowed',
        context: {
          configurationIssue: `channel_${request.channel}_not_allowed`,
        },
      };
    }

    // Policy Rule 3: Check quiet hours
    if (this.isInQuietHours(voiceConfig)) {
      return {
        allowed: false,
        reason: 'denied_quiet_hours',
        context: { configurationIssue: 'within_quiet_hours' },
      };
    }

    // Policy Rule 4: Check maximum attempts per case
    if (attemptCount >= voiceConfig.maxAttemptsPerCase) {
      return {
        allowed: false,
        reason: 'denied_max_attempts_exceeded',
        context: {
          configurationIssue: `attempts_${attemptCount}_exceeds_limit_${voiceConfig.maxAttemptsPerCase}`,
        },
      };
    }

    // CRITICAL Policy Rule 5: Opportunity must be in CaseOpen state
    if (opportunityState !== 'case-open') {
      return {
        allowed: false,
        reason: 'denied_not_caseopen',
        context: {
          opportunityState,
          paymentStatus: paymentVerified ? 'verified' : 'not_verified',
        },
      };
    }

    // CRITICAL Policy Rule 6: Payment must be verified as PAID
    if (!paymentVerified) {
      return {
        allowed: false,
        reason: 'denied_payment_not_verified',
        context: {
          opportunityState,
          paymentStatus: 'not_verified',
        },
      };
    }

    // ✅ ALL policy rules passed - voice action authorized
    return {
      allowed: true,
      reason: 'authorized_caseopen_paid',
      context: {
        opportunityState,
        paymentStatus: 'verified',
      },
    };
  }

  /**
   * Check if current time is within tenant's quiet hours
   */
  private isInQuietHours(config: VoiceConfiguration): boolean {
    if (!config.quietHours.enabled) {
      return false;
    }

    // Get current time in tenant's timezone
    const now = new Date();
    const tenantTime = new Date(
      now.toLocaleString('en-US', {
        timeZone: config.quietHours.timezone,
      })
    );

    const currentHour = tenantTime.getHours();
    const startHour = config.quietHours.startHour;
    const endHour = config.quietHours.endHour;

    // Handle quiet hours that span midnight
    if (startHour <= endHour) {
      // Same day quiet hours (e.g., 22:00 to 08:00)
      return currentHour >= startHour && currentHour < endHour;
    } else {
      // Overnight quiet hours (e.g., 22:00 to 08:00 next day)
      return currentHour >= startHour || currentHour < endHour;
    }
  }
}

/**
 * Default voice configuration
 * Used when tenant configuration is not available or invalid
 */
export const DEFAULT_VOICE_CONFIG: VoiceConfiguration = {
  enabled: false, // Voice disabled by default for security
  allowedChannels: [],
  maxAttemptsPerCase: 0,
  quietHours: {
    enabled: true,
    startHour: 22, // 10 PM
    endHour: 8, // 8 AM
    timezone: 'America/New_York',
  },
  maxCallDurationMinutes: 30,
  retryPolicy: {
    maxRetries: 0,
    retryDelayMinutes: 60,
  },
};

/**
 * Create default voice configuration for a tenant
 * Provides secure defaults that disable voice until explicitly configured
 */
export function createDefaultVoiceConfig(): VoiceConfiguration {
  return { ...DEFAULT_VOICE_CONFIG };
}

/**
 * Validate voice configuration
 * Ensures configuration meets security and operational requirements
 */
export function validateVoiceConfiguration(config: VoiceConfiguration): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Configuration must be an object
  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be a valid object');
    return { valid: false, errors };
  }

  // Validate enabled flag
  if (typeof config.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  // Validate allowed channels
  if (!Array.isArray(config.allowedChannels)) {
    errors.push('allowedChannels must be an array');
  } else {
    const validChannels: VoiceChannel[] = ['inbound', 'outbound'];
    const invalidChannels = config.allowedChannels.filter(
      channel => !validChannels.includes(channel as any)
    );
    if (invalidChannels.length > 0) {
      errors.push(`Invalid channels: ${invalidChannels.join(', ')}`);
    }
  }

  // Validate max attempts
  if (
    typeof config.maxAttemptsPerCase !== 'number' ||
    config.maxAttemptsPerCase < 0
  ) {
    errors.push('maxAttemptsPerCase must be a non-negative number');
  }

  // Validate quiet hours
  if (config.quietHours) {
    if (typeof config.quietHours.enabled !== 'boolean') {
      errors.push('quietHours.enabled must be a boolean');
    }
    if (
      typeof config.quietHours.startHour !== 'number' ||
      config.quietHours.startHour < 0 ||
      config.quietHours.startHour > 23
    ) {
      errors.push('quietHours.startHour must be between 0 and 23');
    }
    if (
      typeof config.quietHours.endHour !== 'number' ||
      config.quietHours.endHour < 0 ||
      config.quietHours.endHour > 23
    ) {
      errors.push('quietHours.endHour must be between 0 and 23');
    }
    if (
      !config.quietHours.timezone ||
      typeof config.quietHours.timezone !== 'string'
    ) {
      errors.push('quietHours.timezone must be a valid string');
    }
  }

  // Validate max call duration
  if (
    typeof config.maxCallDurationMinutes !== 'number' ||
    config.maxCallDurationMinutes <= 0
  ) {
    errors.push('maxCallDurationMinutes must be a positive number');
  }

  // Validate retry policy
  if (config.retryPolicy) {
    if (
      typeof config.retryPolicy.maxRetries !== 'number' ||
      config.retryPolicy.maxRetries < 0
    ) {
      errors.push('retryPolicy.maxRetries must be a non-negative number');
    }
    if (
      typeof config.retryPolicy.retryDelayMinutes !== 'number' ||
      config.retryPolicy.retryDelayMinutes <= 0
    ) {
      errors.push('retryPolicy.retryDelayMinutes must be a positive number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Re-export types for convenience
export type {
  VoiceActionRequest,
  VoicePolicyCheckResult,
  VoicePolicyReason,
  VoiceConfiguration,
};
