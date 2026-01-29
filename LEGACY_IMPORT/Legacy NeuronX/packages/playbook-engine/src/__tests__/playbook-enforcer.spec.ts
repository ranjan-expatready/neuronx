/**
 * Playbook Enforcer Tests - WI-028: Authoritative Playbook Engine
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanonicalOpportunityStage } from '@neuronx/pipeline';
import {
  PlaybookEnforcerImpl,
  PlaybookRegistry,
  StageEvaluator,
  ActionPlanner,
  PlaybookEnforcementMode,
  DEFAULT_INBOUND_LEAD_PLAYBOOK,
} from '../index';

// Mock dependencies
const mockRegistry: PlaybookRegistry = {
  getPlaybook: vi.fn(),
  listPlaybooks: vi.fn(),
  validatePlaybook: vi.fn(),
};

const mockEvaluator: StageEvaluator = {
  evaluateStage: vi.fn(),
  checkCondition: vi.fn(),
  getRequiredEvidence: vi.fn(),
};

const mockPlanner: ActionPlanner = {
  planStageActions: vi.fn(),
  planAction: vi.fn(),
};

describe('PlaybookEnforcer', () => {
  let enforcer: PlaybookEnforcerImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    enforcer = new PlaybookEnforcerImpl(
      mockRegistry,
      mockEvaluator,
      mockPlanner
    );
    enforcer.setEnforcementMode('monitor_only');
  });

  describe('evaluateTransition', () => {
    it('should allow transition when playbook not found in monitor mode', async () => {
      mockRegistry.getPlaybook.mockResolvedValue(null);

      const result = await enforcer.evaluateTransition(
        'tenant-123',
        'opp-456',
        'prospect_identified',
        'qualified',
        'inbound_lead_v1',
        []
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('not found');
      expect(result.enforced).toBe(false);
    });

    it('should block transition when playbook not found in block mode', async () => {
      enforcer.setEnforcementMode('block');
      mockRegistry.getPlaybook.mockResolvedValue(null);

      const result = await enforcer.evaluateTransition(
        'tenant-123',
        'opp-456',
        'prospect_identified',
        'qualified',
        'inbound_lead_v1',
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not found');
      expect(result.enforced).toBe(true);
    });

    it('should allow valid playbook transition', async () => {
      mockRegistry.getPlaybook.mockResolvedValue(DEFAULT_INBOUND_LEAD_PLAYBOOK);
      mockEvaluator.evaluateStage.mockReturnValue({
        canAdvance: true,
        nextStage: 'qualified',
        reason: 'Success condition met',
        requiredEvidence: ['call_connected'],
        missingEvidence: [],
        blockingActions: [],
      });
      mockPlanner.planStageActions.mockReturnValue([]);

      const result = await enforcer.evaluateTransition(
        'tenant-123',
        'opp-456',
        'prospect_identified',
        'qualified',
        'inbound_lead_v1',
        []
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Success condition met');
      expect(result.stageEvaluation).toBeDefined();
    });

    it('should block invalid playbook transition in block mode', async () => {
      enforcer.setEnforcementMode('block');
      mockRegistry.getPlaybook.mockResolvedValue(DEFAULT_INBOUND_LEAD_PLAYBOOK);
      mockEvaluator.evaluateStage.mockReturnValue({
        canAdvance: true,
        nextStage: 'qualified',
        reason: 'Success condition met',
        requiredEvidence: ['call_connected'],
        missingEvidence: [],
        blockingActions: [],
      });

      const result = await enforcer.evaluateTransition(
        'tenant-123',
        'opp-456',
        'prospect_identified',
        'closed_won', // Wrong next stage
        'inbound_lead_v1',
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('violates playbook');
      expect(result.enforced).toBe(true);
    });

    it('should generate execution commands for new stage', async () => {
      const mockCommands = [
        {
          commandId: 'cmd-123',
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
          priority: 'high',
        },
      ];

      mockRegistry.getPlaybook.mockResolvedValue(DEFAULT_INBOUND_LEAD_PLAYBOOK);
      mockEvaluator.evaluateStage.mockReturnValue({
        canAdvance: true,
        nextStage: 'qualified',
        reason: 'Success condition met',
        requiredEvidence: ['qualification_complete'],
        missingEvidence: [],
        blockingActions: [],
      });
      mockPlanner.planStageActions.mockReturnValue(mockCommands);

      const result = await enforcer.evaluateTransition(
        'tenant-123',
        'opp-456',
        'prospect_identified',
        'qualified',
        'inbound_lead_v1',
        []
      );

      expect(result.allowed).toBe(true);
      expect(result.executionCommands).toEqual(mockCommands);
    });
  });

  describe('getRequiredActions', () => {
    it('should return planned actions for stage', async () => {
      const mockCommands = [
        {
          commandId: 'cmd-123',
          commandType: 'EXECUTE_CONTACT',
          channel: 'voice',
        },
      ];

      mockRegistry.getPlaybook.mockResolvedValue(DEFAULT_INBOUND_LEAD_PLAYBOOK);
      mockPlanner.planStageActions.mockReturnValue(mockCommands);

      const commands = await enforcer.getRequiredActions(
        'tenant-123',
        'opp-456',
        'prospect_identified',
        'inbound_lead_v1'
      );

      expect(commands).toEqual(mockCommands);
      expect(mockPlanner.planStageActions).toHaveBeenCalledWith(
        DEFAULT_INBOUND_LEAD_PLAYBOOK,
        'prospect_identified',
        'opp-456',
        'tenant-123',
        expect.any(String)
      );
    });

    it('should return empty array when playbook not found', async () => {
      mockRegistry.getPlaybook.mockResolvedValue(null);

      const commands = await enforcer.getRequiredActions(
        'tenant-123',
        'opp-456',
        'prospect_identified',
        'nonexistent'
      );

      expect(commands).toEqual([]);
    });
  });

  describe('enforcement modes', () => {
    it('should not enforce in monitor_only mode', () => {
      enforcer.setEnforcementMode('monitor_only');
      expect(enforcer.getEnforcementMode()).toBe('monitor_only');
    });

    it('should enforce in block mode', () => {
      enforcer.setEnforcementMode('block');
      expect(enforcer.getEnforcementMode()).toBe('block');
    });

    it('should enforce in block_and_revert mode', () => {
      enforcer.setEnforcementMode('block_and_revert');
      expect(enforcer.getEnforcementMode()).toBe('block_and_revert');
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully in monitor mode', async () => {
      mockRegistry.getPlaybook.mockRejectedValue(new Error('Database error'));

      const result = await enforcer.evaluateTransition(
        'tenant-123',
        'opp-456',
        'prospect_identified',
        'qualified',
        'inbound_lead_v1',
        []
      );

      expect(result.allowed).toBe(true); // Monitor mode allows on error
      expect(result.reason).toContain('Enforcement error');
    });

    it('should block on errors in enforcement mode', async () => {
      enforcer.setEnforcementMode('block');
      mockRegistry.getPlaybook.mockRejectedValue(new Error('Database error'));

      const result = await enforcer.evaluateTransition(
        'tenant-123',
        'opp-456',
        'prospect_identified',
        'qualified',
        'inbound_lead_v1',
        []
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Enforcement error');
    });
  });
});
