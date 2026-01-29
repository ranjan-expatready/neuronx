import { v4 as uuidv4 } from 'uuid';
import { VoicePolicyResolver } from './voice-policy.resolver';
import {
  VoiceOutcome,
  VoiceMode,
  VoiceActor,
  CallDirection,
  ScriptType,
} from './voice-outcome.enums';
import type { VoicePolicy } from './voice-policy.schema';
import type {
  VoiceSession,
  VoiceSessionRequest,
  VoiceModeSelection,
  VoiceOrchestrationContext,
  VoiceExecutionCommand,
  VoiceSessionEvent,
} from './voice-session.types';

/**
 * Voice Orchestration Engine
 * NeuronX-owned voice behavior with policy-driven governance
 */
export class VoiceOrchestrationEngine {
  private readonly policyResolver: VoicePolicyResolver;

  constructor(
    private readonly policy: VoicePolicy,
    private readonly policyVersion: string = '1.0.0'
  ) {
    this.policyResolver = new VoicePolicyResolver(policy);
  }

  /**
   * Select appropriate voice mode for a session request
   * Returns deterministic result based on policy + context
   */
  selectVoiceMode(request: VoiceSessionRequest): VoiceModeSelection {
    const {
      leadState,
      dealValue,
      riskLevel,
      timeOfDay,
      slaPressure,
      preferredMode,
    } = request;

    // Get base rule for the lead state
    const baseRule = this.policyResolver.getVoiceModeRule(leadState);
    if (!baseRule) {
      // No rule for this state - default to HUMAN_ONLY for safety
      return {
        selectedMode: VoiceMode.HUMAN_ONLY,
        reason: `No voice policy rule found for state: ${leadState}`,
        confidence: 0.5,
        allowedModes: [VoiceMode.HUMAN_ONLY],
        policyVersion: this.policyVersion,
        maxDurationMinutes: 5,
        requiredScripts: [],
        requiresChecklist: true,
      };
    }

    // Start with base allowed modes
    let allowedModes = [...baseRule.allowedModes];
    let reason = `Base policy for state: ${leadState}`;
    let confidence = 0.8;

    // Apply risk overrides
    const riskOverrides = this.policyResolver.applyRiskOverrides(leadState, {
      dealValue,
      timeOfDay,
      riskLevel,
      slaPressure,
    });

    if (riskOverrides.allowedModes.length > 0) {
      allowedModes = riskOverrides.allowedModes;
      if (riskOverrides.reason) {
        reason = riskOverrides.reason;
        confidence = 0.9;
      }
    }

    // Select final mode (preferred if allowed, otherwise default)
    let selectedMode = baseRule.defaultMode;

    if (preferredMode && allowedModes.includes(preferredMode)) {
      selectedMode = preferredMode;
      reason += ` (preferred mode selected)`;
      confidence = 0.95;
    }

    // Handle supervisor override requirements
    if (
      riskOverrides.requiresOverride &&
      selectedMode !== VoiceMode.HUMAN_ONLY
    ) {
      selectedMode = VoiceMode.HUMAN_ONLY;
      reason += ` (supervisor override required)`;
      confidence = 1.0;
    }

    return {
      selectedMode: selectedMode as VoiceMode,
      reason,
      confidence,
      allowedModes: allowedModes as VoiceMode[],
      policyVersion: this.policyVersion,
      maxDurationMinutes: baseRule.maxDurationMinutes,
      requiredScripts: baseRule.requiredScripts as ScriptType[],
      requiresChecklist: baseRule.requiresChecklist,
      riskFactors: riskLevel ? [riskLevel] : undefined,
      overrides: riskOverrides.reason ? [riskOverrides.reason] : undefined,
    };
  }

  /**
   * Create a new voice session
   */
  createVoiceSession(
    request: VoiceSessionRequest,
    phoneNumber: string,
    executionTokenId?: string
  ): { session: VoiceSession; executionCommand: VoiceExecutionCommand } {
    const modeSelection = this.selectVoiceMode(request);

    const sessionId = uuidv4();
    const now = new Date();

    const session: VoiceSession = {
      sessionId,
      tenantId: request.tenantId,
      leadId: request.leadId,
      opportunityId: request.opportunityId,
      stateAtCall: request.leadState,
      selectedVoiceMode: modeSelection.selectedMode,
      actor: this.getActorForMode(modeSelection.selectedMode),
      direction: CallDirection.OUTBOUND,
      startedAt: now,
      outcome: VoiceOutcome.CALL_COMPLETED, // Placeholder, updated when call ends
      checklistCompleted: false,
      policyVersion: this.policyVersion,
      enforcementMode: this.policy.enforcementMode,
      correlationId: request.correlationId,
      executionTokenId,
      billable: this.policyResolver.isEventBillable('ANSWERED_CALL'),
      complianceFlags: this.getComplianceFlags(),
    };

    const executionCommand: VoiceExecutionCommand = {
      type: 'initiate_voice_call',
      sessionId,
      tenantId: request.tenantId,
      leadId: request.leadId,
      phoneNumber,
      mode: modeSelection.selectedMode,
      maxDurationSeconds: modeSelection.maxDurationMinutes * 60,
      correlationId: request.correlationId,
      metadata: {
        modeSelection,
        policyVersion: this.policyVersion,
      },
    };

    return { session, executionCommand };
  }

