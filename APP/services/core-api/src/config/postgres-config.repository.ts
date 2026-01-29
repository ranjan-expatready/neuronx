/**
 * PostgreSQL Configuration Repository - WI-012: Configuration Persistence
 *
 * Database-backed configuration repository with tenant isolation and IP protection.
 * Assembles effective configurations from templates + overrides + entitlements.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  NeuronXConfiguration,
  SemanticVersion,
  EffectiveConfiguration,
} from './config.types';
import { TenantContext, validateTenantContext } from './tenant-context';
import { TemplateRepository } from './templates/template.repository';
import { TenantConfigRepository } from './tenant-config.repository';
import { EntitlementService } from './entitlements/entitlement.service';

/**
 * Configuration repository interface (same as existing)
 */
export interface IConfigRepository {
  saveConfig(
    configId: string,
    config: NeuronXConfiguration,
    tenantContext: TenantContext
  ): Promise<void>;
  loadLatestConfig(
    configId: string,
    tenantContext: TenantContext
  ): Promise<NeuronXConfiguration | null>;
  loadConfigByVersion(
    configId: string,
    version: SemanticVersion,
    tenantContext: TenantContext
  ): Promise<NeuronXConfiguration | null>;
  getConfigHistory(
    configId: string,
    tenantContext: TenantContext
  ): Promise<any[]>;
  configExists(
    configId: string,
    tenantContext: TenantContext
  ): Promise<boolean>;
  clearAllConfigs(): void; // For testing only
}

@Injectable()
export class PostgresConfigRepository implements IConfigRepository {
  private readonly logger = new Logger(PostgresConfigRepository.name);

  constructor(
    private readonly templateRepository: TemplateRepository,
    private readonly tenantConfigRepository: TenantConfigRepository,
    private readonly entitlementService: EntitlementService
  ) {}

  /**
   * Save configuration with tenant isolation and IP protection
   */
  async saveConfig(
    configId: string,
    config: NeuronXConfiguration,
    tenantContext: TenantContext
  ): Promise<void> {
    if (!validateTenantContext(tenantContext)) {
      throw new Error('Invalid tenant context provided');
    }

    // Validate tenant isolation
    const isValidTenant =
      await this.tenantConfigRepository.validateTenantIsolation(
        tenantContext.tenantId,
        tenantContext.tenantId // Self-validation
      );
    if (!isValidTenant) {
      throw new Error('Tenant isolation violation');
    }

    // Get tenant attachment to validate against template constraints
    const attachment = await this.tenantConfigRepository.getAttachment(
      tenantContext.tenantId
    );
    if (!attachment) {
      throw new Error(
        `No configuration template attached for tenant ${tenantContext.tenantId}`
      );
    }

    // Get template to validate constraints
    const template = await this.templateRepository.getTemplate(
      attachment.templateId
    );
    if (!template) {
      throw new Error(`Template ${attachment.templateId} not found`);
    }

    // Validate configuration against template constraints
    const constraintValidation = this.templateRepository.validateConstraints(
      template,
      config
    );
    if (!constraintValidation.isValid) {
      throw new Error(
        `Configuration violates template constraints: ${constraintValidation.violations.join(', ')}`
      );
    }

    // Validate against entitlement rules
    await this.validateEntitlementConstraints(config, tenantContext.tenantId);

    // Convert to overrides format (field-level overrides from base template)
    const overrides = this.computeOverrides(template.baseConfig, config);

    // Save overrides to database
    await this.tenantConfigRepository.writeOverrides(
      tenantContext.tenantId,
      overrides,
      tenantContext.actorId || 'system',
      tenantContext.correlationId,
      `Save config ${configId}`
    );

    // Clear cache since configuration changed
    await this.tenantConfigRepository.clearCache(tenantContext.tenantId);

    this.logger.log(
      `Configuration saved for tenant ${tenantContext.tenantId}, config ${configId}`
    );
  }

  /**
   * Load latest effective configuration with template + overrides + entitlements
   */
  async loadLatestConfig(
    configId: string,
    tenantContext: TenantContext
  ): Promise<NeuronXConfiguration | null> {
    if (!validateTenantContext(tenantContext)) {
      throw new Error('Invalid tenant context provided');
    }

    // Validate tenant isolation
    const isValidTenant =
      await this.tenantConfigRepository.validateTenantIsolation(
        tenantContext.tenantId,
        tenantContext.tenantId
      );
    if (!isValidTenant) {
      throw new Error('Tenant isolation violation');
    }

    // Try cache first
    const cached = await this.tenantConfigRepository.getCachedEffectiveConfig(
      tenantContext.tenantId
    );
    if (cached) {
      await this.tenantConfigRepository.incrementCacheHit(
        tenantContext.tenantId
      );
      return cached.config;
    }

    // Compute effective configuration
    const effective = await this.computeEffectiveConfig(tenantContext.tenantId);

    if (effective) {
      // Cache the result
      await this.tenantConfigRepository.cacheEffectiveConfig(
        tenantContext.tenantId,
        effective.config,
        {
          templateId: effective.metadata.templateId,
          templateVersion: effective.metadata.templateVersion,
          entitlementTierId: effective.metadata.entitlementTierId,
          overrideVersion: effective.metadata.overrideVersion,
        }
      );

      return effective.config;
    }

    return null;
  }

  /**
   * Load configuration by version (not supported in new model - overrides are versioned)
   */
  async loadConfigByVersion(
    configId: string,
    version: SemanticVersion,
    tenantContext: TenantContext
  ): Promise<NeuronXConfiguration | null> {
    // In the new model, we don't support loading by specific config version
    // Instead, we support loading by override version
    throw new Error(
      'Loading by config version not supported. Use override versioning.'
    );
  }

