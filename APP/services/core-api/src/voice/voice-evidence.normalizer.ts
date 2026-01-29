/**
 * Voice Evidence Normalizer - WI-033: Voice Execution Adapter Hardening
 *
 * Normalizes Twilio callback data into canonical VoiceEvidence for playbook evaluation.
 * NO business logic - pure data transformation.
 */

import {
  TwilioStatusCallbackPayload,
  TwilioRecordingCallbackPayload,
  VoiceEvidenceEvent,
  CanonicalVoiceEvidence,
} from '@neuronx/voice-twilio';

/**
 * Voice evidence normalizer
 */
export class VoiceEvidenceNormalizer {
  /**
   * Normalize Twilio status callback into canonical evidence events
   */
  normalizeStatusCallback(
    payload: TwilioStatusCallbackPayload,
    tenantId?: string,
    correlationId?: string
  ): VoiceEvidenceEvent[] {
    const events: VoiceEvidenceEvent[] = [];
    const baseEvent = this.createBaseEvent(
      payload.CallSid,
      tenantId,
      correlationId
    );

    // Map Twilio call status to canonical evidence
    const evidenceType = this.mapCallStatusToEvidence(
      payload.CallStatus,
      payload
    );

    if (evidenceType) {
      const event: VoiceEvidenceEvent = {
        ...baseEvent,
        evidenceType,
        data: this.extractStatusData(payload),
        recordedAt: new Date(payload.Timestamp || Date.now()),
        callDurationSeconds: payload.CallDuration
          ? parseInt(payload.CallDuration)
          : undefined,
        confidence: this.calculateConfidence(payload),
        source: 'twilio_callback',
      };

      // Add additional metadata
      if (payload.AnsweredBy) {
        event.data.answeredBy = payload.AnsweredBy;
      }

      if (payload.Digits) {
        event.data.digitsPressed = payload.Digits;
      }

      if (payload.SpeechResult) {
        event.data.speechResult = payload.SpeechResult;
        event.data.speechConfidence = payload.Confidence;
      }

      events.push(event);
    }

    // Additional evidence for specific scenarios
    if (payload.CallStatus === 'completed' && payload.CallDuration) {
      const duration = parseInt(payload.CallDuration);
      if (duration > 0) {
        // Successful call completion
        events.push({
          ...baseEvent,
          evidenceType: CanonicalVoiceEvidence.CALL_CONNECTED,
          data: { duration },
          recordedAt: new Date(payload.Timestamp || Date.now()),
          callDurationSeconds: duration,
          confidence: 1.0,
          source: 'twilio_callback',
        });
      }
    }

    return events;
  }

  /**
   * Normalize Twilio recording callback into canonical evidence
   */
  normalizeRecordingCallback(
    payload: TwilioRecordingCallbackPayload,
    tenantId?: string,
    correlationId?: string
  ): VoiceEvidenceEvent {
    const baseEvent = this.createBaseEvent(
      payload.CallSid,
      tenantId,
      correlationId
    );

    return {
      ...baseEvent,
      evidenceType: CanonicalVoiceEvidence.RECORDING_AVAILABLE,
      data: {
        recordingSid: payload.RecordingSid,
        recordingUrl: payload.RecordingUrl,
        duration: payload.RecordingDuration,
        channels: payload.RecordingChannels,
        source: payload.RecordingSource,
      },
      recordedAt: new Date(payload.Timestamp || Date.now()),
      confidence: 1.0,
      source: 'twilio_callback',
    };
  }

  /**
   * Map Twilio call status to canonical voice evidence
   */
  private mapCallStatusToEvidence(
    callStatus: string,
    payload: TwilioStatusCallbackPayload
  ): CanonicalVoiceEvidence | null {
    switch (callStatus.toLowerCase()) {
      case 'initiated':
        return CanonicalVoiceEvidence.CALL_INITIATED;

      case 'ringing':
        return CanonicalVoiceEvidence.CALL_RINGING;

      case 'answered':
        // Check if answered by human vs machine
        if (payload.AnsweredBy === 'human') {
          return CanonicalVoiceEvidence.HUMAN_ANSWERED;
        } else if (payload.AnsweredBy === 'machine') {
          return CanonicalVoiceEvidence.VOICEMAIL_DETECTED;
        }
        return CanonicalVoiceEvidence.CALL_CONNECTED;

      case 'completed':
        // Check for voicemail detection
        if (payload.AnsweredBy === 'machine' && !payload.Digits) {
          return CanonicalVoiceEvidence.VOICEMAIL_LEFT;
        }
        return CanonicalVoiceEvidence.CALL_CONNECTED;

      case 'busy':
        return CanonicalVoiceEvidence.CALL_BUSY;

      case 'no-answer':
        return CanonicalVoiceEvidence.CALL_NO_ANSWER;

      case 'failed':
        return CanonicalVoiceEvidence.CALL_FAILED;

      case 'canceled':
        return CanonicalVoiceEvidence.CALL_CANCELED;

      default:
        return null;
    }
  }

