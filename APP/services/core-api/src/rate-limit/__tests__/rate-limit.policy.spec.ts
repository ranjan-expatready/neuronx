import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimitPolicyService } from '../rate-limit.policy';
import { EntitlementService } from '../../config/entitlements/entitlement.service';
import { DEFAULT_RATE_LIMIT_CONFIG } from '../rate-limit.types';

describe('RateLimitPolicyService', () => {
  let service: RateLimitPolicyService;
  let entitlementService: any;

  beforeEach(() => {
    entitlementService = {
      getTenantEntitlement: vi.fn(),
      listTiers: vi
        .fn()
        .mockResolvedValue([{ tierId: 'free' }, { tierId: 'pro' }]),
    };
    service = new RateLimitPolicyService(
      entitlementService as EntitlementService
    );
  });

  describe('getPolicyForTenant', () => {
    it('should return tier-aware policy for active entitlement', async () => {
      entitlementService.getTenantEntitlement.mockResolvedValue({
        tierId: 'pro',
        status: 'active',
      });

      const policy = await service.getPolicyForTenant('tenant-1', 'api');

      // Default API policy is 100/min, burst 20. Pro might have overrides but we're using defaults in mock.
      expect(policy.limitPerMinute).toBeGreaterThan(0);
      expect(policy.mode).toBe('fail_closed');
    });

    it('should return conservative policy for inactive entitlement', async () => {
      entitlementService.getTenantEntitlement.mockResolvedValue({
        tierId: 'pro',
        status: 'suspended',
      });

      const policy = await service.getPolicyForTenant('tenant-1', 'api');
      const defaultApi = DEFAULT_RATE_LIMIT_CONFIG.defaultPolicies.api;

      expect(policy.limitPerMinute).toBe(
        Math.floor(defaultApi.limitPerMinute * 0.1)
      );
      expect(policy.mode).toBe('fail_closed');
    });

    it('should return conservative policy for missing entitlement', async () => {
      entitlementService.getTenantEntitlement.mockResolvedValue(null);

      const policy = await service.getPolicyForTenant('tenant-1', 'api');
      expect(policy.limitPerMinute).toBeGreaterThan(0);
    });

    it('should return conservative policy on entitlement service failure', async () => {
      entitlementService.getTenantEntitlement.mockRejectedValue(
        new Error('DB failure')
      );

      const policy = await service.getPolicyForTenant('tenant-1', 'api');
      expect(policy.limitPerMinute).toBeGreaterThan(0);
    });
  });

  describe('getPolicyForTier', () => {
    it('should apply tier overrides', async () => {
      const config = {
        tierOverrides: {
          enterprise: {
            api: { limitPerMinute: 1000, burst: 200 },
          },
        },
      };
      const customService = new RateLimitPolicyService(
        entitlementService,
        config as any
      );

      const policy = await customService.getPolicyForTier('enterprise', 'api');
      expect(policy.limitPerMinute).toBe(1000);
      expect(policy.burst).toBe(200);
    });

    it('should fallback to defaults if no override', async () => {
      const policy = await service.getPolicyForTier('unknown', 'api');
      expect(policy.limitPerMinute).toBe(
        DEFAULT_RATE_LIMIT_CONFIG.defaultPolicies.api.limitPerMinute
      );
    });
  });

  describe('getConservativePolicy', () => {
    it('should apply scope-specific multipliers', () => {
      const apiPolicy = service.getConservativePolicy('api');
      const webhookPolicy = service.getConservativePolicy('webhook');
      const adminPolicy = service.getConservativePolicy('admin');

      expect(apiPolicy.limitPerMinute).toBe(
        Math.floor(
          DEFAULT_RATE_LIMIT_CONFIG.defaultPolicies.api.limitPerMinute * 0.1
        )
      );
      expect(webhookPolicy.limitPerMinute).toBe(
        Math.floor(
          DEFAULT_RATE_LIMIT_CONFIG.defaultPolicies.webhook.limitPerMinute *
            0.05
        )
      );
      expect(adminPolicy.limitPerMinute).toBe(
        Math.floor(
          DEFAULT_RATE_LIMIT_CONFIG.defaultPolicies.admin.limitPerMinute * 0.2
        )
      );
    });
  });

  describe('getEmergencyPolicy', () => {
    it('should return highly restrictive limits', () => {
      const policy = service.getEmergencyPolicy('api');
      expect(policy.limitPerMinute).toBe(5);
      expect(policy.mode).toBe('fail_closed');
    });
  });

  describe('isRouteExcluded', () => {
    it('should check against excluded routes', () => {
      const customService = new RateLimitPolicyService(entitlementService, {
        excludedRoutes: ['/health', '/metrics'],
      } as any);

      expect(customService.isRouteExcluded('/health/liveness')).toBe(true);
      expect(customService.isRouteExcluded('/api/v1/leads')).toBe(false);
    });
  });

  describe('Tier Management', () => {
    it('should update and reset overrides', () => {
      service.updateTierOverrides('pro', 'api', { limitPerMinute: 500 });
      let policy = service.getConfig().tierOverrides.pro.api;
      expect(policy.limitPerMinute).toBe(500);

      service.resetTierOverrides('pro', 'api');
      expect(service.getConfig().tierOverrides.pro?.api).toBeUndefined();
    });

    it('should reset all overrides', () => {
      service.updateTierOverrides('pro', 'api', { limitPerMinute: 500 });
      service.resetTierOverrides();
      // Since we spread DEFAULT_RATE_LIMIT_CONFIG.tierOverrides which is usually empty in tests
      expect(service.getConfig().tierOverrides.pro).toBeUndefined();
    });
  });

  describe('Global toggle', () => {
    it('should set enabled flag', () => {
      service.setEnabled(false);
      expect((service.getConfig() as any).enabled).toBe(false);
      service.setEnabled(true);
      expect((service.getConfig() as any).enabled).toBe(true);
    });
  });

  describe('getAllTierPolicies', () => {
    it('should return policies for all tiers', async () => {
      const result = await service.getAllTierPolicies();
      expect(result.free).toBeDefined();
      expect(result.pro).toBeDefined();
      expect(result.free.api).toBeDefined();
    });
  });

  describe('compareTierPolicies', () => {
    it('should return comparison for specified tiers', async () => {
      const result = await service.compareTierPolicies(['free', 'pro'], 'api');
      expect(result.free).toBeDefined();
      expect(result.pro).toBeDefined();
    });

    it('should fallback to conservative on error', async () => {
      // Mock getPolicyForTier to fail for one tier
      vi.spyOn(service, 'getPolicyForTier').mockRejectedValueOnce(
        new Error('fail')
      );
      const result = await service.compareTierPolicies(['error-tier'], 'api');
      expect(result['error-tier'].limitPerMinute).toBe(
        service.getConservativePolicy('api').limitPerMinute
      );
    });
  });
});
