import { PlanMappingPolicyResolver } from '../plan-mapping-policy.resolver';
import { PlanMappingPolicy, PlanTier } from '../plan-mapping-policy.types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PlanMappingPolicyResolver', () => {
  let resolver: PlanMappingPolicyResolver;
  const testPolicy: PlanMappingPolicy = {
    version: '1.0.0',
    description: 'Test policy',
    productMappings: [
      {
        ghlProductId: 'prod_free_monthly',
        neuronxPlanTier: PlanTier.FREE,
        description: 'Free monthly plan',
        sku: 'free_monthly',
        enabled: true,
      },
      {
        ghlProductId: 'prod_pro_monthly',
        neuronxPlanTier: PlanTier.PRO,
        description: 'Pro monthly plan',
        sku: 'pro_monthly',
        priceId: 'price_pro_monthly',
        enabled: true,
      },
      {
        ghlProductId: 'prod_enterprise',
        neuronxPlanTier: PlanTier.ENTERPRISE,
        description: 'Enterprise plan',
        enabled: false, // Disabled for testing
      },
    ],
    environmentOverrides: [
      {
        environment: 'staging',
        mappings: [
          {
            ghlProductId: 'prod_staging_test',
            neuronxPlanTier: PlanTier.FREE,
            description: 'Staging test product',
            enabled: true,
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
    auditEnabled: true,
    alertOnFallback: true,
  };

  beforeEach(() => {
    resolver = new PlanMappingPolicyResolver(testPolicy);
  });

  it('should return the initial policy', () => {
    const policy = resolver.getPolicy();
    expect(policy).toEqual(testPolicy);
  });

  it('should allow updating the policy', () => {
    const newPolicy: PlanMappingPolicy = {
      ...testPolicy,
      version: '2.0.0',
    };

    resolver.setPolicy(newPolicy);
    const updatedPolicy = resolver.getPolicy();
    expect(updatedPolicy.version).toBe('2.0.0');
  });

  describe('plan tier resolution', () => {
    it('should resolve mapped product to correct plan tier', () => {
      const result = resolver.resolvePlanTier({
        ghlProductId: 'prod_free_monthly',
        environment: 'production',
        tenantId: 'tenant_1',
      });

      expect(result.planTier).toBe(PlanTier.FREE);
      expect(result.fallbackUsed).toBe(false);
      expect(result.reason).toBe('Mapped via default product mapping');
      expect(result.mapping?.neuronxPlanTier).toBe(PlanTier.FREE);
    });

    it('should use environment override when available', () => {
      const result = resolver.resolvePlanTier({
        ghlProductId: 'prod_staging_test',
        environment: 'staging',
        tenantId: 'tenant_1',
      });

      expect(result.planTier).toBe(PlanTier.FREE);
      expect(result.fallbackUsed).toBe(false);
      expect(result.reason).toBe('Mapped via environment override (staging)');
    });

    it('should skip disabled mappings', () => {
      const result = resolver.resolvePlanTier({
        ghlProductId: 'prod_enterprise',
        environment: 'production',
        tenantId: 'tenant_1',
      });

      expect(result.fallbackUsed).toBe(true);
      expect(result.planTier).toBe(PlanTier.FREE); // Grace fallback
    });

    it('should use grace fallback for unmapped products', () => {
      const mockLogger = vi
        .spyOn(resolver['logger'], 'warn')
        .mockImplementation(() => {});

      const result = resolver.resolvePlanTier({
        ghlProductId: 'prod_unknown',
        environment: 'production',
        tenantId: 'tenant_1',
      });

      expect(result.fallbackUsed).toBe(true);
      expect(result.planTier).toBe(PlanTier.FREE); // Grace period uses FREE
      expect(result.reason).toBe('Unmapped product - grace period (7 days)');
      expect(mockLogger).toHaveBeenCalledWith(
        'Using grace period fallback for unmapped product: prod_unknown',
        expect.any(Object)
      );
    });

    it('should use default tier fallback when configured', () => {
      // Update policy to use default_tier fallback
      const policyWithDefaultFallback: PlanMappingPolicy = {
        ...testPolicy,
        fallback: {
          ...testPolicy.fallback,
          behavior: 'default_tier',
          defaultTier: PlanTier.PRO,
        },
      };
      resolver.setPolicy(policyWithDefaultFallback);

      const result = resolver.resolvePlanTier({
        ghlProductId: 'prod_unknown',
        environment: 'production',
        tenantId: 'tenant_1',
      });

      expect(result.fallbackUsed).toBe(true);
      expect(result.planTier).toBe(PlanTier.PRO);
      expect(result.reason).toBe('Unmapped product - default tier (PRO)');
    });

    it('should block access when fallback is block', () => {
      const policyWithBlockFallback: PlanMappingPolicy = {
        ...testPolicy,
        fallback: {
          ...testPolicy.fallback,
          behavior: 'block',
        },
      };
      resolver.setPolicy(policyWithBlockFallback);

      expect(() => {
        resolver.resolvePlanTier({
          ghlProductId: 'prod_unknown',
          environment: 'production',
          tenantId: 'tenant_1',
        });
      }).toThrow(
        'Product prod_unknown is not mapped to any plan tier. Blocking access.'
      );
    });
  });

  describe('utility methods', () => {
    it('should return enabled mappings only', () => {
      const enabledMappings = resolver.getEnabledMappings();
      expect(enabledMappings).toHaveLength(2); // Only enabled mappings
      expect(enabledMappings.every(m => m.enabled)).toBe(true);
    });

    it('should validate product mappability', () => {
      expect(resolver.isProductMappable('prod_free_monthly')).toBe(true);
      expect(resolver.isProductMappable('prod_unknown')).toBe(false);
      expect(resolver.isProductMappable('prod_enterprise')).toBe(false); // Disabled
    });

    it('should return fallback configuration', () => {
      const fallback = resolver.getFallbackConfig();
      expect(fallback.behavior).toBe('grace_with_alert');
      expect(fallback.gracePeriodDays).toBe(7);
    });

    it('should check audit enabled status', () => {
      expect(resolver.isAuditEnabled()).toBe(true);
    });
  });

  describe('SKU and price matching', () => {
    it('should match products with SKU criteria', () => {
      const result = resolver.resolvePlanTier({
        ghlProductId: 'prod_free_monthly',
        sku: 'free_monthly',
        environment: 'production',
        tenantId: 'tenant_1',
      });

      expect(result.planTier).toBe(PlanTier.FREE);
      expect(result.fallbackUsed).toBe(false);
    });

    it('should reject products with mismatched SKU', () => {
      const result = resolver.resolvePlanTier({
        ghlProductId: 'prod_free_monthly',
        sku: 'wrong_sku',
        environment: 'production',
        tenantId: 'tenant_1',
      });

      expect(result.fallbackUsed).toBe(true);
    });

    it('should match products with price ID criteria', () => {
      const result = resolver.resolvePlanTier({
        ghlProductId: 'prod_pro_monthly',
        priceId: 'price_pro_monthly',
        environment: 'production',
        tenantId: 'tenant_1',
      });

      expect(result.planTier).toBe(PlanTier.PRO);
      expect(result.fallbackUsed).toBe(false);
    });
  });
});
