/**
 * Configuration Persistence Tests - REQ-019: Configuration as IP
 *
 * Tests tenant isolation, persistence, and audit functionality.
 * Ensures multi-tenant configuration management with proper isolation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConfigModule,
  ConfigLoader,
  ConfigValidator,
  ConfigAuditService,
} from '../config.module';
import { NeuronXConfiguration, ValidationResult } from '../config.types';
import { TenantContext, createSystemTenantContext } from '../tenant-context';

describe('Configuration Persistence (Unit)', () => {
  let loader: ConfigLoader;
  let validator: ConfigValidator;
  let auditService: ConfigAuditService;

  // Sample valid configuration for testing
  const createValidConfig = (
    version: string = '1.0.0'
  ): NeuronXConfiguration => ({
    version: version as any,
    description: 'Test configuration',
    timestamp: new Date().toISOString(),
    domains: {
      scoring: {
        model: 'basic',
        weights: {
          sentiment: 25,
          responseTime: 25,
          frequency: 25,
          industry: 15,
          customFields: 10,
        },
        qualificationThreshold: 0.7,
        industryMultipliers: {
          technology: 1.2,
          finance: 1.1,
        },
      },
      routing: {
        algorithm: 'capacity-based',
        geographicPreferences: {
          'north-america': ['team-na-1', 'team-na-2'],
        },
        teamCapacities: {
          'team-na-1': {
            maxConcurrent: 10,
            expertiseAreas: ['technology', 'finance'],
            regions: ['north-america'],
          },
        },
        thresholds: {
          highLoadPercentage: 80,
          lowLoadPercentage: 20,
          rebalanceIntervalMinutes: 30,
        },
      },
      sla: {
        responseTimes: {
          email: {
            initialHours: 24,
            followUpHours: 48,
            maxEscalations: 3,
          },
        },
        notifications: {
          immediateChannels: ['email'],
          escalationChannels: ['email', 'sms'],
          managerNotificationDelay: 60,
        },
        escalationRules: {
          enabled: true,
          maxAutomaticEscalations: 2,
          requireManagerApproval: true,
        },
      },
      escalation: {
        sequences: {
          'follow-up-sequence': {
            name: 'Standard Follow-up',
            steps: [
              {
                delayMinutes: 60,
                channels: ['email'],
                template: 'follow-up-1',
                requireResponse: false,
              },
            ],
          },
        },
        hierarchies: {
          'standard-escalation': {
            levels: [
              {
                name: 'Manager',
                approvers: ['manager@example.com'],
                escalationTimeMinutes: 1440,
                notificationChannels: ['email'],
              },
            ],
          },
        },
        exceptions: {
          allowManualOverride: true,
          requireAuditLog: true,
          maxOverridePercentage: 10,
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
            name: 'Premium Plan',
            description: 'Full feature access',
            limits: {
              apiCalls: 10000,
              users: 50,
            },
            pricingTier: 'premium',
          },
        },
        betaFeatures: {
          predictiveRouting: {
            enabled: false,
            maxTenants: 10,
          },
        },
      },
      deploymentMode: {
        model: 'saas',
        featureAvailability: {
          advancedScoring: {
            dfy: true,
            saas: true,
            hybrid: true,
          },
        },
        settings: {
          dataRetentionDays: 365,
          backupFrequency: 'daily',
          supportLevel: 'premium',
          customIntegrations: true,
        },
      },
      integrationMappings: {
        integrations: {
          ghl: {
            enabled: true,
            adapter: 'ghl-webhook-adapter',
            config: {
              webhookSecret: 'test-secret',
            },
          },
        },
        globalSettings: {
          retryPolicy: {
            maxAttempts: 3,
            baseDelayMs: 1000,
            maxDelayMs: 10000,
          },
          rateLimiting: {
            requestsPerMinute: 60,
            burstAllowance: 10,
          },
          errorHandling: {
            circuitBreakerThreshold: 5,
            timeoutMs: 30000,
          },
        },
        dataFlows: {
          'lead-ingestion': {
            source: 'external-api',
            destination: 'neuronx-core',
            transformation: 'field-mapping',
            frequency: 'real-time',
          },
        },
      },
    },
  });

  // Test tenant contexts
  const tenantA: TenantContext = { tenantId: 'tenant-a', environment: 'prod' };
  const tenantB: TenantContext = {
    tenantId: 'tenant-b',
    environment: 'staging',
  };
  const systemTenant = createSystemTenantContext();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    loader = module.get<ConfigLoader>(ConfigLoader);
    validator = module.get<ConfigValidator>(ConfigValidator);
    auditService = module.get<ConfigAuditService>(ConfigAuditService);

    // Clear any existing state
    loader.clearAllConfigs();
  });

  describe('Tenant Isolation', () => {
    it('should isolate configurations between tenants', async () => {
      const configId = 'test-config';

      // Save config for tenant A
      const configA = createValidConfig('1.0.0');
      await loader.saveConfig(configId, configA, tenantA);

      // Save different config for tenant B
      const configB = createValidConfig('1.0.1');
      configB.domains.scoring.qualificationThreshold = 0.8; // Different value
      await loader.saveConfig(configId, configB, tenantB);

      // Load configs for each tenant
      const loadedA = await loader.loadConfig(configId, tenantA);
      const loadedB = await loader.loadConfig(configId, tenantB);

      // Verify isolation
      expect(loadedA).toBeDefined();
      expect(loadedB).toBeDefined();
      expect(loadedA?.version).toBe('1.0.0');
      expect(loadedB?.version).toBe('1.0.1');
      expect(loadedA?.domains.scoring.qualificationThreshold).toBe(0.7);
      expect(loadedB?.domains.scoring.qualificationThreshold).toBe(0.8);
    });

    it('should prevent cross-tenant data access', async () => {
      const configId = 'isolated-config';

      // Save config for tenant A only
      const config = createValidConfig();
      await loader.saveConfig(configId, config, tenantA);

      // Try to load from tenant B
      const loadedFromB = await loader.loadConfig(configId, tenantB);
      expect(loadedFromB).toBeNull();

      // Verify tenant A can still access
      const loadedFromA = await loader.loadConfig(configId, tenantA);
      expect(loadedFromA).toBeDefined();
    });

    it('should maintain isolation across multiple tenants', async () => {
      const configId = 'multi-tenant-config';

      // Create configs for 3 different tenants
      const tenants = [
        tenantA,
        tenantB,
        { tenantId: 'tenant-c', environment: 'dev' as const },
      ];

      for (let i = 0; i < tenants.length; i++) {
        const config = createValidConfig(`1.0.${i}`);
        config.domains.scoring.qualificationThreshold = 0.5 + i * 0.1;
        await loader.saveConfig(configId, config, tenants[i]);
      }

      // Verify each tenant sees only their config
      for (let i = 0; i < tenants.length; i++) {
        const loaded = await loader.loadConfig(configId, tenants[i]);
        expect(loaded).toBeDefined();
        expect(loaded?.version).toBe(`1.0.${i}`);
        expect(loaded?.domains.scoring.qualificationThreshold).toBe(
          0.5 + i * 0.1
        );
      }
    });
  });

  describe('Version History', () => {
    it('should preserve version history per tenant', async () => {
      const configId = 'versioned-config';

      // Save multiple versions for tenant A
      const versions = ['1.0.0', '1.0.1', '1.1.0'];
      for (const version of versions) {
        const config = createValidConfig(version);
        await loader.saveConfig(configId, config, tenantA);
      }

      // Verify history preservation
      const history = await loader.getConfigHistory(configId, tenantA);
      expect(history).toHaveLength(3);
      expect(history.map(h => h.version)).toEqual(['1.1.0', '1.0.1', '1.0.0']); // Newest first

      // Verify tenant B has no history
      const historyB = await loader.getConfigHistory(configId, tenantB);
      expect(historyB).toHaveLength(0);
    });

    it('should load specific version per tenant', async () => {
      const configId = 'specific-version-config';

      // Save version 1.0.0 for tenant A
      const configV1 = createValidConfig('1.0.0');
      configV1.domains.scoring.qualificationThreshold = 0.6;
      await loader.saveConfig(configId, configV1, tenantA);

      // Save version 1.0.1 for tenant A
      const configV2 = createValidConfig('1.0.1');
      configV2.domains.scoring.qualificationThreshold = 0.8;
      await loader.saveConfig(configId, configV2, tenantA);

      // Load specific versions
      const loadedV1 = await loader.loadConfigByVersion(
        configId,
        '1.0.0',
        tenantA
      );
      const loadedV2 = await loader.loadConfigByVersion(
        configId,
        '1.0.1',
        tenantA
      );

      expect(loadedV1?.version).toBe('1.0.0');
      expect(loadedV1?.domains.scoring.qualificationThreshold).toBe(0.6);
      expect(loadedV2?.version).toBe('1.0.1');
      expect(loadedV2?.domains.scoring.qualificationThreshold).toBe(0.8);

      // Verify tenant B cannot access tenant A's versions
      const loadedFromB = await loader.loadConfigByVersion(
        configId,
        '1.0.0',
        tenantB
      );
      expect(loadedFromB).toBeNull();
    });

    it('should return latest version when loading without version', async () => {
      const configId = 'latest-version-config';

      // Save versions in non-chronological order
      const configOld = createValidConfig('1.0.0');
      configOld.timestamp = new Date(Date.now() - 10000).toISOString(); // Older timestamp

      const configNew = createValidConfig('1.0.1');
      configNew.timestamp = new Date().toISOString(); // Newer timestamp

      await loader.saveConfig(configId, configOld, tenantA);
      await loader.saveConfig(configId, configNew, tenantA);

      // Load latest (should be 1.0.1 based on timestamp)
      const loaded = await loader.loadConfig(configId, tenantA);
      expect(loaded?.version).toBe('1.0.1');
    });
  });

  describe('Validation Integration', () => {
    it('should validate configurations before persistence', async () => {
      const configId = 'invalid-config';

      // Create invalid config (missing required domain)
      const invalidConfig = createValidConfig();
      delete (invalidConfig.domains as any).scoring;

      // Attempt to save should fail validation
      await expect(
        loader.saveConfig(configId, invalidConfig, tenantA)
      ).rejects.toThrow('Configuration validation failed');

      // Verify config was not persisted
      const exists = await loader.configExists(configId, tenantA);
      expect(exists).toBe(false);
    });

    it('should reject persistence of invalid configs per tenant', async () => {
      const configId = 'invalid-per-tenant';

      // Valid config for tenant A
      const validConfig = createValidConfig();
      await loader.saveConfig(configId, validConfig, tenantA);

      // Invalid config for tenant B should not affect tenant A
      const invalidConfig = createValidConfig();
      delete (invalidConfig.domains as any).routing;

      await expect(
        loader.saveConfig(configId, invalidConfig, tenantB)
      ).rejects.toThrow();

      // Verify tenant A config still exists and is valid
      const loadedA = await loader.loadConfig(configId, tenantA);
      expect(loadedA).toBeDefined();
      expect(loadedA?.domains.scoring).toBeDefined();
    });
  });

  describe('Audit Integration', () => {
    it('should include tenantId in audit events', async () => {
      const configId = 'audit-test-config';
      const config = createValidConfig();

      // Save config
      await loader.saveConfig(configId, config, tenantA);

      // Load config
      await loader.loadConfig(configId, tenantA);

      // Check audit events
      const events = auditService.getRecentEvents(2);

      expect(events).toHaveLength(2);

      // Save event should include tenantId
      const saveEvent = events.find(e => e.eventType === 'config.changed');
      expect(saveEvent).toBeDefined();
      expect(saveEvent?.tenantId).toBe('tenant-a');

      // Load event should include tenantId
      const loadEvent = events.find(e => e.eventType === 'config.loaded');
      expect(loadEvent).toBeDefined();
      expect(loadEvent?.tenantId).toBe('tenant-a');
    });

    it('should isolate audit events by tenant', async () => {
      const configId = 'audit-isolation-config';

      // Operations for tenant A
      await loader.saveConfig(configId, createValidConfig(), tenantA);
      await loader.loadConfig(configId, tenantA);

      // Operations for tenant B
      await loader.saveConfig(configId, createValidConfig(), tenantB);
      await loader.loadConfig(configId, tenantB);

      const allEvents = auditService.getRecentEvents(10);

      // Should have 4 events total (2 save + 2 load)
      const saveEvents = allEvents.filter(
        e => e.eventType === 'config.changed'
      );
      const loadEvents = allEvents.filter(e => e.eventType === 'config.loaded');

      expect(saveEvents).toHaveLength(2);
      expect(loadEvents).toHaveLength(2);

      // Verify tenant isolation in events
      const tenantAEvents = allEvents.filter(e => e.tenantId === 'tenant-a');
      const tenantBEvents = allEvents.filter(e => e.tenantId === 'tenant-b');

      expect(tenantAEvents).toHaveLength(2);
      expect(tenantBEvents).toHaveLength(2);
    });

    it('should require tenantId in audit events', async () => {
      // This test verifies that the audit service enforces tenantId requirement
      // If tenantId is missing, the audit service should throw an error
      await expect(
        auditService.emitAuditEvent({
          eventType: 'config.validated',
          configId: 'test',
          version: '1.0.0',
          tenantId: '', // Empty tenantId should fail
          timestamp: new Date().toISOString(),
        })
      ).rejects.toThrow('tenantId is required for audit events');
    });
  });

  describe('Backward Compatibility', () => {
    it('should use system tenant when no context provided', async () => {
      const configId = 'backward-compat-config';
      const config = createValidConfig();

      // Save without tenant context (should use system tenant)
      await loader.saveConfig(configId, config);

      // Load without tenant context
      const loaded = await loader.loadConfig(configId);

      expect(loaded).toBeDefined();
      expect(loaded?.version).toBe('1.0.0');
    });

    it('should maintain system tenant isolation', async () => {
      const configId = 'system-tenant-config';

      // Save to system tenant
      const systemConfig = createValidConfig('1.0.0');
      await loader.saveConfig(configId, systemConfig);

      // Save different config to tenant A
      const tenantConfig = createValidConfig('1.0.1');
      await loader.saveConfig(configId, tenantConfig, tenantA);

      // Verify isolation
      const systemLoaded = await loader.loadConfig(configId);
      const tenantLoaded = await loader.loadConfig(configId, tenantA);

      expect(systemLoaded?.version).toBe('1.0.0');
      expect(tenantLoaded?.version).toBe('1.0.1');
    });

    it('should support system tenant in version loading', async () => {
      const configId = 'system-version-config';

      // Save version to system tenant
      const config = createValidConfig('2.0.0');
      await loader.saveConfig(configId, config);

      // Load specific version without context
      const loaded = await loader.loadConfigByVersion(configId, '2.0.0');

      expect(loaded?.version).toBe('2.0.0');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tenant context', async () => {
      const configId = 'error-test-config';
      const config = createValidConfig();

      // Invalid tenant context (empty tenantId)
      const invalidContext = { tenantId: '', environment: 'prod' as const };

      await expect(
        loader.saveConfig(configId, config, invalidContext)
      ).rejects.toThrow('Invalid tenant context provided');
    });

    it('should handle non-existent configurations gracefully', async () => {
      const loaded = await loader.loadConfig('non-existent', tenantA);
      expect(loaded).toBeNull();

      const history = await loader.getConfigHistory('non-existent', tenantA);
      expect(history).toHaveLength(0);
    });

    it('should handle version not found', async () => {
      const configId = 'version-test-config';
      await loader.saveConfig(configId, createValidConfig('1.0.0'), tenantA);

      const loaded = await loader.loadConfigByVersion(
        configId,
        '2.0.0',
        tenantA
      );
      expect(loaded).toBeNull();
    });
  });

  describe('Performance & Edge Cases', () => {
    it('should handle large number of tenants efficiently', async () => {
      const configId = 'scale-test-config';

      // Create configs for multiple tenants
      for (let i = 0; i < 10; i++) {
        const tenant = {
          tenantId: `tenant-${i}`,
          environment: 'prod' as const,
        };
        const config = createValidConfig(`1.0.${i}`);
        await loader.saveConfig(configId, config, tenant);
      }

      // Verify all tenants have their configs
      for (let i = 0; i < 10; i++) {
        const tenant = {
          tenantId: `tenant-${i}`,
          environment: 'prod' as const,
        };
        const loaded = await loader.loadConfig(configId, tenant);
        expect(loaded?.version).toBe(`1.0.${i}`);
      }
    });

    it('should handle concurrent operations safely', async () => {
      const configId = 'concurrent-test-config';

      // Simulate concurrent saves (in practice, this would be handled by the repository)
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const config = createValidConfig(`1.0.${i}`);
        promises.push(loader.saveConfig(`${configId}-${i}`, config, tenantA));
      }

      await Promise.all(promises);

      // Verify all configs were saved
      for (let i = 0; i < 5; i++) {
        const loaded = await loader.loadConfig(`${configId}-${i}`, tenantA);
        expect(loaded?.version).toBe(`1.0.${i}`);
      }
    });

    it('should handle empty tenant configurations', async () => {
      // Verify empty tenant has no configs
      const configIds = await loader.getAllConfigIds(tenantB);
      expect(configIds).toHaveLength(0);
    });
  });
});