  /**
   * Validate and process voice session outcome
   */
  processVoiceOutcome(
    session: VoiceSession,
    outcome: VoiceOutcome,
    metadata: {
      durationSeconds?: number;
      notes?: string;
      checklistCompleted?: boolean;
      qualityMetrics?: Record<string, number>;
      recordingUrl?: string;
    }
  ): {
    validatedSession: VoiceSession;
    events: VoiceSessionEvent[];
    violations: string[];
  } {
    const violations: string[] = [];
    const events: VoiceSessionEvent[] = [];

    // Validate outcome is allowed
    if (!this.policyResolver.isOutcomeAllowed(outcome)) {
      violations.push(`Outcome ${outcome} is not in allowed outcomes list`);
    }

    // Check for blocked outcomes
    if (this.policyResolver.isOutcomeBlocked(outcome)) {
      violations.push(`Outcome ${outcome} is explicitly blocked by policy`);
    }

    // Validate required fields
    const requiredFields = this.policyResolver.getRequiredOutcomeFields();
    const missingFields: string[] = [];

    if (requiredFields.includes('outcome') && !outcome) {
      missingFields.push('outcome');
    }
    if (
      requiredFields.includes('duration_seconds') &&
      !metadata.durationSeconds
    ) {
      missingFields.push('duration_seconds');
    }

    if (missingFields.length > 0) {
      violations.push(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Check checklist requirements
    const requiresChecklist = this.policyResolver.requiresChecklist(
      session.stateAtCall
    );
    if (requiresChecklist && metadata.checklistCompleted === false) {
      violations.push('Checklist completion required but not marked complete');
    }

    // Create session end event
    events.push({
      eventId: uuidv4(),
      sessionId: session.sessionId,
      tenantId: session.tenantId,
      eventType: 'session.completed',
      occurredAt: new Date(),
      data: {
        outcome,
        durationSeconds: metadata.durationSeconds,
        checklistCompleted: metadata.checklistCompleted,
        violations: violations.length > 0 ? violations : undefined,
      },
      correlationId: session.correlationId,
    });

    // Update session with final data
    const validatedSession: VoiceSession = {
      ...session,
      endedAt: new Date(),
      durationSeconds: metadata.durationSeconds,
      outcome,
      notes: metadata.notes,
      checklistCompleted: metadata.checklistCompleted,
      qualityMetrics: metadata.qualityMetrics,
      recordingUrl: metadata.recordingUrl,
    };

    return { validatedSession, events, violations };
  }

  /**
   * Check if a voice session request should be blocked
   */
  shouldBlockVoiceRequest(request: VoiceSessionRequest): {
    shouldBlock: boolean;
    reason?: string;
    violations: string[];
  } {
    const violations: string[] = [];

    // Check enforcement mode
    if (!this.policyResolver.shouldBlockOperations()) {
      return { shouldBlock: false, violations: [] };
    }

    // Check if state allows voice
    const allowedModes = this.policyResolver.getAllowedVoiceModes(
      request.leadState
    );
    if (allowedModes.length === 0) {
      violations.push(`No voice modes allowed for state: ${request.leadState}`);
    }

    // Check daily call limits (would need database lookup in real implementation)
    // For now, assume this check passes

    // Check cooldown periods (would need database lookup in real implementation)
    // For now, assume this check passes

    const shouldBlock = violations.length > 0;

    return {
      shouldBlock,
      reason: shouldBlock
        ? `Voice request blocked: ${violations.join(', ')}`
        : undefined,
      violations,
    };
  }

  /**
   * Get orchestration context for a session
   */
  getOrchestrationContext(
    sessionId: string,
    tenantId: string
  ): VoiceOrchestrationContext | null {
    // In a real implementation, this would fetch from database
    // For now, return a basic context
    return {
      tenantId,
      sessionId,
      leadId: 'placeholder', // Would be fetched from session
      modeSelection: {
        selectedMode: VoiceMode.ASSISTED,
        reason: 'Default context',
        confidence: 0.8,
        allowedModes: [VoiceMode.ASSISTED, VoiceMode.HUMAN_ONLY],
        policyVersion: this.policyVersion,
        maxDurationMinutes: 10,
        requiredScripts: [ScriptType.QUALIFICATION],
        requiresChecklist: true,
      },
      qualityThresholds: {
        CONFIDENCE_SCORE: this.policy.qualityThresholds.minConfidenceScore,
        SPEECH_CLARITY: this.policy.qualityThresholds.minSpeechClarity,
        BACKGROUND_NOISE: this.policy.qualityThresholds.maxBackgroundNoise,
        LATENCY: this.policy.qualityThresholds.maxLatencyMs,
        SCRIPT_ADHERENCE: 0.8, // Default script adherence threshold
      },
      enforcementMode: this.policy.enforcementMode,
      policyVersion: this.policyVersion,
    };
  }

  /**
   * Get policy resolver for direct access
   */
  getPolicyResolver(): VoicePolicyResolver {
    return this.policyResolver;
  }

  /**
   * Get current policy version
   */
  getPolicyVersion(): string {
    return this.policyVersion;
  }

  private getActorForMode(mode: VoiceMode): VoiceActor {
    switch (mode) {
      case VoiceMode.AUTONOMOUS:
        return VoiceActor.AI;
      case VoiceMode.ASSISTED:
        return VoiceActor.HUMAN; // AI assists, human speaks
      case VoiceMode.HUMAN_ONLY:
        return VoiceActor.HUMAN;
      default:
        return VoiceActor.HUMAN;
    }
  }

  private getComplianceFlags(): string[] {
    const flags: string[] = [];

    if (this.policyResolver.isRecordingRequired()) {
      flags.push('RECORDING_REQUIRED');
    }

    if (this.policy.complianceRules.piiMaskingEnabled) {
      flags.push('PII_MASKING_ENABLED');
    }

    return flags;
  }
}
