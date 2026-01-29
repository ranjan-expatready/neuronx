/**
 * UAT Configuration Loader - WI-066: UAT Harness + Seed + Safety
 *
 * Loads and validates UAT configuration from environment variables.
 * Implements fail-closed behavior for production safety.
 */

import {
  UatConfig,
  UatConfigSchema,
  DEFAULT_UAT_CONFIG,
  NeuronxEnvironment,
} from './types';

/**
 * Environment variable names for UAT configuration
 */
const ENV_VARS = {
  NEURONX_ENV: 'NEURONX_ENV',
  UAT_TENANT_IDS: 'UAT_TENANT_IDS',
  UAT_MODE: 'UAT_MODE',
  UAT_KILL_SWITCH: 'UAT_KILL_SWITCH',
  UAT_GHL_LOCATION_IDS: 'UAT_GHL_LOCATION_IDS',
  UAT_LABEL_PREFIX: 'UAT_LABEL_PREFIX',
  UAT_TEST_PHONE_ALLOWLIST: 'UAT_TEST_PHONE_ALLOWLIST',
  UAT_EMAIL_DOMAIN_ALLOWLIST: 'UAT_EMAIL_DOMAIN_ALLOWLIST',
  UAT_CALENDAR_ALLOWLIST: 'UAT_CALENDAR_ALLOWLIST',
} as const;

/**
 * Load UAT configuration from environment variables
 */
export function loadUatConfig(): UatConfig {
  try {
    // Parse environment variables
    const envConfig = {
      neuronxEnv: parseNeuronxEnv(process.env[ENV_VARS.NEURONX_ENV]),
      uatTenantIds: parseCommaSeparatedList(
        process.env[ENV_VARS.UAT_TENANT_IDS]
      ),
      uatMode: parseUatMode(process.env[ENV_VARS.UAT_MODE]),
      uatKillSwitch: parseBoolean(
        process.env[ENV_VARS.UAT_KILL_SWITCH],
        DEFAULT_UAT_CONFIG.uatKillSwitch
      ),
      uatGhlLocationIds: parseCommaSeparatedList(
        process.env[ENV_VARS.UAT_GHL_LOCATION_IDS]
      ),
      uatLabelPrefix:
        process.env[ENV_VARS.UAT_LABEL_PREFIX] ||
        DEFAULT_UAT_CONFIG.uatLabelPrefix,
      uatTestPhoneAllowlist: parseCommaSeparatedList(
        process.env[ENV_VARS.UAT_TEST_PHONE_ALLOWLIST]
      ),
      uatEmailDomainAllowlist: parseCommaSeparatedList(
        process.env[ENV_VARS.UAT_EMAIL_DOMAIN_ALLOWLIST]
      ),
      uatCalendarAllowlist: parseCommaSeparatedList(
        process.env[ENV_VARS.UAT_CALENDAR_ALLOWLIST]
      ),
    };

    // Validate configuration
    const validatedConfig = UatConfigSchema.parse(envConfig);

    // Enforce fail-closed behavior for production
    validateProductionSafety(validatedConfig);

    return validatedConfig;
  } catch (error) {
    throw new Error(
      `UAT configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse NeuronX environment from string
 */
function parseNeuronxEnv(value?: string): NeuronxEnvironment {
  const validEnvs: NeuronxEnvironment[] = ['dev', 'uat', 'prod'];
  const parsed = (value || 'dev').toLowerCase();

  if (!validEnvs.includes(parsed as NeuronxEnvironment)) {
    throw new Error(
      `Invalid NEURONX_ENV: ${value}. Must be one of: ${validEnvs.join(', ')}`
    );
  }

  return parsed as NeuronxEnvironment;
}

/**
 * Parse UAT mode from string
 */
function parseUatMode(value?: string): 'dry_run' | 'live_uat' {
  const validModes = ['dry_run', 'live_uat'];
  const parsed = (value || 'dry_run').toLowerCase();

  if (!validModes.includes(parsed)) {
    throw new Error(
      `Invalid UAT_MODE: ${value}. Must be one of: ${validModes.join(', ')}`
    );
  }

  return parsed as 'dry_run' | 'live_uat';
}

/**
 * Parse boolean from string
 */
function parseBoolean(value?: string, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;

  const lowerValue = value.toLowerCase();
  if (lowerValue === 'true') return true;
  if (lowerValue === 'false') return false;

  throw new Error(`Invalid boolean value: ${value}. Must be 'true' or 'false'`);
}

/**
 * Parse comma-separated list from string
 */
function parseCommaSeparatedList(value?: string): string[] {
  if (!value || value.trim() === '') return [];

  return value
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/**
 * Validate production safety constraints
 */
function validateProductionSafety(config: UatConfig): void {
  // Production environment cannot have UAT configuration enabled
  if (config.neuronxEnv === 'prod') {
    const uatFlagsEnabled = [
      config.uatTenantIds.length > 0,
      config.uatMode === 'live_uat',
      !config.uatKillSwitch, // Kill switch should be true in prod
      config.uatGhlLocationIds.length > 0,
    ].some(enabled => enabled);

    if (uatFlagsEnabled) {
      throw new Error(
        'PRODUCTION SAFETY VIOLATION: Production environment cannot have UAT flags enabled. ' +
          'Ensure all UAT_* environment variables are unset or set to safe defaults in production.'
      );
    }
  }

  // UAT environment must have kill switch enabled by default unless explicitly disabled
  if (config.neuronxEnv === 'uat' && !config.uatKillSwitch) {
    console.warn(
      'WARNING: UAT environment has kill switch disabled. ' +
        'Ensure this is intentional and all safety measures are in place.'
    );
  }
}

/**
 * Get current UAT configuration (cached)
 */
let cachedConfig: UatConfig | null = null;

export function getUatConfig(): UatConfig {
  if (!cachedConfig) {
    cachedConfig = loadUatConfig();
  }
  return cachedConfig;
}

/**
 * Clear cached configuration (for testing)
 */
export function clearUatConfigCache(): void {
  cachedConfig = null;
}
