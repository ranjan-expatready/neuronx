/**
 * Configuration Loader - REQ-019: Configuration as IP
 *
 * Loads NeuronX configuration with tenant isolation and persistence.
 * Provides backward compatibility while enabling multi-tenant operations.
 */

import {
  NeuronXConfiguration,
  TenantConfigurationAttachment,
} from './config.types';
import { ConfigValidator } from './config.validator';
import { configAuditService } from './config.audit';
import {
  IConfigRepository,
} from './postgres-config.repository';
import { TenantContext, createSystemTenantContext } from './tenant-context';
import { TenantConfigRepository } from './tenant-config.repository';
import { EntitlementService } from './entitlements/entitlement.service';

const configValidator = new ConfigValidator();

/**
 * Configuration loader service with tenant isolation and monetization controls
 */
export class ConfigLoader {
  constructor(
    private repository: IConfigRepository,
    private tenantConfigRepository: TenantConfigRepository,
    private entitlementService: EntitlementService,
    private templateService: any // Added for compatibility
  ) {}

  /**
   * Load configuration by ID with tenant context, template, and entitlement enforcement
   * Uses system tenant for backward compatibility when no context provided
   */
  async loadConfig(
    configId: string,
    tenantContext?: TenantContext
  ): Promise<NeuronXConfiguration | null> {
    const context = tenantContext || createSystemTenantContext();

    // Get tenant's template and entitlement assignment
    const attachment = await this.getTenantAttachment(context.tenantId);

    let config = await this.repository.loadLatestConfig(configId, context);

    if (!config) {
      // If no config exists, create from template if available
      if (attachment?.templateId) {
        config = await this.createConfigFromTemplate(
          attachment.templateId,
          context
        );
        if (config) {
          // Save the template-generated config
          await this.repository.saveConfig(configId, config, context);
        }
      }
    }

    if (config) {
      // Apply template constraints if template is attached
      if (attachment?.templateId) {
        config = await this.applyTemplateConstraints(
          config,
          attachment.templateId,
          context
        );
      }

      // Apply entitlement enforcement
      if (attachment?.entitlementTierId) {
        config = await this.applyEntitlementConstraints(
          config,
          attachment.entitlementTierId,
          context
        );
      }

      // Add metadata about applied constraints
      config._metadata = {
        templateId: attachment?.templateId,
        entitlementTierId: attachment?.entitlementTierId,
        appliedAt: new Date().toISOString(),
        constraintsApplied: this.getAppliedConstraints(attachment),
      };

      // Emit audit event for config access
      await configAuditService.emitAuditEvent({
        eventType: 'config.loaded',
        configId,
        tenantId: context.tenantId,
        version: config.version,
        timestamp: new Date().toISOString(),
        metadata: {
          operation: 'load',
          source: 'repository',
          environment: context.environment,
          templateId: attachment?.templateId,
          entitlementTierId: attachment?.entitlementTierId,
          constraintsApplied: config._metadata.constraintsApplied,
        },
      });
    }

    return config;
  }

  /**
   * Save configuration with tenant isolation, template, and entitlement validation
   */
  async saveConfig(
    configId: string,
    config: NeuronXConfiguration,
    tenantContext?: TenantContext
  ): Promise<void> {
    const context = tenantContext || createSystemTenantContext();

    // Get tenant's template and entitlement assignment
    const attachment = await this.getTenantAttachment(context.tenantId);

    // Validate configuration before applying constraints
    await configValidator.validateOrThrow(config, {
      tenantId: context.tenantId,
    });

    // Apply template constraints if template is attached
    let validatedConfig = config;
    if (attachment?.templateId) {
      validatedConfig = await this.applyTemplateConstraints(
        config,
        attachment.templateId,
        context,
        true
      );
    }

    // Apply entitlement enforcement
    if (attachment?.entitlementTierId) {
      validatedConfig = await this.applyEntitlementConstraints(
        validatedConfig,
        attachment.entitlementTierId,
        context,
        true
      );
    }

    // Add metadata about applied constraints
    validatedConfig._metadata = {
      templateId: attachment?.templateId,
      entitlementTierId: attachment?.entitlementTierId,
      appliedAt: new Date().toISOString(),
      constraintsApplied: this.getAppliedConstraints(attachment),
    };

    // Store in repository with tenant isolation
    await this.repository.saveConfig(configId, validatedConfig, context);

    // Emit audit event for config change
    await configAuditService.emitAuditEvent({
      eventType: 'config.changed',
      configId,
      tenantId: context.tenantId,
      version: validatedConfig.version,
      timestamp: new Date().toISOString(),
      changes: [], // TODO: Implement change detection
      metadata: {
        operation: 'save',
        source: 'repository',
        environment: context.environment,
        templateId: attachment?.templateId,
        entitlementTierId: attachment?.entitlementTierId,
        constraintsApplied: validatedConfig._metadata.constraintsApplied,
      },
    });
  }

  /**
   * Load specific configuration version
   */
  async loadConfigByVersion(
    configId: string,
    version: string,
    tenantContext?: TenantContext
  ): Promise<NeuronXConfiguration | null> {
    const context = tenantContext || createSystemTenantContext();
    return this.repository.loadConfigByVersion(
      configId,
      version as any,
      context
    );
  }

