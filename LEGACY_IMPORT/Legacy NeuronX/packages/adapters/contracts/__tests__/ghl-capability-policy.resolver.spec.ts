import { GhlCapabilityPolicyResolver } from '../ghl-capability-policy.resolver';
import {
  GhlCapabilityPolicy,
  PlanTier,
  GhlCapability,
  CapabilityEnforcementMode,
} from '../ghl-capability-policy.types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('GhlCapabilityPolicyResolver', () => {
  let resolver: GhlCapabilityPolicyResolver;
  const testPolicy: GhlCapabilityPolicy = {
    version: '1.0.0',
    description: 'Test policy',
    planCapabilityMatrices: [
      {
        planTier: PlanTier.FREE,
        description: 'Free plan capabilities',
        capabilities: [
          {
            capability: GhlCapability.CRM_CREATE_LEAD,
            enforcementMode: CapabilityEnforcementMode.ALLOW_WITH_AUDIT,
            limits: { maxRequestsPerHour: 10 },
            description: 'Basic lead creation',
            enabled: true,
          },
          {
            capability: GhlCapability.CONVERSATION_SEND_MESSAGE,
            enforcementMode: CapabilityEnforcementMode.BLOCK,
            description: 'Messaging blocked on free',
            enabled: true,
          },
        ],
      },
      {
        planTier: PlanTier.PRO,
        description: 'Pro plan capabilities',
        capabilities: [
          {
            capability: GhlCapability.CRM_CREATE_LEAD,
            enforcementMode: CapabilityEnforcementMode.ALLOW_WITH_LIMITS,
            limits: { maxRequestsPerHour: 100 },
            description: 'Full lead creation',
            enabled: true,
          },
          {
            capability: GhlCapability.WORKFLOW_TRIGGER,
            enforcementMode: CapabilityEnforcementMode.ALLOW_WITH_LIMITS,
            limits: { maxRequestsPerHour: 20 },
            description: 'Workflow automation',
            enabled: true,
          },
        ],
      },
    ],
    environmentOverrides: [
      {
        environment: 'staging',
        mappings: [
          {
            planTier: PlanTier.FREE,
            description: 'Staging overrides',
            capabilities: [
              {
                capability: GhlCapability.CONVERSATION_SEND_MESSAGE,
                enforcementMode: CapabilityEnforcementMode.ALLOW_WITH_AUDIT,
                description: 'Messaging allowed in staging',
                enabled: true,
              },
            ],
          },
        ],
      },
    ],
    fallback: {
      behavior: 'grace_with_alert',
      defaultTier: PlanTier.FREE,
      alertChannels: ['alert@example.com'],
      gracePeriodDays: 7,
    },
    audit: {
      auditCapabilityUsage: true,
      auditCapabilityDenials: true,
      auditCapabilityLimitsExceeded: true,
      auditRetentionDays: 90,
    },
  };

  beforeEach(() => {
    resolver = new GhlCapabilityPolicyResolver(testPolicy);
  });

  it('should return the initial policy', () => {
    const policy = resolver.getPolicy();
    expect(policy).toEqual(testPolicy);
  });

  describe('capability checking', () => {
    it('should allow capability for FREE plan', () => {
      const result = resolver.checkCapability({
        tenantId: 'tenant_1',
        planTier: PlanTier.FREE,
        capability: GhlCapability.CRM_CREATE_LEAD,
        environment: 'production',
      });

      expect(result.allowed).toBe(true);
      expect(result.enforcementMode).toBe(
        CapabilityEnforcementMode.ALLOW_WITH_AUDIT
      );
      expect(result.reason).toBe('Plan configuration: Basic lead creation');
    });

    it('should block capability for FREE plan', () => {
      const result = resolver.checkCapability({
        tenantId: 'tenant_1',
        planTier: PlanTier.FREE,
        capability: GhlCapability.CONVERSATION_SEND_MESSAGE,
        environment: 'production',
      });

      expect(result.allowed).toBe(false);
      expect(result.enforcementMode).toBe(CapabilityEnforcementMode.BLOCK);
      expect(result.reason).toBe(
        'Plan configuration: Messaging blocked on free'
      );
    });

    it('should use environment override', () => {
      const result = resolver.checkCapability({
        tenantId: 'tenant_1',
        planTier: PlanTier.FREE,
        capability: GhlCapability.CONVERSATION_SEND_MESSAGE,
        environment: 'staging',
      });

      expect(result.allowed).toBe(true);
      expect(result.enforcementMode).toBe(
        CapabilityEnforcementMode.ALLOW_WITH_AUDIT
      );
      expect(result.reason).toBe(
        'Environment override (staging): Messaging allowed in staging'
      );
    });

    it('should handle unknown capabilities with fallback', () => {
      const mockLogger = vi
        .spyOn(resolver['logger'], 'warn')
        .mockImplementation(() => {});

      const result = resolver.checkCapability({
        tenantId: 'tenant_1',
        planTier: PlanTier.FREE,
        capability: 'unknown_capability' as GhlCapability,
        environment: 'production',
      });

      expect(result.allowed).toBe(true); // Grace period fallback
      expect(result.enforcementMode).toBe('grace_with_alert');
      expect(result.reason).toBe(
        'Unknown capability fallback: grace_with_alert'
      );
      expect(mockLogger).toHaveBeenCalledWith(
        'Capability fallback triggered',
        expect.any(Object)
      );
    });

    it('should block unknown capabilities when fallback is block', () => {
      const policyWithBlockFallback = {
        ...testPolicy,
        fallback: { ...testPolicy.fallback, behavior: 'block' as const },
      };
      resolver.setPolicy(policyWithBlockFallback);

      expect(() => {
        resolver.checkCapability({
          tenantId: 'tenant_1',
          planTier: PlanTier.FREE,
          capability: 'unknown_capability' as GhlCapability,
          environment: 'production',
        });
      }).toThrow(
        'Product unknown_capability is not mapped to any plan tier. Blocking access.'
      );
    });
  });

  describe('capability configuration access', () => {
    it('should get capability config for existing capability', () => {
      const config = resolver.getCapabilityConfig(
        PlanTier.FREE,
        GhlCapability.CRM_CREATE_LEAD
      );
      expect(config).toBeDefined();
      expect(config?.enforcementMode).toBe(
        CapabilityEnforcementMode.ALLOW_WITH_AUDIT
      );
      expect(config?.limits?.maxRequestsPerHour).toBe(10);
    });

    it('should return null for non-existent capability', () => {
      const config = resolver.getCapabilityConfig(
        PlanTier.FREE,
        'non_existent' as GhlCapability
      );
      expect(config).toBeNull();
    });

    it('should get all capabilities for a plan', () => {
      const capabilities = resolver.getPlanCapabilities(PlanTier.PRO);
      expect(capabilities).toHaveLength(2);
      expect(capabilities.every(c => c.enabled)).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should validate capability existence', () => {
      expect(
        resolver.validateCapabilityExists(
          PlanTier.FREE,
          GhlCapability.CRM_CREATE_LEAD
        )
      ).toBe(true);
      expect(
        resolver.validateCapabilityExists(
          PlanTier.FREE,
          'non_existent' as GhlCapability
        )
      ).toBe(false);
    });

    it('should return fallback configuration', () => {
      const fallback = resolver.getFallbackConfig();
      expect(fallback.behavior).toBe('grace_with_alert');
      expect(fallback.gracePeriodDays).toBe(7);
    });

    it('should check audit enabled status', () => {
      expect(resolver.isAuditEnabled('auditCapabilityUsage')).toBe(true);
      expect(resolver.isAuditEnabled('auditCapabilityDenials')).toBe(true);
      expect(resolver.isAuditEnabled('non_existent' as any)).toBe(false);
    });
  });
});