  /**
   * Extract relevant data from status callback
   */
  private extractStatusData(
    payload: TwilioStatusCallbackPayload
  ): Record<string, any> {
    return {
      callSid: payload.CallSid,
      callStatus: payload.CallStatus,
      from: payload.From,
      to: payload.To,
      direction: payload.CallStatus === 'initiated' ? 'outbound' : 'inbound',
      duration: payload.CallDuration ? parseInt(payload.CallDuration) : 0,
      answeredBy: payload.AnsweredBy,
      timestamp: payload.Timestamp,
    };
  }

  /**
   * Calculate confidence score for evidence
   */
  private calculateConfidence(payload: TwilioStatusCallbackPayload): number {
    // Base confidence on call status reliability
    switch (payload.CallStatus.toLowerCase()) {
      case 'completed':
        return payload.CallDuration && parseInt(payload.CallDuration) > 0
          ? 1.0
          : 0.8;

      case 'answered':
        // Higher confidence if we know who answered
        return payload.AnsweredBy ? 0.95 : 0.8;

      case 'busy':
      case 'failed':
        return 0.9; // These are definitive failure states

      case 'no-answer':
        return 0.85; // Could be timing issue but generally reliable

      case 'initiated':
      case 'ringing':
        return 0.7; // These are intermediate states

      default:
        return 0.5; // Unknown status
    }
  }

  /**
   * Create base event structure
   */
  private createBaseEvent(
    callSid: string,
    tenantId?: string,
    correlationId?: string
  ): Omit<
    VoiceEvidenceEvent,
    | 'evidenceType'
    | 'data'
    | 'recordedAt'
    | 'callDurationSeconds'
    | 'confidence'
    | 'source'
  > {
    // Extract opportunity and playbook info from correlation ID or call metadata
    // In production, this would be stored in a mapping table
    const opportunityId = this.extractOpportunityId(callSid, correlationId);
    const playbookId = 'default-playbook'; // TODO: Extract from correlation data
    const stageId = 'current-stage'; // TODO: Extract from correlation data

    return {
      eventId: `voice_${callSid}_${Date.now()}`,
      tenantId,
      opportunityId,
      playbookId,
      stageId,
      actionId: `voice_action_${callSid}`,
      callSid,
      attemptNumber: 1, // TODO: Track attempts properly
      complianceChecked: true,
      safetyValidated: true,
      correlationId: correlationId || `voice_${callSid}`,
    };
  }

  /**
   * Extract opportunity ID from call SID or correlation data
   * In production, this would use a lookup table
   */
  private extractOpportunityId(
    callSid: string,
    correlationId?: string
  ): string {
    // TODO: Implement proper opportunity ID extraction
    // For now, return a placeholder
    return `opp_from_call_${callSid}`;
  }

  /**
   * Detect business-relevant outcomes from call data
   */
  detectBusinessOutcomes(
    payload: TwilioStatusCallbackPayload
  ): CanonicalVoiceEvidence[] {
    const outcomes: CanonicalVoiceEvidence[] = [];

    // Check for do-not-call request
    if (
      payload.SpeechResult?.toLowerCase().includes('do not call') ||
      payload.Digits === '9'
    ) {
      // Common DNC digit
      outcomes.push(CanonicalVoiceEvidence.DO_NOT_CALL_REQUESTED);
    }

    // Check for objection signals
    if (
      payload.SpeechResult?.toLowerCase().includes('not interested') ||
      payload.SpeechResult?.toLowerCase().includes('stop calling')
    ) {
      outcomes.push(CanonicalVoiceEvidence.OBJECTION_DETECTED);
    }

    // Check for qualification signals
    if (
      payload.SpeechResult?.toLowerCase().includes('interested') ||
      payload.SpeechResult?.toLowerCase().includes('tell me more')
    ) {
      outcomes.push(CanonicalVoiceEvidence.INTEREST_DETECTED);
    }

    // Check for successful qualification
    if (
      payload.SpeechResult?.toLowerCase().includes('qualified') ||
      payload.SpeechResult?.toLowerCase().includes('yes')
    ) {
      outcomes.push(CanonicalVoiceEvidence.QUALIFICATION_COMPLETE);
    }

    return outcomes;
  }

  /**
   * Create evidence event for business outcome
   */
  createBusinessOutcomeEvent(
    callSid: string,
    outcome: CanonicalVoiceEvidence,
    data: Record<string, any>,
    tenantId?: string,
    correlationId?: string
  ): VoiceEvidenceEvent {
    const baseEvent = this.createBaseEvent(callSid, tenantId, correlationId);

    return {
      ...baseEvent,
      evidenceType: outcome,
      data,
      recordedAt: new Date(),
      confidence: 0.8, // Business outcomes are interpretive
      source: 'ai_analysis',
    };
  }

  /**
   * Validate evidence event structure
   */
  validateEvidenceEvent(event: VoiceEvidenceEvent): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!event.eventId) errors.push('Event ID is required');
    if (!event.opportunityId) errors.push('Opportunity ID is required');
    if (!event.playbookId) errors.push('Playbook ID is required');
    if (!event.stageId) errors.push('Stage ID is required');
    if (!event.evidenceType) errors.push('Evidence type is required');
    if (!event.callSid) errors.push('Call SID is required');
    if (!event.correlationId) errors.push('Correlation ID is required');

    return { valid: errors.length === 0, errors };
  }
}
