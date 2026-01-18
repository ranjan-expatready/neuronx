/**
 * Decision Policy Resolver Tests - WI-042
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DecisionPolicyResolver } from '../decision-policy.resolver';
import { DecisionPolicyLoader } from '../decision-policy.loader';

// Mock the loader
vi.mock('../decision-policy.loader');

describe('DecisionPolicyResolver', () => {
  let resolver: DecisionPolicyResolver;
  let mockLoader: any;

  beforeEach(() => {
    mockLoader = {
      getEnforcementMode: vi.fn(),
      getRiskThresholds: vi.fn(),
      getDealValueThresholds: vi.fn(),
      getSlaUrgencyMapping: vi.fn(),
      getVoiceModeRules: vi.fn(),
      getVoiceConstraints: vi.fn(),
      getActorSelectionRules: vi.fn(),
      getExecutionModeRules: vi.fn(),
      getEscalationRules: vi.fn(),
      getRetryLimits: vi.fn(),
      getFeatures: vi.fn(),
    };

    vi.mocked(DecisionPolicyLoader).mockImplementation(() => mockLoader);
    resolver = new DecisionPolicyResolver(mockLoader as any);
  });

  describe('Enforcement mode', () => {
    it('should return enforcement mode from loader', () => {
      mockLoader.getEnforcementMode.mockReturnValue('block');
      expect(resolver.getEnforcementMode()).toBe('block');
    });
  });

  describe('Risk threshold accessors', () => {
    beforeEach(() => {
      mockLoader.getRiskThresholds.mockReturnValue({
        aiAllowed: 'MEDIUM',
        humanRequired: 'HIGH',
        approvalRequired: 'CRITICAL',
      });
    });

    it('should return AI allowed threshold', () => {
      expect(resolver.getAiAllowedRiskThreshold()).toBe('MEDIUM');
    });

    it('should return human required threshold', () => {
      expect(resolver.getHumanRequiredRiskThreshold()).toBe('HIGH');
    });

    it('should return approval required threshold', () => {
      expect(resolver.getApprovalRequiredRiskThreshold()).toBe('CRITICAL');
    });
  });

  describe('Deal value threshold accessors', () => {
    beforeEach(() => {
      mockLoader.getDealValueThresholds.mockReturnValue({
        low: 10000,
        medium: 100000,
        high: 100000,
      });
    });

    it('should return low deal value threshold', () => {
      expect(resolver.getLowDealValueThreshold()).toBe(10000);
    });

    it('should return medium deal value threshold', () => {
      expect(resolver.getMediumDealValueThreshold()).toBe(100000);
    });

    it('should return high deal value threshold', () => {
      expect(resolver.getHighDealValueThreshold()).toBe(100000);
    });
  });

  describe('SLA urgency mapping', () => {
    beforeEach(() => {
      mockLoader.getSlaUrgencyMapping.mockReturnValue({
        low: 'LOW',
        normal: 'MEDIUM',
        high: 'HIGH',
        critical: 'CRITICAL',
      });
    });

    it('should return risk level for SLA urgency', () => {
      expect(resolver.getSlaUrgencyRiskLevel('critical')).toBe('CRITICAL');
      expect(resolver.getSlaUrgencyRiskLevel('low')).toBe('LOW');
    });
  });

  describe('Voice mode rules', () => {
    beforeEach(() => {
      mockLoader.getVoiceModeRules.mockReturnValue({
        scriptedRequired: 'HIGH',
        conversationalAllowed: 'LOW',
      });
    });

    it('should return scripted required threshold', () => {
      expect(resolver.getScriptedRequiredRiskThreshold()).toBe('HIGH');
    });

    it('should return conversational allowed threshold', () => {
      expect(resolver.getConversationalAllowedRiskThreshold()).toBe('LOW');
    });
  });

  describe('Voice constraints', () => {
    beforeEach(() => {
      mockLoader.getVoiceConstraints.mockReturnValue({
        maxDurationMinutes: 15,
        scriptedConfidenceThreshold: 0.8,
        conversationalRiskLimit: 'LOW',
      });
    });

    it('should return max voice duration', () => {
      expect(resolver.getMaxVoiceDurationMinutes()).toBe(15);
    });

    it('should return scripted confidence threshold', () => {
      expect(resolver.getScriptedConfidenceThreshold()).toBe(0.8);
    });

    it('should return conversational risk limit', () => {
      expect(resolver.getConversationalRiskLimit()).toBe('LOW');
    });
  });

  describe('Actor selection rules', () => {
    beforeEach(() => {
      mockLoader.getActorSelectionRules.mockReturnValue({
        aiConfidenceThreshold: 0.7,
        hybridActorThreshold: 0.5,
        humanFallbackEnabled: true,
      });
    });

    it('should return AI confidence threshold', () => {
      expect(resolver.getAiConfidenceThreshold()).toBe(0.7);
    });

    it('should return hybrid actor threshold', () => {
      expect(resolver.getHybridActorThreshold()).toBe(0.5);
    });

    it('should return human fallback enabled status', () => {
      expect(resolver.isHumanFallbackEnabled()).toBe(true);
    });
  });

  describe('Execution mode rules', () => {
    beforeEach(() => {
      mockLoader.getExecutionModeRules.mockReturnValue({
        autonomousMaxRisk: 'LOW',
        assistedMinRisk: 'MEDIUM',
        approvalMinRisk: 'HIGH',
        hybridAlwaysAssisted: true,
      });
    });

    it('should return autonomous max risk', () => {
      expect(resolver.getAutonomousMaxRisk()).toBe('LOW');
    });

    it('should return assisted min risk', () => {
      expect(resolver.getAssistedMinRisk()).toBe('MEDIUM');
    });

    it('should return approval min risk', () => {
      expect(resolver.getApprovalMinRisk()).toBe('HIGH');
    });

    it('should return hybrid always assisted flag', () => {
      expect(resolver.shouldHybridAlwaysBeAssisted()).toBe(true);
    });
  });

  describe('Escalation rules', () => {
    beforeEach(() => {
      mockLoader.getEscalationRules.mockReturnValue({
        criticalRiskAlwaysEscalate: true,
        highValueDealThreshold: 100000,
        retryCountEscalationThreshold: 3,
        slaCriticalEscalation: true,
      });
    });

    it('should return critical risk always escalate flag', () => {
      expect(resolver.shouldCriticalRiskAlwaysEscalate()).toBe(true);
    });

    it('should return high value deal escalation threshold', () => {
      expect(resolver.getHighValueDealEscalationThreshold()).toBe(100000);
    });

    it('should return retry count escalation threshold', () => {
      expect(resolver.getRetryCountEscalationThreshold()).toBe(3);
    });

    it('should return SLA critical escalation flag', () => {
      expect(resolver.shouldSlaCriticalAlwaysEscalate()).toBe(true);
    });
  });

  describe('Retry limits', () => {
    beforeEach(() => {
      mockLoader.getRetryLimits.mockReturnValue({
        beforeEscalation: 3,
        beforeHumanOverride: 5,
      });
    });

    it('should return retry limit before escalation', () => {
      expect(resolver.getRetryLimitBeforeEscalation()).toBe(3);
    });

    it('should return retry limit before human override', () => {
      expect(resolver.getRetryLimitBeforeHumanOverride()).toBe(5);
    });
  });

  describe('Feature flags', () => {
    beforeEach(() => {
      mockLoader.getFeatures.mockReturnValue({
        voiceExecution: true,
        aiActors: true,
        hybridActors: true,
        riskAssessment: true,
        escalationWorkflow: true,
      });
    });

    it('should return voice execution enabled status', () => {
      expect(resolver.isVoiceExecutionEnabled()).toBe(true);
    });

    it('should return AI actors enabled status', () => {
      expect(resolver.areAiActorsEnabled()).toBe(true);
    });

    it('should return hybrid actors enabled status', () => {
      expect(resolver.areHybridActorsEnabled()).toBe(true);
    });

    it('should return risk assessment enabled status', () => {
      expect(resolver.isRiskAssessmentEnabled()).toBe(true);
    });

    it('should return escalation workflow enabled status', () => {
      expect(resolver.isEscalationWorkflowEnabled()).toBe(true);
    });
  });

  describe('Utility methods', () => {
    describe('isRiskLevelAtOrAbove', () => {
      it('should correctly compare risk levels', () => {
        expect(resolver.isRiskLevelAtOrAbove('CRITICAL', 'HIGH')).toBe(true);
        expect(resolver.isRiskLevelAtOrAbove('LOW', 'MEDIUM')).toBe(false);
        expect(resolver.isRiskLevelAtOrAbove('HIGH', 'HIGH')).toBe(true);
      });
    });

    describe('isRiskLevelAtOrBelow', () => {
      it('should correctly compare risk levels', () => {
        expect(resolver.isRiskLevelAtOrBelow('LOW', 'MEDIUM')).toBe(true);
        expect(resolver.isRiskLevelAtOrBelow('HIGH', 'MEDIUM')).toBe(false);
        expect(resolver.isRiskLevelAtOrBelow('MEDIUM', 'MEDIUM')).toBe(true);
      });
    });

    describe('classifyDealValueRisk', () => {
      beforeEach(() => {
        mockLoader.getDealValueThresholds.mockReturnValue({
          low: 10000,
          medium: 100000,
          high: 100000,
        });
      });

      it('should classify deal values correctly', () => {
        expect(resolver.classifyDealValueRisk(5000)).toBe('LOW');
        expect(resolver.classifyDealValueRisk(50000)).toBe('MEDIUM');
        expect(resolver.classifyDealValueRisk(150000)).toBe('HIGH');
        expect(resolver.classifyDealValueRisk(undefined)).toBe('LOW');
      });
    });

    describe('shouldEscalateBasedOnDealValue', () => {
      beforeEach(() => {
        mockLoader.getEscalationRules.mockReturnValue({
          highValueDealThreshold: 100000,
        });
      });

      it('should determine escalation based on deal value and actor', () => {
        expect(resolver.shouldEscalateBasedOnDealValue(150000, 'AI')).toBe(
          true
        );
        expect(resolver.shouldEscalateBasedOnDealValue(50000, 'AI')).toBe(
          false
        );
        expect(resolver.shouldEscalateBasedOnDealValue(150000, 'HUMAN')).toBe(
          false
        );
      });
    });
  });
});
