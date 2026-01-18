/**
 * Entitlement Types - REQ-019: Configuration as IP
 *
 * Entitlements define what features and limits tenants are allowed to use.
 * Entitlements are NeuronX-owned assets that control feature access and usage limits.
 */

/**
 * Entitlement tier definition
 * Tiers define the allowed features and limits for tenants
 */
export interface EntitlementTier {
  /** Unique tier identifier */
  tierId: string;

  /** Human-readable name */
  name: string;

  /** Tier description */
  description: string;

  /** Tier category (e.g., 'free', 'paid', 'enterprise') */
  category: string;

  /** Whether this tier is active/purchasable */
  isActive: boolean;

  /** Feature entitlements */
  features: FeatureEntitlements;

  /** Usage limits and quotas */
  limits: UsageLimits;

  /** Tier metadata */
  metadata: TierMetadata;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Feature entitlements define which features are enabled
 */
export interface FeatureEntitlements {
  /** Configuration domain access */
  domains: {
    scoring: boolean;
    routing: boolean;
    sla: boolean;
    escalation: boolean;
    featureFlags: boolean;
    deploymentMode: boolean;
    integrationMappings: boolean;
    voice: boolean;
  };

  /** Specific feature flags */
  features: Record<string, boolean>;

  /** Integration capabilities */
  integrations: {
    /** Allowed integration types */
    allowedTypes: string[];

    /** Maximum number of active integrations */
    maxActiveIntegrations: number;

    /** Custom integration development */
    customIntegrations: boolean;
  };

  /** AI/ML capabilities */
  ai: {
    /** Advanced scoring models */
    advancedScoring: boolean;

    /** Predictive routing */
    predictiveRouting: boolean;

    /** Voice AI capabilities */
    voiceAI: boolean;

    /** Custom model training */
    customModels: boolean;
  };

  /** Support and service levels */
  support: {
    /** Support level */
    level: 'basic' | 'premium' | 'enterprise' | 'dedicated';

    /** Response time SLA */
    responseTimeHours: number;

    /** Custom success management */
    customSuccess: boolean;
  };
}

/**
 * Usage limits and quotas
 */
export interface UsageLimits {
  /** Lead processing limits */
  leads: {
    /** Monthly lead processing limit */
    monthlyLimit: number;

    /** Burst limit for peak usage */
    burstLimit: number;

    /** Rate limit per minute */
    perMinuteLimit: number;
  };

  /** API usage limits */
  api: {
    /** Monthly API call limit */
    monthlyLimit: number;

    /** Per-minute rate limit */
    perMinuteLimit: number;

    /** Burst allowance */
    burstAllowance: number;
  };

  /** Team and user limits */
  team: {
    /** Maximum team members */
    maxMembers: number;

    /** Maximum concurrent users */
    maxConcurrentUsers: number;

    /** Maximum teams */
    maxTeams: number;
  };

  /** Storage and data limits */
  storage: {
    /** Data retention days */
    retentionDays: number;

    /** Maximum data volume (GB) */
    maxVolumeGB: number;

    /** Backup frequency */
    backupFrequency: 'daily' | 'weekly' | 'monthly';
  };

  /** Voice and communication limits */
  voice: {
    /** Monthly voice minutes */
    monthlyMinutes: number;

    /** Maximum concurrent calls */
    maxConcurrentCalls: number;

    /** Call recording retention days */
    recordingRetentionDays: number;
  };

  /** Integration limits */
  integrations: {
    /** Maximum webhooks */
    maxWebhooks: number;

    /** API rate limits for integrations */
    apiRateLimit: number;

    /** Data sync frequency */
    syncFrequencyMinutes: number;
  };
}

/**
 * Tier metadata for marketplace and governance
 */
export interface TierMetadata {
  /** Target customer segment */
  targetSegment: string;

  /** Business value proposition */
  valueProposition: string;

  /** Use cases this tier supports */
  useCases: string[];

  /** Technical requirements */
  requirements: string[];

  /** Included services */
  includedServices: string[];

  /** Upgrade/downgrade information */
  transitions: {
    /** Allowed upgrade paths */
    upgradeTo: string[];

    /** Allowed downgrade paths */
    downgradeTo: string[];

    /** Proration policy */
    proration: 'daily' | 'monthly' | 'none';
  };

  /** Deprecation information */
  deprecated?: {
    reason: string;
    replacementTierId?: string;
    deprecatedAt: string;
    sunsetAt: string;
  };
}

/**
 * Tenant entitlement assignment
 * Links tenants to their entitlement tiers
 */
export interface TenantEntitlement {
  /** Tenant identifier */
  tenantId: string;

  /** Assigned tier identifier */
  tierId: string;

  /** Assignment timestamp */
  assignedAt: string;

  /** Assignment source */
  assignedBy: string;

  /** Custom overrides for this tenant */
  overrides?: TenantOverrides;

  /** Assignment status */
  status: 'active' | 'suspended' | 'cancelled';

  /** Status change timestamp */
  statusChangedAt: string;
}

/**
 * Tenant-specific overrides
 * Allows customization within entitlement limits
 */
export interface TenantOverrides {
  /** Additional features enabled */
  additionalFeatures?: Record<string, boolean>;

  /** Increased limits */
  increasedLimits?: Partial<UsageLimits>;

  /** Custom settings */
  customSettings?: Record<string, any>;

  /** Override expiration */
  expiresAt?: string;

  /** Override reason */
  reason: string;
}

/**
 * Entitlement check result
 */
export interface EntitlementCheckResult {
  /** Whether the requested feature/limit is allowed */
  allowed: boolean;

  /** Reason for the decision */
  reason: string;

  /** Current usage information */
  usage?: {
    current: number;
    limit: number;
    percentage: number;
  };

  /** Applicable tier information */
  tier?: {
    tierId: string;
    name: string;
    category: string;
  };

  /** Check timestamp */
  checkedAt: string;
}

/**
 * Usage tracking information
 */
export interface UsageTracking {
  /** Tenant identifier */
  tenantId: string;

  /** Usage period (e.g., '2024-01') */
  period: string;

  /** Current usage by category */
  usage: {
    leads: number;
    api: number;
    team: number;
    storage: number;
    voice: number;
    integrations: number;
  };

  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * Entitlement violation report
 */
export interface EntitlementViolation {
  /** Violation identifier */
  violationId: string;

  /** Tenant identifier */
  tenantId: string;

  /** Violation type */
  type: 'feature_access' | 'usage_limit' | 'rate_limit';

  /** Violated resource/feature */
  resource: string;

  /** Violation details */
  details: {
    attemptedValue?: number;
    limitValue?: number;
    featureName?: string;
  };

  /** Violation timestamp */
  occurredAt: string;

  /** Resolution status */
  status: 'open' | 'resolved' | 'escalated';

  /** Resolution timestamp */
  resolvedAt?: string;
}

/**
 * Tier query options
 */
export interface TierQueryOptions {
  /** Filter by category */
  category?: string;

  /** Filter by active status */
  isActive?: boolean;

  /** Filter by target segment */
  targetSegment?: string;

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}
