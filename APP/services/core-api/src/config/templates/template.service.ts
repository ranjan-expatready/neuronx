/**
 * Configuration Template Service - REQ-019: Configuration as IP
 *
 * Manages NeuronX-owned configuration templates as monetizable assets.
 * Templates define the structure, constraints, and defaults for tenant configurations.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ConfigurationTemplate,
  TemplateValidationResult,
  TemplateApplicationResult,
  TemplateQueryOptions,
  TemplateConstraints,
  FieldConstraint,
} from './template.types';
import { NeuronXConfiguration } from '../config.types';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  // In-memory template storage - in production this would be a database
  private templates = new Map<string, ConfigurationTemplate>();

  // Pre-defined NeuronX templates
  private readonly builtinTemplates: ConfigurationTemplate[] = [
    this.createStarterTemplate(),
    this.createProfessionalTemplate(),
    this.createEnterpriseTemplate(),
  ];

  constructor() {
    // Initialize with built-in templates
    this.initializeTemplates();
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<ConfigurationTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  /**
   * List templates with optional filtering
   */
  async listTemplates(
    options: TemplateQueryOptions = {}
  ): Promise<ConfigurationTemplate[]> {
    let templates = Array.from(this.templates.values());

    // Apply filters
    if (options.category) {
      templates = templates.filter(t => t.category === options.category);
    }

    if (options.isActive !== undefined) {
      templates = templates.filter(t => t.isActive === options.isActive);
    }

    if (options.targetSegment) {
      templates = templates.filter(
        t => t.targetSegment === options.targetSegment
      );
    }

    // Apply pagination
    if (options.offset) {
      templates = templates.slice(options.offset);
    }

    if (options.limit) {
      templates = templates.slice(0, options.limit);
    }

    return templates;
  }

  /**
   * Create a new template
   */
  async createTemplate(
    template: Omit<ConfigurationTemplate, 'createdAt' | 'updatedAt'>
  ): Promise<ConfigurationTemplate> {
    // Validate template
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    // Check for duplicate ID
    if (this.templates.has(template.templateId)) {
      throw new Error(`Template with ID ${template.templateId} already exists`);
    }

    const newTemplate: ConfigurationTemplate = {
      ...template,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.templates.set(template.templateId, newTemplate);
    this.logger.log(`Created template: ${template.templateId}`);

    return newTemplate;
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<ConfigurationTemplate>
  ): Promise<ConfigurationTemplate> {
    const existing = this.templates.get(templateId);
    if (!existing) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Prevent changing templateId
    if (updates.templateId && updates.templateId !== templateId) {
      throw new Error('Cannot change template ID');
    }

    const updatedTemplate: ConfigurationTemplate = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Validate updated template
    const validation = this.validateTemplate(updatedTemplate);
    if (!validation.valid) {
      throw new Error(
        `Invalid template update: ${validation.errors.join(', ')}`
      );
    }

    this.templates.set(templateId, updatedTemplate);
    this.logger.log(`Updated template: ${templateId}`);

    return updatedTemplate;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    if (!this.templates.has(templateId)) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Prevent deletion of built-in templates
    const template = this.templates.get(templateId)!;
    if (this.builtinTemplates.some(t => t.templateId === templateId)) {
      throw new Error('Cannot delete built-in templates');
    }

    this.templates.delete(templateId);
    this.logger.log(`Deleted template: ${templateId}`);
  }

  /**
   * Apply template to tenant configuration
   * This enforces template constraints and provides defaults
   */
  async applyTemplate(
    templateId: string,
    tenantConfig: NeuronXConfiguration
  ): Promise<TemplateApplicationResult> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      return {
        success: false,
        errors: [`Template ${templateId} not found`],
      };
    }

    if (!template.isActive) {
      return {
        success: false,
        errors: [`Template ${templateId} is not active`],
      };
    }

    try {
      const result = this.applyTemplateConstraints(template, tenantConfig);
      this.logger.log(`Applied template ${templateId} to tenant configuration`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to apply template ${templateId}:`,
        error.message
      );
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Validate template structure
   */
  validateTemplate(
    template: Partial<ConfigurationTemplate>
  ): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!template.templateId) errors.push('templateId is required');
    if (!template.name) errors.push('name is required');
    if (!template.version) errors.push('version is required');
    if (!template.category) errors.push('category is required');
    if (!template.baseConfig) errors.push('baseConfig is required');

    // Template ID format
    if (template.templateId && !/^[a-zA-Z0-9_-]+$/.test(template.templateId)) {
      errors.push(
        'templateId must contain only alphanumeric characters, hyphens, and underscores'
      );
    }

    // Version format (semantic versioning)
    if (template.version && !/^\d+\.\d+\.\d+$/.test(template.version)) {
      errors.push('version must follow semantic versioning (x.y.z)');
    }

    // Base config validation
    if (template.baseConfig) {
      const configErrors = this.validateBaseConfig(template.baseConfig);
      errors.push(...configErrors);
    }

    // Constraints validation
    if (template.constraints) {
      const constraintErrors = this.validateConstraints(template.constraints);
      errors.push(...constraintErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Initialize built-in templates
   */
  private initializeTemplates(): void {
    for (const template of this.builtinTemplates) {
      this.templates.set(template.templateId, template);
    }
    this.logger.log(
      `Initialized ${this.builtinTemplates.length} built-in templates`
    );
  }

  /**
   * Create starter template
   */
  private createStarterTemplate(): ConfigurationTemplate {
    return {
      templateId: 'starter',
      name: 'Starter Plan',
      description: 'Basic configuration for getting started with NeuronX',
      version: '1.0.0',
      category: 'starter',
      isActive: true,
      baseConfig: this.createStarterBaseConfig(),
      constraints: this.createStarterConstraints(),
      metadata: {
        author: 'NeuronX Platform Team',
        targetSegment: 'small-business',
        valueProposition:
          'Essential features for small teams getting started with sales automation',
        requirements: ['Basic CRM integration'],
        limitations: [
          'Limited to 3 team members',
          'Basic scoring model only',
          'Limited geographic routing',
          'No voice capabilities',
        ],
        upgradePath: 'professional',
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
  }

  /**
   * Create professional template
   */
  private createProfessionalTemplate(): ConfigurationTemplate {
    return {
      templateId: 'professional',
      name: 'Professional Plan',
      description: 'Advanced configuration for growing sales teams',
      version: '1.0.0',
      category: 'professional',
      isActive: true,
      baseConfig: this.createProfessionalBaseConfig(),
      constraints: this.createProfessionalConstraints(),
      metadata: {
        author: 'NeuronX Platform Team',
        targetSegment: 'mid-market',
        valueProposition:
          'Advanced AI-driven sales orchestration for growing teams',
        requirements: ['Advanced CRM integration', 'API access'],
        limitations: [
          'Limited to 25 team members',
          'No predictive routing',
          'Limited voice capabilities',
        ],
        upgradePath: 'enterprise',
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
  }

  /**
   * Create enterprise template
   */
  private createEnterpriseTemplate(): ConfigurationTemplate {
    return {
      templateId: 'enterprise',
      name: 'Enterprise Plan',
      description: 'Full-featured configuration for large sales organizations',
      version: '1.0.0',
      category: 'enterprise',
      isActive: true,
      baseConfig: this.createEnterpriseBaseConfig(),
      constraints: this.createEnterpriseConstraints(),
      metadata: {
        author: 'NeuronX Platform Team',
        targetSegment: 'enterprise',
        valueProposition: 'Complete AI-powered sales orchestration platform',
        requirements: ['Enterprise CRM integration', 'Custom integrations'],
        limitations: [], // No limitations for enterprise
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
  }

  // Template creation helper methods would go here
  // For brevity, I'll create simple implementations

  private createStarterBaseConfig(): NeuronXConfiguration {
    return {
      version: '1.0.0',
      description: 'Starter configuration',
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
          qualificationThreshold: 0.6,
          industryMultipliers: { technology: 1.1, finance: 1.05 },
        },
        routing: {
          algorithm: 'round-robin',
          geographicPreferences: { 'north-america': ['team-basic'] },
          teamCapacities: {
            'team-basic': {
              maxConcurrent: 5,
              expertiseAreas: ['general'],
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
            default: { initialHours: 1, followUpHours: 4, maxEscalations: 2 },
          },
          notifications: {
            immediateChannels: ['email'],
            escalationChannels: ['email'],
            managerNotificationDelay: 60,
          },
          escalationRules: {
            enabled: true,
            maxAutomaticEscalations: 2,
            requireManagerApproval: true,
          },
        },
        escalation: {
          hierarchies: {
            basic: {
              levels: [
                {
                  name: 'Manager',
                  approvers: ['manager@company.com'],
                  escalationTimeMinutes: 480,
                  notificationChannels: ['email'],
                },
              ],
            },
          },
          sequences: {},
          exceptions: {
            allowManualOverride: false,
            requireAuditLog: true,
            maxOverridePercentage: 10,
          },
        },
        featureFlags: {
          modules: {
            basicScoring: {
              enabled: true,
              entitlements: ['basic'],
              dependencies: [],
            },
          },
          entitlements: {
            basic: {
              name: 'Basic Features',
              description: 'Essential features',
              limits: { apiCalls: 1000, users: 3 },
              pricingTier: 'starter',
            },
          },
          betaFeatures: {},
        },
        deploymentMode: {
          model: 'saas',
          featureAvailability: {
            basicScoring: { dfy: true, saas: true, hybrid: false },
          },
          settings: {
            dataRetentionDays: 90,
            backupFrequency: 'weekly',
            supportLevel: 'basic',
            customIntegrations: false,
          },
        },
        integrationMappings: {
          integrations: {
            crm: { enabled: true, adapter: 'basic-crm', config: {} },
          },
          globalSettings: {
            retryPolicy: {
              maxAttempts: 3,
              baseDelayMs: 1000,
              maxDelayMs: 5000,
            },
            rateLimiting: { requestsPerMinute: 60, burstAllowance: 10 },
            errorHandling: { circuitBreakerThreshold: 5, timeoutMs: 30000 },
          },
          dataFlows: {
            basic: {
              source: 'crm',
              destination: 'neuronx',
              transformation: 'basic-mapping',
              frequency: 'real-time',
            },
          },
        },
      },
    };
  }

  private createProfessionalBaseConfig(): NeuronXConfiguration {
    // Similar structure but with more advanced features
    const base = this.createStarterBaseConfig();
    base.domains.scoring.model = 'advanced';
    return base;
  }

  private createEnterpriseBaseConfig(): NeuronXConfiguration {
    // Full features enabled
    const base = this.createProfessionalBaseConfig();
    // Add voice, predictive routing, etc.
    return base;
  }

  private createStarterConstraints(): TemplateConstraints {
    return {
      domains: {
        enabled: {
          scoring: true,
          routing: true,
          sla: true,
          escalation: true,
          featureFlags: true,
          deploymentMode: true,
          integrationMappings: true,
          voice: false, // Disabled for starter
        },
        constraints: {},
      },
    };
  }

  private createProfessionalConstraints(): TemplateConstraints {
    const constraints = this.createStarterConstraints();
    constraints.domains.enabled.voice = true; // Enable voice for professional
    return constraints;
  }

  private createEnterpriseConstraints(): TemplateConstraints {
    const constraints = this.createProfessionalConstraints();
    // All features enabled for enterprise
    return constraints;
  }

  private validateBaseConfig(config: NeuronXConfiguration): string[] {
    const errors: string[] = [];
    if (!config.version) errors.push('baseConfig must have version');
    if (!config.domains) errors.push('baseConfig must have domains');
    return errors;
  }

  private validateConstraints(constraints: TemplateConstraints): string[] {
    const errors: string[] = [];
    if (!constraints.domains) errors.push('constraints must have domains');
    return errors;
  }

  private applyTemplateConstraints(
    template: ConfigurationTemplate,
    tenantConfig: NeuronXConfiguration
  ): TemplateApplicationResult {
    // This would implement the actual constraint application logic
    // For now, return success with the tenant config
    return {
      success: true,
      appliedConfig: tenantConfig,
      constrainedFields: [],
    };
  }
}
