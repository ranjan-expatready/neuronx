/**
 * Execution Authority Tests - WI-034: Multi-Channel Execution Authority
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NeuronXExecutionAuthority,
  ExecutionContext,
} from '../execution-authority';
import { ActorType } from '@neuronx/decision-engine';

// Mock dependencies
vi.mock('../channel-router', () => ({
  DeterministicChannelRouter: vi.fn().mockImplementation(() => ({
    routeChannel: vi.fn(),
  })),
}));

vi.mock('../execution-token.service', () => ({
  ExecutionTokenService: vi.fn().mockImplementation(() => ({
    executionRequiresToken: vi.fn(),
    createTokenData: vi.fn(),
  })),
}));

describe('NeuronXExecutionAuthority', () => {
  let executionAuthority: NeuronXExecutionAuthority;
  let mockTokenRepo: any;
  let mockChannelRouter: any;
  let mockTokenService: any;

  beforeEach(() => {
    mockTokenRepo = {};
    executionAuthority = new NeuronXExecutionAuthority(mockTokenRepo);

    // Get references to mocked instances
    mockChannelRouter = (executionAuthority as any).channelRouter;
    mockTokenService = (executionAuthority as any).tokenService;
  });

  describe('planExecution', () => {
    const baseContext: ExecutionContext = {
      tenantId: 'tenant_1',
      opportunityId: 'opp_1',
      executionCommand: {
        commandId: 'cmd_1',
        tenantId: 'tenant_1',
        opportunityId: 'opp_1',
        playbookId: 'pb_1',
        stageId: 'stage_1',
        actionId: 'action_1',
        commandType: 'EXECUTE_CONTACT',
        channel: 'voice',
        priority: 'normal',
      },
      decisionResult: {
        allowed: true,
        actor: ActorType.AI,
        mode: 'AUTONOMOUS',
        voiceMode: 'SCRIPTED',
        escalationRequired: false,
        executionConstraints: [],
        auditReason: 'Test execution',
      },
      currentStage: 'QUALIFIED',
      dealValue: 50000,
      riskScore: 30,
      slaUrgency: 'normal',
      retryCount: 0,
      evidenceSoFar: [],
      correlationId: 'corr_1',
    };

    it('should create execution plan for allowed execution', async () => {
      mockChannelRouter.routeChannel.mockResolvedValue({
        channel: 'voice',
        reason: 'Voice contact execution',
        confidence: 0.9,
      });

      mockTokenService.executionRequiresToken.mockReturnValue(true);
      mockTokenService.createTokenData.mockReturnValue({
        tokenId: '',
        tenantId: 'tenant_1',
        opportunityId: 'opp_1',
        actorType: 'AI',
        mode: 'AUTONOMOUS',
        channelScope: 'voice',
        commandType: 'EXECUTE_CONTACT',
        correlationId: 'corr_1',
        expiresAt: new Date(),
        createdAt: new Date(),
        createdBy: 'system',
      });

      const plan = await executionAuthority.planExecution(baseContext);

      expect(plan.allowed).toBe(true);
      expect(plan.channel).toBe('voice');
      expect(plan.actor).toBe('AI');
      expect(plan.mode).toBe('AUTONOMOUS');
      expect(plan.token).toBeDefined();
      expect(plan.correlationId).toBe('corr_1');
    });

    it('should reject high-risk AI executions', async () => {
      const highRiskContext = {
        ...baseContext,
        riskScore: 85, // Critical risk
        decisionResult: {
          ...baseContext.decisionResult,
          actor: ActorType.AI,
        },
      };

      const plan = await executionAuthority.planExecution(highRiskContext);

      expect(plan.allowed).toBe(false);
      expect(plan.reason).toContain('Critical risk blocks AI execution');
    });

    it('should require approval for high-risk AI executions', async () => {
      const mediumRiskContext = {
        ...baseContext,
        riskScore: 65, // High risk
        decisionResult: {
          ...baseContext.decisionResult,
          actor: ActorType.AI,
          mode: 'AUTONOMOUS', // Not approval required
        },
      };

      const plan = await executionAuthority.planExecution(mediumRiskContext);

      expect(plan.allowed).toBe(false);
      expect(plan.reason).toContain(
        'High-risk AI actions require approval mode'
      );
    });

    it('should route urgent SLA to appropriate channel', async () => {
      const urgentContext = {
        ...baseContext,
        slaUrgency: 'urgent',
        executionCommand: {
          ...baseContext.executionCommand,
          commandType: 'SEND_MESSAGE',
        },
      };

      mockChannelRouter.routeChannel.mockResolvedValue({
        channel: 'sms',
        reason: 'Urgent message via SMS',
        confidence: 0.95,
      });

      const plan = await executionAuthority.planExecution(urgentContext);

      expect(plan.channel).toBe('sms');
    });

    it('should block excessive retries with AI actor', async () => {
      const retryContext = {
        ...baseContext,
        retryCount: 5,
        decisionResult: {
          ...baseContext.decisionResult,
          actor: ActorType.AI,
        },
      };

      const plan = await executionAuthority.planExecution(retryContext);

      expect(plan.allowed).toBe(false);
      expect(plan.reason).toContain(
        'Excessive retries require human intervention'
      );
    });

    it('should include risk assessment in plan', async () => {
      mockChannelRouter.routeChannel.mockResolvedValue({
        channel: 'voice',
        reason: 'Voice execution',
        confidence: 0.8,
      });

      const plan = await executionAuthority.planExecution(baseContext);

      expect(plan.riskAssessment).toBeDefined();
      expect(plan.riskAssessment.level).toBe('low');
      expect(plan.riskAssessment.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('token lifecycle', () => {
    it('should issue token when requested', async () => {
      const mockPlan = {
        allowed: true,
        actor: 'AI',
        mode: 'AUTONOMOUS',
        channel: 'voice',
        adapterCommand: {
          commandId: 'cmd_1',
          commandType: 'EXECUTE_CONTACT',
          channelData: {},
        },
        constraints: {},
        correlationId: 'corr_1',
        auditReason: 'Test',
        riskAssessment: {
          level: 'low',
          score: 0,
          factors: [],
          mitigationStrategies: [],
        },
        token: {
          tokenId: '',
          tenantId: 'tenant_1',
          opportunityId: 'opp_1',
          actorType: 'AI',
          mode: 'AUTONOMOUS',
          channelScope: 'voice',
          commandType: 'EXECUTE_CONTACT',
          correlationId: 'corr_1',
          expiresAt: new Date(),
          createdAt: new Date(),
          createdBy: 'system',
        },
      };

      mockTokenService.issueToken.mockResolvedValue({
        ...mockPlan.token,
        tokenId: 'issued_token_123',
      });

      const token = await executionAuthority.issueToken(mockPlan, 'test_user');

      expect(token.tokenId).toBe('issued_token_123');
      expect(mockTokenService.issueToken).toHaveBeenCalledWith(
        mockPlan,
        'test_user'
      );
    });

    it('should verify token when requested', async () => {
      const mockVerification = {
        valid: true,
        canUse: true,
        reason: 'Token is valid',
      };

      mockTokenService.verifyToken.mockResolvedValue(mockVerification);

      const result = await executionAuthority.verifyToken('token_123', {
        channel: 'voice',
        commandType: 'EXECUTE_CONTACT',
      });

      expect(result).toEqual(mockVerification);
      expect(mockTokenService.verifyToken).toHaveBeenCalledWith('token_123', {
        channel: 'voice',
        commandType: 'EXECUTE_CONTACT',
      });
    });

    it('should mark token as used', async () => {
      await executionAuthority.markTokenUsed('token_123', 'test_user');

      expect(mockTokenService.markTokenUsed).toHaveBeenCalledWith(
        'token_123',
        'test_user'
      );
    });

    it('should revoke token', async () => {
      await executionAuthority.revokeToken(
        'token_123',
        'admin',
        'Security incident'
      );

      expect(mockTokenService.revokeToken).toHaveBeenCalledWith(
        'token_123',
        'admin',
        'Security incident'
      );
    });
  });
});