  /**
   * Get configuration history (override history)
   */
  async getConfigHistory(
    configId: string,
    tenantContext: TenantContext
  ): Promise<any[]> {
    if (!validateTenantContext(tenantContext)) {
      throw new Error('Invalid tenant context provided');
    }

    return this.tenantConfigRepository.getConfigHistory(tenantContext.tenantId);
  }

  /**
   * Check if configuration exists
   */
  async configExists(
    configId: string,
    tenantContext: TenantContext
  ): Promise<boolean> {
    if (!validateTenantContext(tenantContext)) {
      throw new Error('Invalid tenant context provided');
    }

    const attachment = await this.tenantConfigRepository.getAttachment(
      tenantContext.tenantId
    );
    return !!attachment;
  }

  /**
   * Clear all configs (for testing only)
   */
  clearAllConfigs(): void {
    // Not implemented for production - use database migrations for cleanup
    throw new Error(
      'clearAllConfigs not supported in production. Use database migrations.'
    );
  }

  /**
   * Compute effective configuration from template + overrides + entitlements
   */
  private async computeEffectiveConfig(
    tenantId: string
  ): Promise<EffectiveConfiguration | null> {
    // Get tenant attachment
    const attachment =
      await this.tenantConfigRepository.getAttachment(tenantId);
    if (!attachment || attachment.status !== 'active') {
      return null;
    }

    // Get template
    const template = await this.templateRepository.getTemplate(
      attachment.templateId
    );
    if (!template) {
      throw new Error(`Template ${attachment.templateId} not found`);
    }

    // Start with base config
    let effectiveConfig = { ...template.baseConfig };

    // Apply overrides
    const overrides =
      await this.tenantConfigRepository.getLatestOverrides(tenantId);
    if (overrides) {
      effectiveConfig = this.deepMerge(effectiveConfig, overrides.overrides);
    }

    // Apply entitlement constraints
    effectiveConfig = await this.applyEntitlementConstraints(
      effectiveConfig,
      attachment.entitlementTierId
    );

    // Add metadata
    const metadata = {
      templateId: attachment.templateId,
      templateVersion: attachment.templateVersion,
      entitlementTierId: attachment.entitlementTierId,
      overrideVersion: overrides?.version,
      computedAt: new Date().toISOString(),
      fromCache: false,
    };

    return {
      tenantId,
      config: effectiveConfig as NeuronXConfiguration,
      metadata,
    };
  }

  /**
   * Validate configuration against entitlement constraints
   */
  private async validateEntitlementConstraints(
    config: any,
    tenantId: string
  ): Promise<void> {
    const entitlement =
      await this.entitlementService.getTenantEntitlement(tenantId);
    if (!entitlement) {
      throw new Error(`No entitlement found for tenant ${tenantId}`);
    }

    const tier = await this.entitlementService.getTier(entitlement.tierId);
    if (!tier) {
      throw new Error(`Entitlement tier ${entitlement.tierId} not found`);
    }

    // Check feature enablement
    if (
      config.scoring?.model === 'predictive' &&
      !tier.features.ai.predictiveRouting
    ) {
      throw new Error('Predictive scoring not allowed for current tier');
    }

    if (config.voice && !tier.features.domains.voice) {
      throw new Error('Voice features not allowed for current tier');
    }

    // Check limits
    if (tier.limits && config.routing?.teamCapacities) {
      const teamCount = Object.keys(config.routing.teamCapacities).length;
      if (tier.limits.team?.maxTeams && teamCount > tier.limits.team.maxTeams) {
        throw new Error(
          `Team count exceeds limit: ${teamCount} > ${tier.limits.team.maxTeams}`
        );
      }
    }
  }

  /**
   * Apply entitlement constraints to configuration
   */
  private async applyEntitlementConstraints(
    config: any,
    entitlementTierId: string
  ): Promise<any> {
    const tier = await this.entitlementService.getTier(entitlementTierId);
    if (!tier) return config;

    const result = { ...config };

    // Disable voice features if not entitled
    if (!tier.features.domains.voice && result.voice) {
      result.voice = undefined;
    }

    // Limit team capacities if constrained
    if (tier.limits?.team?.maxTeams && result.routing?.teamCapacities) {
      const teams = Object.keys(result.routing.teamCapacities);
      if (teams.length > tier.limits.team.maxTeams) {
        // Keep only the first N teams
        const allowedTeams = teams.slice(0, tier.limits.team.maxTeams);
        result.routing.teamCapacities = Object.fromEntries(
          Object.entries(result.routing.teamCapacities).filter(([teamId]) =>
            allowedTeams.includes(teamId)
          )
        );
      }
    }

    return result;
  }

  /**
   * Compute overrides from base config to effective config
   */
  private computeOverrides(baseConfig: any, effectiveConfig: any): any {
    const overrides: any = {};

    this.computeOverridesRecursive(baseConfig, effectiveConfig, overrides, '');

    return overrides;
  }

  private computeOverridesRecursive(
    base: any,
    effective: any,
    overrides: any,
    path: string
  ): void {
    if (typeof effective !== 'object' || effective === null) {
      if (base !== effective) {
        this.setNestedValue(overrides, path, effective);
      }
      return;
    }

    for (const key in effective) {
      const newPath = path ? `${path}.${key}` : key;
      if (!(key in base)) {
        this.setNestedValue(overrides, newPath, effective[key]);
      } else {
        this.computeOverridesRecursive(
          base[key],
          effective[key],
          overrides,
          newPath
        );
      }
    }
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Set nested object value by dot path
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }
}
