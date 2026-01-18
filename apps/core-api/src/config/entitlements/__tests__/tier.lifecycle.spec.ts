import { describe, it, expect } from 'vitest';
import {
  TierLifecycleManager,
  FeatureDowngradeHandler,
  DEFAULT_LIFECYCLE_CONFIG,
  TIER_HIERARCHY,
} from '../tier.lifecycle';

describe('TierLifecycleManager', () => {
  const manager = new TierLifecycleManager();

  describe('validateTransition', () => {
    const testCases = [
      { from: 'free', to: 'starter', expected: true },
      { from: 'free', to: 'professional', expected: false },
      { from: 'starter', to: 'professional', expected: true },
      { from: 'starter', to: 'free', expected: true },
      { from: 'professional', to: 'enterprise', expected: true },
      { from: 'professional', to: 'starter', expected: true },
      { from: 'enterprise', to: 'professional', expected: true },
      { from: 'enterprise', to: 'free', expected: false },
    ];

    it.each(testCases)(
      'should return $expected for transition from $from to $to',
      ({ from, to, expected }) => {
        const result = manager.validateTransition(from, to);
        expect(result.allowed).toBe(expected);
        if (!expected) {
          expect(result.reason).toContain('not allowed');
        }
      }
    );
  });

  describe('calculateTransitionEffect', () => {
    it('should return defined effect for professional -> starter (downgrade)', () => {
      const effect = manager.calculateTransitionEffect(
        'professional',
        'starter'
      );
      expect(effect.type).toBe('downgrade');
      expect(effect.effectiveTiming).toBe('grace_period');
      expect(effect.gracePeriodDays).toBe(14);
    });

    it('should return defined effect for starter -> professional (upgrade)', () => {
      const effect = manager.calculateTransitionEffect(
        'starter',
        'professional'
      );
      expect(effect.type).toBe('upgrade');
      expect(effect.effectiveTiming).toBe('immediate');
    });

    it('should return default effect for valid but undefined transition (free -> starter)', () => {
      const effect = manager.calculateTransitionEffect('free', 'starter');
      expect(effect.type).toBe('upgrade');
      expect(effect.effectiveTiming).toBe('immediate');
    });
  });

  describe('getGracePeriod', () => {
    const testCases = [
      { from: 'enterprise', to: 'professional', expected: 14 },
      { from: 'professional', to: 'starter', expected: 14 },
      { from: 'starter', to: 'free', expected: 7 },
      { from: 'free', to: 'starter', expected: 0 },
      {
        from: 'unknown',
        to: 'starter',
        expected: DEFAULT_LIFECYCLE_CONFIG.defaultGracePeriodDays,
      },
    ];

    it.each(testCases)(
      'should return $expected days for $from -> $to',
      ({ from, to, expected }) => {
        expect(manager.getGracePeriod(from, to)).toBe(expected);
      }
    );
  });

  describe('getFeatureDisablementBehavior', () => {
    it('should return immediate_disable for voice', () => {
      expect(manager.getFeatureDisablementBehavior('voice')).toBe(
        'immediate_disable'
      );
    });

    it('should return frozen_preserve for sla', () => {
      expect(manager.getFeatureDisablementBehavior('sla')).toBe(
        'frozen_preserve'
      );
    });

    it('should return immediate_disable for unknown domain', () => {
      expect(manager.getFeatureDisablementBehavior('unknown')).toBe(
        'immediate_disable'
      );
    });
  });
});

describe('FeatureDowngradeHandler', () => {
  const tenantId = 'tenant_123';

  it('should generate correct payload for voice disablement', () => {
    const payload = FeatureDowngradeHandler.handleVoiceDisablement(tenantId);
    expect(payload.action).toBe('disable_voice');
    expect(payload.tenantId).toBe(tenantId);
    expect(payload.domains.voice._disabled).toBe(true);
    expect(payload.notifications[0].feature).toBe('voice');
  });

  it('should generate correct payload for SLA freeze', () => {
    const payload = FeatureDowngradeHandler.handleSLAFreeze(tenantId);
    expect(payload.action).toBe('freeze_sla_escalation');
    expect(payload.domains.sla._frozen).toBe(true);
    expect(payload.domains.escalation._frozen).toBe(true);
  });

  it('should generate correct payload for routing degradation (starter)', () => {
    const payload = FeatureDowngradeHandler.handleRoutingDegrade(
      tenantId,
      'starter'
    );
    expect(payload.action).toBe('degrade_routing');
    expect(payload.domains.routing._maxCapacity).toBe(5);
  });

  it('should generate correct payload for routing degradation (free)', () => {
    const payload = FeatureDowngradeHandler.handleRoutingDegrade(
      tenantId,
      'free'
    );
    expect(payload.domains.routing._maxCapacity).toBe(1);
  });

  it('should generate correct payload for integration fallback', () => {
    const payload = FeatureDowngradeHandler.handleIntegrationFallback(tenantId);
    expect(payload.action).toBe('fallback_integrations');
    expect(payload.domains.integrationMappings._allowedIntegrations).toContain(
      'crm-basic'
    );
  });
});
