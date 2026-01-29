/**
 * Decision Engine Tests - WI-029: Decision Engine & Actor Orchestration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DecisionEngineImpl } from '../decision-engine';
import { DecisionContextBuilder } from '../decision-context';
import { RiskGate } from '../risk-gate';
import { ActorSelector } from '../actor-selector';
import { VoiceModeSelector } from './voice-mode-selector';

// Mock dependencies
const mockContextBuilder: DecisionContextBuilder = {
  buildContext: vi.fn(),
  validateContext: vi.fn(),
};

const mockRiskGate: RiskGate = {
  assessRisk: vi.fn(),
  isAiAllowed: vi.fn(),
  isHumanRequired: vi.fn(),
  isApprovalRequired: vi.fn(),
};

const mockActorSelector: ActorSelector = {
  selectActor: vi.fn(),
  assessActorCapabilities: vi.fn(),
};

const mockVoiceSelector: VoiceModeSelector = {
  selectVoiceMode: vi.fn(),
  isVoiceAllowed: vi.fn(),
};

describe('DecisionEngine', () => {
  let decisionEngine: DecisionEngineImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    decisionEngine = new DecisionEngineImpl(
      mockContextBuilder,
      mockRiskGate,
      mockActorSelector,
      mockVoiceSelector
    );
    decisionEngine.setEnforcementMode('monitor_only');
  });

  describe('makeDecision', () => {
    it('should make successful decisions for valid contexts', async () => {
      const mockContext = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'email',
          priority: 'normal',
          aiAllowed: true,
          humanAllowed: true,
        },
        dealValue: 5000,
        customerRiskScore: 0.3,
        slaUrgency: 'normal' as const,
        retryCount: 0,
        evidenceSoFar: [],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const mockRiskAssessment = {
        overallRisk: 'LOW' as const,
        riskFactors: [],
        mitigationRequired: false,
        recommendedActions: [],
      };

      const mockActorCapability = {
        actorType: 'AI' as const,
        canExecute: true,
        confidence: 0.9,
        constraints: [],
        riskFactors: [],
      };

      // Setup mocks
      mockContextBuilder.buildContext.mockReturnValue(mockContext);
      mockContextBuilder.validateContext.mockReturnValue({
        valid: true,
        errors: [],
      });
      mockRiskGate.assessRisk.mockReturnValue(mockRiskAssessment);
      mockActorSelector.selectActor.mockReturnValue(mockActorCapability);
      mockVoiceSelector.selectVoiceMode.mockReturnValue(null);
      mockVoiceSelector.isVoiceAllowed.mockReturnValue({
        allowed: true,
        reason: 'Not a voice command',
      });

      const result = await decisionEngine.makeDecision({});

      expect(result.allowed).toBe(true);
      expect(result.actor).toBe('AI');
      expect(result.mode).toBe('AUTONOMOUS');
      expect(result.riskLevel).toBe('LOW');
      expect(result.correlationId).toBe('test-123');
    });

    it('should block execution for high-risk scenarios in block mode', async () => {
      decisionEngine.setEnforcementMode('block');

      const mockContext = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'high',
          aiAllowed: true,
          humanAllowed: true,
        },
        dealValue: 150000,
        customerRiskScore: 0.8,
        slaUrgency: 'critical' as const,
        retryCount: 3,
        evidenceSoFar: ['call_failed'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const mockRiskAssessment = {
        overallRisk: 'CRITICAL' as const,
        riskFactors: ['High-value deal', 'High-risk customer'],
        mitigationRequired: true,
        recommendedActions: ['Require supervisor approval'],
      };

      const mockActorCapability = {
        actorType: 'HUMAN' as const,
        canExecute: true,
        confidence: 0.95,
        constraints: [],
        riskFactors: [],
      };

      // Setup mocks
      mockContextBuilder.buildContext.mockReturnValue(mockContext);
      mockContextBuilder.validateContext.mockReturnValue({
        valid: true,
        errors: [],
      });
      mockRiskGate.assessRisk.mockReturnValue(mockRiskAssessment);
      mockActorSelector.selectActor.mockReturnValue(mockActorCapability);
      mockVoiceSelector.selectVoiceMode.mockReturnValue(null);
      mockVoiceSelector.isVoiceAllowed.mockReturnValue({
        allowed: false,
        reason: 'Voice interactions not allowed for critical risk situations',
      });

      const result = await decisionEngine.makeDecision({});

      expect(result.allowed).toBe(false);
      expect(result.actor).toBe('HUMAN');
      expect(result.mode).toBe('APPROVAL_REQUIRED');
      expect(result.escalationRequired).toBe(true);
      expect(result.executionConstraints).toContain(
        'Voice interactions not allowed for critical risk situations'
      );
    });

    it('should handle voice mode selection correctly', async () => {
      const mockContext = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'normal',
          aiAllowed: true,
          humanAllowed: true,
        },
        dealValue: 5000,
        customerRiskScore: 0.3,
        slaUrgency: 'normal' as const,
        retryCount: 0,
        evidenceSoFar: [],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const mockRiskAssessment = {
        overallRisk: 'LOW' as const,
        riskFactors: [],
        mitigationRequired: false,
        recommendedActions: [],
      };

      const mockActorCapability = {
        actorType: 'HYBRID' as const,
        canExecute: true,
        confidence: 0.8,
        constraints: [],
        riskFactors: [],
      };

      // Setup mocks
      mockContextBuilder.buildContext.mockReturnValue(mockContext);
      mockContextBuilder.validateContext.mockReturnValue({
        valid: true,
        errors: [],
      });
      mockRiskGate.assessRisk.mockReturnValue(mockRiskAssessment);
      mockActorSelector.selectActor.mockReturnValue(mockActorCapability);
      mockVoiceSelector.selectVoiceMode.mockReturnValue('SCRIPTED');
      mockVoiceSelector.isVoiceAllowed.mockReturnValue({
        allowed: true,
        reason: 'Voice interaction allowed',
      });

      const result = await decisionEngine.makeDecision({});

      expect(result.allowed).toBe(true);
      expect(result.actor).toBe('HYBRID');
      expect(result.mode).toBe('ASSISTED');
      expect(result.voiceMode).toBe('SCRIPTED');
    });

    it('should provide fail-safe decisions on errors', async () => {
      mockContextBuilder.buildContext.mockImplementation(() => {
        throw new Error('Context building failed');
      });

      const result = await decisionEngine.makeDecision({});

      expect(result.allowed).toBe(true); // Fail-safe allows execution
      expect(result.actor).toBe('HUMAN'); // Fail-safe forces human
      expect(result.mode).toBe('ASSISTED'); // Fail-safe requires assistance
      expect(result.escalationRequired).toBe(true); // Fail-safe requires escalation
      expect(result.reason).toContain('FAILSAFE');
      expect(result.executionConstraints).toContain(
        'FAILSAFE MODE: Human supervision required'
      );
    });
  });

  describe('enforcement modes', () => {
    it('should allow all decisions in monitor_only mode', async () => {
      decisionEngine.setEnforcementMode('monitor_only');

      const mockContext = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'email',
          priority: 'normal',
          aiAllowed: true,
          humanAllowed: true,
        },
        dealValue: 5000,
        customerRiskScore: 0.3,
        slaUrgency: 'normal' as const,
        retryCount: 0,
        evidenceSoFar: [],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      // Setup mocks for a scenario that would normally be blocked
      mockContextBuilder.buildContext.mockReturnValue(mockContext);
      mockContextBuilder.validateContext.mockReturnValue({
        valid: true,
        errors: [],
      });
      mockRiskGate.assessRisk.mockReturnValue({
        overallRisk: 'CRITICAL' as const,
        riskFactors: [],
        mitigationRequired: true,
        recommendedActions: [],
      });
      mockActorSelector.selectActor.mockReturnValue({
        actorType: 'AI' as const,
        canExecute: false, // Would normally block
        confidence: 0.1,
        constraints: [],
        riskFactors: [],
      });
      mockVoiceSelector.selectVoiceMode.mockReturnValue(null);
      mockVoiceSelector.isVoiceAllowed.mockReturnValue({
        allowed: true,
        reason: '',
      });

      const result = await decisionEngine.makeDecision({});

      expect(result.allowed).toBe(true); // Monitor mode allows even invalid decisions
      expect(decisionEngine.getEnforcementMode()).toBe('monitor_only');
    });

    it('should enforce decisions in block mode', async () => {
      decisionEngine.setEnforcementMode('block');

      const mockContext = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'email',
          priority: 'normal',
          aiAllowed: true,
          humanAllowed: true,
        },
        dealValue: 5000,
        customerRiskScore: 0.3,
        slaUrgency: 'normal' as const,
        retryCount: 0,
        evidenceSoFar: [],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      // Setup mocks for critical risk scenario
      mockContextBuilder.buildContext.mockReturnValue(mockContext);
      mockContextBuilder.validateContext.mockReturnValue({
        valid: true,
        errors: [],
      });
      mockRiskGate.assessRisk.mockReturnValue({
        overallRisk: 'CRITICAL' as const,
        riskFactors: [],
        mitigationRequired: true,
        recommendedActions: [],
      });
      mockActorSelector.selectActor.mockReturnValue({
        actorType: 'HUMAN' as const,
        canExecute: true,
        confidence: 0.9,
        constraints: [],
        riskFactors: [],
      });
      mockVoiceSelector.selectVoiceMode.mockReturnValue(null);
      mockVoiceSelector.isVoiceAllowed.mockReturnValue({
        allowed: true,
        reason: '',
      });

      const result = await decisionEngine.makeDecision({});

      expect(result.allowed).toBe(false); // Block mode blocks critical risk
      expect(result.mode).toBe('APPROVAL_REQUIRED');
      expect(result.escalationRequired).toBe(true);
    });
  });

  describe('validateDecisionResult', () => {
    it('should validate correct decision results', () => {
      const validResult = {
        allowed: true,
        reason: 'Valid decision',
        actor: 'AI' as const,
        mode: 'AUTONOMOUS' as const,
        escalationRequired: false,
        executionConstraints: [],
        riskLevel: 'LOW' as const,
        decidedAt: new Date(),
        correlationId: 'test-123',
        decisionEngineVersion: '1.0.0',
      };

      const validation = decisionEngine.validateDecisionResult(validResult);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid decision results', () => {
      const invalidResult = {
        allowed: 'yes', // Should be boolean
        reason: '', // Should not be empty
        actor: 'ROBOT', // Invalid actor type
        mode: 'CHAOTIC', // Invalid mode
        escalationRequired: 'maybe', // Should be boolean
        executionConstraints: 'none', // Should be array
        riskLevel: 'EXTREME', // Invalid risk level
        decidedAt: 'tomorrow', // Should be Date
        correlationId: '', // Should not be empty
        decisionEngineVersion: '1.0.0',
      };

      const validation = decisionEngine.validateDecisionResult(
        invalidResult as any
      );
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
