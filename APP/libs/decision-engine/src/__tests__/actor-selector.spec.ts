/**
 * Actor Selector Tests - WI-029: Decision Engine & Actor Orchestration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ActorSelectorImpl, DEFAULT_DECISION_CONFIG } from '../index';

describe('ActorSelector', () => {
  let actorSelector: ActorSelectorImpl;

  beforeEach(() => {
    actorSelector = new ActorSelectorImpl();
  });

  describe('selectActor', () => {
    it('should select AI for low-risk scenarios', () => {
      const context = {
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

      const riskAssessment = {
        overallRisk: 'LOW' as const,
        riskFactors: [],
        mitigationRequired: false,
        recommendedActions: [],
      };

      const capability = actorSelector.selectActor(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );

      expect(capability.actorType).toBe('AI');
      expect(capability.canExecute).toBe(true);
    });

    it('should select human for high-risk scenarios', () => {
      const context = {
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

      const riskAssessment = {
        overallRisk: 'CRITICAL' as const,
        riskFactors: ['High-value deal', 'High-risk customer'],
        mitigationRequired: true,
        recommendedActions: ['Require supervisor approval'],
      };

      const capability = actorSelector.selectActor(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );

      expect(capability.actorType).toBe('HUMAN');
      expect(capability.canExecute).toBe(true);
    });

    it('should select hybrid for medium-risk scenarios', () => {
      const context = {
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
        dealValue: 25000,
        customerRiskScore: 0.5,
        slaUrgency: 'normal' as const,
        retryCount: 1,
        evidenceSoFar: ['call_attempt_logged'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const riskAssessment = {
        overallRisk: 'MEDIUM' as const,
        riskFactors: ['Medium-value deal'],
        mitigationRequired: false,
        recommendedActions: [],
      };

      const capability = actorSelector.selectActor(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );

      expect(capability.actorType).toBe('HYBRID');
      expect(capability.canExecute).toBe(true);
    });

    it('should block AI when not allowed by command', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'email',
          priority: 'normal',
          aiAllowed: false, // AI not allowed
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

      const riskAssessment = {
        overallRisk: 'LOW' as const,
        riskFactors: [],
        mitigationRequired: false,
        recommendedActions: [],
      };

      const capabilities = actorSelector.assessActorCapabilities(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );

      expect(capabilities.AI.canExecute).toBe(false);
      expect(capabilities.AI.constraints).toContain(
        'AI execution not allowed by command'
      );
      expect(capabilities.HUMAN.canExecute).toBe(true);
    });
  });

  describe('assessActorCapabilities', () => {
    it('should assess all actor types comprehensively', () => {
      const context = {
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
        dealValue: 100000,
        customerRiskScore: 0.7,
        slaUrgency: 'high' as const,
        retryCount: 2,
        evidenceSoFar: ['call_attempt_logged', 'call_failed'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const riskAssessment = {
        overallRisk: 'HIGH' as const,
        riskFactors: ['High-value deal', 'High-risk customer'],
        mitigationRequired: true,
        recommendedActions: ['Require supervisor approval'],
      };

      const capabilities = actorSelector.assessActorCapabilities(
        context,
        riskAssessment,
        DEFAULT_DECISION_CONFIG
      );

      // AI should be blocked for high risk
      expect(capabilities.AI.canExecute).toBe(false);
      expect(capabilities.AI.riskFactors).toContain(
        'Risk level HIGH exceeds AI threshold'
      );

      // Human should be available
      expect(capabilities.HUMAN.canExecute).toBe(true);
      expect(capabilities.HUMAN.confidence).toBeGreaterThan(0.8);

      // Hybrid should be blocked when AI is blocked
      expect(capabilities.HYBRID.canExecute).toBe(false);
      expect(capabilities.HYBRID.constraints).toContain(
        'AI component not available'
      );
    });
  });
});
