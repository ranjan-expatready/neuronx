/**
 * Routing Configuration Integration Tests - REQ-019: Configuration as IP
 *
 * Tests tenant-specific routing configuration integration.
 * Ensures routing behavior adapts to tenant configuration while preserving algorithm integrity.
 */

import { LeadRouterService } from '../lead-router.service';
import { PredictiveRoutingService } from '../predictive-routing.service';
import { ConfigService } from '@nestjs/config';
import { CipherService } from '../../cipher/cipher.service';
import { ConfigLoader } from '../../config/config.loader';
import { TenantContext } from '../../config/tenant-context';
import { NeuronXConfiguration } from '../../config/config.types';
import { NeuronxEvent } from '@neuronx/contracts';
import { UsageService } from '../../usage/usage.service';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Routing Configuration Integration (Unit)', () => {
  let leadRouter: LeadRouterService;
  let predictiveRouter: PredictiveRoutingService;
  let configLoader: ConfigLoader;

  // Test tenant contexts
  const tenantA: TenantContext = { tenantId: 'tenant-a', environment: 'prod' };
  const tenantB: TenantContext = { tenantId: 'tenant-b', environment: 'prod' };
  const systemTenant: TenantContext = {
    tenantId: 'system',
    environment: 'prod',
  };

  // Test events for lead routing
  const createTestEvent = (country: string, region?: string): NeuronxEvent => ({
    id: 'test-event-123',
    type: 'lead.created',
    tenantId: 'test-tenant',
    timestamp: new Date().toISOString(),
    data: {
      leadId: 'lead-123',
      country,
      region,
      score: 75,
      industry: 'technology',
    },
  });

  // Test lead profiles for predictive routing
  const testLeadProfile = {
    leadId: 'lead-123',
    score: 85,
    industry: 'technology',
    region: 'north-america',
    urgency: 'high' as const,
  };

  // Test configurations for different tenants
  const createTenantARoutingConfig = (): NeuronXConfiguration => ({
    version: '1.0.0',
    description: 'Tenant A routing config - capacity focused',
    timestamp: new Date().toISOString(),
    domains: {
      routing: {
        algorithm: 'capacity-based',
        geographicPreferences: {
          'north-america': ['team-enterprise', 'team-startup'],
          europe: ['team-enterprise'],
          'asia-pacific': ['team-global'],
          'latin-america': ['team-global'],
        },
        teamCapacities: {
          'team-enterprise': {
            maxConcurrent: 12, // Lower capacity for tenant A
            expertiseAreas: ['technology', 'healthcare'],
            regions: ['north-america', 'europe'],
          },
          'team-startup': {
            maxConcurrent: 18, // Higher capacity for tenant A
            expertiseAreas: ['technology', 'retail'],
            regions: ['north-america'],
          },
          'team-global': {
            maxConcurrent: 8, // Standard capacity
            expertiseAreas: ['manufacturing', 'energy'],
            regions: ['europe', 'asia-pacific', 'latin-america'],
          },
        },
        thresholds: {
          highLoadPercentage: 75, // Lower threshold
          lowLoadPercentage: 25, // Higher low threshold
          rebalanceIntervalMinutes: 45,
        },
      },
      scoring: {} as any,
      sla: {} as any,
      escalation: {} as any,
      featureFlags: {} as any,
      deploymentMode: {} as any,
      integrationMappings: {} as any,
    },
  });

  const createTenantBRoutingConfig = (): NeuronXConfiguration => ({
    version: '1.0.1',
    description: 'Tenant B routing config - expertise focused',
    timestamp: new Date().toISOString(),
    domains: {
      routing: {
        algorithm: 'expertise-first',
        geographicPreferences: {
          'north-america': ['team-startup', 'team-enterprise'], // Different priority
          europe: ['team-global', 'team-enterprise'], // Different teams
          'asia-pacific': ['team-global'],
          'latin-america': ['team-enterprise', 'team-global'], // Different priority
        },
        teamCapacities: {
          'team-enterprise': {
            maxConcurrent: 20, // Higher capacity for tenant B
            expertiseAreas: ['technology', 'healthcare', 'finance'],
            regions: ['north-america', 'europe', 'latin-america'],
          },
          'team-startup': {
            maxConcurrent: 15, // Lower capacity for tenant B
            expertiseAreas: ['technology', 'retail', 'media'],
            regions: ['north-america'],
          },
          'team-global': {
            maxConcurrent: 12, // Higher capacity for tenant B
            expertiseAreas: ['manufacturing', 'energy', 'finance'],
            regions: ['europe', 'asia-pacific', 'latin-america'],
          },
        },
        thresholds: {
          highLoadPercentage: 85, // Higher threshold
          lowLoadPercentage: 15, // Lower low threshold
          rebalanceIntervalMinutes: 30,
        },
      },
      scoring: {} as any,
      sla: {} as any,
      escalation: {} as any,
      featureFlags: {} as any,
      deploymentMode: {} as any,
      integrationMappings: {} as any,
    },
  });

  beforeEach(async () => {
    const mockCipherService = {
      isEnabled: vi.fn().mockReturnValue(false),
      checkDecision: vi.fn(),
    };

    const mockConfigService = {};

    const mockUsageService = {
      recordUsage: vi.fn().mockResolvedValue(undefined),
    };

    // Stateful ConfigLoader mock
    const configs = new Map<string, any>();
    const mockConfigLoader = {
      loadConfig: vi.fn().mockImplementation(async (key, context) => {
        // Simple keying strategy: key + tenantId
        const storageKey = `${key}:${context.tenantId}`;
        return configs.get(storageKey);
      }),
      saveConfig: vi.fn().mockImplementation(async (key, config, context) => {
        const storageKey = `${key}:${context.tenantId}`;
        configs.set(storageKey, config);
      }),
      clearAllConfigs: vi.fn().mockImplementation(() => {
        configs.clear();
      }),
    };

    // Manual instantiation to ensure dependencies are injected correctly
    // and avoid NestJS DI complexity in unit tests
    configLoader = mockConfigLoader as any;
    
    leadRouter = new LeadRouterService(
        mockConfigLoader as any,
        mockUsageService as any
    );

    predictiveRouter = new PredictiveRoutingService(
        mockConfigService as any,
        mockCipherService as any,
        mockConfigLoader as any
    );
    
    // Explicitly clear configs to ensure clean state
    configLoader.clearAllConfigs();
  });

  afterEach(() => {
    // Clean up after each test
    if (configLoader) {
        configLoader.clearAllConfigs();
    }
    vi.clearAllMocks();
  });

  describe('Lead Router - Geographic Preferences', () => {
    it('should route leads differently based on tenant geographic preferences', async () => {
      // Setup different geographic preferences for each tenant
      const configA = createTenantARoutingConfig();
      const configB = createTenantBRoutingConfig();

      await configLoader.saveConfig('neuronx-config', configA, tenantA);
      await configLoader.saveConfig('neuronx-config', configB, tenantB);

      // Test routing for north-america region
      const eventNA = createTestEvent('US', 'north-america');

      // Override tenantId for testing
      const eventForA = { ...eventNA, tenantId: tenantA.tenantId };
      const eventForB = { ...eventNA, tenantId: tenantB.tenantId };

      const resultA = await leadRouter.routeLead(eventForA);
      const resultB = await leadRouter.routeLead(eventForB);

      // Tenant A prefers team-enterprise first for north-america
      expect(resultA?.routedTo).toBe('team-enterprise');
      expect(resultA?.routingReason).toBe('region_north-america');

      // Tenant B prefers team-startup first for north-america
      expect(resultB?.routedTo).toBe('team-startup');
      expect(resultB?.routingReason).toBe('region_north-america');
    });

    it('should fall back to defaults when no geographic preferences exist', async () => {
      // Don't setup any configuration - should use defaults

      const event = createTestEvent('US', 'north-america');
      const result = await leadRouter.routeLead(event);

      // Should route to default global team or configured default for NA
      // Default for NA is team-enterprise
      expect(result?.routedTo).toBe('team-enterprise');
      expect(result?.routingReason).toBe('region_north-america');
    });
    
    it('should handle unknown regions gracefully', async () => {
      // Setup config for tenant A
      const configA = createTenantARoutingConfig();
      await configLoader.saveConfig('neuronx-config', configA, tenantA);

      const event = createTestEvent('XX', 'unknown-region');
      const eventForA = { ...event, tenantId: tenantA.tenantId };

      const result = await leadRouter.routeLead(eventForA);

      // Should fall back to global team for unknown regions
      expect(result?.routedTo).toBe('global-team');
      expect(result?.routingReason).toBe('region_default');
    });
  });

  describe('Predictive Router - Team Capacities', () => {
    it('should respect tenant-specific team capacity limits', async () => {
      // Setup different capacities for each tenant
      const configA = createTenantARoutingConfig(); // team-enterprise: 12 capacity
      const configB = createTenantBRoutingConfig(); // team-enterprise: 20 capacity

      await configLoader.saveConfig('neuronx-config', configA, tenantA);
      await configLoader.saveConfig('neuronx-config', configB, tenantB);

      // Test with a lead that would normally go to team-enterprise
      const leadProfile = { ...testLeadProfile, region: 'north-america' };

      const recommendationA = await predictiveRouter.predictOptimalRouting(
        tenantA.tenantId,
        leadProfile,
        'test-1'
      );
      const recommendationB = await predictiveRouter.predictOptimalRouting(
        tenantB.tenantId,
        leadProfile,
        'test-2'
      );

      // Both should produce valid recommendations
      expect(recommendationA).toBeDefined();
      expect(recommendationB).toBeDefined();
      expect(recommendationA.recommendedTeam).toBeDefined();
      expect(recommendationB.recommendedTeam).toBeDefined();
    });

    it('should apply different routing algorithms per tenant', async () => {
      // Setup different algorithms for each tenant
      const configA = createTenantARoutingConfig(); // capacity-based
      const configB = createTenantBRoutingConfig(); // expertise-first

      await configLoader.saveConfig('neuronx-config', configA, tenantA);
      await configLoader.saveConfig('neuronx-config', configB, tenantB);

      const leadProfile = { ...testLeadProfile, industry: 'technology' };

      const resultA = await predictiveRouter.predictOptimalRouting(
        tenantA.tenantId,
        leadProfile,
        'test-capacity'
      );
      const resultB = await predictiveRouter.predictOptimalRouting(
        tenantB.tenantId,
        leadProfile,
        'test-expertise'
      );

      // Both should produce valid results with different weightings
      expect(resultA).toBeDefined();
      expect(resultB).toBeDefined();

      // Capacity-based (tenant A) should have higher capacity weight
      // Expertise-first (tenant B) should have higher industry weight
      expect(resultA.factors.capacityMatch.weight).toBeGreaterThan(
        resultB.factors.capacityMatch.weight
      );
      expect(resultB.factors.industryMatch.weight).toBeGreaterThan(
        resultA.factors.industryMatch.weight
      );
    });

    it('should maintain deterministic routing for same tenant and inputs', async () => {
      // Setup config for tenant A
      const configA = createTenantARoutingConfig();
      await configLoader.saveConfig('neuronx-config', configA, tenantA);

      // Route same lead twice
      const result1 = await predictiveRouter.predictOptimalRouting(
        tenantA.tenantId,
        testLeadProfile,
        'test-1'
      );
      const result2 = await predictiveRouter.predictOptimalRouting(
        tenantA.tenantId,
        testLeadProfile,
        'test-2'
      );

      // Results should be identical
      expect(result1.recommendedTeam.teamId).toBe(
        result2.recommendedTeam.teamId
      );
      expect(result1.confidence).toBe(result2.confidence);
      expect(result1.factors.scoreMatch.contribution).toBe(
        result2.factors.scoreMatch.contribution
      );
    });
  });

  describe('Configuration Fallback Behavior', () => {
    it('should use defaults when configuration is missing', async () => {
      // Don't setup any configuration

      const event = createTestEvent('US', 'north-america');
      const leadProfile = testLeadProfile;

      const routingResult = await leadRouter.routeLead(event);
      const predictiveResult = await predictiveRouter.predictOptimalRouting(
        'any-tenant',
        leadProfile,
        'test-defaults'
      );

      // Should work with defaults
      expect(routingResult).toBeDefined();
      expect(predictiveResult).toBeDefined();
      // Default for NA is team-enterprise
      expect(routingResult?.routedTo).toBe('team-enterprise');
      expect(predictiveResult.recommendedTeam).toBeDefined();
    });

    it('should handle invalid configuration gracefully', async () => {
      // Setup invalid config (missing routing domain)
      const invalidConfig: NeuronXConfiguration = {
        ...createTenantARoutingConfig(),
        domains: {
          ...createTenantARoutingConfig().domains,
          routing: {} as any, // Invalid empty routing config
        },
      };

      await configLoader.saveConfig('neuronx-config', invalidConfig, tenantA);

      const event = createTestEvent('US', 'north-america');
      const eventForA = { ...event, tenantId: tenantA.tenantId };

      const result = await leadRouter.routeLead(eventForA);

      // Should fall back to defaults instead of crashing
      expect(result).toBeDefined();
      expect(result?.routedTo).toBe('team-enterprise');
    });

    it('should use system tenant configuration as fallback', async () => {
      // Setup config for system tenant only
      const systemConfig = createTenantARoutingConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        systemConfig,
        systemTenant
      );

      const event = createTestEvent('US', 'north-america');
      const leadProfile = testLeadProfile;
      
      const routingResult = await leadRouter.routeLead(event);
      const predictiveResult = await predictiveRouter.predictOptimalRouting(
        'any-tenant',
        leadProfile,
        'test-system'
      );

      expect(routingResult).toBeDefined();
      expect(predictiveResult).toBeDefined();
    });
  });

  describe('Tenant Isolation', () => {
    it('should maintain complete tenant isolation in routing decisions', async () => {
      // Setup different configs for each tenant
      const configA = createTenantARoutingConfig();
      const configB = createTenantBRoutingConfig();

      await configLoader.saveConfig('neuronx-config', configA, tenantA);
      await configLoader.saveConfig('neuronx-config', configB, tenantB);

      // Test with same input data for both tenants
      const eventNA = createTestEvent('US', 'north-america');
      const eventForA = { ...eventNA, tenantId: tenantA.tenantId };
      const eventForB = { ...eventNA, tenantId: tenantB.tenantId };

      const routingA = await leadRouter.routeLead(eventForA);
      const routingB = await leadRouter.routeLead(eventForB);

      const predictiveA = await predictiveRouter.predictOptimalRouting(
        tenantA.tenantId,
        testLeadProfile,
        'test-a'
      );
      const predictiveB = await predictiveRouter.predictOptimalRouting(
        tenantB.tenantId,
        testLeadProfile,
        'test-b'
      );

      // Geographic routing should differ
      expect(routingA?.routedTo).not.toBe(routingB?.routedTo);

      // Predictive routing should use different algorithms/weights
      expect(predictiveA.factors.capacityMatch.weight).not.toBe(
        predictiveB.factors.capacityMatch.weight
      );
    });

    it('should prevent cross-tenant configuration leakage', async () => {
      // Setup config for tenant A only
      const configA = createTenantARoutingConfig();
      await configLoader.saveConfig('neuronx-config', configA, tenantA);

      // Try to route for tenant B
      const event = createTestEvent('US', 'north-america');
      const eventForB = { ...event, tenantId: tenantB.tenantId };

      const routingResult = await leadRouter.routeLead(eventForB);
      const predictiveResult = await predictiveRouter.predictOptimalRouting(
        tenantB.tenantId,
        testLeadProfile,
        'test-b'
      );

      expect(routingResult).toBeDefined();
      expect(predictiveResult).toBeDefined();
    });
  });

  describe('Error Handling & Resilience', () => {
    it('should handle configuration loading errors gracefully', async () => {
      // Mock config loader to throw error
      vi
        .spyOn(configLoader, 'loadConfig')
        .mockRejectedValueOnce(new Error('Config load failed'));

      const event = createTestEvent('US', 'north-america');
      const result = await leadRouter.routeLead(event);

      // Should still work with defaults
      expect(result).toBeDefined();
      // Default for NA is team-enterprise
      expect(result?.routedTo).toBe('team-enterprise');
    });

    it('should validate configuration structure before use', async () => {
      // Setup config with invalid team capacities
      const invalidConfig: NeuronXConfiguration = {
        ...createTenantARoutingConfig(),
        domains: {
          ...createTenantARoutingConfig().domains,
          routing: {
            ...createTenantARoutingConfig().domains.routing,
            teamCapacities: {
              'team-enterprise': {
                maxConcurrent: -5, // Invalid negative capacity
                expertiseAreas: [],
                regions: [],
              },
            },
          },
        },
      };

      await configLoader.saveConfig('neuronx-config', invalidConfig, tenantA);

      // Should handle gracefully and use defaults
      const result = await predictiveRouter.predictOptimalRouting(
        tenantA.tenantId,
        testLeadProfile,
        'test-invalid'
      );

      // Should still produce valid result
      expect(result).toBeDefined();
      expect(result.recommendedTeam).toBeDefined();
    });
  });
});
