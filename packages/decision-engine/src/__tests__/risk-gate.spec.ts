/**
 * Risk Gate Tests - WI-029: Decision Engine & Actor Orchestration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RiskGateImpl, DEFAULT_DECISION_CONFIG } from '../index';

describe('RiskGate', () => {
  let riskGate: RiskGateImpl;

  beforeEach(() => {
    riskGate = new RiskGateImpl();
  });

  describe('assessRisk', () => {
    it('should assess low risk for standard scenarios', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'email',
          priority: 'normal',
        },
        dealValue: 5000,
        customerRiskScore: 0.3,
        slaUrgency: 'normal' as const,
        retryCount: 0,
        evidenceSoFar: ['call_attempt_logged'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const assessment = riskGate.assessRisk(context, DEFAULT_DECISION_CONFIG);

      expect(assessment.overallRisk).toBe('LOW');
      expect(assessment.mitigationRequired).toBe(false);
    });

    it('should assess high risk for critical deal values', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'high',
        },
        dealValue: 200000, // High value
        customerRiskScore: 0.9, // High risk customer
        slaUrgency: 'critical' as const,
        retryCount: 2,
        evidenceSoFar: ['call_attempt_logged', 'call_failed'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const assessment = riskGate.assessRisk(context, DEFAULT_DECISION_CONFIG);

      expect(assessment.overallRisk).toBe('CRITICAL');
      expect(assessment.riskFactors).toContain('High-value deal');
      expect(assessment.riskFactors).toContain('High-risk customer');
      expect(assessment.mitigationRequired).toBe(true);
    });

    it('should assess medium risk for retry scenarios', () => {
      const context = {
        tenantId: 'tenant-123',
        opportunityId: 'opp-456',
        stageId: 'prospect_identified',
        executionCommand: {
          commandType: 'EXECUTE_CONTACT',
          channel: 'email',
          priority: 'normal',
        },
        dealValue: 25000,
        customerRiskScore: 0.5,
        slaUrgency: 'normal' as const,
        retryCount: 2, // Multiple retries
        evidenceSoFar: ['call_attempt_logged', 'call_attempt_logged'],
        playbookVersion: '1.0.0',
        correlationId: 'test-123',
        requestedAt: new Date(),
      };

      const assessment = riskGate.assessRisk(context, DEFAULT_DECISION_CONFIG);

      expect(assessment.overallRisk).toBe('MEDIUM');
      expect(assessment.riskFactors).toContain('Multiple retry attempts');
    });
  });

  describe('isAiAllowed', () => {
    it('should allow AI for low and medium risk', () => {
      expect(riskGate.isAiAllowed('LOW', DEFAULT_DECISION_CONFIG)).toBe(true);
      expect(riskGate.isAiAllowed('MEDIUM', DEFAULT_DECISION_CONFIG)).toBe(
        true
      );
    });

    it('should block AI for high and critical risk', () => {
      expect(riskGate.isAiAllowed('HIGH', DEFAULT_DECISION_CONFIG)).toBe(false);
      expect(riskGate.isAiAllowed('CRITICAL', DEFAULT_DECISION_CONFIG)).toBe(
        false
      );
    });
  });

  describe('isHumanRequired', () => {
    it('should not require human for low and medium risk', () => {
      expect(riskGate.isHumanRequired('LOW', DEFAULT_DECISION_CONFIG)).toBe(
        false
      );
      expect(riskGate.isHumanRequired('MEDIUM', DEFAULT_DECISION_CONFIG)).toBe(
        false
      );
    });

    it('should require human for high and critical risk', () => {
      expect(riskGate.isHumanRequired('HIGH', DEFAULT_DECISION_CONFIG)).toBe(
        true
      );
      expect(
        riskGate.isHumanRequired('CRITICAL', DEFAULT_DECISION_CONFIG)
      ).toBe(true);
    });
  });

  describe('isApprovalRequired', () => {
    it('should not require approval for low, medium, or high risk', () => {
      expect(riskGate.isApprovalRequired('LOW', DEFAULT_DECISION_CONFIG)).toBe(
        false
      );
      expect(
        riskGate.isApprovalRequired('MEDIUM', DEFAULT_DECISION_CONFIG)
      ).toBe(false);
      expect(riskGate.isApprovalRequired('HIGH', DEFAULT_DECISION_CONFIG)).toBe(
        false
      );
    });

    it('should require approval for critical risk', () => {
      expect(
        riskGate.isApprovalRequired('CRITICAL', DEFAULT_DECISION_CONFIG)
      ).toBe(true);
    });
  });
});
