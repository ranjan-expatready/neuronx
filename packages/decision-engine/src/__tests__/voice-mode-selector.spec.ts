/**
 * Voice Mode Selector Tests - WI-029: Decision Engine & Actor Orchestration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceModeSelectorImpl, DEFAULT_DECISION_CONFIG } from '../index';

describe('VoiceModeSelector', () => {
  let voiceSelector: VoiceModeSelectorImpl;

  beforeEach(() => {
    voiceSelector = new VoiceModeSelectorImpl();
  });

  describe('selectVoiceMode', () => {
    it('should return null for non-voice commands', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'SEND_MESSAGE',
          channel: 'email', // Not voice
          priority: 'normal',
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

      const riskAssessment = {
        overallRisk: 'LOW' as const,
        riskFactors: [],
        mitigationRequired: false,
        recommendedActions: [],
      };

      const mode = voiceSelector.selectVoiceMode(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );
      expect(mode).toBeNull();
    });

    it('should select scripted mode for high-risk voice calls', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'high',
          actionType: 'qualification_call',
        },
        dealValue: 50000,
        customerRiskScore: 0.6,
        slaUrgency: 'high' as const,
        retryCount: 1,
        evidenceSoFar: ['call_attempt_logged'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const riskAssessment = {
        overallRisk: 'HIGH' as const,
        riskFactors: ['Medium-value deal', 'Retry attempt'],
        mitigationRequired: true,
        recommendedActions: [],
      };

      const mode = voiceSelector.selectVoiceMode(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );
      expect(mode).toBe('SCRIPTED');
    });

    it('should allow conversational mode for low-risk scenarios', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'normal',
          actionType: 'contact_attempt',
        },
        dealValue: 1000,
        customerRiskScore: 0.2,
        slaUrgency: 'normal' as const,
        retryCount: 0,
        evidenceSoFar: ['engaged_response'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const riskAssessment = {
        overallRisk: 'LOW' as const,
        riskFactors: [],
        mitigationRequired: false,
        recommendedActions: [],
      };

      const mode = voiceSelector.selectVoiceMode(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );
      expect(mode).toBe('CONVERSATIONAL');
    });
  });

  describe('isVoiceAllowed', () => {
    it('should allow voice for low-risk scenarios', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'normal',
        },
        dealValue: 5000,
        customerRiskScore: 0.3,
        slaUrgency: 'normal' as const,
        retryCount: 0,
        evidenceSoFar: ['call_connected'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const riskAssessment = {
        overallRisk: 'LOW' as const,
        riskFactors: [],
        mitigationRequired: false,
        recommendedActions: [],
      };

      const result = voiceSelector.isVoiceAllowed(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Voice interaction allowed');
    });

    it('should block voice for critical risk', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'high',
        },
        dealValue: 100000,
        customerRiskScore: 0.9,
        slaUrgency: 'critical' as const,
        retryCount: 5,
        evidenceSoFar: ['call_failed', 'complaint'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const riskAssessment = {
        overallRisk: 'CRITICAL' as const,
        riskFactors: ['High-value deal', 'High-risk customer'],
        mitigationRequired: true,
        recommendedActions: [],
      };

      const result = voiceSelector.isVoiceAllowed(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        'Voice interactions not allowed for critical risk situations'
      );
    });

    it('should block voice for high-value deals', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'normal',
        },
        dealValue: 150000, // High value
        customerRiskScore: 0.3,
        slaUrgency: 'normal' as const,
        retryCount: 0,
        evidenceSoFar: [],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const riskAssessment = {
        overallRisk: 'HIGH' as const,
        riskFactors: ['High-value deal'],
        mitigationRequired: true,
        recommendedActions: [],
      };

      const result = voiceSelector.isVoiceAllowed(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        'High-value deals require human voice interaction'
      );
    });

    it('should block voice with negative evidence', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'normal',
        },
        dealValue: 5000,
        customerRiskScore: 0.3,
        slaUrgency: 'normal' as const,
        retryCount: 0,
        evidenceSoFar: ['angry_customer', 'complaint_filed'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const riskAssessment = {
        overallRisk: 'MEDIUM' as const,
        riskFactors: [],
        mitigationRequired: false,
        recommendedActions: [],
      };

      const result = voiceSelector.isVoiceAllowed(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        'Negative evidence suggests human voice intervention required'
      );
    });
  });
});
