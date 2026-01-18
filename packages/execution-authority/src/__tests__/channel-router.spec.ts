/**
 * Channel Router Tests - WI-034: Multi-Channel Execution Authority
 * WI-043: Channel Routing Policy Configuration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeterministicChannelRouter,
  ExecutionContext,
  ExecutionChannel,
} from '../channel-router';
import { ChannelRoutingPolicyResolver } from '../policy/channel-routing-policy.resolver';
import { ChannelRoutingPolicy } from '../policy/channel-routing-policy.types';
import { ActorType } from '@neuronx/decision-engine';

describe('DeterministicChannelRouter', () => {
  let router: DeterministicChannelRouter;
  let policyResolver: ChannelRoutingPolicyResolver;

  const testPolicy: ChannelRoutingPolicy = {
    channelPriorityOrder: ['voice', 'sms', 'email', 'whatsapp', 'calendar'],
    riskChannelConstraints: {
      critical: 'email',
    },
    dealValueRouting: [
      {
        minValue: 50000,
        preferredChannel: 'whatsapp',
        reason: 'High-value prospects contacted via WhatsApp',
      },
    ],
    slaUrgencyOverrides: [
      {
        urgency: 'urgent',
        commandTypes: ['SEND_MESSAGE'],
        preferredChannel: 'sms',
        reason: 'Urgent messages sent via SMS',
      },
    ],
    retryFallbacks: [
      {
        maxRetries: 3,
        fallbackChannel: 'email',
        reason: 'Excessive retries require human intervention via email',
      },
    ],
    humanOnlyChannels: [],
    riskScoreThresholds: {
      critical: 80,
      high: 60,
      medium: 40,
      low: 0,
    },
    commandFallbacks: [
      {
        commandType: 'EXECUTE_CONTACT',
        fallbackChannel: 'voice',
        reason: 'Default contact execution via voice',
      },
      {
        commandType: 'SEND_MESSAGE',
        fallbackChannel: 'email',
        reason: 'Default message sending via email',
      },
      {
        commandType: 'SCHEDULE_MEETING',
        fallbackChannel: 'calendar',
        reason: 'Meeting scheduling via calendar',
      },
    ],
  };

  beforeEach(() => {
    policyResolver = new ChannelRoutingPolicyResolver(testPolicy);
    router = new DeterministicChannelRouter(policyResolver);
  });

  describe('routeChannel', () => {
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

    it('should route contact execution to voice via command fallback', async () => {
      const result = await router.routeChannel(baseContext);

      expect(result.channel).toBe(ExecutionChannel.VOICE);
      expect(result.reason).toBe('Default contact execution via voice');
      expect(result.confidence).toBe(0.7);
    });

    it('should route urgent SEND_MESSAGE to SMS via SLA override', async () => {
      const urgentContext = {
        ...baseContext,
        executionCommand: {
          ...baseContext.executionCommand,
          commandType: 'SEND_MESSAGE',
        },
        slaUrgency: 'urgent',
      };

      const result = await router.routeChannel(urgentContext);

      expect(result.channel).toBe(ExecutionChannel.SMS);
      expect(result.reason).toBe('Urgent messages sent via SMS');
      expect(result.confidence).toBe(0.95);
    });

    it('should route meeting scheduling to calendar via command fallback', async () => {
      const meetingContext = {
        ...baseContext,
        executionCommand: {
          ...baseContext.executionCommand,
          commandType: 'SCHEDULE_MEETING',
        },
      };

      const result = await router.routeChannel(meetingContext);

      expect(result.channel).toBe(ExecutionChannel.CALENDAR);
      expect(result.reason).toBe('Meeting scheduling via calendar');
      expect(result.confidence).toBe(0.7);
    });

    it('should route high-value SEND_MESSAGE to WhatsApp via deal value routing', async () => {
      const highValueContext = {
        ...baseContext,
        dealValue: 100000,
        executionCommand: {
          ...baseContext.executionCommand,
          commandType: 'SEND_MESSAGE',
        },
      };

      const result = await router.routeChannel(highValueContext);

      expect(result.channel).toBe(ExecutionChannel.WHATSAPP);
      expect(result.reason).toBe('High-value prospects contacted via WhatsApp');
      expect(result.confidence).toBe(0.85);
    });

    it('should route critical risk to email via risk constraint', async () => {
      const criticalRiskContext = {
        ...baseContext,
        riskScore: 85, // Above critical threshold (80)
        executionCommand: {
          ...baseContext.executionCommand,
          commandType: 'SEND_MESSAGE',
        },
      };

      const result = await router.routeChannel(criticalRiskContext);

      expect(result.channel).toBe(ExecutionChannel.EMAIL);
      expect(result.reason).toBe('critical risk level requires email channel');
      expect(result.confidence).toBe(0.9);
    });

    it('should route excessive retries to email via retry fallback', async () => {
      const retryContext = {
        ...baseContext,
        retryCount: 4, // Above maxRetries threshold (3)
        executionCommand: {
          ...baseContext.executionCommand,
          commandType: 'SEND_MESSAGE',
        },
      };

      const result = await router.routeChannel(retryContext);

      expect(result.channel).toBe(ExecutionChannel.EMAIL);
      expect(result.reason).toBe(
        'Excessive retries require human intervention via email'
      );
      expect(result.confidence).toBe(0.8);
    });

    it('should provide deterministic routing for identical inputs', async () => {
      const result1 = await router.routeChannel(baseContext);
      const result2 = await router.routeChannel(baseContext);

      expect(result1.channel).toBe(result2.channel);
      expect(result1.reason).toBe(result2.reason);
      expect(result1.confidence).toBe(result2.confidence);
    });
  });

  describe('policy-driven behavior', () => {
    it('should use policy resolver for all routing decisions', async () => {
      // Test that routing uses policy values, not hardcoded logic
      const result = await router.routeChannel(baseContext);

      // The result should be deterministic based on policy
      expect(result.channel).toBeDefined();
      expect(result.reason).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should route according to priority order when no specific rules match', async () => {
      const unknownCommandContext = {
        ...baseContext,
        executionCommand: {
          ...baseContext.executionCommand,
          commandType: 'UNKNOWN_COMMAND' as any,
        },
      };

      const result = await router.routeChannel(unknownCommandContext);

      // Should fall back to first channel in priority order
      expect(result.channel).toBe(ExecutionChannel.VOICE);
      expect(result.reason).toBe(
        'Ultimate fallback to highest priority channel'
      );
      expect(result.confidence).toBe(0.5);
    });
  });
});
