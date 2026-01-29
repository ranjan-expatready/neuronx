import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntitlementService } from '../entitlement.service';
import { EntitlementRepository } from '../entitlement.repository';
import { TierLifecycleManager } from '../tier.lifecycle';
import { EntitlementTier, TenantEntitlement } from '../entitlement.types';

// Mock dependencies
const mockEntitlementRepository = {
  initializeCanonicalTiers: vi.fn(),
  getTier: vi.fn(),
  listTiers: vi.fn(),
  setTierImmediate: vi.fn(),
  getTenantEntitlement: vi.fn(),
} as unknown as EntitlementRepository;

const mockTierLifecycleManager = {
  validateTransition: vi.fn(),
  calculateTransitionEffect: vi.fn(),
  getGracePeriod: vi.fn(),
} as unknown as TierLifecycleManager;

describe('EntitlementService', () => {
  let service: EntitlementService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EntitlementService(
      mockTierLifecycleManager,
      mockEntitlementRepository
    );

    // @ts-ignore - access private maps for testing
    service['usageTracking'] = new Map();
    // @ts-ignore
    service['violations'] = [];
    // @ts-ignore
    service['scheduledActions'] = new Map();
  });

  const mockTier: EntitlementTier = {
    tierId: 'professional',
    name: 'Professional',
    description: 'Professional tier',
    category: 'paid',
    isActive: true,
    features: {
      domains: {
        scoring: true,
        routing: true,
        sla: true,
        escalation: true,
        featureFlags: false,
        deploymentMode: false,
        integrationMappings: false,
        voice: true,
      },
      features: {
        'advanced.analytics': true,
        'custom.reports': false,
      },
      integrations: {
        allowedTypes: ['crm'],
        maxActiveIntegrations: 5,
        customIntegrations: false,
      },
      ai: {
        advancedScoring: true,
        predictiveRouting: true,
        voiceAI: false,
        customModels: false,
      },
      support: {
        level: 'premium',
        responseTimeHours: 24,
        customSuccess: false,
      },
    },
    limits: {
      leads: { monthlyLimit: 1000, burstLimit: 100, perMinuteLimit: 10 },
      api: { monthlyLimit: 10000, perMinuteLimit: 100, burstAllowance: 50 },
      team: { maxMembers: 10, maxConcurrentUsers: 5, maxTeams: 2 },
      storage: { retentionDays: 30, maxVolumeGB: 10, backupFrequency: 'daily' },
      voice: {
        monthlyMinutes: 100,
        maxConcurrentCalls: 2,
        recordingRetentionDays: 30,
      },
      integrations: {
        maxWebhooks: 5,
        apiRateLimit: 50,
        syncFrequencyMinutes: 30,
      },
    },
    metadata: {
      targetSegment: 'SMB',
      valueProposition: 'Value',
      useCases: [],
      requirements: [],
      includedServices: [],
      transitions: { upgradeTo: [], downgradeTo: [], proration: 'none' },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockEntitlement: TenantEntitlement = {
    tenantId: 't1',
    tierId: 'professional',
    assignedAt: new Date().toISOString(),
    assignedBy: 'system',
    status: 'active',
    statusChangedAt: new Date().toISOString(),
  };

  describe('checkFeatureEntitlement', () => {
    const table = [
      {
        feature: 'domain.scoring',
        expected: true,
        reason: 'Feature allowed by tier',
      },
      {
        feature: 'domain.featureFlags',
        expected: false,
        reason: 'Feature not included in tier',
      },
      {
        feature: 'advanced.analytics',
        expected: true,
        reason: 'Feature allowed by tier',
      },
      {
        feature: 'custom.reports',
        expected: false,
        reason: 'Feature not included in tier',
      },
      {
        feature: 'ai.advancedScoring',
        expected: true,
        reason: 'Feature allowed by tier',
      },
      {
        feature: 'ai.voiceAI',
        expected: false,
        reason: 'Feature not included in tier',
      },
      {
        feature: 'integration.custom',
        expected: false,
        reason: 'Feature not included in tier',
      },
      {
        feature: 'unknown',
        expected: false,
        reason: 'Feature not included in tier',
      },
    ];

    it.each(table)(
      'should return $expected for $feature',
      async ({ feature, expected, reason }) => {
        vi.mocked(
          mockEntitlementRepository.getTenantEntitlement
        ).mockResolvedValue(mockEntitlement);
        vi.mocked(mockEntitlementRepository.getTier).mockResolvedValue(
          mockTier
        );

        const result = await service.checkFeatureEntitlement('t1', feature);
        expect(result.allowed).toBe(expected);
        expect(result.reason).toBe(reason);
      }
    );

    it('should return allowed: false if no entitlement', async () => {
      vi.mocked(
        mockEntitlementRepository.getTenantEntitlement
      ).mockResolvedValue(null);
      const result = await service.checkFeatureEntitlement(
        't1',
        'domain.scoring'
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No active entitlement found for tenant');
    });
  });

  describe('checkUsageLimit', () => {
    it('should allow within limits', async () => {
      vi.mocked(
        mockEntitlementRepository.getTenantEntitlement
      ).mockResolvedValue(mockEntitlement);
      vi.mocked(mockEntitlementRepository.getTier).mockResolvedValue(mockTier);

      const result = await service.checkUsageLimit('t1', 'leads', 500);
      expect(result.allowed).toBe(true);
      expect(result.usage?.current).toBe(0);
      expect(result.usage?.limit).toBe(1000);
    });

    it('should deny when exceeding limits', async () => {
      vi.mocked(
        mockEntitlementRepository.getTenantEntitlement
      ).mockResolvedValue(mockEntitlement);
      vi.mocked(mockEntitlementRepository.getTier).mockResolvedValue(mockTier);

      const result = await service.checkUsageLimit('t1', 'leads', 1500);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Usage limit exceeded');
    });

    it('should account for existing usage', async () => {
      vi.mocked(
        mockEntitlementRepository.getTenantEntitlement
      ).mockResolvedValue(mockEntitlement);
      vi.mocked(mockEntitlementRepository.getTier).mockResolvedValue(mockTier);

      await service.recordUsage('t1', 'leads', 800);
      const result = await service.checkUsageLimit('t1', 'leads', 300);
      expect(result.allowed).toBe(false);
      expect(result.usage?.current).toBe(800);
    });
  });

  describe('assignTenantTier', () => {
    it('should assign tier when valid', async () => {
      vi.mocked(mockEntitlementRepository.getTier).mockResolvedValue(mockTier);
      vi.mocked(
        mockEntitlementRepository.getTenantEntitlement
      ).mockResolvedValue(null);
      vi.mocked(mockEntitlementRepository.setTierImmediate).mockResolvedValue(
        mockEntitlement
      );

      const result = await service.assignTenantTier(
        't1',
        'professional',
        'admin'
      );
      expect(result).toEqual(mockEntitlement);
    });

    it('should throw if tier not found', async () => {
      vi.mocked(mockEntitlementRepository.getTier).mockResolvedValue(null);
      await expect(
        service.assignTenantTier('t1', 'nonexistent', 'admin')
      ).rejects.toThrow();
    });
  });

  describe('requestTierTransition', () => {
    it('should process immediate upgrade', async () => {
      const request = {
        tenantId: 't1',
        fromTier: 'free',
        toTier: 'professional',
        reason: 'Upgrade',
        requestedBy: 'user',
      };

      vi.mocked(mockTierLifecycleManager.validateTransition).mockReturnValue({
        allowed: true,
      });
      vi.mocked(
        mockEntitlementRepository.getTenantEntitlement
      ).mockResolvedValue({
        ...mockEntitlement,
        tierId: 'free',
      });
      vi.mocked(
        mockTierLifecycleManager.calculateTransitionEffect
      ).mockReturnValue({
        type: 'upgrade',
        effectiveTiming: 'immediate',
      });

      const result = await service.requestTierTransition(request);
      expect(result.success).toBe(true);
      expect(result.transition?.effectiveTiming).toBe('immediate');
      // @ts-ignore
      expect(service['tenantEntitlements'].get('t1').tierId).toBe(
        'professional'
      );
    });

    it('should process delayed downgrade with grace period', async () => {
      const request = {
        tenantId: 't1',
        fromTier: 'professional',
        toTier: 'starter',
        reason: 'Downgrade',
        requestedBy: 'user',
      };

      vi.mocked(mockTierLifecycleManager.validateTransition).mockReturnValue({
        allowed: true,
      });
      vi.mocked(
        mockEntitlementRepository.getTenantEntitlement
      ).mockResolvedValue(mockEntitlement);
      vi.mocked(
        mockTierLifecycleManager.calculateTransitionEffect
      ).mockReturnValue({
        type: 'downgrade',
        effectiveTiming: 'grace_period',
        gracePeriodDays: 7,
      });

      const result = await service.requestTierTransition(request);
      expect(result.success).toBe(true);
      expect(result.transition?.effectiveTiming).toBe('grace_period');
      expect(result.scheduledActions?.length).toBeGreaterThan(0);
    });

    it('should fail if transition validation fails', async () => {
      vi.mocked(mockTierLifecycleManager.validateTransition).mockReturnValue({
        allowed: false,
        reason: 'Invalid path',
      });

      const result = await service.requestTierTransition({
        tenantId: 't1',
        fromTier: 'enterprise',
        toTier: 'free',
        reason: 'Back to free',
        requestedBy: 'admin',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid path');
    });
  });

  describe('violations', () => {
    it('should report and retrieve violations', async () => {
      const violation = await service.reportViolation(
        't1',
        'usage_limit',
        'leads',
        { attemptedValue: 1100, limitValue: 1000 }
      );
      expect(violation.tenantId).toBe('t1');
      expect(violation.type).toBe('usage_limit');

      const violations = await service.getViolations('t1');
      expect(violations).toContainEqual(violation);
    });
  });
});