  /**
   * Check if configuration exists for tenant
   */
  async configExists(
    configId: string,
    tenantContext?: TenantContext
  ): Promise<boolean> {
    const context = tenantContext || createSystemTenantContext();
    return this.repository.configExists(configId, context);
  }

  /**
   * Get configuration history for tenant
   */
  async getConfigHistory(
    configId: string,
    tenantContext?: TenantContext
  ): Promise<
    Array<{ config: NeuronXConfiguration; version: string; timestamp: string }>
  > {
    const context = tenantContext || createSystemTenantContext();
    const entries = await this.repository.getConfigHistory(configId, context);

    return entries.map(entry => ({
      config: entry.config,
      version: entry.version,
      timestamp: entry.timestamp,
    }));
  }

  /**
   * List all configuration IDs for tenant (for testing/admin only)
   */
  async getAllConfigIds(tenantContext?: TenantContext): Promise<string[]> {
    const context = tenantContext || createSystemTenantContext();
    if ('getAllConfigIds' in this.repository) {
      return (this.repository as any).getAllConfigIds(context.tenantId);
    }
    return [];
  }

  /**
   * Clear all configurations (for testing only)
   */
  clearAllConfigs(): void {
    this.repository.clearAllConfigs();
    configAuditService.clearEvents();
  }

  /**
   * Get tenant's template and entitlement attachment
   * In production, this would be stored in a database
   */
  private async getTenantAttachment(
    tenantId: string
  ): Promise<TenantConfigurationAttachment | null> {
    return this.tenantConfigRepository.getAttachment(tenantId);
  }

  /**
   * Create initial configuration from template
   */
  private async createConfigFromTemplate(
    templateId: string,
    _tenantContext: TenantContext
  ): Promise<NeuronXConfiguration | null> {
    try {
      const template = await this.templateService.getTemplate(templateId);
      if (!template) {
        return null;
      }

      // Use the template's base configuration as starting point
      const config: NeuronXConfiguration = {
        ...template.baseConfig,
        _metadata: {
          templateId,
          appliedAt: new Date().toISOString(),
          constraintsApplied: ['template-initialized'],
        },
      };

      return config;
    } catch (error: any) {
      // Log error but don't fail - tenant can still configure manually
      console.warn(
        `Failed to create config from template ${templateId}:`,
        error.message
      );
      return null;
    }
  }

  /**
   * Apply template constraints to configuration
   */
  private async applyTemplateConstraints(
    config: NeuronXConfiguration,
    templateId: string,
    _tenantContext: TenantContext,
    throwOnViolation: boolean = false
  ): Promise<NeuronXConfiguration> {
    try {
      const result = await this.templateService.applyTemplate(
        templateId,
        config
      );

      if (!result.success) {
        if (throwOnViolation) {
          throw new Error(
            `Template constraints violated: ${result.errors?.join(', ')}`
          );
        }
        // Log warning but allow config to proceed
        console.warn(
          `Template constraints not fully applied for ${templateId}:`,
          result.errors
        );
      }

      return result.appliedConfig || config;
    } catch (error: any) {
      if (throwOnViolation) {
        throw error;
      }
      console.warn(
        `Failed to apply template constraints for ${templateId}:`,
        error.message
      );
      return config;
    }
  }

  /**
   * Apply entitlement constraints to configuration
   */
  private async applyEntitlementConstraints(
    config: NeuronXConfiguration,
    tierId: string,
    _tenantContext: TenantContext,
    throwOnViolation: boolean = false
  ): Promise<NeuronXConfiguration> {
    try {
      // Check each domain entitlement
      const domainsToDisable: string[] = [];

      const tier = await this.entitlementService.getTier(tierId);
      if (tier) {
        for (const [domain, enabled] of Object.entries(
          tier.features.domains
        )) {
          if (!enabled) {
            domainsToDisable.push(domain);
          }
        }
      }

      // Disable domains not in entitlement
      const constrainedConfig = { ...config };
      for (const domain of domainsToDisable) {
        if (
          constrainedConfig.domains[
            domain as keyof typeof constrainedConfig.domains
          ]
        ) {
          // Mark domain as disabled rather than removing it
          (
            constrainedConfig.domains[
              domain as keyof typeof constrainedConfig.domains
            ] as any
          )._disabled = true;
          (
            constrainedConfig.domains[
              domain as keyof typeof constrainedConfig.domains
            ] as any
          )._disabledReason = 'not_in_entitlement';
        }
      }

      return constrainedConfig;
    } catch (error: any) {
      if (throwOnViolation) {
        throw error;
      }
      console.warn(
        `Failed to apply entitlement constraints for ${tierId}:`,
        error.message
      );
      return config;
    }
  }

  /**
   * Get list of applied constraints for audit
   */
  private getAppliedConstraints(
    attachment: TenantConfigurationAttachment | null
  ): string[] {
    const constraints: string[] = [];

    if (attachment?.templateId) {
      constraints.push(`template:${attachment.templateId}`);
    }

    if (attachment?.entitlementTierId) {
      constraints.push(`entitlement:${attachment.entitlementTierId}`);
    }

    return constraints;
  }
}

/**
 * Global loader instance
 * TODO: Replace with dependency injection
 */
// export const configLoader = new ConfigLoader();