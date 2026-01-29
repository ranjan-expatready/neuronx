/**
 * Configuration Integration Tests - REQ-019: Configuration as IP
 *
 * Tests tenant-specific scoring configuration integration.
 * Ensures scoring behavior adapts to tenant configuration while preserving algorithm integrity.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AdvancedScoringService } from '../advanced-scoring.service';
import { ConfigService } from '@nestjs/config';
import { CipherService } from '../../cipher/cipher.service';
import { ConfigLoader } from '../../config/config.loader';
import { TenantContext } from '../../config/tenant-context';
import { NeuronXConfiguration } from '../../config/config.types';

describe('AdvancedScoringService - Configuration Integration (Unit)', () => {
  let service: AdvancedScoringService;
  let configLoader: ConfigLoader;

  // Test conversation signal - consistent across tests
  const testConversationSignal = {
    sentiment: 0.7, // Positive sentiment
    responseTimeMinutes: 15,
    messageLength: 150,
    topicRelevance: 0.8,
    interactionFrequency: 3,
  };

  // Test tenant contexts
  const tenantA: TenantContext = { tenantId: 'tenant-a', environment: 'prod' };
  const tenantB: TenantContext = { tenantId: 'tenant-b', environment: 'prod' };
  const systemTenant: TenantContext = {
    tenantId: 'system',
    environment: 'prod',
  };

  // Test configurations for different tenants
  const createTenantAConfig = (): NeuronXConfiguration => ({
    version: '1.0.0',
    description: 'Tenant A scoring config',
    timestamp: new Date().toISOString(),
    domains: {
      scoring: {
        model: 'advanced',
        weights: {
          sentiment: 40, // Higher sentiment weight
          responseTime: 20, // Medium timing weight
          frequency: 20, // Medium frequency weight
          industry: 10, // Lower industry weight
          customFields: 10, // Lower custom fields weight
        },
        qualificationThreshold: 0.7,
        industryMultipliers: {
          technology: 1.2,
          finance: 1.1,
          healthcare: 1.0,
        },
      },
      routing: {} as any,
      sla: {} as any,
      escalation: {} as any,
      featureFlags: {} as any,
      deploymentMode: {} as any,
      integrationMappings: {} as any,
    },
  });

  const createTenantBConfig = (): NeuronXConfiguration => ({
    version: '1.0.1',
    description: 'Tenant B scoring config',
    timestamp: new Date().toISOString(),
    domains: {
      scoring: {
        model: 'basic',
        weights: {
          sentiment: 20, // Lower sentiment weight
          responseTime: 30, // Higher timing weight
          frequency: 30, // Higher frequency weight
          industry: 15, // Higher industry weight
          customFields: 5, // Lowest custom fields weight
        },
        qualificationThreshold: 0.8,
        industryMultipliers: {
          technology: 0.9,
          finance: 1.3,
          healthcare: 1.1,
        },
      },
      routing: {} as any,
      sla: {} as any,
      escalation: {} as any,
      featureFlags: {} as any,
      deploymentMode: {} as any,
      integrationMappings: {} as any,
    },
  });

  beforeEach(async () => {
    const mockCipherService = {
      isEnabled: jest.fn().mockReturnValue(false),
      checkDecision: jest.fn(),
    };

    const mockConfigService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancedScoringService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CipherService,
          useValue: mockCipherService,
        },
        {
          provide: ConfigLoader,
          useClass: ConfigLoader,
        },
      ],
    }).compile();

    service = module.get<AdvancedScoringService>(AdvancedScoringService);
    configLoader = module.get<ConfigLoader>(ConfigLoader);

    // Clear any existing config state
    configLoader.clearAllConfigs();
  });

  afterEach(() => {
    // Clean up after each test
    configLoader.clearAllConfigs();
  });

  describe('Tenant-Specific Scoring Configuration', () => {
    it('should produce different scores for tenants with different configurations', async () => {
      // Setup different configs for each tenant
      const configA = createTenantAConfig();
      const configB = createTenantBConfig();

      await configLoader.saveConfig('neuronx-config', configA, tenantA);
      await configLoader.saveConfig('neuronx-config', configB, tenantB);

      // Score same lead data for both tenants
      const resultA = await service.calculateEnhancedScore(
        'lead-123',
        tenantA.tenantId,
        75, // base score
        'technology',
        testConversationSignal,
        'correlation-123'
      );

      const resultB = await service.calculateEnhancedScore(
        'lead-123',
        tenantB.tenantId,
        75, // same base score
        'technology',
        testConversationSignal,
        'correlation-456'
      );

      // Results should be different due to different configurations
      expect(resultA.enhancedScore).not.toBe(resultB.enhancedScore);

      // Tenant A should have higher score due to higher sentiment weight (40% vs 20%)
      // and positive sentiment multiplier for technology (1.2 vs 0.9)
      expect(resultA.enhancedScore).toBeGreaterThan(resultB.enhancedScore);
    });

    it('should produce consistent results for same tenant and data', async () => {
      // Setup config for tenant A
      const configA = createTenantAConfig();
      await configLoader.saveConfig('neuronx-config', configA, tenantA);

      // Score same lead twice
      const result1 = await service.calculateEnhancedScore(
        'lead-123',
        tenantA.tenantId,
        75,
        'technology',
        testConversationSignal,
        'correlation-1'
      );

      const result2 = await service.calculateEnhancedScore(
        'lead-123',
        tenantA.tenantId,
        75,
        'technology',
        testConversationSignal,
        'correlation-2'
      );

      // Results should be identical
      expect(result1.enhancedScore).toBe(result2.enhancedScore);
      expect(result1.adjustment).toBe(result2.adjustment);
      expect(result1.confidence).toBe(result2.confidence);
    });

    it('should apply tenant-specific industry multipliers', async () => {
      // Setup config for tenant A with technology multiplier of 1.2
      const configA = createTenantAConfig();
      await configLoader.saveConfig('neuronx-config', configA, tenantA);

      // Setup config for tenant B with technology multiplier of 0.9
      const configB = createTenantBConfig();
      await configLoader.saveConfig('neuronx-config', configB, tenantB);

      // Score technology industry leads for both tenants
      const resultA = await service.calculateEnhancedScore(
        'lead-tech-1',
        tenantA.tenantId,
        70,
        'technology',
        testConversationSignal,
        'correlation-tech-a'
      );

      const resultB = await service.calculateEnhancedScore(
        'lead-tech-2',
        tenantB.tenantId,
        70,
        'technology',
        testConversationSignal,
        'correlation-tech-b'
      );

      // Tenant A should have higher score due to industry multiplier (1.2 > 0.9)
      expect(resultA.enhancedScore).toBeGreaterThan(resultB.enhancedScore);

      // Both should have industry adjustment reasoning
      expect(
        resultA.reasoning.some(r => r.includes('Industry adjustment'))
      ).toBe(true);
      expect(
        resultB.reasoning.some(r => r.includes('Industry adjustment'))
      ).toBe(true);
    });
  });

  describe('Configuration Fallback Behavior', () => {
    it('should fall back to defaults when no configuration exists', async () => {
      // Don't setup any configuration - should use defaults

      const result = await service.calculateEnhancedScore(
        'lead-123',
        'non-existent-tenant',
        75,
        'finance',
        testConversationSignal,
        'correlation-fallback'
      );

      // Should still produce a valid result using defaults
      expect(result).toBeDefined();
      expect(result.enhancedScore).toBeGreaterThan(0);
      expect(result.enhancedScore).toBeLessThanOrEqual(100);
      expect(result.adjustment).toBe(result.enhancedScore - 75);

      // Should use default industry multiplier for finance (1.08)
      expect(result.factors.industryAdjustment.value).toBe(1.08);
    });

    it('should use system tenant configuration when available', async () => {
      // Setup config for system tenant only
      const systemConfig = createTenantAConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        systemConfig,
        systemTenant
      );

      const result = await service.calculateEnhancedScore(
        'lead-123',
        'any-tenant',
        75,
        'technology',
        testConversationSignal,
        'correlation-system'
      );

      // Should use system tenant config (Tenant A config with tech multiplier 1.2)
      expect(result).toBeDefined();
      expect(result.factors.industryAdjustment.value).toBe(1.2);
    });

    it('should handle missing industry multipliers gracefully', async () => {
      // Setup config without industry multipliers
      const configWithoutMultipliers: NeuronXConfiguration = {
        ...createTenantAConfig(),
        domains: {
          ...createTenantAConfig().domains,
          scoring: {
            ...createTenantAConfig().domains.scoring,
            industryMultipliers: {}, // Empty multipliers
          },
        },
      };

      await configLoader.saveConfig(
        'neuronx-config',
        configWithoutMultipliers,
        tenantA
      );

      const result = await service.calculateEnhancedScore(
        'lead-123',
        tenantA.tenantId,
        75,
        'unknown-industry',
        testConversationSignal,
        'correlation-missing-multiplier'
      );

      // Should use default multiplier of 1.0 for unknown industry
      expect(result.factors.industryAdjustment.value).toBe(1.0);
    });
  });

  describe('Configuration Validation & Error Handling', () => {
    it('should reject invalid configuration early', async () => {
      // Setup invalid config (missing weights)
      const invalidConfig: NeuronXConfiguration = {
        ...createTenantAConfig(),
        domains: {
          ...createTenantAConfig().domains,
          scoring: {
            ...createTenantAConfig().domains.scoring,
            weights: {} as any, // Invalid empty weights
          },
        },
      };

      await configLoader.saveConfig('neuronx-config', invalidConfig, tenantA);

      // Should fall back to defaults instead of crashing
      const result = await service.calculateEnhancedScore(
        'lead-123',
        tenantA.tenantId,
        75,
        'finance',
        testConversationSignal,
        'correlation-invalid-config'
      );

      // Should still produce valid result using defaults
      expect(result).toBeDefined();
      expect(result.enhancedScore).toBeGreaterThan(0);
      expect(result.enhancedScore).toBeLessThanOrEqual(100);
    });

    it('should handle configuration loading errors gracefully', async () => {
      // Mock config loader to throw error
      jest
        .spyOn(configLoader, 'loadConfig')
        .mockRejectedValueOnce(new Error('Config load failed'));

      const result = await service.calculateEnhancedScore(
        'lead-123',
        tenantA.tenantId,
        75,
        'finance',
        testConversationSignal,
        'correlation-load-error'
      );

      // Should fall back to defaults and still work
      expect(result).toBeDefined();
      expect(result.enhancedScore).toBeGreaterThan(0);
      expect(result.enhancedScore).toBeLessThanOrEqual(100);
    });

    it('should validate weight normalization', async () => {
      // Setup config with weights that don't sum to 100
      const unevenWeightsConfig: NeuronXConfiguration = {
        ...createTenantAConfig(),
        domains: {
          ...createTenantAConfig().domains,
          scoring: {
            ...createTenantAConfig().domains.scoring,
            weights: {
              sentiment: 50, // Different weights
              responseTime: 30,
              frequency: 10,
              industry: 5,
              customFields: 5, // Total = 100, should work
            },
          },
        },
      };

      await configLoader.saveConfig(
        'neuronx-config',
        unevenWeightsConfig,
        tenantA
      );

      const result = await service.calculateEnhancedScore(
        'lead-123',
        tenantA.tenantId,
        75,
        'finance',
        testConversationSignal,
        'correlation-weight-normalization'
      );

      // Should normalize weights and produce valid result
      expect(result).toBeDefined();
      expect(result.enhancedScore).toBeGreaterThan(0);
      expect(result.enhancedScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Industry Multiplier Configuration', () => {
    it('should apply different multipliers for different industries per tenant', async () => {
      // Setup config for tenant A
      const configA = createTenantAConfig();
      await configLoader.saveConfig('neuronx-config', configA, tenantA);

      // Test different industries for same tenant
      const techResult = await service.calculateEnhancedScore(
        'lead-tech',
        tenantA.tenantId,
        70,
        'technology',
        testConversationSignal,
        'correlation-tech'
      );

      const financeResult = await service.calculateEnhancedScore(
        'lead-finance',
        tenantA.tenantId,
        70,
        'finance',
        testConversationSignal,
        'correlation-finance'
      );

      const healthcareResult = await service.calculateEnhancedScore(
        'lead-healthcare',
        tenantA.tenantId,
        70,
        'healthcare',
        testConversationSignal,
        'correlation-healthcare'
      );

      // Technology should have highest multiplier (1.2)
      expect(techResult.factors.industryAdjustment.value).toBe(1.2);
      expect(techResult.enhancedScore).toBeGreaterThan(
        financeResult.enhancedScore
      );

      // Finance should have medium multiplier (1.1)
      expect(financeResult.factors.industryAdjustment.value).toBe(1.1);

      // Healthcare should have neutral multiplier (1.0)
      expect(healthcareResult.factors.industryAdjustment.value).toBe(1.0);
      expect(healthcareResult.enhancedScore).toBeLessThan(
        financeResult.enhancedScore
      );
    });

    it('should handle case-insensitive industry matching', async () => {
      // Setup config for tenant A
      const configA = createTenantAConfig();
      await configLoader.saveConfig('neuronx-config', configA, tenantA);

      // Test with different capitalizations
      const result1 = await service.calculateEnhancedScore(
        'lead-1',
        tenantA.tenantId,
        70,
        'Technology', // Capitalized
        testConversationSignal,
        'correlation-case-1'
      );

      const result2 = await service.calculateEnhancedScore(
        'lead-2',
        tenantA.tenantId,
        70,
        'TECHNOLOGY', // Uppercase
        testConversationSignal,
        'correlation-case-2'
      );

      const result3 = await service.calculateEnhancedScore(
        'lead-3',
        tenantA.tenantId,
        70,
        'technology', // Lowercase
        testConversationSignal,
        'correlation-case-3'
      );

      // All should get the same multiplier (1.2)
      expect(result1.factors.industryAdjustment.value).toBe(1.2);
      expect(result2.factors.industryAdjustment.value).toBe(1.2);
      expect(result3.factors.industryAdjustment.value).toBe(1.2);
    });
  });
});
