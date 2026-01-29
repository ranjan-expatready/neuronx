/**
 * Voice Twilio Adapter Types - WI-033: Voice Execution Adapter Hardening
 *
 * Defines types for Twilio voice execution with NeuronX decision enforcement.
 */

import { ExecutionCommand } from '@neuronx/playbook-engine';
import { DecisionResult } from '@neuronx/decision-engine';

/**
 * Canonical voice evidence types - normalized from Twilio callbacks
 */
export enum CanonicalVoiceEvidence {
  // Call initiation states
  CALL_INITIATED = 'call_initiated',
  CALL_RINGING = 'call_ringing',

  // Call completion states
  CALL_CONNECTED = 'call_connected',
  HUMAN_ANSWERED = 'human_answered',
  VOICEMAIL_DETECTED = 'voicemail_detected',
  VOICEMAIL_LEFT = 'voicemail_left',

  // Call failure states
  CALL_FAILED = 'call_failed',
  CALL_BUSY = 'call_busy',
  CALL_NO_ANSWER = 'call_no_answer',
  CALL_CANCELED = 'call_canceled',

  // Business outcomes (normalized from conversation)
  QUALIFICATION_COMPLETE = 'qualification_complete',
  OBJECTION_DETECTED = 'objection_detected',
  INTEREST_DETECTED = 'interest_detected',
  DO_NOT_CALL_REQUESTED = 'do_not_call_requested',

  // Escalation signals
  ESCALATION_REQUIRED = 'escalation_required',
  SUPERVISOR_REQUESTED = 'supervisor_requested',

  // Technical events
  RECORDING_AVAILABLE = 'recording_available',
  TRANSCRIPT_AVAILABLE = 'transcript_available',

  // Safety events
  SAFETY_VIOLATION = 'safety_violation',
  COMPLIANCE_VIOLATION = 'compliance_violation',
}

/**
 * Voice execution context combining NeuronX decisions with execution details
 */
export interface VoiceExecutionContext {
  executionCommand: ExecutionCommand;
  decisionResult: DecisionResult;
  tenantId?: string;
  correlationId: string;

  // Additional context for voice execution
  attemptNumber: number;
  maxRetries: number;
  previousOutcomes?: CanonicalVoiceEvidence[];
}

/**
 * Twilio API call request
 */
export interface TwilioCallRequest {
  to: string;
  from: string;
  url?: string; // TwiML URL for dynamic content
  twiml?: string; // Inline TwiML
  statusCallback?: string;
  statusCallbackEvent?: string[];
  statusCallbackMethod?: 'POST' | 'GET';
  timeout?: number;
  record?: boolean;
  recordingChannels?: 'mono' | 'dual';
  recordingStatusCallback?: string;
  recordingStatusCallbackMethod?: 'POST' | 'GET';
  machineDetection?: string;
  machineDetectionTimeout?: number;
  machineDetectionSpeechThreshold?: number;
  machineDetectionSpeechEndThreshold?: number;
  machineDetectionSilenceTimeout?: number;
}

/**
 * Twilio call response
 */
export interface TwilioCallResponse {
  sid: string;
  status: string;
  to: string;
  from: string;
  direction: string;
  apiVersion: string;
  price?: string;
  priceUnit?: string;
  dateCreated: string;
  dateUpdated: string;
  uri: string;
  subresourceUris: Record<string, string>;
}

/**
 * Twilio status callback payload
 */
export interface TwilioStatusCallbackPayload {
  CallSid: string;
  CallStatus: string;
  CallDuration?: string;
  RecordingUrl?: string;
  RecordingSid?: string;
  RecordingDuration?: string;
  Digits?: string; // For gather input
  SpeechResult?: string; // For speech recognition
  Confidence?: string; // For speech recognition confidence
  AnsweredBy?: string; // human, machine
  Timestamp: string;
  AccountSid: string;
  From: string;
  To: string;
  CallToken?: string;
  StirVerstat?: string; // STIR/SHAKEN verification status
  // Custom parameters can be added via TwiML
  [key: string]: any;
}

/**
 * Twilio recording callback payload
 */
export interface TwilioRecordingCallbackPayload {
  RecordingSid: string;
  RecordingUrl: string;
  RecordingStatus: string;
  RecordingDuration: string;
  RecordingChannels: string;
  RecordingSource: string;
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Timestamp: string;
}

/**
 * Normalized voice evidence event
 */
