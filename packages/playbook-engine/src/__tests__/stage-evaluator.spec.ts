/**
 * Stage Evaluator Tests - WI-028: Authoritative Playbook Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalOpportunityStage } from '@neuronx/pipeline';
import { StageEvaluatorImpl, DEFAULT_INBOUND_LEAD_PLAYBOOK } from '../index';

describe('StageEvaluator', () => {
  let evaluator: StageEvaluatorImpl;

  beforeEach(() => {
    evaluator = new StageEvaluatorImpl();
  });

  describe('evaluateStage', () => {
    it('should return error for non-existent stage', () => {
      const result = evaluator.evaluateStage(
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        'nonexistent_stage',
        []
      );

      expect(result.canAdvance).toBe(false);
      expect(result.reason).toContain('not found');
      expect(result.requiredEvidence).toEqual([]);
    });

    it('should require evidence for stage advancement', () => {
      const result = evaluator.evaluateStage(
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        'prospect_identified',
        [] // No evidence
      );

      expect(result.canAdvance).toBe(false);
      expect(result.reason).toContain('Missing required evidence');
      expect(result.missingEvidence).toContain('call_attempt_logged');
      expect(result.blockingActions).toContain('initial_contact_attempt');
    });

    it('should advance on success condition met', () => {
      const evidence = [
        {
          evidenceId: 'ev-1',
          tenantId: 'tenant-123',
          opportunityId: 'opp-456',
          playbookId: 'inbound_lead_v1',
          stageId: 'prospect_identified',
          actionId: 'initial_contact_attempt',
          evidenceType: 'call_connected' as const,
          collectedAt: new Date(),
          collectedBy: 'system',
          data: {},
          source: 'webhook' as const,
        },
      ];

      const result = evaluator.evaluateStage(
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        'prospect_identified',
        evidence
      );

      expect(result.canAdvance).toBe(true);
      expect(result.nextStage).toBe('initial_contact');
      expect(result.reason).toContain('Success condition met');
    });

    it('should advance to failure stage when failure condition met', () => {
      // Simulate retries exhausted
      const evidence = Array(3)
        .fill(null)
        .map((_, i) => ({
          evidenceId: `ev-${i}`,
          tenantId: 'tenant-123',
          opportunityId: 'opp-456',
          playbookId: 'inbound_lead_v1',
          stageId: 'prospect_identified',
          actionId: 'initial_contact_attempt',
          evidenceType: 'call_attempt_logged' as const,
          collectedAt: new Date(),
          collectedBy: 'system',
          data: { attemptNumber: i + 1 },
          source: 'webhook' as const,
        }));

      const result = evaluator.evaluateStage(
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        'prospect_identified',
        evidence
      );

      expect(result.canAdvance).toBe(true);
      expect(result.nextStage).toBe('lost');
      expect(result.reason).toContain('Failure condition met');
    });
  });

  describe('checkCondition', () => {
    it('should check evidence_present condition', () => {
      const evidence = [
        {
          evidenceType: 'call_connected',
          collectedAt: new Date(),
        },
      ];

      const condition = {
        conditionType: 'evidence_present' as const,
        evidenceType: 'call_connected' as const,
      };

      expect(evaluator.checkCondition(condition, evidence)).toBe(true);
    });

    it('should check evidence_present with threshold', () => {
      const evidence = [
        { evidenceType: 'call_attempt_logged', collectedAt: new Date() },
        { evidenceType: 'call_attempt_logged', collectedAt: new Date() },
      ];

      const condition = {
        conditionType: 'evidence_present' as const,
        evidenceType: 'call_attempt_logged' as const,
        threshold: 3,
        operator: 'gte' as const,
      };

      expect(evaluator.checkCondition(condition, evidence)).toBe(false);
    });

    it('should check evidence_absent condition', () => {
      const evidence = [
        { evidenceType: 'call_attempt_logged', collectedAt: new Date() },
      ];

      const condition = {
        conditionType: 'evidence_absent' as const,
        evidenceType: 'call_connected' as const,
      };

      expect(evaluator.checkCondition(condition, evidence)).toBe(true);
    });

    it('should handle manual_decision conditions', () => {
      const condition = {
        conditionType: 'manual_decision' as const,
      };

      expect(evaluator.checkCondition(condition, [])).toBe(false);
    });
  });

  describe('getRequiredEvidence', () => {
    it('should return evidence types required by stage actions', () => {
      const stage = DEFAULT_INBOUND_LEAD_PLAYBOOK.stages.prospect_identified;
      const required = evaluator.getRequiredEvidence(stage);

      expect(required).toEqual(['call_attempt_logged']);
    });

    it('should handle stages with multiple actions', () => {
      const stage = DEFAULT_INBOUND_LEAD_PLAYBOOK.stages.initial_contact;
      const required = evaluator.getRequiredEvidence(stage);

      expect(required).toEqual(['qualification_complete']);
    });
  });
});
