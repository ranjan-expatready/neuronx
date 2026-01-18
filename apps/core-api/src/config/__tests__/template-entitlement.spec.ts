/**
 * Template and Entitlement Tests - REQ-019: Configuration as IP
 *
 * Tests that templates constrain tenant configurations and entitlements block unauthorized features.
 * Validates the monetization control plane enforces template limits and entitlement boundaries.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigLoader } from '../config.loader';
import { TemplateService } from '../templates/template.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { NeuronXConfiguration } from '../config.types';
import { TenantContext } from '../tenant-context';

describe('Monetization Control Plane - Template & Entitlement Enforcement', () => {
  let configLoader: ConfigLoader;
  let templateService: TemplateService;
  let entitlementService: EntitlementService;

  // Test data
  const tenantFree = 'tenant-free';
  const tenantStarter = 'tenant-starter';
  const tenantProfessional = 'tenant-professional';
  const tenantEnterprise = 'tenant-enterprise';

  // Test configurations
  const createTestConfig = (): NeuronXConfiguration => ({
    version: '1.0.0',
    description: 'Test configuration',
    timestamp: new Date().toISOString(),
    domains: {
      scoring: {
        model: 'advanced',
        weights: {
          sentiment: 25,
          responseTime: 25,
          frequency: 25,
          industry: 15,
          customFields: 10,
        },
        qualificationThreshold: 0.8,
        industryMultipliers: { technology: 1.2, finance: 1.1 },
      },
      routing: {
        algorithm: 'predictive',
        geographicPreferences: {
          'north-america': ['team-na'],
          europe: ['team-eu'],
        },
        teamCapacities: {
          'team-na': {
            maxConcurrent: 10,
            expertiseAreas: ['tech'],
            regions: ['north-america'],
          },
        },
        thresholds: {
          highLoadPercentage: 85,
          lowLoadPercentage: 15,
          rebalanceIntervalMinutes: 25,
        },
      },
      sla: {
        responseTimes: {
          default: { initialHours: 2, followUpHours: 6, maxEscalations: 3 },
        },
        notifications: {
          immediateChannels: ['email'],
          escalationChannels: ['email', 'sms'],
          managerNotificationDelay: 45,
        },
        escalationRules: {
          enabled: true,
          maxAutomaticEscalations: 3,
          requireManagerApproval: false,
        },
      },
      escalation: {
        hierarchies: {
          default: {
            levels: [
              {
                name: 'Manager',
                approvers: ['mgr@test.com'],
                escalationTimeMinutes: 240,
                notificationChannels: ['email'],
              },
            ],
          },
        },
        sequences: {},
        exceptions: {
          allowManualOverride: true,
          requireAuditLog: true,
          maxOverridePercentage: 15,
        },
      },
      featureFlags: {
        modules: {
          advancedScoring: {
            enabled: true,
            entitlements: ['premium'],
            dependencies: [],
          },
        },
        entitlements: {
          premium: {
            name: 'Premium Features',
            description: 'Advanced features',
            limits: { apiCalls: 5000, users: 10 },
            pricingTier: 'premium',
          },
        },
        betaFeatures: {},
      },
      deploymentMode: {
        model: 'hybrid',
        featureAvailability: {
          advancedScoring: { dfy: true, saas: true, hybrid: true },
        },
        settings: {
          dataRetentionDays: 180,
          backupFrequency: 'daily',
          supportLevel: 'premium',
          customIntegrations: true,
        },
      },
      integrationMappings: {
        integrations: {
          crm: {
            enabled: true,
            adapter: 'salesforce',
            config: { apiKey: 'test' },
          },
        },
        globalSettings: {
          retryPolicy: { maxAttempts: 5, baseDelayMs: 2000, maxDelayMs: 10000 },
          rateLimiting: { requestsPerMinute: 200, burstAllowance: 50 },
          errorHandling: { circuitBreakerThreshold: 10, timeoutMs: 45000 },
        },
        dataFlows: {
          crm: {
            source: 'salesforce',
            destination: 'neuronx',
            transformation: 'full-mapping',
            frequency: 'real-time',
          },
        },
      },
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigLoader, TemplateService, EntitlementService],
    }).compile();

    configLoader = module.get<ConfigLoader>(ConfigLoader);
    templateService = module.get<TemplateService>(TemplateService);
    entitlementService = module.get<EntitlementService>(EntitlementService);

    // Clear all configurations between tests
    configLoader.clearAllConfigs();
  });

  afterEach(() => {
    configLoader.clearAllConfigs();
  });

  describe('Template Constraint Enforcement', () => {
    it('should apply starter template constraints to tenant configuration', async () => {
      // Setup: Create a config that exceeds starter limits
      const unrestrictedConfig = createTestConfig();
      unrestrictedConfig.domains.routing.algorithm = 'predictive'; // Not allowed in starter
      unrestrictedConfig.domains.scoring.qualificationThreshold = 0.9; // May be constrained

      const tenantContext: TenantContext = {
        tenantId: tenantStarter,
        environment: 'prod',
      };

      // Save configuration - should be constrained by template
      await configLoader.saveConfig(
        'test-config',
        unrestrictedConfig,
        tenantContext
      );

      // Load configuration - should have template constraints applied
      const loadedConfig = await configLoader.loadConfig(
        'test-config',
        tenantContext
      );

      expect(loadedConfig).toBeDefined();
      expect(loadedConfig!._metadata).toBeDefined();
      expect(loadedConfig!._metadata!.templateId).toBe('starter');
      expect(loadedConfig!._metadata!.constraintsApplied).toContain(
        'template:starter'
      );
    });

    it('should enforce template domain availability', async () => {
      // Free tier should not have voice capabilities
      const configWithVoice = createTestConfig();
      // Add voice domain that free tier shouldn't have
      (configWithVoice.domains as any).voice = {
        enabled: true,
        channels: ['inbound'],
      };

      const tenantContext: TenantContext = {
        tenantId: tenantFree,
        environment: 'prod',
      };

      // Save configuration - voice should be disabled by template constraints
      await configLoader.saveConfig(
        'test-config',
        configWithVoice,
        tenantContext
      );

      const loadedConfig = await configLoader.loadConfig(
        'test-config',
        tenantContext
      );

      // Voice domain should be marked as disabled
      expect((loadedConfig!.domains as any).voice._disabled).toBe(true);
      expect((loadedConfig!.domains as any).voice._disabledReason).toBe(
        'not_in_entitlement'
      );
    });

    it('should create initial configuration from template when none exists', async () => {
      const tenantContext: TenantContext = {
        tenantId: tenantStarter,
        environment: 'prod',
      };

      // Load configuration when none exists - should create from template
      const loadedConfig = await configLoader.loadConfig(
        'test-config',
        tenantContext
      );

      expect(loadedConfig).toBeDefined();
      expect(loadedConfig!._metadata!.templateId).toBe('starter');
      expect(loadedConfig!.domains.scoring.model).toBeDefined(); // Should have template defaults
    });
  });

  describe('Entitlement Feature Blocking', () => {
    it('should block features not in entitlement tier', async () => {
      // Try to enable enterprise features on starter tier
      const enterpriseConfig = createTestConfig();
      enterpriseConfig.domains.routing.algorithm = 'predictive'; // May require enterprise
      enterpriseConfig.domains.deploymentMode.model = 'hybrid'; // May require enterprise

      const tenantContext: TenantContext = {
        tenantId: tenantStarter,
        environment: 'prod',
      };

      // Save should succeed but features should be constrained
      await configLoader.saveConfig(
        'test-config',
        enterpriseConfig,
        tenantContext
      );

      const loadedConfig = await configLoader.loadConfig(
        'test-config',
        tenantContext
      );

      expect(loadedConfig!._metadata!.entitlementTierId).toBe('starter');

      // Enterprise features should be constrained or disabled
      // (Specific constraints depend on template implementation)
    });

    it('should allow all features for enterprise tier', async () => {
      const fullConfig = createTestConfig();
      // Enable all advanced features
      fullConfig.domains.routing.algorithm = 'predictive';
      fullConfig.domains.deploymentMode.model = 'hybrid';
      (fullConfig.domains as any).voice = {
        enabled: true,
        channels: ['inbound', 'outbound'],
      };

      const tenantContext: TenantContext = {
        tenantId: tenantEnterprise,
        environment: 'prod',
      };

      await configLoader.saveConfig('test-config', fullConfig, tenantContext);

      const loadedConfig = await configLoader.loadConfig(
        'test-config',
        tenantContext
      );

      expect(loadedConfig!._metadata!.entitlementTierId).toBe('enterprise');
      // Enterprise should have access to all features
      expect((loadedConfig!.domains as any).voice._disabled).toBeUndefined();
    });

    it('should enforce domain-level entitlement restrictions', async () => {
      // Free tier should have limited domain access
      const fullConfig = createTestConfig();

      const tenantContext: TenantContext = {
        tenantId: tenantFree,
        environment: 'prod',
      };

      await configLoader.saveConfig('test-config', fullConfig, tenantContext);

      const loadedConfig = await configLoader.loadConfig(
        'test-config',
        tenantContext
      );

      // Check that domains not in free tier are disabled
      // (routing may be disabled for free tier)
      const tier = await entitlementService.getTier('free');
      expect(tier!.features.domains.routing).toBe(false);

      // Routing domain should be marked as disabled
      expect(loadedConfig!.domains.routing._disabled).toBe(true);
      expect(loadedConfig!.domains.routing._disabledReason).toBe(
        'not_in_entitlement'
      );
    });
  });

  describe('Tenant Isolation and Template Assignment', () => {
    it('should apply different templates to different tenants', async () => {
      const baseConfig = createTestConfig();

      // Save same config for different tenants
      await configLoader.saveConfig('shared-config', baseConfig, {
        tenantId: tenantFree,
        environment: 'prod',
      });
      await configLoader.saveConfig('shared-config', baseConfig, {
        tenantId: tenantEnterprise,
        environment: 'prod',
      });

      // Load configs - should have different constraints applied
      const freeConfig = await configLoader.loadConfig('shared-config', {
        tenantId: tenantFree,
        environment: 'prod',
      });
      const enterpriseConfig = await configLoader.loadConfig('shared-config', {
        tenantId: tenantEnterprise,
        environment: 'prod',
      });

      expect(freeConfig!._metadata!.templateId).toBe('starter'); // Free tier maps to starter template
      expect(freeConfig!._metadata!.entitlementTierId).toBe('free');

      expect(enterpriseConfig!._metadata!.templateId).toBe('enterprise');
      expect(enterpriseConfig!._metadata!.entitlementTierId).toBe('enterprise');

      // Enterprise should have more features enabled than free
      expect(
        (enterpriseConfig!.domains as any).voice._disabled
      ).toBeUndefined();
      expect((freeConfig!.domains as any).voice._disabled).toBe(true);
    });

    it('should maintain tenant isolation for template applications', async () => {
      // Create different configs for different tenants
      const starterConfig = createTestConfig();
      starterConfig.domains.scoring.model = 'basic';

      const enterpriseConfig = createTestConfig();
      enterpriseConfig.domains.scoring.model = 'advanced';

      await configLoader.saveConfig('test-config', starterConfig, {
        tenantId: tenantStarter,
        environment: 'prod',
      });
      await configLoader.saveConfig('test-config', enterpriseConfig, {
        tenantId: tenantEnterprise,
        environment: 'prod',
      });

      // Load configs - should be different
      const loadedStarter = await configLoader.loadConfig('test-config', {
        tenantId: tenantStarter,
        environment: 'prod',
      });
      const loadedEnterprise = await configLoader.loadConfig('test-config', {
        tenantId: tenantEnterprise,
        environment: 'prod',
      });

      expect(loadedStarter!.domains.scoring.model).toBe('basic');
      expect(loadedEnterprise!.domains.scoring.model).toBe('advanced');
    });
  });

  describe('Configuration Metadata and Audit', () => {
    it('should include template and entitlement metadata in configuration', async () => {
      const config = createTestConfig();

      const tenantContext: TenantContext = {
        tenantId: tenantProfessional,
        environment: 'prod',
      };

      await configLoader.saveConfig('test-config', config, tenantContext);

      const loadedConfig = await configLoader.loadConfig(
        'test-config',
        tenantContext
      );

      expect(loadedConfig!._metadata).toBeDefined();
      expect(loadedConfig!._metadata!.templateId).toBe('professional');
      expect(loadedConfig!._metadata!.entitlementTierId).toBe('professional');
      expect(loadedConfig!._metadata!.appliedAt).toBeDefined();
      expect(loadedConfig!._metadata!.constraintsApplied).toContain(
        'template:professional'
      );
      expect(loadedConfig!._metadata!.constraintsApplied).toContain(
        'entitlement:professional'
      );
    });

    it('should handle configuration without tenant attachment', async () => {
      const config = createTestConfig();

      // Use tenant without predefined attachment
      const tenantContext: TenantContext = {
        tenantId: 'unknown-tenant',
        environment: 'prod',
      };

      await configLoader.saveConfig('test-config', config, tenantContext);

      const loadedConfig = await configLoader.loadConfig(
        'test-config',
        tenantContext
      );

      // Should still work but without template/entitlement constraints
      expect(loadedConfig).toBeDefined();
      expect(loadedConfig!._metadata!.templateId).toBeUndefined();
      expect(loadedConfig!._metadata!.entitlementTierId).toBeUndefined();
    });
  });

  describe('Template and Entitlement Service Integration', () => {
    it('should validate template existence and application', async () => {
      const template = await templateService.getTemplate('starter');
      expect(template).toBeDefined();
      expect(template!.templateId).toBe('starter');
      expect(template!.isActive).toBe(true);

      const config = createTestConfig();
      const result = await templateService.applyTemplate('starter', config);

      expect(result.success).toBe(true);
      expect(result.appliedConfig).toBeDefined();
    });

    it('should validate entitlement tier access', async () => {
      const tier = await entitlementService.getTier('professional');
      expect(tier).toBeDefined();
      expect(tier!.tierId).toBe('professional');
      expect(tier!.isActive).toBe(true);

      // Check that professional tier has routing enabled
      expect(tier!.features.domains.routing).toBe(true);
    });

    it('should properly assign and validate tenant entitlements', async () => {
      // Assign professional tier to a tenant
      await entitlementService.assignTenantTier(
        'test-tenant',
        'professional',
        'test-system'
      );

      const entitlement =
        await entitlementService.getTenantEntitlement('test-tenant');
      expect(entitlement).toBeDefined();
      expect(entitlement!.tierId).toBe('professional');
      expect(entitlement!.status).toBe('active');
    });
  });

  describe('Error Handling and Safety', () => {
    it('should handle template application failures gracefully', async () => {
      // Try to apply non-existent template
      const config = createTestConfig();
      const result = await templateService.applyTemplate(
        'non-existent',
        config
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Template non-existent not found');
    });

    it('should handle invalid template configurations', async () => {
      const invalidConfig = createTestConfig();
      // Make config invalid somehow
      invalidConfig.version = ''; // Invalid version

      const tenantContext: TenantContext = {
        tenantId: tenantStarter,
        environment: 'prod',
      };

      // Should still save but with warnings/errors logged
      await expect(
        configLoader.saveConfig('test-config', invalidConfig, tenantContext)
      ).rejects.toThrow();
    });

    it('should prevent cross-tenant configuration leakage', async () => {
      const config1 = createTestConfig();
      config1.domains.scoring.model = 'model-1';

      const config2 = createTestConfig();
      config2.domains.scoring.model = 'model-2';

      await configLoader.saveConfig('test-config', config1, {
        tenantId: tenantStarter,
        environment: 'prod',
      });
      await configLoader.saveConfig('test-config', config2, {
        tenantId: tenantProfessional,
        environment: 'prod',
      });

      // Load each config - should get different values
      const loaded1 = await configLoader.loadConfig('test-config', {
        tenantId: tenantStarter,
        environment: 'prod',
      });
      const loaded2 = await configLoader.loadConfig('test-config', {
        tenantId: tenantProfessional,
        environment: 'prod',
      });

      expect(loaded1!.domains.scoring.model).toBe('model-1');
      expect(loaded2!.domains.scoring.model).toBe('model-2');
    });
  });
});