export interface VoiceEvidenceEvent {
  eventId: string;
  tenantId?: string;
  opportunityId: string;
  playbookId: string;
  stageId: string;
  actionId: string;

  evidenceType: CanonicalVoiceEvidence;
  callSid: string;
  attemptNumber: number;

  // Evidence data
  data: Record<string, any>;

  // Quality metrics
  confidence?: number; // 0-1, how confident we are in this evidence
  source: 'twilio_callback' | 'ai_analysis' | 'human_input' | 'system';

  // Timing
  recordedAt: Date;
  callDurationSeconds?: number;

  // Compliance and safety
  complianceChecked: boolean;
  safetyValidated: boolean;

  // Correlation
  correlationId: string;
  parentCorrelationId?: string; // Links to original execution
}

/**
 * Voice execution receipt (returned when call is initiated)
 */
export interface VoiceExecutionReceipt {
  receiptId: string;
  callSid: string;
  status: 'initiated' | 'rejected' | 'failed';
  reason?: string;

  // What was executed
  executionCommand: ExecutionCommand;
  decisionResult: DecisionResult;

  // Evidence of enforcement
  enforcement: {
    voiceModeEnforced: boolean;
    actorEnforced: boolean;
    safetyChecksPassed: boolean;
    complianceChecksPassed: boolean;
  };

  // Timing
  initiatedAt: Date;
  correlationId: string;
}

/**
 * Voice execution result (from callback processing)
 */
export interface VoiceExecutionResult {
  resultId: string;
  callSid: string;
  status: 'completed' | 'failed' | 'hung_up' | 'timeout';

  // Evidence produced
  evidenceEvents: VoiceEvidenceEvent[];

  // Final outcomes
  finalEvidence: CanonicalVoiceEvidence;
  callDurationSeconds?: number;

  // Quality assessment
  qualityScore?: number; // 0-100
  complianceIssues: string[];

  // Next actions (recommendations, not decisions)
  recommendations: {
    shouldRetry: boolean;
    retryReason?: string;
    shouldEscalate: boolean;
    escalationReason?: string;
    nextAction?: string;
  };

  // Correlation
  correlationId: string;
  completedAt: Date;
}

/**
 * Voice safety violation event
 */
export interface VoiceSafetyViolation {
  violationId: string;
  callSid: string;
  violationType:
    | 'voice_mode_breach'
    | 'actor_breach'
    | 'safety_breach'
    | 'compliance_breach';
  description: string;

  // Context
  executionContext: VoiceExecutionContext;
  attemptedAction: string;

  // Impact assessment
  severity: 'low' | 'medium' | 'high' | 'critical';
  blockedAction: boolean;

  // Audit
  detectedAt: Date;
  correlationId: string;
}

/**
 * Voice configuration
 */
export interface VoiceConfiguration {
  enabled: boolean;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;

  // Safety settings
  maxCallDurationSeconds: number;
  defaultTimeoutSeconds: number;
  machineDetectionEnabled: boolean;

  // Recording settings
  recordingEnabled: boolean;
  recordingChannels: 'mono' | 'dual';

  // Callback settings
  statusCallbackUrl?: string;
  recordingCallbackUrl?: string;

  // Feature flags
  scriptedModeEnabled: boolean;
  conversationalModeEnabled: boolean;
  humanAssistEnabled: boolean;

  // Token enforcement (WI-034)
  tokensEnabled: boolean;
}

/**
 * Voice execution adapter interface
 */
export interface VoiceExecutionAdapter {
  /**
   * Execute a voice command with decision enforcement
   */
  executeVoiceCommand(
    context: VoiceExecutionContext
  ): Promise<VoiceExecutionReceipt>;

  /**
   * Process Twilio status callback
   */
  processStatusCallback(
    payload: TwilioStatusCallbackPayload
  ): Promise<VoiceExecutionResult>;

  /**
   * Process Twilio recording callback
   */
  processRecordingCallback(
    payload: TwilioRecordingCallbackPayload
  ): Promise<void>;

  /**
   * Validate configuration
   */
  validateConfiguration(config: VoiceConfiguration): {
    valid: boolean;
    errors: string[];
  };

  /**
   * Get adapter capabilities
   */
  getCapabilities(): {
    supportsScripted: boolean;
    supportsConversational: boolean;
    supportsRecording: boolean;
    supportsMachineDetection: boolean;
  };
}
