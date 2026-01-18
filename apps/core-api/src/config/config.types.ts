/**
 * Configuration Domain Types - REQ-019: Configuration as IP
 *
 * Canonical domain models for NeuronX configuration schema.
 * These types define the structure that tenants can customize within NeuronX-owned boundaries.
 */

export type SemanticVersion = `${number}.${number}.${number}`;

/**
 * Base configuration structure with versioning and metadata
 */
export interface BaseConfig {
  /** Semantic version for configuration compatibility */
  version: SemanticVersion;

  /** Human-readable description of this configuration */
  description?: string;

  /** Timestamp when configuration was created/modified */
  timestamp: string;

  /** Optional metadata for tracking */
  metadata?: Record<string, unknown>;
}

/**
 * Lead scoring configuration domain
 * NeuronX owns: ML model selection, weight schemas, validation rules
 * Tenant owns: Specific threshold values, industry multipliers
 */
export interface ScoringConfig {
  /** ML model selection (basic/advanced/predictive) */
  model: 'basic' | 'advanced' | 'predictive';

  /** Weight assignments for different signal types (must sum to 100) */
  weights: {
    sentiment: number; // 0-100
    responseTime: number; // 0-100
    frequency: number; // 0-100
    industry: number; // 0-100
    customFields: number; // 0-100
  };

  /** Qualification threshold (0.0-1.0) */
  qualificationThreshold: number;

  /** Industry-specific multipliers */
  industryMultipliers: Record<string, number>;
}

/**
 * Lead routing configuration domain
 * NeuronX owns: Team capacity algorithms, expertise mappings, validation rules
 * Tenant owns: Geographic preferences, load balancing selections
 */
export interface RoutingConfig {
  /** Load balancing algorithm selection */
  algorithm:
    | 'round-robin'
    | 'capacity-based'
    | 'expertise-first'
    | 'geographic';

  /** Geographic routing preferences by region */
  geographicPreferences: Record<string, string[]>; // region -> teamIds

  /** Team capacity definitions */
  teamCapacities: Record<
    string,
    {
      maxConcurrent: number;
      expertiseAreas: string[];
      regions: string[];
    }
  >;

  /** Load balancing thresholds */
  thresholds: {
    highLoadPercentage: number; // 0-100
    lowLoadPercentage: number; // 0-100
    rebalanceIntervalMinutes: number;
  };
}

/**
 * SLA configuration domain
 * NeuronX owns: Escalation hierarchies, time calculations, validation rules
 * Tenant owns: Response requirements, notification rules
 */
export interface SLAConfig {
  /** Response time requirements by channel/source */
  responseTimes: Record<
    string,
    {
      initialHours: number;
      followUpHours: number;
      maxEscalations: number;
    }
  >;

  /** SLA breach notification rules */
  notifications: {
    immediateChannels: string[]; // email, sms, slack
    escalationChannels: string[]; // email, sms, slack
    managerNotificationDelay: number; // minutes
  };

  /** Automatic escalation rules */
  escalationRules: {
    enabled: boolean;
    maxAutomaticEscalations: number;
    requireManagerApproval: boolean;
  };
}

/**
 * Escalation configuration domain
 * NeuronX owns: Follow-up sequences, approval workflows, validation rules
 * Tenant owns: Notification methods, timing preferences
 */
export interface EscalationConfig {
  /** Follow-up sequence templates */
  sequences: Record<
    string,
    {
      name: string;
      steps: Array<{
        delayMinutes: number;
        channels: string[];
        template: string;
        requireResponse: boolean;
      }>;
    }
  >;

  /** Escalation hierarchy definitions */
  hierarchies: Record<
    string,
    {
      levels: Array<{
        name: string;
        approvers: string[];
        escalationTimeMinutes: number;
        notificationChannels: string[];
      }>;
    }
  >;

  /** Exception handling rules */
  exceptions: {
    allowManualOverride: boolean;
    requireAuditLog: boolean;
    maxOverridePercentage: number; // 0-100
  };
}

/**
 * Feature flags and entitlements configuration domain
 * NeuronX owns: Entitlement schemas, access controls, validation rules
 * Tenant owns: Feature enablement selections
 */
