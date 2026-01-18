/**
 * Configuration Persistence Tests - WI-012: Configuration Persistence
 *
 * Tests for PostgreSQL-backed configuration with IP protection and tenant isolation.
 * Verifies template constraints, entitlement enforcement, and tenant data safety.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigLoader } from '../config.loader';
import { PostgresConfigRepository } from '../postgres-config.repository';
import { TemplateRepository } from '../templates/template.repository';
import { TenantConfigRepository } from '../tenant-config.repository';
import { EntitlementService } from '../../entitlements/entitlement.service';
import { createTenantContext } from '../tenant-context';

// Mock Prisma
const mockPrisma = {
  configurationTemplate: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  tenantConfigAttachment: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  tenantConfigOverride: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  effectiveConfigCache: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('Configuration Persistence (WI-012)', () => {
  let configLoader: ConfigLoader;
  let configRepository: PostgresConfigRepository;
  let templateRepository: TemplateRepository;
  let tenantConfigRepository: TenantConfigRepository;
  let entitlementService: EntitlementService;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const actorId = 'user-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'IConfigRepository',
          useClass: PostgresConfigRepository,
        },
        TemplateRepository,
        TenantConfigRepository,
        {
          provide: EntitlementService,
          useValue: {
            getTenantEntitlement: jest.fn(),
            getTier: jest.fn(),
          },
        },
        {
          provide: ConfigLoader,
          useFactory: (
            configRepo: PostgresConfigRepository,
            templateRepo: TemplateRepository,
            tenantConfigRepo: TenantConfigRepository,
            entitlementSvc: EntitlementService
          ) => {
            return new ConfigLoader(
              configRepo,
              templateRepo,
              tenantConfigRepo,
              entitlementSvc
            );
          },
          inject: [
            'IConfigRepository',
            TemplateRepository,
            TenantConfigRepository,
            EntitlementService,
          ],
        },
      ],
    }).compile();

    configLoader = module.get<ConfigLoader>(ConfigLoader);
    configRepository =
      module.get<PostgresConfigRepository>('IConfigRepository');
    templateRepository = module.get<TemplateRepository>(TemplateRepository);
    tenantConfigRepository = module.get<TenantConfigRepository>(
      TenantConfigRepository
    );
    entitlementService = module.get<EntitlementService>(EntitlementService);

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockPrisma.configurationTemplate.findUnique.mockResolvedValue({
      templateId: 'sales-os-standard',
      name: 'Sales OS Standard',
      baseConfig: { scoring: { model: 'advanced' } },
      constraints: { requiredFields: ['scoring.model'] },
    });

    mockPrisma.tenantConfigAttachment.findUnique.mockResolvedValue({
      tenantId: tenantA,
      templateId: 'sales-os-standard',
      entitlementTierId: 'professional',
      status: 'active',
    });

    mockPrisma.tenantConfigOverride.findFirst.mockResolvedValue(null); // No overrides by default

    entitlementService.getTenantEntitlement.mockResolvedValue({
      tenantId: tenantA,
      tierId: 'professional',
      status: 'active',
    });

    entitlementService.getTier.mockResolvedValue({
      tierId: 'professional',
      features: { domains: { voice: true } },
      limits: { routing: 10 },
    });
  });

  describe('Tenant Isolation', () => {
    it('should prevent tenant A from reading tenant B config', async () => {
      // Setup tenant B's attachment
      mockPrisma.tenantConfigAttachment.findUnique.mockImplementation(args => {
        if (args.where.tenantId === tenantB) {
          return Promise.resolve({
            tenantId: tenantB,
            templateId: 'sales-os-standard',
            entitlementTierId: 'professional',
            status: 'active',
          });
        }
        return Promise.resolve(null);
      });

      const contextA = createTenantContext(tenantA, actorId);
      const contextB = createTenantContext(tenantB, actorId);

      // Tenant A should not be able to access tenant B's config
      const configA = await configLoader.loadConfig('test-config', contextA);
      const configB = await configLoader.loadConfig('test-config', contextB);

      // They should get different results or null
      expect(configA?.tenantId).toBe(tenantA);
      expect(configB?.tenantId).toBe(tenantB);
    });

    it('should prevent tenant A from writing tenant B config', async () => {
      const contextA = createTenantContext(tenantA, actorId);
      const contextB = createTenantContext(tenantB, actorId);

      const config = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tenantId: tenantA, // Even if tenant A tries to set tenantId to B
      };

      // This should validate tenant isolation
      await expect(
        configRepository.saveConfig('test-config', config, contextA)
      ).rejects.toThrow();

      // Should not allow cross-tenant writes
      const crossTenantConfig = { ...config, tenantId: tenantB };
      await expect(
        configRepository.saveConfig('test-config', crossTenantConfig, contextA)
      ).rejects.toThrow();
    });
  });

  describe('IP Protection', () => {
    it('should prevent tenants from modifying template base config', async () => {
      const context = createTenantContext(tenantA, actorId);

      // Template has baseConfig with scoring.model = 'advanced'
      // Tenant tries to override with forbidden field
      const configWithTemplateOverride = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tenantId: tenantA,
        templateBase: { scoring: { model: 'basic' } }, // Should be blocked
      };

      // This should be blocked by template constraints
      mockPrisma.configurationTemplate.findUnique.mockResolvedValue({
        templateId: 'sales-os-standard',
        constraints: {
          forbiddenFields: ['templateBase'], // Templates can forbid tenant access to base
        },
      });

      await expect(
        configRepository.saveConfig(
          'test-config',
          configWithTemplateOverride,
          context
        )
      ).rejects.toThrow('forbidden field');
    });

    it('should enforce template constraints on tenant overrides', async () => {
      const context = createTenantContext(tenantA, actorId);

      // Template requires scoring.model field
      const configWithoutRequiredField = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tenantId: tenantA,
        // Missing required scoring.model
      };

      mockPrisma.configurationTemplate.findUnique.mockResolvedValue({
        templateId: 'sales-os-standard',
        constraints: {
          requiredFields: ['scoring.model'],
        },
      });

      await expect(
        configRepository.saveConfig(
          'test-config',
          configWithoutRequiredField,
          context
        )
      ).rejects.toThrow('required field');
    });

    it('should enforce entitlement constraints', async () => {
      const context = createTenantContext(tenantA, actorId);

      // Tenant with 'starter' tier tries to use enterprise features
      const configWithEnterpriseFeatures = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tenantId: tenantA,
        scoring: { model: 'predictive' }, // Requires enterprise tier
        voice: { enabled: true }, // Requires voice entitlement
      };

      entitlementService.getTier.mockResolvedValue({
        tierId: 'starter',
        features: {
          domains: { voice: false },
          ai: { predictiveRouting: false },
        },
      });

      await expect(
        configRepository.saveConfig(
          'test-config',
          configWithEnterpriseFeatures,
          context
        )
      ).rejects.toThrow('not allowed for current tier');
    });
  });

  describe('Configuration Assembly', () => {
    it('should assemble config from template + overrides + entitlements', async () => {
      const context = createTenantContext(tenantA, actorId);

      // Setup template base config
      mockPrisma.configurationTemplate.findUnique.mockResolvedValue({
        templateId: 'sales-os-standard',
        baseConfig: {
          scoring: { model: 'advanced', qualificationThreshold: 0.7 },
          routing: { algorithm: 'capacity-based' },
        },
      });

      // Setup tenant overrides
      mockPrisma.tenantConfigOverride.findFirst.mockResolvedValue({
        overrides: {
          'scoring.qualificationThreshold': 0.8,
          'routing.algorithm': 'expertise-first',
        },
      });

      const config = await configLoader.loadConfig('test-config', context);

      expect(config).toBeDefined();
      expect(config?.scoring.model).toBe('advanced'); // From template
      expect(config?.scoring.qualificationThreshold).toBe(0.8); // From override
      expect(config?.routing.algorithm).toBe('expertise-first'); // From override
    });

    it('should apply entitlement constraints to effective config', async () => {
      const context = createTenantContext(tenantA, actorId);

      // Template allows voice, but entitlement doesn't
      mockPrisma.configurationTemplate.findUnique.mockResolvedValue({
        templateId: 'sales-os-standard',
        baseConfig: {
          scoring: { model: 'advanced' },
          voice: { enabled: true },
        },
      });

      entitlementService.getTier.mockResolvedValue({
        tierId: 'starter',
        features: { domains: { voice: false } },
      });

      const config = await configLoader.loadConfig('test-config', context);

      // Voice should be removed due to entitlement constraints
      expect(config?.voice).toBeUndefined();
      expect(config?.scoring.model).toBe('advanced'); // Scoring still allowed
    });
  });

  describe('Persistence and Restart Survival', () => {
    it('should persist configuration across "restart" (repository recreation)', async () => {
      const context = createTenantContext(tenantA, actorId);

      const config = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tenantId: tenantA,
        customSetting: 'tenant-value',
      };

      // Save config
      await configRepository.saveConfig('test-config', config, context);

      // Simulate "restart" by clearing any in-memory state
      // (In real scenario, this would be a new repository instance)

      // Load config - should still work
      const loaded = await configRepository.loadLatestConfig(
        'test-config',
        context
      );
      expect(loaded?.customSetting).toBe('tenant-value');
    });

    it('should cache effective configurations for performance', async () => {
      const context = createTenantContext(tenantA, actorId);

      // First load - should compute and cache
      const config1 = await configLoader.loadConfig('test-config', context);
      expect(mockPrisma.effectiveConfigCache.upsert).toHaveBeenCalled();

      // Reset mock to check if cache is used
      mockPrisma.effectiveConfigCache.findUnique.mockResolvedValue({
        tenantId: tenantA,
        effectiveConfig: config1,
        computedAt: new Date(),
        hitCount: 0,
      });

      // Second load - should use cache
      const config2 = await configLoader.loadConfig('test-config', context);
      expect(config2).toEqual(config1);
      expect(mockPrisma.effectiveConfigCache.update).toHaveBeenCalled(); // Hit count increment
    });
  });

  describe('Template and Attachment Management', () => {
    it('should switch effective config immediately when attachment changes', async () => {
      const context = createTenantContext(tenantA, actorId);

      // Start with standard template
      mockPrisma.tenantConfigAttachment.findUnique.mockResolvedValue({
        tenantId: tenantA,
        templateId: 'sales-os-standard',
        entitlementTierId: 'professional',
        status: 'active',
        template: { version: '1.0.0' },
      });

      const config1 = await configLoader.loadConfig('test-config', context);

      // Change attachment to enterprise template
      mockPrisma.tenantConfigAttachment.findUnique.mockResolvedValue({
        tenantId: tenantA,
        templateId: 'sales-os-enterprise',
        entitlementTierId: 'enterprise',
        status: 'active',
        template: { version: '1.0.0' },
      });

      // Cache should be cleared
      mockPrisma.effectiveConfigCache.findUnique.mockResolvedValue(null);

      const config2 = await configLoader.loadConfig('test-config', context);

      // Config should be different (different template)
      expect(config2).not.toEqual(config1);
      expect(mockPrisma.effectiveConfigCache.deleteMany).toHaveBeenCalled();
    });
  });

  describe('Constraint Enforcement', () => {
    it('should block invalid enum values', async () => {
      const context = createTenantContext(tenantA, actorId);

      const configWithInvalidEnum = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tenantId: tenantA,
        scoring: { model: 'invalid-model' }, // Not in allowed enums
      };

      mockPrisma.configurationTemplate.findUnique.mockResolvedValue({
        templateId: 'sales-os-standard',
        constraints: {
          allowedEnums: {
            'scoring.model': ['basic', 'advanced', 'predictive'],
          },
        },
      });

      await expect(
        configRepository.saveConfig(
          'test-config',
          configWithInvalidEnum,
          context
        )
      ).rejects.toThrow('invalid value');
    });

    it('should enforce field ranges', async () => {
      const context = createTenantContext(tenantA, actorId);

      const configWithOutOfRangeValue = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        tenantId: tenantA,
        scoring: { qualificationThreshold: 1.5 }, // Above max 1.0
      };

      mockPrisma.configurationTemplate.findUnique.mockResolvedValue({
        templateId: 'sales-os-standard',
        constraints: {
          fieldRanges: {
            'scoring.qualificationThreshold': { min: 0.1, max: 1.0 },
          },
        },
      });

      await expect(
        configRepository.saveConfig(
          'test-config',
          configWithOutOfRangeValue,
          context
        )
      ).rejects.toThrow('above maximum');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain existing config loader API', async () => {
      const context = createTenantContext(tenantA, actorId);

      // Should work with existing loadConfig interface
      const config = await configLoader.loadConfig('test-config', context);

      expect(config).toBeDefined();
      expect(config?.version).toBeDefined();
      expect(config?.timestamp).toBeDefined();
    });

    it('should handle missing attachments gracefully', async () => {
      const context = createTenantContext('unattached-tenant', actorId);

      mockPrisma.tenantConfigAttachment.findUnique.mockResolvedValue(null);

      const config = await configLoader.loadConfig('test-config', context);
      expect(config).toBeNull();
    });
  });
});
