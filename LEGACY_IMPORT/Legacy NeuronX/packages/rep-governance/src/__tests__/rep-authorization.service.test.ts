import { describe, it, expect, beforeEach } from 'vitest';
import { RepAuthorizationService } from '../rep-authorization.service';
import {
  SkillTier,
  AuthorizationAction,
  AuthorizationResult,
  OverrideType,
} from '../rep-skill.enums';

describe('RepAuthorizationService', () => {
  const mockPolicy = {
    enforcementMode: 'monitor_only' as const,
    skillTiers: {
      L1: {
        name: 'Script-Locked',
        description: 'Entry-level restrictions',
        allowedFSMTransitions: [
          'prospect_identified->initial_contact',
          'initial_contact->qualified',
        ],
        blockedFSMTransitions: ['*->closed_won', '*->verbal_commit'],
        allowedVoiceModes: ['AUTONOMOUS', 'ASSISTED'],
        blockedVoiceModes: ['HUMAN_ONLY'],
        maxDealValue: 5000,
        canRecommendQualification: false,
        canRecommendDisqualification: false,
        canOverrideDecisions: false,
        requiresSupervisorApproval: true,
        escalationRequired: true,
      },
      L2: {
        name: 'Script-Guided',
        description: 'Experienced with guidance',
        allowedFSMTransitions: [
          'prospect_identified->initial_contact',
          'initial_contact->qualified',
          'qualified->proposal_sent',
        ],
        blockedFSMTransitions: ['*->closed_won'],
        allowedVoiceModes: ['AUTONOMOUS', 'ASSISTED', 'HUMAN_ONLY'],
        blockedVoiceModes: [],
        maxDealValue: 25000,
        canRecommendQualification: true,
        canRecommendDisqualification: true,
        canOverrideDecisions: false,
        requiresSupervisorApproval: false,
        escalationRequired: false,
      },
      L4: {
        name: 'Supervisor',
        description: 'Full override authority',
        allowedFSMTransitions: ['*'],
        blockedFSMTransitions: [],
        allowedVoiceModes: ['AUTONOMOUS', 'ASSISTED', 'HUMAN_ONLY'],
        blockedVoiceModes: [],
        maxDealValue: 1000000,
        canRecommendQualification: true,
        canRecommendDisqualification: true,
        canOverrideDecisions: true,
        requiresSupervisorApproval: false,
        escalationRequired: false,
      },
    },
    riskRestrictions: {
      high_risk: {
        allowedTiers: ['L4'],
        requiresDualApproval: true,
      },
    },
    overridePolicies: {
      DECISION_OVERRIDE: {
        allowedTiers: ['L4'],
        requiresJustification: true,
        justificationMinLength: 50,
      },
      ESCALATION_REQUEST: {
        allowedTiers: ['L1', 'L2', 'L3', 'L4'],
        requiresJustification: true,
        justificationMinLength: 25,
      },
    },
    trainingRequirements: {},
    advancementCriteria: {},
    auditPolicies: {
      allActionsAudited: true,
      skillTierIncludedInAudit: true,
      overrideJustificationsRequired: true,
      violationEscalationEnabled: true,
      complianceReportingEnabled: true,
    },
    emergencyProcedures: {},
    integrationPoints: {
      fsmTransitions: true,
      voiceOrchestration: true,
      executionAuthorization: true,
      decisionEngine: true,
      billingSystem: false,
    },
  };

  const authService = new RepAuthorizationService(mockPolicy, '1.0.0');

  describe('authorize', () => {
    describe('FSM Transition authorization', () => {
      it('should allow permitted FSM transitions for L2', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L2,
          action: AuthorizationAction.FSM_TRANSITION,
          context: {
            fromState: 'prospect_identified',
            toState: 'initial_contact',
          },
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.ALLOWED);
        expect(result.details.allowed).toBe(true);
        expect(result.details.violations).toHaveLength(0);
      });

      it('should deny blocked FSM transitions for L2', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L2,
          action: AuthorizationAction.FSM_TRANSITION,
          context: {
            fromState: 'qualified',
            toState: 'closed_won',
          },
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.DENIED);
        expect(result.details.allowed).toBe(false);
        expect(result.details.violations).toContain(
          'FSM transition not allowed for skill tier'
        );
      });

      it('should allow all transitions for L4 (supervisor)', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L4,
          action: AuthorizationAction.FSM_TRANSITION,
          context: {
            fromState: 'prospect_identified',
            toState: 'closed_won',
          },
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.ALLOWED);
        expect(result.details.allowed).toBe(true);
      });
    });

    describe('Voice Mode authorization', () => {
      it('should allow permitted voice modes for L2', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L2,
          action: AuthorizationAction.VOICE_MODE_SELECTION,
          context: {
            voiceMode: 'ASSISTED',
          },
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.ALLOWED);
        expect(result.details.allowed).toBe(true);
      });

      it('should deny blocked voice modes for L1', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L1,
          action: AuthorizationAction.VOICE_MODE_SELECTION,
          context: {
            voiceMode: 'HUMAN_ONLY',
          },
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.DENIED);
        expect(result.details.allowed).toBe(false);
        expect(result.details.violations).toContain(
          'Voice mode not allowed for skill tier'
        );
      });
    });

    describe('Deal Value authorization', () => {
      it('should allow deals within skill tier limits', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L2,
          action: AuthorizationAction.DEAL_VALUE_ACCESS,
          context: {
            dealValue: 15000, // Within L2 limit of $25K
          },
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.ALLOWED);
        expect(result.details.allowed).toBe(true);
      });

      it('should deny deals exceeding skill tier limits', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L2,
          action: AuthorizationAction.DEAL_VALUE_ACCESS,
          context: {
            dealValue: 50000, // Exceeds L2 limit of $25K
          },
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.DENIED);
        expect(result.details.allowed).toBe(false);
        expect(result.details.violations).toContain(
          'Deal value $50000 exceeds limit for skill tier L2'
        );
      });
    });

    describe('Decision Override authorization', () => {
      it('should allow overrides for L4', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L4,
          action: AuthorizationAction.DECISION_OVERRIDE,
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.ALLOWED);
        expect(result.details.allowed).toBe(true);
      });

      it('should deny overrides for L2', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L2,
          action: AuthorizationAction.DECISION_OVERRIDE,
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.DENIED);
        expect(result.details.allowed).toBe(false);
        expect(result.details.violations).toContain(
          'Decision override not authorized'
        );
      });
    });

    describe('Risk-based restrictions', () => {
      it('should require approval for high-risk operations', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L2,
          action: AuthorizationAction.EXECUTION_AUTHORIZATION,
          context: {
            riskLevel: 'high_risk',
          },
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.REQUIRES_APPROVAL);
        expect(result.override?.required).toBe(true);
        expect(result.override?.approvalRequired).toBe(true);
      });
    });

    describe('Supervisor approval requirements', () => {
      it('should require supervisor approval for L1 violations', () => {
        const request = {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L1,
          action: AuthorizationAction.FSM_TRANSITION,
          context: {
            fromState: 'qualified',
            toState: 'closed_won', // Blocked for L1
          },
          correlationId: 'corr-789',
        };

        const result = authService.authorize(request);

        expect(result.result).toBe(AuthorizationResult.REQUIRES_APPROVAL);
        expect(result.override?.required).toBe(true);
        expect(result.override?.justificationRequired).toBe(true);
      });
    });

    it('should include audit information in all responses', () => {
      const request = {
        tenantId: 'tenant-123',
        repId: 'rep-456',
        repSkillTier: SkillTier.L2,
        action: AuthorizationAction.FSM_TRANSITION,
        context: {
          fromState: 'prospect_identified',
          toState: 'initial_contact',
        },
        correlationId: 'corr-789',
      };

      const result = authService.authorize(request);

      expect(result.audit.timestamp).toBeInstanceOf(Date);
      expect(result.audit.policyVersion).toBe('1.0.0');
      expect(result.audit.correlationId).toBe('corr-789');
      expect(result.skillTier).toBe(SkillTier.L2);
    });
  });

  describe('processOverrideRequest', () => {
    it('should approve valid override requests for authorized tiers', () => {
      const overrideRequest = {
        tenantId: 'tenant-123',
        repId: 'rep-456',
        repSkillTier: SkillTier.L4,
        overrideType: OverrideType.DECISION_OVERRIDE,
        originalRequest: {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L4,
          action: AuthorizationAction.DECISION_OVERRIDE,
        },
        justification:
          'This is a valid business reason for the override that exceeds the minimum length requirement of 50 characters.',
        supervisorId: 'supervisor-789',
        correlationId: 'corr-101',
      };

      const result = authService.processOverrideRequest(overrideRequest);

      expect(result.approved).toBe(true);
      expect(result.reason).toBe('Override approved based on policy');
      expect(result.approvedBy).toBe('supervisor-789');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should reject override requests for unauthorized tiers', () => {
      const overrideRequest = {
        tenantId: 'tenant-123',
        repId: 'rep-456',
        repSkillTier: SkillTier.L2,
        overrideType: OverrideType.DECISION_OVERRIDE,
        originalRequest: {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L2,
          action: AuthorizationAction.DECISION_OVERRIDE,
        },
        justification: 'Valid justification',
        correlationId: 'corr-101',
      };

      const result = authService.processOverrideRequest(overrideRequest);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('not allowed for skill tier');
    });

    it('should reject justifications that are too short', () => {
      const overrideRequest = {
        tenantId: 'tenant-123',
        repId: 'rep-456',
        repSkillTier: SkillTier.L4,
        overrideType: OverrideType.DECISION_OVERRIDE,
        originalRequest: {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L4,
          action: AuthorizationAction.DECISION_OVERRIDE,
        },
        justification: 'Too short', // Less than 50 characters
        correlationId: 'corr-101',
      };

      const result = authService.processOverrideRequest(overrideRequest);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Justification too short');
    });

    it('should require supervisor approval when specified', () => {
      const overrideRequest = {
        tenantId: 'tenant-123',
        repId: 'rep-456',
        repSkillTier: SkillTier.L4,
        overrideType: OverrideType.DECISION_OVERRIDE,
        originalRequest: {
          tenantId: 'tenant-123',
          repId: 'rep-456',
          repSkillTier: SkillTier.L4,
          action: AuthorizationAction.DECISION_OVERRIDE,
        },
        justification:
          'This is a valid business reason for the override that exceeds the minimum length requirement of 50 characters.',
        // Missing supervisorId
        correlationId: 'corr-101',
      };

      const result = authService.processOverrideRequest(overrideRequest);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Supervisor approval required');
    });
  });

  describe('getRepSkillTier', () => {
    it('should return a default skill tier', () => {
      const tier = authService.getRepSkillTier('rep-123', 'tenant-456');
      expect(Object.values(SkillTier)).toContain(tier);
    });
  });
});
