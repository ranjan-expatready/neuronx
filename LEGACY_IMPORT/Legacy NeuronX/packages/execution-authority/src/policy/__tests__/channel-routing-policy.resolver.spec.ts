import { ChannelRoutingPolicyResolver } from '../channel-routing-policy.resolver';
import { ChannelRoutingPolicy } from '../channel-routing-policy.types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ChannelRoutingPolicyResolver', () => {
  let resolver: ChannelRoutingPolicyResolver;
  const initialPolicy: ChannelRoutingPolicy = {
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
    ],
  };

  beforeEach(() => {
    resolver = new ChannelRoutingPolicyResolver(initialPolicy);
  });

  it('should return the initial policy', () => {
    const policy = resolver.getPolicy();
    expect(policy).toEqual(initialPolicy);
  });

  it('should allow updating the policy', () => {
    const newPolicy: ChannelRoutingPolicy = {
      ...initialPolicy,
      channelPriorityOrder: ['email', 'sms', 'voice', 'whatsapp', 'calendar'],
    };

    resolver.setPolicy(newPolicy);
    const updatedPolicy = resolver.getPolicy();
    expect(updatedPolicy).toEqual(newPolicy);
    expect(updatedPolicy.channelPriorityOrder[0]).toBe('email');
  });

  it('should return a consistent policy instance', () => {
    const policy1 = resolver.getPolicy();
    const policy2 = resolver.getPolicy();
    expect(policy1).toBe(policy2); // Should be the same object reference
  });

  it('should convert risk scores to risk levels correctly', () => {
    expect(resolver.getRiskLevel(85)).toBe('critical');
    expect(resolver.getRiskLevel(70)).toBe('high');
    expect(resolver.getRiskLevel(50)).toBe('medium');
    expect(resolver.getRiskLevel(20)).toBe('low');
    expect(resolver.getRiskLevel(0)).toBe('low');
  });

  it('should provide access to policy sections', () => {
    expect(resolver.getChannelPriorityOrder()).toEqual([
      'voice',
      'sms',
      'email',
      'whatsapp',
      'calendar',
    ]);
    expect(resolver.getRiskChannelConstraints()).toEqual({ critical: 'email' });
    expect(resolver.getDealValueRouting()).toHaveLength(1);
    expect(resolver.getSlaUrgencyOverrides()).toHaveLength(1);
    expect(resolver.getRetryFallbacks()).toHaveLength(1);
    expect(resolver.getHumanOnlyChannels()).toHaveLength(0);
    expect(resolver.getRiskScoreThresholds()).toEqual({
      critical: 80,
      high: 60,
      medium: 40,
      low: 0,
    });
    expect(resolver.getCommandFallbacks()).toHaveLength(1);
  });
});
