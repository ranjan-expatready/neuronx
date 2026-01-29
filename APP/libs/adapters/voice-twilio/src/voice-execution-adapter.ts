/**
 * Voice Execution Adapter - WI-033: Voice Execution Adapter Hardening
 *
 * Enforces NeuronX decisions before executing voice calls.
 * NO decisions made here - only enforcement of existing decisions.
 */

import {
  VoiceExecutionAdapter,
  VoiceExecutionContext,
  VoiceExecutionReceipt,
  VoiceConfiguration,
  TwilioCallRequest,
  CanonicalVoiceEvidence,
  VoiceSafetyViolation,
} from './types';
import { TwilioClient } from './twilio.client';
import { ActorType, VoiceMode } from '@neuronx/decision-engine';

/**
 * Voice execution adapter with NeuronX decision enforcement
 */
export class TwilioVoiceExecutionAdapter implements VoiceExecutionAdapter {
  private twilioClient: TwilioClient;
  private config: VoiceConfiguration;
  private safetyViolations: VoiceSafetyViolation[] = [];

  // Token verification service (injected)
  private tokenVerifier?: {
    verifyToken: (tokenId: string, scope: any) => Promise<any>;
    markTokenUsed: (tokenId: string, usedBy: string) => Promise<void>;
  };

  constructor(config: VoiceConfiguration, tokenVerifier?: any) {
    this.config = config;
    this.twilioClient = new TwilioClient(config);
    this.tokenVerifier = tokenVerifier;
  }

  /**
   * Execute voice command with decision enforcement
   * Accepts optional execution token for side-effect authorization
   */
  async executeVoiceCommand(
    context: VoiceExecutionContext,
    tokenId?: string
  ): Promise<VoiceExecutionReceipt> {
    const { executionCommand, decisionResult, correlationId } = context;

    // Hard gate: Check execution token if tokens are enabled
    if (this.tokenVerifier && this.config.tokensEnabled) {
      if (!tokenId) {
        await this.recordSafetyViolation(
          context,
          'token_missing',
          'Execution token required but not provided'
        );
        return this.createRejectedReceipt(context, 'Execution token required');
      }

      // Verify token scope and validity
      const tokenVerification = await this.tokenVerifier.verifyToken(tokenId, {
        channel: 'voice',
        commandType: executionCommand.commandType,
      });

      if (!tokenVerification.canUse) {
        await this.recordSafetyViolation(
          context,
          'token_invalid',
          `Token verification failed: ${tokenVerification.reason}`
        );
        return this.createRejectedReceipt(context, tokenVerification.reason);
      }
    }

    // Hard gate: Check if decision allows execution
    if (!decisionResult.allowed) {
      await this.recordSafetyViolation(
        context,
        'decision_denied',
        'DecisionResult.allowed is false'
      );
      return this.createRejectedReceipt(context, 'Decision not allowed');
    }

    // Hard gate: Check voice mode enforcement
    const voiceModeCheck = this.enforceVoiceMode(context);
    if (!voiceModeCheck.allowed) {
      await this.recordSafetyViolation(
        context,
        'voice_mode_breach',
        voiceModeCheck.reason
      );
      return this.createRejectedReceipt(context, voiceModeCheck.reason);
    }

    // Hard gate: Check actor enforcement
    const actorCheck = this.enforceActor(context);
    if (!actorCheck.allowed) {
      await this.recordSafetyViolation(
        context,
        'actor_breach',
        actorCheck.reason
      );
      return this.createRejectedReceipt(context, actorCheck.reason);
    }

    // Hard gate: Check feature flag
    if (!this.config.enabled) {
      return this.createRejectedReceipt(
        context,
        'Voice execution disabled by feature flag'
      );
    }

    // All gates passed - execute the call
    try {
      const twilioRequest = this.buildTwilioRequest(context);
      const twilioResponse = await this.twilioClient.createCall(twilioRequest);

      // Mark token as used if provided
      if (tokenId && this.tokenVerifier) {
        await this.tokenVerifier.markTokenUsed(tokenId, 'voice_adapter');
      }

      return {
        receiptId: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        callSid: twilioResponse.sid,
        status: 'initiated',
        executionCommand,
        decisionResult,
        enforcement: {
          voiceModeEnforced: true,
          actorEnforced: true,
          safetyChecksPassed: true,
          complianceChecksPassed: true,
          tokenVerified: !!tokenId,
        },
        initiatedAt: new Date(),
        correlationId,
      };
    } catch (error) {
      console.error('Twilio call creation failed:', error);
      return {
        receiptId: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        callSid: '',
        status: 'failed',
        reason: error instanceof Error ? error.message : 'Unknown error',
        executionCommand,
        decisionResult,
        enforcement: {
          voiceModeEnforced: true,
          actorEnforced: true,
          safetyChecksPassed: true,
          complianceChecksPassed: false,
        },
        initiatedAt: new Date(),
        correlationId,
      };
    }
  }

