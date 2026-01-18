/**
 * Voice Control Plane Types - REQ-001: Voice Orchestration Gating
 *
 * Types for voice interaction orchestration with strict PAID → CaseOpen gating.
 * Voice actions are ONLY allowed for verified paid opportunities in CaseOpen state.
 */

export type VoiceChannel = 'inbound' | 'outbound';

export type VoiceActionType =
  | 'outbound_call' // Initiate outbound voice call
  | 'inbound_response' // Respond to inbound voice call
  | 'follow_up_call' // Follow-up voice communication
  | 'escalation_call'; // Escalation voice communication

/**
 * Voice action request
 * Represents a request to perform a voice action on an opportunity
 */
export interface VoiceActionRequest {
  /** Tenant identifier */
  tenantId: string;

  /** Opportunity identifier */
  opportunityId: string;

  /** Type of voice action requested */
  actionType: VoiceActionType;

  /** Voice channel (inbound/outbound) */
  channel: VoiceChannel;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Voice action result
 * Result of voice action authorization check
 */
export interface VoiceActionResult {
  /** Whether voice action is authorized */
  authorized: boolean;

  /** Reason for authorization decision */
  reason: string;

  /** Opportunity state information */
  opportunityState?: {
    currentState: string;
    isCaseOpen: boolean;
    paymentVerified: boolean;
  };

  /** Voice configuration for tenant */
  voiceConfig?: VoiceConfiguration;

  /** Authorization timestamp */
  timestamp: string;
}

/**
 * Voice configuration per tenant
 * Configuration-driven voice behavior (no business logic)
 */
export interface VoiceConfiguration {
  /** Whether voice is enabled for this tenant */
  enabled: boolean;

  /** Allowed voice channels */
  allowedChannels: VoiceChannel[];

  /** Maximum voice attempts per case */
  maxAttemptsPerCase: number;

  /** Quiet hours (calls not allowed during these hours) */
  quietHours: {
    enabled: boolean;
    startHour: number; // 0-23
    endHour: number; // 0-23
    timezone: string; // IANA timezone identifier
  };

  /** Maximum call duration in minutes */
  maxCallDurationMinutes: number;

  /** Retry configuration */
  retryPolicy: {
    maxRetries: number;
    retryDelayMinutes: number;
  };
}

/**
 * Voice intent event
 * Event emitted when voice action is authorized and ready for execution
 * External voice systems consume this event to perform actual voice operations
 */
export interface VoiceIntentEvent {
  /** Event type identifier */
  type: 'voice.intent.authorized';

  /** Tenant identifier */
  tenantId: string;

  /** Unique event identifier */
  eventId: string;

  /** Event timestamp */
  timestamp: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Voice intent payload */
  payload: VoiceIntentPayload;
}

/**
 * Voice intent payload
 * Contains all information needed for external voice system execution
 */
export interface VoiceIntentPayload {
  /** Opportunity identifier */
  opportunityId: string;

  /** Voice action type */
  actionType: VoiceActionType;

  /** Voice channel */
  channel: VoiceChannel;

  /** Voice configuration for execution */
  configuration: VoiceConfiguration;

  /** Authorization context */
  authorization: {
    authorizedAt: string;
    authorizedBy: 'voice-service';
    paymentVerified: boolean;
    caseOpenVerified: boolean;
  };

  /** Execution metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Voice policy check result
 * Internal result of policy evaluation
 */
export interface VoicePolicyCheckResult {
  /** Whether action is allowed */
  allowed: boolean;

  /** Specific reason for policy decision */
  reason: VoicePolicyReason;

  /** Additional context */
  context?: {
    opportunityState?: string;
    paymentStatus?: string;
    configurationIssue?: string;
  };
}

/**
 * Voice policy reason codes
 * Specific reasons why voice action was allowed or denied
 */
export type VoicePolicyReason =
  | 'authorized_caseopen_paid' // ✅ Allowed: CaseOpen with verified payment
  | 'denied_not_caseopen' // ❌ Denied: Opportunity not in CaseOpen state
  | 'denied_payment_not_verified' // ❌ Denied: Payment not verified as PAID
  | 'denied_voice_disabled' // ❌ Denied: Voice disabled for tenant
  | 'denied_channel_not_allowed' // ❌ Denied: Voice channel not allowed
  | 'denied_quiet_hours' // ❌ Denied: Within quiet hours
  | 'denied_max_attempts_exceeded' // ❌ Denied: Too many voice attempts
  | 'denied_configuration_error' // ❌ Denied: Configuration error
  | 'denied_system_error'; // ❌ Denied: System error

/**
 * Voice audit event
 * Audit trail for all voice authorization decisions
 */
export interface VoiceAuditEvent {
  /** Event type */
  type:
    | 'voice.authorization.checked'
    | 'voice.intent.emitted'
    | 'voice.action.denied';

  /** Tenant identifier */
  tenantId: string;

  /** Opportunity identifier */
  opportunityId: string;

  /** Voice action type */
  actionType: VoiceActionType;

  /** Authorization result */
  result: VoiceActionResult;

  /** Timestamp */
  timestamp: string;

  /** Correlation ID */
  correlationId: string;

  /** Additional audit data */
  metadata?: Record<string, unknown>;
}
