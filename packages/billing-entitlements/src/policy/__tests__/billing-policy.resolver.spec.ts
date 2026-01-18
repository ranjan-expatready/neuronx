import { BillingPolicyResolver } from '../billing-policy.resolver';
import { BillingPolicy, PlanTier, UsageType } from '../billing-policy.types';
import { EnforcementMode } from '../../types';
import { describe, it, expect, beforeEach } from 'vitest';

describe('BillingPolicyResolver', () => {
  let resolver: BillingPolicyResolver;
  const testPolicy: BillingPolicy = {
    plans: {
      FREE: {
        name: 'Free Plan',
        limits: {
          executionsPerMonth: 100,
          voiceMinutesPerMonth: 10,
          experimentsPerMonth: 1,
          teams: 1,
          operators: 1,
        },
        enforcementMode: EnforcementMode.BLOCK,
        gracePeriodDays: 0,
        warningThresholds: [80, 95],
      },
      PRO: {
        name: 'Pro Plan',
        limits: {
          executionsPerMonth: 1000,
          voiceMinutesPerMonth: 100,
          experimentsPerMonth: 10,
          teams: 3,
          operators: 5,
        },
        enforcementMode: EnforcementMode.GRACE_PERIOD,
        gracePeriodDays: 7,
        warningThresholds: [80, 90, 95],
      },
      ENTERPRISE: {
        name: 'Enterprise Plan',
        limits: {
          executionsPerMonth: -1, // Unlimited
          voiceMinutesPerMonth: -1,
          experimentsPerMonth: -1,
          teams: -1,
          operators: -1,
        },
        enforcementMode: EnforcementMode.MONITOR_ONLY,
        gracePeriodDays: 30,
        warningThresholds: [90],
      },
    },
    usageExtraction: {
      voiceEstimates: [
        { voiceMode: 'SCRIPTED', estimatedMinutes: 2 },
        { voiceMode: 'CONVERSATIONAL', estimatedMinutes: 5 },
        { voiceMode: 'HUMAN_ONLY', estimatedMinutes: 10 },
      ],
      usageTypeMappings: [
        { channels: ['voice'], usageType: UsageType.VOICE_MINUTE, quantity: 0 },
        {
          channels: ['email', 'sms'],
          usageType: UsageType.EXECUTION,
          quantity: 1,
        },
      ],
    },
    enforcement: {
      defaultEnforcementMode: EnforcementMode.MONITOR_ONLY,
      defaultGracePeriodDays: 7,
      failClosedOnErrors: true,
    },
    warningThresholds: {
      softWarning: 80,
      hardWarning: 90,
      criticalWarning: 95,
    },
  };

  beforeEach(() => {
    resolver = new BillingPolicyResolver(testPolicy);
  });

  it('should return the initial policy', () => {
    const policy = resolver.getPolicy();
    expect(policy).toEqual(testPolicy);
  });

  it('should allow updating the policy', () => {
    const newPolicy: BillingPolicy = {
      ...testPolicy,
      enforcement: {
        ...testPolicy.enforcement,
        defaultEnforcementMode: EnforcementMode.BLOCK,
      },
    };

    resolver.setPolicy(newPolicy);
    const updatedPolicy = resolver.getPolicy();
    expect(updatedPolicy).toEqual(newPolicy);
    expect(updatedPolicy.enforcement.defaultEnforcementMode).toBe(
      EnforcementMode.BLOCK
    );
  });

  it('should return a consistent policy instance', () => {
    const policy1 = resolver.getPolicy();
    const policy2 = resolver.getPolicy();
    expect(policy1).toBe(policy2); // Should be the same object reference
  });

  describe('plan configuration access', () => {
    it('should get plan configuration for FREE tier', () => {
      const config = resolver.getPlanConfiguration(PlanTier.FREE);
      expect(config.name).toBe('Free Plan');
      expect(config.enforcementMode).toBe(EnforcementMode.BLOCK);
      expect(config.limits.executionsPerMonth).toBe(100);
    });

    it('should get plan limits for PRO tier', () => {
      const limits = resolver.getPlanLimits(PlanTier.PRO);
      expect(limits.executionsPerMonth).toBe(1000);
      expect(limits.teams).toBe(3);
    });

    it('should get enforcement mode for ENTERPRISE tier', () => {
      const mode = resolver.getPlanEnforcementMode(PlanTier.ENTERPRISE);
      expect(mode).toBe(EnforcementMode.MONITOR_ONLY);
    });

    it('should get grace period for PRO tier', () => {
      const gracePeriod = resolver.getPlanGracePeriod(PlanTier.PRO);
      expect(gracePeriod).toBe(7);
    });

    it('should get warning thresholds for FREE tier', () => {
      const thresholds = resolver.getPlanWarningThresholds(PlanTier.FREE);
      expect(thresholds).toEqual([80, 95]);
    });
  });

  describe('usage extraction', () => {
    it('should get voice minute estimate for SCRIPTED mode', () => {
      const estimate = resolver.getVoiceMinuteEstimate('SCRIPTED');
      expect(estimate).toBe(2);
    });

    it('should get voice minute estimate for CONVERSATIONAL mode', () => {
      const estimate = resolver.getVoiceMinuteEstimate('CONVERSATIONAL');
      expect(estimate).toBe(5);
    });

    it('should get usage type mapping for voice channel', () => {
      const mapping = resolver.getUsageTypeMapping('voice');
      expect(mapping).toBeDefined();
      expect(mapping?.usageType).toBe(UsageType.VOICE_MINUTE);
      expect(mapping?.quantity).toBe(0);
    });

    it('should get usage type mapping for email channel', () => {
      const mapping = resolver.getUsageTypeMapping('email');
      expect(mapping).toBeDefined();
      expect(mapping?.usageType).toBe(UsageType.EXECUTION);
      expect(mapping?.quantity).toBe(1);
    });
  });

  describe('unlimited checks', () => {
    it('should identify unlimited limits', () => {
      expect(resolver.isUnlimited(-1)).toBe(true);
      expect(resolver.isUnlimited(100)).toBe(false);
    });
  });

  describe('default values', () => {
    it('should return default enforcement mode', () => {
      const mode = resolver.getDefaultEnforcementMode();
      expect(mode).toBe(EnforcementMode.MONITOR_ONLY);
    });

    it('should return default grace period', () => {
      const gracePeriod = resolver.getDefaultGracePeriod();
      expect(gracePeriod).toBe(7);
    });
  });

  describe('warning level calculation', () => {
    it('should calculate warning levels correctly', () => {
      expect(resolver.getWarningLevel(75, 100)).toBe('none'); // 75% < 80%
      expect(resolver.getWarningLevel(85, 100)).toBe('soft'); // 85% >= 80%
      expect(resolver.getWarningLevel(92, 100)).toBe('hard'); // 92% >= 90%
      expect(resolver.getWarningLevel(97, 100)).toBe('critical'); // 97% >= 95%
    });

    it('should return none for unlimited plans', () => {
      expect(resolver.getWarningLevel(1000, -1)).toBe('none');
    });

    it('should handle edge cases', () => {
      expect(resolver.getWarningLevel(0, 100)).toBe('none');
      expect(resolver.getWarningLevel(100, 100)).toBe('critical');
    });
  });

  describe('global warning thresholds', () => {
    it('should return global warning thresholds', () => {
      const thresholds = resolver.getWarningThresholds();
      expect(thresholds.softWarning).toBe(80);
      expect(thresholds.hardWarning).toBe(90);
      expect(thresholds.criticalWarning).toBe(95);
    });
  });
});
