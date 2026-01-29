/**
 * Voice Execution Adapter Tests - WI-033: Voice Execution Adapter Hardening
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TwilioVoiceExecutionAdapter } from '../voice-execution-adapter';
import { VoiceConfiguration, VoiceExecutionContext } from '../types';
import { ExecutionCommand } from '@neuronx/playbook-engine';
import { DecisionResult, ActorType, VoiceMode } from '@neuronx/decision-engine';

// Mock TwilioClient
vi.mock('../twilio.client', () => ({
  TwilioClient: vi.fn().mockImplementation(() => ({
    createCall: vi.fn(),
  })),
}));

describe('TwilioVoiceExecutionAdapter', () => {
  let adapter: TwilioVoiceExecutionAdapter;
  let config: VoiceConfiguration;
  let mockTwilioClient: any;

  beforeEach(() => {
    config = {
      enabled: true,
      twilioAccountSid: 'test_sid',
      twilioAuthToken: 'test_token',
      twilioFromNumber: '+1234567890',
      maxCallDurationSeconds: 300,
      defaultTimeoutSeconds: 30,
      machineDetectionEnabled: false,
      recordingEnabled: false,
      scriptedModeEnabled: true,
      conversationalModeEnabled: false,
      humanAssistEnabled: false,
    };

    // Create adapter and get the mocked client
    adapter = new TwilioVoiceExecutionAdapter(config);
    mockTwilioClient = (adapter as any).twilioClient;
  });

  describe('executeVoiceCommand', () => {
    const baseExecutionCommand: ExecutionCommand = {
      commandId: 'cmd_123',
      tenantId: 'tenant_1',
      opportunityId: 'opp_456',
      playbookId: 'pb_789',
      stageId: 'stage_1',
      actionId: 'action_1',
      commandType: 'EXECUTE_CONTACT',
      channel: 'voice',
      priority: 'normal',
      contactData: {
        phone: '+0987654321',
        firstName: 'John',
        lastName: 'Doe',
      },
      correlationId: 'corr_123',
    };

    const baseDecisionResult: DecisionResult = {
      allowed: true,
      actor: ActorType.AI,
      mode: 'AUTONOMOUS',
      voiceMode: VoiceMode.SCRIPTED,
      escalationRequired: false,
      executionConstraints: [],
      auditReason: 'Test execution',
    };

    const baseContext: VoiceExecutionContext = {
      executionCommand: baseExecutionCommand,
      decisionResult: baseDecisionResult,
      tenantId: 'tenant_1',
      correlationId: 'corr_123',
      attemptNumber: 1,
      maxRetries: 3,
      previousOutcomes: [],
    };

    it('should execute call when decision allows', async () => {
      mockTwilioClient.createCall.mockResolvedValue({
        sid: 'CA123',
        status: 'queued',
      });

      const result = await adapter.executeVoiceCommand(baseContext);

      expect(result.status).toBe('initiated');
      expect(result.callSid).toBe('CA123');
      expect(result.enforcement.voiceModeEnforced).toBe(true);
      expect(result.enforcement.actorEnforced).toBe(true);
    });

    it('should reject when decision does not allow', async () => {
      const context = {
        ...baseContext,
        decisionResult: {
          ...baseDecisionResult,
          allowed: false,
          auditReason: 'Decision rejected',
        },
      };

      const result = await adapter.executeVoiceCommand(context);

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Decision not allowed');
      expect(result.enforcement.safetyChecksPassed).toBe(false);
    });

    it('should enforce voice mode restrictions', async () => {
      // Test HUMAN_ONLY mode
      const humanOnlyContext = {
        ...baseContext,
        decisionResult: {
          ...baseDecisionResult,
          voiceMode: VoiceMode.HUMAN_ONLY,
        },
      };

      const result = await adapter.executeVoiceCommand(humanOnlyContext);

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Voice mode HUMAN_ONLY - AI voice blocked');
    });

    it('should enforce SCRIPTED mode requirements', async () => {
      // Test SCRIPTED mode without scriptId
      const scriptedContext = {
        ...baseContext,
        decisionResult: {
          ...baseDecisionResult,
          voiceMode: VoiceMode.SCRIPTED,
        },
        executionCommand: {
          ...baseExecutionCommand,
          scriptId: undefined, // No script ID
        },
      };

      const result = await adapter.executeVoiceCommand(scriptedContext);

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Scripted mode requires scriptId');
    });

    it('should allow SCRIPTED mode with scriptId', async () => {
      mockTwilioClient.createCall.mockResolvedValue({
        sid: 'CA123',
        status: 'queued',
      });

      const scriptedContext = {
        ...baseContext,
        decisionResult: {
          ...baseDecisionResult,
          voiceMode: VoiceMode.SCRIPTED,
        },
        executionCommand: {
          ...baseExecutionCommand,
          scriptId: 'script_123',
        },
      };

      const result = await adapter.executeVoiceCommand(scriptedContext);

      expect(result.status).toBe('initiated');
      expect(result.enforcement.voiceModeEnforced).toBe(true);
    });

    it('should enforce actor restrictions', async () => {
      // Test HUMAN actor
      const humanContext = {
        ...baseContext,
        decisionResult: {
          ...baseDecisionResult,
          actor: ActorType.HUMAN,
        },
      };

      const result = await adapter.executeVoiceCommand(humanContext);

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('HUMAN actor requires approval workflow');
    });

    it('should reject when voice execution is disabled', async () => {
      const disabledAdapter = new TwilioVoiceExecutionAdapter({
        ...config,
        enabled: false,
      });

      const result = await disabledAdapter.executeVoiceCommand(baseContext);

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Voice execution disabled by feature flag');
    });

    it('should handle Twilio API errors', async () => {
      mockTwilioClient.createCall.mockRejectedValue(
        new Error('Invalid phone number')
      );

      const result = await adapter.executeVoiceCommand(baseContext);

      expect(result.status).toBe('failed');
      expect(result.reason).toBe('Invalid phone number');
    });

    it('should record safety violations', async () => {
      // Test voice mode breach
      const breachContext = {
        ...baseContext,
        decisionResult: {
          ...baseDecisionResult,
          voiceMode: VoiceMode.HUMAN_ONLY,
        },
      };

      await adapter.executeVoiceCommand(breachContext);

      const violations = adapter.getSafetyViolations();
      expect(violations).toHaveLength(1);
      expect(violations[0].violationType).toBe('voice_mode_breach');
    });
  });

  describe('getCapabilities', () => {
    it('should return adapter capabilities', () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.supportsScripted).toBe(true);
      expect(capabilities.supportsConversational).toBe(false);
      expect(capabilities.supportsRecording).toBe(false);
      expect(capabilities.supportsMachineDetection).toBe(false);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const result = adapter.validateConfiguration(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        ...config,
        twilioAccountSid: '',
        twilioAuthToken: '',
      };

      const result = adapter.validateConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Twilio account SID is required');
      expect(result.errors).toContain('Twilio auth token is required');
    });
  });

  describe('safety violations', () => {
    it('should track and retrieve safety violations', async () => {
      const violationContext = {
        executionCommand: baseExecutionCommand,
        decisionResult: {
          ...baseDecisionResult,
          allowed: false,
        },
        tenantId: 'tenant_1',
        correlationId: 'corr_123',
        attemptNumber: 1,
        maxRetries: 3,
        previousOutcomes: [],
      };

      await adapter.executeVoiceCommand(violationContext);

      const violations = adapter.getSafetyViolations();
      expect(violations).toHaveLength(1);

      // Clear violations
      adapter.clearSafetyViolations();
      expect(adapter.getSafetyViolations()).toHaveLength(0);
    });
  });
});
