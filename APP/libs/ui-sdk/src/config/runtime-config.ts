/**
 * Runtime Config - WI-061: UI Infrastructure & Governance Layer
 *
 * Server-driven feature flags and UI behavior configuration.
 * Fetched from backend, cached, and evaluated client-side.
 */

import { RuntimeConfig, ApiResponse, UiSdkError } from '../types';
import { httpClient } from '../http/client';
import { CorrelationContext } from '../http/correlation';

/**
 * Runtime Configuration Manager
 * Fetches and caches server-driven UI configuration
 */
export class RuntimeConfigManager {
  private static instance: RuntimeConfigManager;
  private cachedConfig: RuntimeConfig | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private isLoading: boolean = false;
  private loadPromise: Promise<RuntimeConfig> | null = null;

  static getInstance(): RuntimeConfigManager {
    if (!RuntimeConfigManager.instance) {
      RuntimeConfigManager.instance = new RuntimeConfigManager();
    }
    return RuntimeConfigManager.instance;
  }

  /**
   * Get current runtime configuration (with caching)
   */
  async getConfig(): Promise<RuntimeConfig> {
    const now = Date.now();

    // Return cached config if still valid
    if (this.cachedConfig && now < this.cacheExpiry) {
      return this.cachedConfig;
    }

    // Prevent multiple simultaneous loads
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    try {
      this.loadPromise = this.fetchConfig();
      const config = await this.loadPromise;

      // Cache the result
      this.cachedConfig = config;
      this.cacheExpiry = now + this.CACHE_TTL;

      return config;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  /**
   * Force refresh of runtime configuration
   */
  async refresh(): Promise<RuntimeConfig> {
    this.clearCache();
    return this.getConfig();
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.cacheExpiry = 0;
  }

  /**
   * Check if a specific feature is enabled
   */
  async isFeatureEnabled(feature: keyof RuntimeConfig): Promise<boolean> {
    const config = await this.getConfig();
    const value = config[feature];

    // Type-safe boolean check
    if (typeof value === 'boolean') {
      return value;
    }

    // For non-boolean features, assume enabled if config exists
    return true;
  }

  /**
   * Get enforcement mode for banners/notifications
   */
  async getEnforcementMode(): Promise<'monitor_only' | 'block'> {
    const config = await this.getConfig();
    return config.enforcementBannerMode;
  }

  /**
   * Check if operator console is enabled
   */
  async isOperatorConsoleEnabled(): Promise<boolean> {
    return this.isFeatureEnabled('enableOperatorConsole');
  }

  /**
   * Check if manager console is enabled
   */
  async isManagerConsoleEnabled(): Promise<boolean> {
    return this.isFeatureEnabled('enableManagerConsole');
  }

  /**
   * Check if executive dashboard is enabled
   */
  async isExecDashboardEnabled(): Promise<boolean> {
    return this.isFeatureEnabled('enableExecDashboard');
  }

  /**
   * Check if voice widgets are enabled
   */
  async isVoiceWidgetsEnabled(): Promise<boolean> {
    return this.isFeatureEnabled('enableVoiceWidgets');
  }

  /**
   * Check if drift widgets are enabled
   */
  async isDriftWidgetsEnabled(): Promise<boolean> {
    return this.isFeatureEnabled('enableDriftWidgets');
  }

  /**
   * Check if override requests are enabled
   */
  async isOverrideRequestsEnabled(): Promise<boolean> {
    return this.isFeatureEnabled('enableOverrideRequests');
  }

  /**
   * Get max retry attempts for operations
   */
  async getMaxRetryAttempts(): Promise<number> {
    const config = await this.getConfig();
    return config.maxRetryAttempts;
  }

  /**
   * Get correlation ID prefix
   */
  async getCorrelationIdPrefix(): Promise<string> {
    const config = await this.getConfig();
    return config.correlationIdPrefix;
  }

  /**
   * Fetch configuration from backend
   */
  private async fetchConfig(): Promise<RuntimeConfig> {
    const correlationId = CorrelationContext.get();

    try {
      const response: ApiResponse<RuntimeConfig> = await httpClient.get(
        '/ui/runtime-config',
        {
          correlationId,
        }
      );

      if (!response.success || !response.data) {
        throw new UiSdkError(
          response.error || 'Failed to fetch runtime config',
          'RUNTIME_CONFIG_FETCH_FAILED',
          response.correlationId
        );
      }

      // Validate required fields and provide defaults
      const config = this.validateAndDefaultConfig(response.data);

      return config;
    } catch (error) {
      // Fail-open with sensible defaults
      console.warn('Failed to fetch runtime config, using defaults', {
        correlationId,
        error: (error as Error).message,
      });

      return this.getDefaultConfig();
    }
  }

  /**
   * Validate config and apply defaults
   */
  private validateAndDefaultConfig(
    config: Partial<RuntimeConfig>
  ): RuntimeConfig {
    return {
      enableOperatorConsole: config.enableOperatorConsole ?? true,
      enableManagerConsole: config.enableManagerConsole ?? true,
      enableExecDashboard: config.enableExecDashboard ?? true,
      enableVoiceWidgets: config.enableVoiceWidgets ?? true,
      enableDriftWidgets: config.enableDriftWidgets ?? true,
      enableOverrideRequests: config.enableOverrideRequests ?? false,
      enforcementBannerMode: config.enforcementBannerMode ?? 'monitor_only',
      maxRetryAttempts: Math.max(1, Math.min(config.maxRetryAttempts ?? 3, 10)),
      correlationIdPrefix: config.correlationIdPrefix ?? 'ui',
    };
  }

  /**
   * Get default configuration (fail-open)
   */
  private getDefaultConfig(): RuntimeConfig {
    return {
      enableOperatorConsole: true,
      enableManagerConsole: true,
      enableExecDashboard: true,
      enableVoiceWidgets: true,
      enableDriftWidgets: true,
      enableOverrideRequests: false,
      enforcementBannerMode: 'monitor_only',
      maxRetryAttempts: 3,
      correlationIdPrefix: 'ui',
    };
  }
}

/**
 * Default runtime config manager instance
 */
export const runtimeConfigManager = RuntimeConfigManager.getInstance();

/**
 * Convenience functions for runtime config
 */
export const getRuntimeConfig = () => runtimeConfigManager.getConfig();
export const refreshRuntimeConfig = () => runtimeConfigManager.refresh();
export const isFeatureEnabled = (feature: keyof RuntimeConfig) =>
  runtimeConfigManager.isFeatureEnabled(feature);
export const getEnforcementMode = () =>
  runtimeConfigManager.getEnforcementMode();
export const isOperatorConsoleEnabled = () =>
  runtimeConfigManager.isOperatorConsoleEnabled();
export const isManagerConsoleEnabled = () =>
  runtimeConfigManager.isManagerConsoleEnabled();
export const isExecDashboardEnabled = () =>
  runtimeConfigManager.isExecDashboardEnabled();
export const isVoiceWidgetsEnabled = () =>
  runtimeConfigManager.isVoiceWidgetsEnabled();
export const isDriftWidgetsEnabled = () =>
  runtimeConfigManager.isDriftWidgetsEnabled();
export const isOverrideRequestsEnabled = () =>
  runtimeConfigManager.isOverrideRequestsEnabled();
export const getMaxRetryAttempts = () =>
  runtimeConfigManager.getMaxRetryAttempts();
export const getCorrelationIdPrefix = () =>
  runtimeConfigManager.getCorrelationIdPrefix();
