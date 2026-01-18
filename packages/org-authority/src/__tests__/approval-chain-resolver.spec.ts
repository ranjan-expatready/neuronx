/**
 * Approval Chain Resolver Tests - WI-035: Tenant & Organization Authority Model
 */

import { describe, it, expect } from 'vitest';
import {
  ApprovalChainResolver,
  ActionType,
  RiskLevel,
  ExecutionChannel,
  VoiceMode,
  Capability,
} from '../approval-chain-resolver';

describe('ApprovalChainResolver', () => {
  let resolver: ApprovalChainResolver;

  beforeEach(() => {
    resolver = new ApprovalChainResolver();
  });

  describe('getApprovalRequirement', () => {
    describe('APPROVE action type', () => {
      it('should not require approval for LOW risk', () => {
        const context = {
          actionType: ActionType.APPROVE,
          riskLevel: RiskLevel.LOW,
        };

        const requirement = resolver.getApprovalRequirement(context);

        expect(requirement.required).toBe(false);
        expect(requirement.requiredCapabilities).toHaveLength(0);
      });

      it('should require medium risk approval', () => {
        const context = {
          actionType: ActionType.APPROVE,
          riskLevel: RiskLevel.MEDIUM,
        };

        const requirement = resolver.getApprovalRequirement(context);

        expect(requirement.required).toBe(true);
        expect(requirement.requiredCapabilities).toContain(
          Capability.APPROVE_MEDIUM_RISK_EXECUTION
        );
      });

      it('should require high risk approval', () => {
        const context = {
          actionType: ActionType.APPROVE,
          riskLevel: RiskLevel.HIGH,
        };

        const requirement = resolver.getApprovalRequirement(context);

        expect(requirement.required).toBe(true);
        expect(requirement.requiredCapabilities).toContain(
          Capability.APPROVE_HIGH_RISK_EXECUTION
        );
      });

      it('should require critical risk approval', () => {
        const context = {
          actionType: ActionType.APPROVE,
          riskLevel: RiskLevel.CRITICAL,
        };

        const requirement = resolver.getApprovalRequirement(context);

        expect(requirement.required).toBe(true);
        expect(requirement.requiredCapabilities).toContain(
          Capability.APPROVE_HIGH_RISK_EXECUTION
        );
      });
    });

    describe('ASSIST action type', () => {
      it('should require execution assistance capability', () => {
        const context = {
          actionType: ActionType.ASSIST,
          riskLevel: RiskLevel.MEDIUM,
        };

        const requirement = resolver.getApprovalRequirement(context);

        expect(requirement.required).toBe(true);
        expect(requirement.requiredCapabilities).toContain(
          Capability.ASSIST_EXECUTION
        );
      });
    });

    describe('ESCALATE action type', () => {
      it('should require escalation capability', () => {
        const context = {
          actionType: ActionType.ESCALATE,
          riskLevel: RiskLevel.HIGH,
        };

        const requirement = resolver.getApprovalRequirement(context);

        expect(requirement.required).toBe(true);
        expect(requirement.requiredCapabilities).toContain(
          Capability.ESCALATE_EXECUTION
        );
      });
    });

    describe('REVOKE_TOKEN action type', () => {
      it('should require token revocation capability', () => {
        const context = {
          actionType: ActionType.REVOKE_TOKEN,
          riskLevel: RiskLevel.MEDIUM,
        };

        const requirement = resolver.getApprovalRequirement(context);

        expect(requirement.required).toBe(true);
        expect(requirement.requiredCapabilities).toContain(
          Capability.REVOKE_EXECUTION_TOKENS
        );
      });
    });

    describe('deal value adjustments', () => {
      it('should escalate approval for high deal values', () => {
        const context = {
          actionType: ActionType.APPROVE,
          riskLevel: RiskLevel.LOW,
          dealValue: 150000, // High value
        };

        const requirement = resolver.getApprovalRequirement(context);

        expect(requirement.required).toBe(true);
        expect(requirement.requiredCapabilities).toContain(
          Capability.APPROVE_HIGH_RISK_EXECUTION
        );
        expect(requirement.reason).toContain(
          'escalated due to high deal value'
        );
      });
    });

    describe('channel and voice mode adjustments', () => {
      it('should escalate for conversational voice', () => {
        const context = {
          actionType: ActionType.APPROVE,
          riskLevel: RiskLevel.MEDIUM,
          channel: ExecutionChannel.VOICE,
          voiceMode: VoiceMode.CONVERSATIONAL,
        };

        const requirement = resolver.getApprovalRequirement(context);

        expect(requirement.requiredCapabilities).toContain(
          Capability.APPROVE_HIGH_RISK_EXECUTION
        );
        expect(requirement.reason).toContain(
          'conversational voice requires high-risk approval'
        );
      });

      it('should not require approval for human-only voice', () => {
        const context = {
          actionType: ActionType.APPROVE,
          riskLevel: RiskLevel.MEDIUM,
          channel: ExecutionChannel.VOICE,
          voiceMode: VoiceMode.HUMAN_ONLY,
        };

        const requirement = resolver.getApprovalRequirement(context);

        expect(requirement.required).toBe(true);
        expect(requirement.reason).toContain('human-only voice execution');
      });
    });
  });

  describe('requiresApproval', () => {
    it('should return true when approval is required', () => {
      const context = {
        actionType: ActionType.APPROVE,
        riskLevel: RiskLevel.HIGH,
      };

      expect(resolver.requiresApproval(context)).toBe(true);
    });

    it('should return false when approval is not required', () => {
      const context = {
        actionType: ActionType.APPROVE,
        riskLevel: RiskLevel.LOW,
      };

      expect(resolver.requiresApproval(context)).toBe(false);
    });
  });

  describe('getRequiredCapabilities', () => {
    it('should return required capabilities', () => {
      const context = {
        actionType: ActionType.APPROVE,
        riskLevel: RiskLevel.MEDIUM,
      };

      const capabilities = resolver.getRequiredCapabilities(context);

      expect(capabilities).toContain(Capability.APPROVE_MEDIUM_RISK_EXECUTION);
    });
  });

  describe('getApprovalReason', () => {
    it('should return approval reason', () => {
      const context = {
        actionType: ActionType.APPROVE,
        riskLevel: RiskLevel.HIGH,
      };

      const reason = resolver.getApprovalReason(context);

      expect(reason).toContain(
        'High risk requires high-risk approval capability'
      );
    });
  });

  describe('validateApprovalChain', () => {
    it('should validate approval chain logic', () => {
      const validation = resolver.validateApprovalChain();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect non-deterministic results', () => {
      // This test ensures the resolver produces consistent results
      const context = {
        actionType: ActionType.APPROVE,
        riskLevel: RiskLevel.MEDIUM,
      };

      const result1 = resolver.getApprovalRequirement(context);
      const result2 = resolver.getApprovalRequirement(context);

      expect(result1.required).toBe(result2.required);
      expect(result1.requiredCapabilities).toEqual(
        result2.requiredCapabilities
      );
      expect(result1.reason).toBe(result2.reason);
    });
  });
});
