import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceOrchestrationEngine } from '../voice-orchestration.engine';
import { VoiceMode, VoiceOutcome, VoiceActor } from '../voice-outcome.enums';

describe('VoiceOrchestrationEngine', () => {
  const mockPolicy = {
    enforcementMode: 'monitor_only' as const,
    voiceModeRules: {
      prospect_identified: {
        allowedModes: ['HUMAN_ONLY', 'ASSISTED'],
        defaultMode: 'ASSISTED',
        requiresChecklist: true,
        maxDurationMinutes: 5,
        requiredScripts: ['QUALIFICATION'],
      },
      qualified: {
        allowedModes: ['ASSISTED', 'HUMAN_ONLY'],
        defaultMode: 'ASSISTED',
        requiresChecklist: true,
        maxDurationMinutes: 12,
        requiredScripts: ['VALUE_PROPOSITION', 'OBJECTION_HANDLING'],
      },
    },
    riskOverrides: {
      high_risk: {
        allowedModes: ['HUMAN_ONLY'],
        reason: 'High-value opportunities require human oversight',
        threshold: 50000,
      },
    },
    scriptRequirements: {
      AUTONOMOUS: {
        requiredScripts: ['ACKNOWLEDGMENT'],
        allowAdlib: false,
        enforceOrder: true,
        maxDeviations: 0,
      },
      ASSISTED: {
        requiredScripts: ['QUALIFICATION_CHECKLIST'],
        allowAdlib: true,
        enforceOrder: false,
        maxDeviations: 3,
      },
      HUMAN_ONLY: {
        requiredScripts: ['OUTCOME_LOGGING'],
        allowAdlib: true,
        enforceOrder: false,
        maxDeviations: 10,
      },
    },
    qualityThresholds: {
      minConfidenceScore: 0.7,
      maxBackgroundNoise: 0.3,
      minSpeechClarity: 0.6,
      maxLatencyMs: 500,
    },
    retryRules: {
      maxRetries: 3,
      backoffMultiplier: 2,
      maxBackoffMinutes: 60,
      escalationTriggers: [],
    },
    outcomeRequirements: {
      requiredFields: ['outcome', 'duration_seconds'],
      allowedOutcomes: [
        'CONTACTED_SUCCESSFUL',
        'CONTACTED_UNSUCCESSFUL',
        'NO_ANSWER',
      ],
      blockedOutcomes: ['DIRECT_STATE_CHANGE', 'MANUAL_QUALIFICATION'],
    },
    billingRules: {
      billableEvents: ['ANSWERED_CALL'],
      nonBillableEvents: ['NO_ANSWER'],
      rateMultipliers: {
        AUTONOMOUS: 0.8,
        ASSISTED: 1.0,
        HUMAN_ONLY: 1.2,
      },
    },
    complianceRules: {
      recordingRequired: true,
      piiMaskingEnabled: true,
      auditRetentionDays: 2555,
      maxDailyCallsPerLead: 3,
      cooldownPeriodMinutes: 60,
    },
    emergencyOverrides: {
      enabled: false,
      allowedModes: ['HUMAN_ONLY'],
      requiresApproval: true,
      approvalTimeoutHours: 24,
    },
  };

  const engine = new VoiceOrchestrationEngine(mockPolicy, '1.0.0');

  describe('selectVoiceMode', () => {
    it('should return deterministic mode selection for same input', () => {
      const request = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        correlationId: 'corr-789',
        leadState: 'prospect_identified',
      };

      const result1 = engine.selectVoiceMode(request);
      const result2 = engine.selectVoiceMode(request);

      expect(result1.selectedMode).toBe(result2.selectedMode);
      expect(result1.reason).toBe(result2.reason);
      expect(result1.confidence).toBe(result2.confidence);
      expect(result1.allowedModes).toEqual(result2.allowedModes);
    });

    it('should select default mode for state', () => {
      const request = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        correlationId: 'corr-789',
        leadState: 'prospect_identified',
      };

      const result = engine.selectVoiceMode(request);

      expect(result.selectedMode).toBe(VoiceMode.ASSISTED);
      expect(result.allowedModes).toEqual(['HUMAN_ONLY', 'ASSISTED']);
      expect(result.requiresChecklist).toBe(true);
      expect(result.maxDurationMinutes).toBe(5);
    });

    it('should apply high-value deal override', () => {
      const request = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        correlationId: 'corr-789',
        leadState: 'qualified',
        dealValue: 75000, // Above threshold
      };

      const result = engine.selectVoiceMode(request);

      expect(result.selectedMode).toBe(VoiceMode.HUMAN_ONLY);
      expect(result.reason).toContain(
        'High-value opportunities require human oversight'
      );
      expect(result.allowedModes).toEqual(['HUMAN_ONLY']);
    });

    it('should respect preferred mode when allowed', () => {
      const request = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        correlationId: 'corr-789',
        leadState: 'prospect_identified',
        preferredMode: VoiceMode.HUMAN_ONLY,
      };

      const result = engine.selectVoiceMode(request);

      expect(result.selectedMode).toBe(VoiceMode.HUMAN_ONLY);
      expect(result.confidence).toBe(0.95); // Higher confidence for preferred mode
    });

    it('should return HUMAN_ONLY for unknown states', () => {
      const request = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        correlationId: 'corr-789',
        leadState: 'unknown_state',
      };

      const result = engine.selectVoiceMode(request);

      expect(result.selectedMode).toBe(VoiceMode.HUMAN_ONLY);
      expect(result.reason).toContain('No voice policy rule found');
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('createVoiceSession', () => {
    it('should create session and execution command', () => {
      const request = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        correlationId: 'corr-789',
        leadState: 'prospect_identified',
      };

      const phoneNumber = '+1234567890';

      const { session, executionCommand } = engine.createVoiceSession(
        request,
        phoneNumber
      );

      expect(session.sessionId).toBeDefined();
      expect(session.tenantId).toBe('tenant-123');
      expect(session.leadId).toBe('lead-456');
      expect(session.selectedVoiceMode).toBe(VoiceMode.ASSISTED);
      expect(session.actor).toBe(VoiceActor.HUMAN); // ASSISTED mode = human speaks
      expect(session.enforcementMode).toBe('monitor_only');

      expect(executionCommand.type).toBe('initiate_voice_call');
      expect(executionCommand.sessionId).toBe(session.sessionId);
      expect(executionCommand.phoneNumber).toBe(phoneNumber);
      expect(executionCommand.mode).toBe(VoiceMode.ASSISTED);
    });
  });

  describe('processVoiceOutcome', () => {
    it('should validate and process allowed outcome', () => {
      const session = {
        sessionId: 'session-123',
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        stateAtCall: 'prospect_identified',
        selectedVoiceMode: VoiceMode.ASSISTED,
        actor: VoiceActor.HUMAN,
        direction: 'OUTBOUND' as const,
        startedAt: new Date(),
        outcome: VoiceOutcome.CALL_COMPLETED, // Will be overridden
        policyVersion: '1.0.0',
        enforcementMode: 'monitor_only' as const,
        correlationId: 'corr-789',
        billable: true,
      };

      const metadata = {
        durationSeconds: 180,
        notes: 'Good conversation',
        checklistCompleted: true,
      };

      const { validatedSession, events, violations } =
        engine.processVoiceOutcome(
          session,
          VoiceOutcome.CONTACTED_SUCCESSFUL,
          metadata
        );

      expect(violations).toHaveLength(0);
      expect(validatedSession.outcome).toBe(VoiceOutcome.CONTACTED_SUCCESSFUL);
      expect(validatedSession.durationSeconds).toBe(180);
      expect(validatedSession.notes).toBe('Good conversation');
      expect(validatedSession.checklistCompleted).toBe(true);
      expect(validatedSession.endedAt).toBeDefined();

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('session.completed');
      expect(events[0].data.outcome).toBe(VoiceOutcome.CONTACTED_SUCCESSFUL);
    });

    it('should detect blocked outcomes', () => {
      const session = {
        sessionId: 'session-123',
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        stateAtCall: 'prospect_identified',
        selectedVoiceMode: VoiceMode.ASSISTED,
        actor: VoiceActor.HUMAN,
        direction: 'OUTBOUND' as const,
        startedAt: new Date(),
        outcome: VoiceOutcome.CALL_COMPLETED,
        policyVersion: '1.0.0',
        enforcementMode: 'monitor_only' as const,
        correlationId: 'corr-789',
        billable: true,
      };

      const { violations } = engine.processVoiceOutcome(
        session,
        'DIRECT_STATE_CHANGE' as any,
        { durationSeconds: 60 }
      );

      expect(violations).toContain(
        'Outcome DIRECT_STATE_CHANGE is explicitly blocked by policy'
      );
    });

    it('should enforce checklist requirements', () => {
      const session = {
        sessionId: 'session-123',
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        stateAtCall: 'prospect_identified', // Requires checklist
        selectedVoiceMode: VoiceMode.ASSISTED,
        actor: VoiceActor.HUMAN,
        direction: 'OUTBOUND' as const,
        startedAt: new Date(),
        outcome: VoiceOutcome.CALL_COMPLETED,
        policyVersion: '1.0.0',
        enforcementMode: 'monitor_only' as const,
        correlationId: 'corr-789',
        billable: true,
      };

      const { violations } = engine.processVoiceOutcome(
        session,
        VoiceOutcome.CONTACTED_SUCCESSFUL,
        {
          durationSeconds: 180,
          checklistCompleted: false, // Checklist required but not completed
        }
      );

      expect(violations).toContain(
        'Checklist completion required but not marked complete'
      );
    });

    it('should validate required fields', () => {
      const session = {
        sessionId: 'session-123',
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        stateAtCall: 'prospect_identified',
        selectedVoiceMode: VoiceMode.ASSISTED,
        actor: VoiceActor.HUMAN,
        direction: 'OUTBOUND' as const,
        startedAt: new Date(),
        outcome: VoiceOutcome.CALL_COMPLETED,
        policyVersion: '1.0.0',
        enforcementMode: 'monitor_only' as const,
        correlationId: 'corr-789',
        billable: true,
      };

      const { violations } = engine.processVoiceOutcome(
        session,
        VoiceOutcome.CONTACTED_SUCCESSFUL,
        {
          // Missing durationSeconds (required field)
          notes: 'Test call',
        }
      );

      expect(violations).toContain('Missing required fields: duration_seconds');
    });
  });

  describe('shouldBlockVoiceRequest', () => {
    it('should not block in monitor mode', () => {
      const request = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        correlationId: 'corr-789',
        leadState: 'invalid_state', // No rule for this state
      };

      const result = engine.shouldBlockVoiceRequest(request);

      expect(result.shouldBlock).toBe(false);
    });

    it('should block in block mode for invalid states', () => {
      // Create engine in block mode
      const blockPolicy = { ...mockPolicy, enforcementMode: 'block' as const };
      const blockEngine = new VoiceOrchestrationEngine(blockPolicy);

      const request = {
        tenantId: 'tenant-123',
        leadId: 'lead-456',
        correlationId: 'corr-789',
        leadState: 'invalid_state', // No rule for this state
      };

      const result = blockEngine.shouldBlockVoiceRequest(request);

      expect(result.shouldBlock).toBe(true);
      expect(result.violations).toContain(
        'No voice modes allowed for state: invalid_state'
      );
    });
  });
});
