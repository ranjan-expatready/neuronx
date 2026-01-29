/**
 * Template Repository - WI-012: Configuration Persistence
 *
 * PostgreSQL-backed template repository for NeuronX-owned IP.
 * Manages configuration templates with versioning and constraints.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaClient,
  ConfigurationTemplate as PrismaConfigurationTemplate,
} from '@prisma/client';
import {
  ConfigurationTemplate,
  TemplateConstraints,
  TemplateVersion,
} from './template.types';

@Injectable()
export class TemplateRepository {
  private readonly logger = new Logger(TemplateRepository.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Initialize canonical templates (run once on system setup)
   */
  async initializeCanonicalTemplates(): Promise<void> {
    const canonicalTemplates = [
      this.createSalesOsStandardTemplate(),
      this.createEnterpriseTemplate(),
      this.createStarterTemplate(),
      this.createFreeTemplate(),
    ];

    for (const template of canonicalTemplates) {
      await this.prisma.configurationTemplate.upsert({
        where: {
          templateId_version: {
            templateId: template.templateId,
            version: template.version,
          },
        },
        update: {
          name: template.name,
          description: template.description,
          category: template.category,
          isActive: template.isActive,
          baseConfig: template.baseConfig as any,
          constraints: template.constraints as any,
          updatedAt: new Date(),
        },
        create: {
          templateId: template.templateId,
          name: template.name,
          description: template.description,
          category: template.category,
          isActive: template.isActive,
          version: template.version,
          baseConfig: template.baseConfig as any,
          constraints: template.constraints as any,
        },
      });
    }

    this.logger.log('Canonical configuration templates initialized');
  }

  /**
   * Get template by ID and optional version
   */
  async getTemplate(
    templateId: string,
    version?: string
  ): Promise<ConfigurationTemplate | null> {
    const template = await this.prisma.configurationTemplate.findFirst({
      where: {
        templateId,
        ...(version && { version }),
        isActive: true,
      },
      orderBy: version ? undefined : { version: 'desc' }, // Latest if no version specified
    });

    return template ? this.mapTemplateToDomain(template) : null;
  }

  /**
   * List active templates with optional filtering
   */
  async listActiveTemplates(
    category?: string
  ): Promise<ConfigurationTemplate[]> {
    const templates = await this.prisma.configurationTemplate.findMany({
      where: {
        isActive: true,
        ...(category && { category }),
      },
      orderBy: { templateId: 'asc' },
    });

    return templates.map(this.mapTemplateToDomain);
  }

  /**
   * Get template versions for a specific template ID
   */
  async getTemplateVersions(templateId: string): Promise<TemplateVersion[]> {
    const templates = await this.prisma.configurationTemplate.findMany({
      where: { templateId },
      orderBy: { version: 'desc' },
      select: {
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return templates.map(t => ({
      version: t.version,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  /**
   * Validate template constraints against a configuration
   */
  validateConstraints(
    template: ConfigurationTemplate,
    config: any
  ): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];
    const constraints = template.constraints;

    // Check required fields
    if (constraints.requiredFields) {
      for (const field of constraints.requiredFields) {
        if (!this.getNestedValue(config, field)) {
          violations.push(`Required field missing: ${field}`);
        }
      }
    }

    // Check field ranges
    if (constraints.fieldRanges) {
      for (const [field, range] of Object.entries(constraints.fieldRanges)) {
        const value = this.getNestedValue(config, field);
        if (value !== undefined) {
          if (typeof value === 'number') {
            const numRange = range as { min?: number; max?: number };
            if (numRange.min !== undefined && value < numRange.min) {
              violations.push(
                `Field ${field} below minimum: ${value} < ${numRange.min}`
              );
            }
            if (numRange.max !== undefined && value > numRange.max) {
              violations.push(
                `Field ${field} above maximum: ${value} > ${numRange.max}`
              );
            }
          }
        }
      }
    }

    // Check allowed enum values
    if (constraints.allowedEnums) {
      for (const [field, allowed] of Object.entries(constraints.allowedEnums)) {
        const value = this.getNestedValue(config, field);
        if (value !== undefined && !(allowed as any[]).includes(value)) {
          violations.push(
            `Field ${field} has invalid value: ${value}. Allowed: ${(allowed as any[]).join(', ')}`
          );
        }
      }
    }

    // Check forbidden fields (templates can forbid certain customizations)
    if (constraints.forbiddenFields) {
      for (const field of constraints.forbiddenFields) {
        if (this.getNestedValue(config, field) !== undefined) {
          violations.push(`Forbidden field present: ${field}`);
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  /**
   * Canonical template definitions
   */
  private createSalesOsStandardTemplate(): ConfigurationTemplate {
    return {
      templateId: 'sales-os-standard',
      name: 'Sales OS Standard',
      description: 'Standard configuration template for Sales OS operations',
      category: 'sales',
      isActive: true,
      version: '1.0.0',
      baseConfig: {
        scoring: {
          model: 'advanced',
          weights: {
            sentiment: 25,
            responseTime: 20,
            frequency: 15,
            industry: 25,
            customFields: 15,
          },
          qualificationThreshold: 0.7,
          industryMultipliers: {
            technology: 1.2,
            healthcare: 1.1,
            finance: 1.1,
            default: 1.0,
          },
        },
        routing: {
          algorithm: 'capacity-based',
          geographicPreferences: {},
          teamCapacities: {},
          thresholds: {
            highLoadPercentage: 80,
            lowLoadPercentage: 20,
            rebalanceIntervalMinutes: 30,
          },
        },
        sla: {
          responseTimes: {
            default: {
              initialHours: 24,
              followUpHours: 48,
              maxEscalations: 3,
            },
          },
          notifications: {
            immediateChannels: ['email'],
            escalationChannels: ['email', 'slack'],
            managerNotificationDelay: 60,
          },
          escalationRules: {
            automaticEscalation: true,
            escalationDelays: [24, 48, 72],
          },
        },
      },
      constraints: {
        requiredFields: ['scoring.weights', 'routing.algorithm'],
        fieldRanges: {
          'scoring.qualificationThreshold': { min: 0.1, max: 1.0 },
          'scoring.weights.sentiment': { min: 0, max: 100 },
          'scoring.weights.responseTime': { min: 0, max: 100 },
          'scoring.weights.frequency': { min: 0, max: 100 },
          'scoring.weights.industry': { min: 0, max: 100 },
          'scoring.weights.customFields': { min: 0, max: 100 },
        },
        allowedEnums: {
          'scoring.model': ['basic', 'advanced', 'predictive'],
          'routing.algorithm': [
            'round-robin',
            'capacity-based',
            'expertise-first',
            'geographic',
          ],
        },
        forbiddenFields: [], // Templates can forbid tenant customization of certain fields
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private createEnterpriseTemplate(): ConfigurationTemplate {
    const base = this.createSalesOsStandardTemplate();
    return {
      ...base,
      templateId: 'sales-os-enterprise',
      name: 'Sales OS Enterprise',
      description:
        'Enterprise-grade configuration template with advanced features',
      category: 'enterprise',
      baseConfig: {
        ...base.baseConfig,
        scoring: {
          ...base.baseConfig.scoring,
          model: 'predictive',
        },
        routing: {
          ...base.baseConfig.routing,
          algorithm: 'expertise-first',
        },
      },
    };
  }

  private createStarterTemplate(): ConfigurationTemplate {
    const base = this.createSalesOsStandardTemplate();
    return {
      ...base,
      templateId: 'sales-os-starter',
      name: 'Sales OS Starter',
      description: 'Simplified configuration template for getting started',
      category: 'sales',
      baseConfig: {
        ...base.baseConfig,
        scoring: {
          ...base.baseConfig.scoring,
          model: 'basic',
        },
      },
    };
  }

  private createFreeTemplate(): ConfigurationTemplate {
    const base = this.createSalesOsStandardTemplate();
    return {
      ...base,
      templateId: 'sales-os-free',
      name: 'Sales OS Free',
      description: 'Basic configuration template for free tier',
      category: 'sales',
      baseConfig: {
        ...base.baseConfig,
        scoring: {
          ...base.baseConfig.scoring,
          model: 'basic',
          weights: {
            sentiment: 30,
            responseTime: 25,
            frequency: 20,
            industry: 15,
            customFields: 10,
          },
        },
      },
    };
  }

  /**
   * Utility function to get nested object value by dot path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Map Prisma model to domain model
   */
  private mapTemplateToDomain(
    prismaTemplate: PrismaConfigurationTemplate
  ): ConfigurationTemplate {
    return {
      templateId: prismaTemplate.templateId,
      name: prismaTemplate.name,
      description: prismaTemplate.description,
      category: prismaTemplate.category,
      isActive: prismaTemplate.isActive,
      version: prismaTemplate.version,
      baseConfig: prismaTemplate.baseConfig as any,
      constraints: prismaTemplate.constraints as any,
      createdAt: prismaTemplate.createdAt.toISOString(),
      updatedAt: prismaTemplate.updatedAt.toISOString(),
    };
  }
}
