/**
 * Configuration Repository - REQ-019: Configuration as IP
 *
 * In-memory repository for configuration persistence with tenant isolation.
 * Provides tenant-scoped storage, versioning, and audit trail support.
 */

import { NeuronXConfiguration, SemanticVersion } from './config.types';
import { TenantContext, validateTenantContext } from './tenant-context';

/**
 * Configuration entry with metadata
 */
interface ConfigEntry {
  config: NeuronXConfiguration;
  tenantId: string;
  version: SemanticVersion;
  timestamp: string;
}

/**
 * Configuration repository interface
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
  ): Promise<ConfigEntry[]>;
  configExists(
    configId: string,
    tenantContext: TenantContext
  ): Promise<boolean>;
  clearAllConfigs(): void; // For testing only
}

/**
 * In-memory configuration repository
 * Provides tenant-isolated configuration storage and versioning
 */
export class ConfigRepository implements IConfigRepository {
  // Storage: tenantId -> configId -> version -> config entry
  // STOP-SHIP: Tenant isolation depends on tenantId being the top-level key
  // If this structure changes, update tenant isolation regression tests
  private configs = new Map<string, Map<string, Map<string, ConfigEntry>>>();

  /**
   * Save configuration with tenant isolation
   */
  async saveConfig(
    configId: string,
    config: NeuronXConfiguration,
    tenantContext: TenantContext
  ): Promise<void> {
    if (!validateTenantContext(tenantContext)) {
      throw new Error('Invalid tenant context provided');
    }

    // Ensure tenant storage exists
    if (!this.configs.has(tenantContext.tenantId)) {
      this.configs.set(tenantContext.tenantId, new Map());
    }

    const tenantConfigs = this.configs.get(tenantContext.tenantId)!;

    // Ensure config ID storage exists
    if (!tenantConfigs.has(configId)) {
      tenantConfigs.set(configId, new Map());
    }

    const configVersions = tenantConfigs.get(configId)!;

    // Create config entry
    const entry: ConfigEntry = {
      config,
      tenantId: tenantContext.tenantId,
      version: config.version,
      timestamp: config.timestamp,
    };

    // Store by version
    configVersions.set(config.version, entry);
  }

  /**
   * Load latest configuration for a tenant
   */
  async loadLatestConfig(
    configId: string,
    tenantContext: TenantContext
  ): Promise<NeuronXConfiguration | null> {
    if (!validateTenantContext(tenantContext)) {
      throw new Error('Invalid tenant context provided');
    }

    const tenantConfigs = this.configs.get(tenantContext.tenantId);
    if (!tenantConfigs) {
      return null;
    }

    const configVersions = tenantConfigs.get(configId);
    if (!configVersions || configVersions.size === 0) {
      return null;
    }

    // Find the latest version (assuming semantic versioning)
    // For now, we'll sort by timestamp as a proxy
    const entries = Array.from(configVersions.values());
    const latest = entries.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];

    return latest.config;
  }

  /**
   * Load specific configuration version for a tenant
   */
  async loadConfigByVersion(
    configId: string,
    version: SemanticVersion,
    tenantContext: TenantContext
  ): Promise<NeuronXConfiguration | null> {
    if (!validateTenantContext(tenantContext)) {
      throw new Error('Invalid tenant context provided');
    }

    const tenantConfigs = this.configs.get(tenantContext.tenantId);
    if (!tenantConfigs) {
      return null;
    }

    const configVersions = tenantConfigs.get(configId);
    if (!configVersions) {
      return null;
    }

    const entry = configVersions.get(version);
    return entry ? entry.config : null;
  }

  /**
   * Get configuration history for a tenant
   */
  async getConfigHistory(
    configId: string,
    tenantContext: TenantContext
  ): Promise<ConfigEntry[]> {
    if (!validateTenantContext(tenantContext)) {
      throw new Error('Invalid tenant context provided');
    }

    const tenantConfigs = this.configs.get(tenantContext.tenantId);
    if (!tenantConfigs) {
      return [];
    }

    const configVersions = tenantConfigs.get(configId);
    if (!configVersions) {
      return [];
    }

    // Return sorted by timestamp (newest first)
    return Array.from(configVersions.values()).sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Check if configuration exists for a tenant
   */
  async configExists(
    configId: string,
    tenantContext: TenantContext
  ): Promise<boolean> {
    if (!validateTenantContext(tenantContext)) {
      throw new Error('Invalid tenant context provided');
    }

    const tenantConfigs = this.configs.get(tenantContext.tenantId);
    if (!tenantConfigs) {
      return false;
    }

    const configVersions = tenantConfigs.get(configId);
    return configVersions ? configVersions.size > 0 : false;
  }

  /**
   * Clear all configurations (for testing only)
   */
  clearAllConfigs(): void {
    this.configs.clear();
  }

  /**
   * Get all tenant IDs (for testing only)
   */
  getAllTenantIds(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Get all config IDs for a tenant (for testing only)
   */
  getAllConfigIds(tenantId: string): string[] {
    const tenantConfigs = this.configs.get(tenantId);
    return tenantConfigs ? Array.from(tenantConfigs.keys()) : [];
  }
}

/**
 * Global repository instance
 * TODO: Replace with dependency injection
 */
export const configRepository = new ConfigRepository();