export interface FeatureFlagsConfig {
  /** Feature enablement by module */
  modules: Record<
    string,
    {
      enabled: boolean;
      entitlements: string[]; // Required entitlement levels
      dependencies: string[]; // Other modules required
    }
  >;

  /** Entitlement definitions */
  entitlements: Record<
    string,
    {
      name: string;
      description: string;
      limits: Record<string, number>; // API calls, users, etc.
      pricingTier: string;
    }
  >;

  /** Beta feature access */
  betaFeatures: Record<
    string,
    {
      enabled: boolean;
      maxTenants: number;
      expirationDate?: string;
    }
  >;
}

/**
 * Deployment mode configuration domain
 * NeuronX owns: Model implementation differences, validation rules
 * Tenant owns: Model selection, feature preferences
 */
export interface DeploymentModeConfig {
  /** Deployment model selection */
  model: 'dfy' | 'saas' | 'hybrid';

  /** Feature availability by model */
  featureAvailability: Record<
    string,
    {
      dfy: boolean;
      saas: boolean;
      hybrid: boolean;
      migrationPath?: string;
    }
  >;

  /** Model-specific settings */
  settings: {
    dataRetentionDays: number;
    backupFrequency: string;
    supportLevel: 'basic' | 'premium' | 'enterprise';
    customIntegrations: boolean;
  };
}

/**
 * Integration mappings configuration domain
 * NeuronX owns: Adapter schemas, protocol translations, validation rules
 * Tenant owns: Integration enablement, error preferences
 */
export interface IntegrationMappingsConfig {
  /** Integration enablement by system */
  integrations: Record<
    string,
    {
      enabled: boolean;
      adapter: string; // Adapter identifier
      config: Record<string, unknown>; // Adapter-specific config
    }
  >;

  /** Global integration settings */
  globalSettings: {
    retryPolicy: {
      maxAttempts: number;
      baseDelayMs: number;
      maxDelayMs: number;
    };
    rateLimiting: {
      requestsPerMinute: number;
      burstAllowance: number;
    };
    errorHandling: {
      circuitBreakerThreshold: number;
      timeoutMs: number;
    };
  };

  /** Data flow mappings (high-level only) */
  dataFlows: Record<
    string,
    {
      source: string;
      destination: string;
      transformation: string; // High-level description only
      frequency: string;
    }
  >;
}

/**
 * Tenant configuration attachment
 * Links tenants to their templates and entitlements
 */
export interface TenantConfigurationAttachment {
  /** Tenant identifier */
  tenantId: string;

  /** Attached template identifier */
  templateId: string;

  /** Attached entitlement tier identifier */
  entitlementTierId: string;

  /** Attachment timestamp */
  attachedAt: string;

  /** Attached by user/system */
  attachedBy: string;

  /** Attachment status */
  status: 'active' | 'suspended' | 'migrating';

  /** Status change timestamp */
  statusChangedAt: string;
}

/**
 * Complete NeuronX configuration schema
 * This is the canonical configuration structure owned by NeuronX
 */
export interface NeuronXConfiguration extends BaseConfig {
  /** Configuration domain instances */
  domains: {
    scoring: ScoringConfig;
    routing: RoutingConfig;
    sla: SLAConfig;
    escalation: EscalationConfig;
    featureFlags: FeatureFlagsConfig;
    deploymentMode: DeploymentModeConfig;
    integrationMappings: IntegrationMappingsConfig;
  };

  /** Template and entitlement metadata (added by ConfigLoader) */
  _metadata?: {
    /** Applied template ID */
    templateId?: string;

    /** Applied entitlement tier ID */
    entitlementTierId?: string;

    /** Template application timestamp */
    appliedAt?: string;

    /** Constraints applied */
    constraintsApplied?: string[];
  };
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    domain: string;
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

/**
 * Configuration audit event with tenant isolation
 */
export interface ConfigAuditEvent {
  eventType: 'config.loaded' | 'config.validated' | 'config.changed';
  configId: string;
  version: SemanticVersion;
  tenantId: string; // Added for tenant isolation
  timestamp: string;
  userId?: string;
  changes?: Array<{
    domain: string;
    field: string;
    oldValue?: unknown;
    newValue?: unknown;
  }>;
  metadata?: Record<string, unknown>;
}