  /**
   * Enforce voice mode restrictions
   */
  private enforceVoiceMode(context: VoiceExecutionContext): {
    allowed: boolean;
    reason: string;
  } {
    const { decisionResult, executionCommand } = context;

    // If no voice mode specified, default to human-only for safety
    const voiceMode = decisionResult.voiceMode || VoiceMode.HUMAN_ONLY;

    switch (voiceMode) {
      case VoiceMode.HUMAN_ONLY:
        // Only human execution allowed
        return {
          allowed: false,
          reason: 'Voice mode HUMAN_ONLY - AI voice blocked',
        };

      case VoiceMode.SCRIPTED:
        // Only scripted content allowed
        if (executionCommand.scriptId) {
          return { allowed: true, reason: 'Scripted mode approved' };
        } else {
          return { allowed: false, reason: 'Scripted mode requires scriptId' };
        }

      case VoiceMode.CONVERSATIONAL:
        // Conversational AI allowed (but we don't implement it yet)
        if (this.config.conversationalModeEnabled) {
          return { allowed: true, reason: 'Conversational mode approved' };
        } else {
          return { allowed: false, reason: 'Conversational mode not enabled' };
        }

      case VoiceMode.AI_ASSIST_HUMAN:
        // Human with AI assistance
        if (this.config.humanAssistEnabled) {
          return {
            allowed: false,
            reason: 'AI assist requires human execution',
          };
        } else {
          return { allowed: false, reason: 'AI assist mode not enabled' };
        }

      default:
        return { allowed: false, reason: `Unknown voice mode: ${voiceMode}` };
    }
  }

  /**
   * Enforce actor restrictions
   */
  private enforceActor(context: VoiceExecutionContext): {
    allowed: boolean;
    reason: string;
  } {
    const { decisionResult, executionCommand } = context;
    const actor = decisionResult.actor;

    switch (actor) {
      case ActorType.AI:
        // AI execution - check if voice is allowed
        if (decisionResult.voiceMode === VoiceMode.HUMAN_ONLY) {
          return {
            allowed: false,
            reason: 'AI actor not allowed in HUMAN_ONLY mode',
          };
        }
        return { allowed: true, reason: 'AI actor approved' };

      case ActorType.HUMAN:
        // Human execution - always allowed but requires work queue item
        return {
          allowed: false,
          reason: 'HUMAN actor requires approval workflow',
        };

      case ActorType.HYBRID:
        // Hybrid execution
        if (this.config.humanAssistEnabled) {
          return {
            allowed: false,
            reason: 'HYBRID actor requires human approval',
          };
        } else {
          return { allowed: false, reason: 'HYBRID mode not enabled' };
        }

      default:
        return { allowed: false, reason: `Unknown actor: ${actor}` };
    }
  }

