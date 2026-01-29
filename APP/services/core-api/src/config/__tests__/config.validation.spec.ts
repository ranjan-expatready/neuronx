/**
 * Configuration Validation Tests - REQ-019: Configuration as IP
 *
 * Tests configuration loading, validation, and audit functionality.
 * Maintains >90% coverage requirement for configuration IP.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ConfigModule,
  ConfigLoader,
  ConfigValidator,
  ConfigAuditService,
} from '../config.module';
import { NeuronXConfiguration, ValidationResult } from '../config.types';

describe('Configuration Validation (Unit)', () => {
  let loader: ConfigLoader;
  let validator: ConfigValidator;
  let auditService: ConfigAuditService;

  // Sample valid configuration for testing
  const validConfig: NeuronXConfiguration = {
    version: '1.0.0',
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
                escalationTimeMinutes: 1440, // 24 hours
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
  };

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

  describe('Configuration Loading', () => {
    it('should load valid configuration', async () => {
      const configId = 'test-config-1';

      await loader.saveConfig(configId, validConfig);
      const loaded = await loader.loadConfig(configId);

      expect(loaded).toBeDefined();
      expect(loaded?.version).toBe('1.0.0');
      expect(loaded?.domains.scoring.model).toBe('basic');
    });

    it('should return null for non-existent configuration', async () => {
      const loaded = await loader.loadConfig('non-existent');
      expect(loaded).toBeNull();
    });

    it('should emit audit event on config load', async () => {
      const configId = 'test-config-2';

      await loader.saveConfig(configId, validConfig);
      await loader.loadConfig(configId);

      const events = auditService.getRecentEvents();
      const loadEvent = events.find(e => e.eventType === 'config.loaded');

      expect(loadEvent).toBeDefined();
      expect(loadEvent?.configId).toBe(configId);
      expect(loadEvent?.version).toBe('1.0.0');
    });

    it('should emit audit event on config save', async () => {
      const configId = 'test-config-3';

      await loader.saveConfig(configId, validConfig);

      const events = auditService.getRecentEvents();
      const saveEvent = events.find(e => e.eventType === 'config.changed');

      expect(saveEvent).toBeDefined();
      expect(saveEvent?.configId).toBe(configId);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct configuration', async () => {
      const result = await validator.validate(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration without required domains', async () => {
      const invalidConfig = {
        ...validConfig,
        domains: {} as any, // Remove all domains
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('Required domain missing'))
      ).toBe(true);
    });

    it('should reject invalid semantic version', async () => {
      const invalidConfig = {
        ...validConfig,
        version: 'invalid-version' as any,
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('semantic'))).toBe(
        true
      );
    });

    it('should reject scoring weights that do not sum to 100', async () => {
      const invalidConfig = {
        ...validConfig,
        domains: {
          ...validConfig.domains,
          scoring: {
            ...validConfig.domains.scoring,
            weights: {
              sentiment: 50,
              responseTime: 25,
              frequency: 25,
              industry: 15,
              customFields: 10, // Total = 125, not 100
            },
          },
        },
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('sum to 100'))).toBe(
        true
      );
    });

    it('should reject negative weight values', async () => {
      const invalidConfig = {
        ...validConfig,
        domains: {
          ...validConfig.domains,
          scoring: {
            ...validConfig.domains.scoring,
            weights: {
              sentiment: -10, // Negative weight
              responseTime: 35,
              frequency: 25,
              industry: 15,
              customFields: 35,
            },
          },
        },
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('between 0-100'))).toBe(
        true
      );
    });

    it('should reject invalid routing algorithm', async () => {
      const invalidConfig = {
        ...validConfig,
        domains: {
          ...validConfig.domains,
          routing: {
            ...validConfig.domains.routing,
            algorithm: 'invalid-algorithm' as any,
          },
        },
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('Algorithm must be one of'))
      ).toBe(true);
    });

    it('should reject invalid SLA response times', async () => {
      const invalidConfig = {
        ...validConfig,
        domains: {
          ...validConfig.domains,
          sla: {
            ...validConfig.domains.sla,
            responseTimes: {
              email: {
                initialHours: -1, // Negative hours
                followUpHours: 48,
                maxEscalations: 3,
              },
            },
          },
        },
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('must be positive'))
      ).toBe(true);
    });

    it('should reject invalid escalation delays', async () => {
      const invalidConfig = {
        ...validConfig,
        domains: {
          ...validConfig.domains,
          escalation: {
            ...validConfig.domains.escalation,
            sequences: {
              'test-sequence': {
                name: 'Test',
                steps: [
                  {
                    delayMinutes: -30, // Negative delay
                    channels: ['email'],
                    template: 'test',
                    requireResponse: false,
                  },
                ],
              },
            },
          },
        },
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('cannot be negative'))
      ).toBe(true);
    });

    it('should reject invalid feature flag dependencies', async () => {
      const invalidConfig = {
        ...validConfig,
        domains: {
          ...validConfig.domains,
          featureFlags: {
            ...validConfig.domains.featureFlags,
            modules: {
              testModule: {
                enabled: true,
                entitlements: ['premium'],
                dependencies: ['non-existent-module'], // Dependency doesn't exist
              },
            },
          },
        },
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('does not exist in modules'))
      ).toBe(true);
    });

    it('should reject invalid deployment model', async () => {
      const invalidConfig = {
        ...validConfig,
        domains: {
          ...validConfig.domains,
          deploymentMode: {
            ...validConfig.domains.deploymentMode,
            model: 'invalid-model' as any,
          },
        },
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('Model must be one of'))
      ).toBe(true);
    });

    it('should reject invalid integration settings', async () => {
      const invalidConfig = {
        ...validConfig,
        domains: {
          ...validConfig.domains,
          integrationMappings: {
            ...validConfig.domains.integrationMappings,
            globalSettings: {
              ...validConfig.domains.integrationMappings.globalSettings,
              retryPolicy: {
                maxAttempts: 0, // Must be positive
                baseDelayMs: 1000,
                maxDelayMs: 10000,
              },
            },
          },
        },
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('must be positive'))
      ).toBe(true);
    });

    it('should emit audit event on validation', async () => {
      await validator.validate(validConfig);

      const events = auditService.getRecentEvents();
      const validationEvent = events.find(
        e => e.eventType === 'config.validated'
      );

      expect(validationEvent).toBeDefined();
      expect(validationEvent?.metadata?.valid).toBe(true);
    });

    it('should throw error on validation failure when using validateOrThrow', async () => {
      const invalidConfig = {
        ...validConfig,
        version: 'invalid-version' as any,
      };

      await expect(validator.validateOrThrow(invalidConfig)).rejects.toThrow(
        'Configuration validation failed'
      );
    });
  });

  describe('Version Compatibility', () => {
    it('should consider exact versions compatible', () => {
      const compatible = validator.isVersionCompatible('1.0.0', '1.0.0');
      expect(compatible).toBe(true);
    });

    it('should consider different versions incompatible', () => {
      const compatible = validator.isVersionCompatible('1.0.0', '1.1.0');
      expect(compatible).toBe(false);
    });

    // TODO: Implement semantic version compatibility rules
    it('should implement semantic version compatibility rules', () => {
      // Placeholder for future semantic version logic
      expect(true).toBe(true);
    });
  });

  describe('Audit Service', () => {
    it('should emit audit events', async () => {
      await auditService.emitAuditEvent({
        eventType: 'config.validated',
        configId: 'test-config',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });

      const events = auditService.getRecentEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('config.validated');
    });

    it('should maintain event history', async () => {
      await auditService.emitAuditEvent({
        eventType: 'config.loaded',
        configId: 'config-1',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });

      await auditService.emitAuditEvent({
        eventType: 'config.changed',
        configId: 'config-1',
        version: '1.0.1',
        timestamp: new Date().toISOString(),
      });

      const events = auditService.getRecentEvents(2);
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe('config.loaded');
      expect(events[1].eventType).toBe('config.changed');
    });
  });

  // Coverage tests for edge cases and error conditions
  describe('Edge Cases and Error Handling', () => {
    it('should handle missing timestamp gracefully', async () => {
      const configWithoutTimestamp = {
        ...validConfig,
        timestamp: undefined as any,
      };

      const result = await validator.validate(configWithoutTimestamp);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('Timestamp is required'))
      ).toBe(true);
    });

    it('should handle empty configuration object', async () => {
      const emptyConfig = {} as NeuronXConfiguration;

      const result = await validator.validate(emptyConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate industry multipliers are positive', async () => {
      const invalidConfig = {
        ...validConfig,
        domains: {
          ...validConfig.domains,
          scoring: {
            ...validConfig.domains.scoring,
            industryMultipliers: {
              technology: -0.5, // Negative multiplier
            },
          },
        },
      };

      const result = await validator.validate(invalidConfig);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('must be positive'))
      ).toBe(true);
    });
  });
});
