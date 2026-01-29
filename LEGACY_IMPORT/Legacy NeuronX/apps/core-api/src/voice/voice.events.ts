/**
 * Voice Events - REQ-001: Voice Intent Emission
 *
 * Voice event definitions for intent emission to external voice systems.
 * VoiceService emits intents ONLY - external systems handle actual voice execution.
 */

import {
  VoiceIntentEvent,
  VoiceIntentPayload,
  VoiceAuditEvent,
} from './voice.types';

/**
 * Voice event types
 * These are the only authorized voice events in the system
 */
export type VoiceEventType =
  | 'voice.intent.authorized' // ✅ Voice action authorized, ready for execution
  | 'voice.authorization.checked' // Audit: authorization decision made
  | 'voice.action.denied'; // Audit: voice action denied

/**
 * Voice Intent Event Emitter
 * Ensures consistent event structure for voice intent emission
 */
export class VoiceEventEmitter {
  /**
   * Emit voice intent authorized event
   * This is the ONLY event that signals voice action readiness for external execution
   */
  static emitVoiceIntentAuthorized(
    tenantId: string,
    opportunityId: string,
    actionType: VoiceIntentPayload['actionType'],
    channel: VoiceIntentPayload['channel'],
    configuration: VoiceIntentPayload['configuration'],
    correlationId: string
  ): VoiceIntentEvent {
    return {
      type: 'voice.intent.authorized',
      tenantId,
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      correlationId,
      payload: {
        opportunityId,
        actionType,
        channel,
        configuration,
        authorization: {
          authorizedAt: new Date().toISOString(),
          authorizedBy: 'voice-service',
          paymentVerified: true, // Only emitted when verified
          caseOpenVerified: true, // Only emitted when verified
        },
      },
    };
  }

  /**
   * Emit voice authorization checked event (audit)
   * Records all authorization decisions for compliance
   */
  static emitVoiceAuthorizationChecked(
    tenantId: string,
    opportunityId: string,
    actionType: VoiceIntentPayload['actionType'],
    result: VoiceAuditEvent['result'],
    correlationId: string
  ): VoiceAuditEvent {
    return {
      type: 'voice.authorization.checked',
      tenantId,
      opportunityId,
      actionType,
      result,
      timestamp: new Date().toISOString(),
      correlationId,
    };
  }

  /**
   * Emit voice action denied event (audit)
   * Records denial reasons for compliance and debugging
   */
  static emitVoiceActionDenied(
    tenantId: string,
    opportunityId: string,
    actionType: VoiceIntentPayload['actionType'],
    result: VoiceAuditEvent['result'],
    correlationId: string,
    metadata?: Record<string, unknown>
  ): VoiceAuditEvent {
    return {
      type: 'voice.action.denied',
      tenantId,
      opportunityId,
      actionType,
      result,
      timestamp: new Date().toISOString(),
      correlationId,
      metadata,
    };
  }
}

/**
 * Voice event validation helpers
 * Ensure events conform to security and business requirements
 */
export class VoiceEventValidator {
  /**
   * Validate voice intent event before emission
   * Ensures only authorized intents are emitted
   */
  static validateVoiceIntentEvent(event: VoiceIntentEvent): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Must be intent authorized event
    if (event.type !== 'voice.intent.authorized') {
      errors.push('Event must be voice.intent.authorized type');
    }

    // Must have tenant ID
    if (!event.tenantId || typeof event.tenantId !== 'string') {
      errors.push('Event must have valid tenantId');
    }

    // Must have opportunity ID
    if (
      !event.payload?.opportunityId ||
      typeof event.payload.opportunityId !== 'string'
    ) {
      errors.push('Event must have valid opportunityId in payload');
    }

    // Must have valid action type
    const validActionTypes = [
      'outbound_call',
      'inbound_response',
      'follow_up_call',
      'escalation_call',
    ];
    if (
      !event.payload?.actionType ||
      !validActionTypes.includes(event.payload.actionType)
    ) {
      errors.push('Event must have valid actionType in payload');
    }

    // Must have valid channel
    const validChannels = ['inbound', 'outbound'];
    if (
      !event.payload?.channel ||
      !validChannels.includes(event.payload.channel)
    ) {
      errors.push('Event must have valid channel in payload');
    }

    // Must have voice configuration
    if (
      !event.payload?.configuration ||
      typeof event.payload.configuration !== 'object'
    ) {
      errors.push('Event must have valid voice configuration in payload');
    }

    // Authorization must indicate verified payment and case-open
    const auth = event.payload?.authorization;
    if (!auth?.paymentVerified || !auth?.caseOpenVerified) {
      errors.push(
        'Event authorization must indicate verified payment and case-open status'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate voice audit event
   * Ensures audit events contain required information
   */
  static validateVoiceAuditEvent(event: VoiceAuditEvent): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Must be valid audit event type
    const validTypes = [
      'voice.authorization.checked',
      'voice.intent.emitted',
      'voice.action.denied',
    ];
    if (!event.type || !validTypes.includes(event.type)) {
      errors.push('Event must be valid voice audit event type');
    }

    // Must have tenant ID
    if (!event.tenantId || typeof event.tenantId !== 'string') {
      errors.push('Event must have valid tenantId');
    }

    // Must have opportunity ID
    if (!event.opportunityId || typeof event.opportunityId !== 'string') {
      errors.push('Event must have valid opportunityId');
    }

    // Must have valid action type
    const validActionTypes = [
      'outbound_call',
      'inbound_response',
      'follow_up_call',
      'escalation_call',
    ];
    if (!event.actionType || !validActionTypes.includes(event.actionType)) {
      errors.push('Event must have valid actionType');
    }

    // Must have result
    if (!event.result || typeof event.result !== 'object') {
      errors.push('Event must have valid result');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
