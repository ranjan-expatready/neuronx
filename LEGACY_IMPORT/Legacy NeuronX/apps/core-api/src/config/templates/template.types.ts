/**
 * Configuration Template Types - REQ-019: Configuration as IP
 *
 * Templates define the structure, constraints, and defaults for tenant configurations.
 * Templates are NeuronX-owned intellectual property that can be monetized as products.
 */

import { NeuronXConfiguration } from '../config.types';

/**
 * Configuration template definition
 * Templates are versioned, NeuronX-owned assets that define allowed configuration ranges
 */
export interface ConfigurationTemplate {
  /** Unique template identifier */
  templateId: string;

  /** Human-readable name */
  name: string;

  /** Template description */
  description: string;

  /** Semantic version for compatibility */
  version: string;

  /** Template category (e.g., 'starter', 'professional', 'enterprise') */
  category: string;

  /** Whether this template is active/purchasable */
  isActive: boolean;

  /** Base configuration with defaults and constraints */
  baseConfig: NeuronXConfiguration;

  /** Field-level constraints and overrides */
  constraints: TemplateConstraints;

  /** Template metadata */
  metadata: TemplateMetadata;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Template constraints define what tenants can and cannot modify
 */
export interface TemplateConstraints {
  /** Domain-level constraints */
  domains: {
    /** Which domains are enabled for this template */
    enabled: Record<string, boolean>;

    /** Domain-specific constraints */
    constraints: {
      scoring?: DomainConstraints<ScoringConstraints>;
      routing?: DomainConstraints<RoutingConstraints>;
      sla?: DomainConstraints<SLAConstraints>;
      escalation?: DomainConstraints<EscalationConstraints>;
      featureFlags?: DomainConstraints<FeatureFlagConstraints>;
      deploymentMode?: DomainConstraints<DeploymentModeConstraints>;
      integrationMappings?: DomainConstraints<IntegrationConstraints>;
      voice?: DomainConstraints<VoiceConstraints>;
    };
  };
}

/**
 * Generic domain constraints wrapper
 */
export interface DomainConstraints<T = any> {
  /** Whether this domain is enabled */
  enabled: boolean;

  /** Field-level constraints */
  fields: Record<string, FieldConstraint>;

  /** Domain-specific constraints */
  domainConstraints?: T;
}

/**
 * Field-level constraint definition
 */
export interface FieldConstraint {
  /** Whether tenant can modify this field */
  modifiable: boolean;

  /** Minimum allowed value (for numbers) */
  minValue?: number;

  /** Maximum allowed value (for numbers) */
  maxValue?: number;

  /** Allowed values (for enums/arrays) */
  allowedValues?: any[];

  /** Whether field is required */
  required?: boolean;

  /** Default value if not specified */
  defaultValue?: any;
}

/**
 * Domain-specific constraint types
 */
export interface ScoringConstraints {
  /** Maximum number of custom industry multipliers */
  maxIndustryMultipliers: number;

  /** Allowed ML model types */
  allowedModels: string[];

  /** Maximum qualification threshold */
  maxQualificationThreshold: number;
}

export interface RoutingConstraints {
  /** Maximum number of geographic regions */
  maxGeographicRegions: number;

  /** Maximum team capacity per team */
  maxTeamCapacity: number;

  /** Allowed routing algorithms */
  allowedAlgorithms: string[];

  /** Maximum load percentage */
  maxLoadPercentage: number;
}

export interface SLAConstraints {
  /** Maximum response time hours */
  maxResponseTimeHours: number;

  /** Maximum escalation levels */
  maxEscalationLevels: number;

  /** Allowed notification channels */
  allowedChannels: string[];
}

export interface EscalationConstraints {
  /** Maximum hierarchy levels */
  maxHierarchyLevels: number;

  /** Maximum escalation time minutes */
  maxEscalationTimeMinutes: number;

  /** Allowed notification channels */
  allowedChannels: string[];
}

export interface FeatureFlagConstraints {
  /** Which modules can be enabled */
  allowedModules: string[];

  /** Maximum entitlements per tier */
  maxEntitlements: number;
}

export interface DeploymentModeConstraints {
  /** Allowed deployment models */
  allowedModels: string[];

  /** Maximum data retention days */
  maxDataRetentionDays: number;
}

export interface IntegrationConstraints {
  /** Allowed integration adapters */
  allowedAdapters: string[];

  /** Maximum rate limit */
  maxRateLimit: number;
}

export interface VoiceConstraints {
  /** Maximum attempts per case */
  maxAttemptsPerCase: number;

  /** Maximum call duration minutes */
  maxCallDurationMinutes: number;

  /** Allowed channels */
  allowedChannels: string[];

  /** Whether quiet hours can be disabled */
  canDisableQuietHours: boolean;
}

/**
 * Template metadata for governance and marketplace
 */
export interface TemplateMetadata {
  /** Template author (NeuronX team) */
  author: string;

  /** Target customer segment */
  targetSegment: string;

  /** Business value proposition */
  valueProposition: string;

  /** Technical requirements */
  requirements: string[];

  /** Known limitations */
  limitations: string[];

  /** Upgrade path to higher tiers */
  upgradePath?: string;

  /** Deprecation information */
  deprecated?: {
    reason: string;
    replacementTemplateId?: string;
    deprecatedAt: string;
  };
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  /** Whether template is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];
}

/**
 * Template application result
 * Result of applying a template to tenant configuration
 */
export interface TemplateApplicationResult {
  /** Whether application was successful */
  success: boolean;

  /** Applied configuration */
  appliedConfig?: NeuronXConfiguration;

  /** Validation errors */
  errors?: string[];

  /** Fields that were constrained/modified */
  constrainedFields?: Array<{
    field: string;
    originalValue?: any;
    appliedValue: any;
    constraint: string;
  }>;
}

/**
 * Template query options
 */
export interface TemplateQueryOptions {
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

/**
 * Template version information
 */
export interface TemplateVersion {
  version: string;
  createdAt: string;
  updatedAt: string;
}