  /**
   * Build Twilio call request from execution context
   */
  private buildTwilioRequest(
    context: VoiceExecutionContext
  ): TwilioCallRequest {
    const { executionCommand, correlationId } = context;

    if (!this.config.twilioFromNumber) {
      throw new Error('Twilio from number not configured');
    }

    // Find contact information
    const contactData = executionCommand.contactData;
    if (!contactData?.phone) {
      throw new Error('Contact phone number required for voice call');
    }

    const request: TwilioCallRequest = {
      to: contactData.phone,
      from: this.config.twilioFromNumber,
      timeout: this.config.defaultTimeoutSeconds || 30,
      record: this.config.recordingEnabled,
      statusCallback: this.config.statusCallbackUrl,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    };

    // Add recording callback if enabled
    if (this.config.recordingEnabled && this.config.recordingCallbackUrl) {
      request.recordingStatusCallback = this.config.recordingCallbackUrl;
      request.recordingStatusCallbackMethod = 'POST';
      request.recordingChannels = this.config.recordingChannels;
    }

    // Add machine detection if enabled
    if (this.config.machineDetectionEnabled) {
      request.machineDetection = 'DetectMessageEnd';
      request.machineDetectionTimeout = 30;
      request.machineDetectionSpeechThreshold = 2400;
      request.machineDetectionSpeechEndThreshold = 1200;
      request.machineDetectionSilenceTimeout = 5000;
    }

    // For now, use a simple TwiML URL - in production this would be dynamic
    // based on the script and voice mode
    request.url = `${process.env.NEXT_PUBLIC_API_URL}/voice/twiml/${executionCommand.commandId}`;

    return request;
  }

  /**
   * Record safety violation
   */
  private async recordSafetyViolation(
    context: VoiceExecutionContext,
    violationType: VoiceSafetyViolation['violationType'],
    description: string
  ): Promise<void> {
    const violation: VoiceSafetyViolation = {
      violationId: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      callSid: '', // No call SID yet since call wasn't made
      violationType,
      description,
      executionContext: context,
      attemptedAction: 'voice_call_execution',
      severity: violationType.includes('breach') ? 'high' : 'medium',
      blockedAction: true,
      detectedAt: new Date(),
      correlationId: context.correlationId,
    };

    this.safetyViolations.push(violation);

    // In production, this would be logged to audit system
    console.warn('Voice safety violation:', violation);
  }

  /**
   * Create rejected receipt
   */
  private createRejectedReceipt(
    context: VoiceExecutionContext,
    reason: string
  ): VoiceExecutionReceipt {
    return {
      receiptId: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      callSid: '',
      status: 'rejected',
      reason,
      executionCommand: context.executionCommand,
      decisionResult: context.decisionResult,
      enforcement: {
        voiceModeEnforced: true,
        actorEnforced: true,
        safetyChecksPassed: false,
        complianceChecksPassed: false,
      },
      initiatedAt: new Date(),
      correlationId: context.correlationId,
    };
  }

  /**
   * Get adapter capabilities
   */
  getCapabilities() {
    return {
      supportsScripted: this.config.scriptedModeEnabled,
      supportsConversational: this.config.conversationalModeEnabled,
      supportsRecording: this.config.recordingEnabled,
      supportsMachineDetection: this.config.machineDetectionEnabled,
    };
  }

  /**
   * Validate configuration
   */
  validateConfiguration(config: VoiceConfiguration): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.twilioAccountSid) {
      errors.push('Twilio account SID is required');
    }

    if (!config.twilioAuthToken) {
      errors.push('Twilio auth token is required');
    }

    if (!config.twilioFromNumber) {
      errors.push('Twilio from number is required');
    }

    if (config.maxCallDurationSeconds && config.maxCallDurationSeconds > 3600) {
      errors.push('Maximum call duration cannot exceed 1 hour');
    }

    if (config.defaultTimeoutSeconds && config.defaultTimeoutSeconds > 300) {
      errors.push('Default timeout cannot exceed 5 minutes');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Stub implementations for interface compliance
   * These would be implemented in the core-api integration
   */
  async processStatusCallback(payload: any): Promise<any> {
    throw new Error(
      'Status callback processing should be implemented in core-api'
    );
  }

  async processRecordingCallback(payload: any): Promise<void> {
    throw new Error(
      'Recording callback processing should be implemented in core-api'
    );
  }

  /**
   * Get safety violations (for monitoring)
   */
  getSafetyViolations(): VoiceSafetyViolation[] {
    return [...this.safetyViolations];
  }

  /**
   * Clear safety violations (for testing)
   */
  clearSafetyViolations(): void {
    this.safetyViolations = [];
  }
}
