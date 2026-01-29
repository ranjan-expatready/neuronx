/**
 * Tier Lifecycle Rules - REQ-019: Configuration as IP
 *
 * Defines behavioral semantics for entitlement tier transitions,
 * including upgrade/downgrade rules, grace periods, and safe feature disablement.
 */

import {
  EntitlementTier,
  TenantEntitlement,
  UsageTracking,
} from './entitlement.types';

/**
 * Tier transition types
 */
export type TierTransitionType =
  | 'upgrade' // Moving to higher tier (immediate effect)
  | 'downgrade' // Moving to lower tier (delayed + safe)
  | 'lateral' // Same tier level, different features
  | 'suspension' // Temporary disablement (read-only)
  | 'expiry' // Automatic fallback to free tier
  | 'reactivation'; // Restoring from suspension

/**
 * Feature disablement behavior during downgrades
 */
export type FeatureDisablementBehavior =
  | 'immediate_disable' // Feature disabled immediately
  | 'frozen_preserve' // Feature frozen in current state, preserved
  | 'graceful_degrade' // Feature constrained but remains functional
  | 'safe_fallback'; // Feature falls back to lower-tier equivalent

/**
 * Tier lifecycle configuration
 */
export interface TierLifecycleConfig {
  /** Default grace period in days for downgrades */
  defaultGracePeriodDays: number;

  /** Tier-specific grace periods */
  tierGracePeriods: Record<string, number>;

  /** Feature disablement rules by domain */
  featureDisablement: Record<string, FeatureDisablementBehavior>;

  /** Allowed transition paths */
  transitionRules: TierTransitionRules;

  /** Automatic expiry behavior */
  expiryBehavior: ExpiryBehavior;
}

/**
 * Tier transition rules
 */
export interface TierTransitionRules {
  /** Which transitions are allowed */
  allowedTransitions: Record<string, string[]>; // fromTier -> [toTier1, toTier2, ...]

  /** Transition effects and timing */
  transitionEffects: Record<string, Record<string, TransitionEffect>>;
}

/**
 * Effect of a tier transition
 */
export interface TransitionEffect {
  /** Type of transition */
  type: TierTransitionType;

  /** When the transition takes effect */
  effectiveTiming: 'immediate' | 'delayed' | 'grace_period';

  /** Grace period in days (if delayed) */
  gracePeriodDays?: number;

  /** Whether to preserve existing configuration */
  preserveConfig: boolean;

  /** Whether to notify tenant of change */
  notifyTenant: boolean;

  /** Special handling instructions */
  specialHandling?: string[];
}

/**
 * Expiry behavior configuration
 */
export interface ExpiryBehavior {
  /** Automatic fallback tier */
  fallbackTier: string;

  /** Whether to notify before expiry */
  notifyBeforeExpiry: boolean;

  /** Days before expiry to notify */
  notificationDays: number[];

  /** Whether to preserve config on expiry */
  preserveConfigOnExpiry: boolean;

  /** Grace period after expiry before enforcement */
  postExpiryGraceDays: number;
}

/**
 * Tier transition request
 */
export interface TierTransitionRequest {
  /** Tenant identifier */
  tenantId: string;

  /** Current tier */
  fromTier: string;

  /** Target tier */
  toTier: string;

  /** Reason for transition */
  reason: TransitionReason;

  /** Requested by */
  requestedBy: string;

  /** Effective date (optional, defaults to immediate or grace period) */
  effectiveDate?: string;

  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Reason for tier transition
 */
export type TransitionReason =
  | 'customer_request' // Customer initiated upgrade/downgrade
  | 'billing_issue' // Payment/billing problem
  | 'plan_change' // Admin plan change
  | 'trial_expiry' // Trial period ended
  | 'contract_change' // Contract modification
  | 'system_action' // Automated system action
  | 'fraud_suspension' // Security/fraud suspension
  | 'policy_violation'; // Terms/policy violation

/**
 * Tier transition result
 */
export interface TierTransitionResult {
  /** Whether transition was successful */
  success: boolean;

  /** Transition details */
  transition?: {
    type: TierTransitionType;
    effectiveTiming: 'immediate' | 'delayed' | 'grace_period';
    effectiveDate: string;
    gracePeriodDays?: number;
  };

  /** Updated entitlement */
  entitlement?: TenantEntitlement;

  /** Errors if transition failed */
  errors?: string[];

  /** Warnings for the transition */
  warnings?: string[];

  /** Actions that will be taken */
  scheduledActions?: ScheduledAction[];
}

/**
 * Scheduled action for tier transitions
 */
export interface ScheduledAction {
  /** Action identifier */
  actionId: string;

  /** Action type */
  type: 'feature_disable' | 'config_update' | 'notification' | 'enforcement';

  /** When to execute */
  executeAt: string;

  /** Action details */
  details: Record<string, any>;
}

/**
 * Tier lifecycle manager
 * Handles tier transitions with proper lifecycle semantics
 */
export class TierLifecycleManager {
  private readonly config: TierLifecycleConfig;

  constructor(config: TierLifecycleConfig = DEFAULT_LIFECYCLE_CONFIG) {
    this.config = config;
  }

  /**
   * Validate if a tier transition is allowed
   */
  validateTransition(
    fromTier: string,
    toTier: string
  ): { allowed: boolean; reason?: string } {
    const allowedTargets =
      this.config.transitionRules.allowedTransitions[fromTier] || [];

    if (!allowedTargets.includes(toTier)) {
      return {
        allowed: false,
        reason: `Transition from ${fromTier} to ${toTier} is not allowed`,
      };
    }

    return { allowed: true };
  }

  /**
   * Calculate transition effect
   */
  calculateTransitionEffect(
    fromTier: string,
    toTier: string
  ): TransitionEffect {
    const effects =
      this.config.transitionRules.transitionEffects[fromTier]?.[toTier];

    if (!effects) {
      // Default effect for allowed transitions
      return {
        type: this.determineTransitionType(fromTier, toTier),
        effectiveTiming: 'immediate',
        preserveConfig: true,
        notifyTenant: true,
      };
    }

    return effects;
  }

  /**
   * Get grace period for a tier transition
   */
  getGracePeriod(fromTier: string, toTier: string): number {
    // Check tier-specific grace period first
    const tierSpecific = this.config.tierGracePeriods[`${fromTier}->${toTier}`];
    if (tierSpecific !== undefined) {
      return tierSpecific;
    }

    // Check target tier grace period
    const targetTier = this.config.tierGracePeriods[toTier];
    if (targetTier !== undefined) {
      return targetTier;
    }

    // Use default
    return this.config.defaultGracePeriodDays;
  }

  /**
   * Get feature disablement behavior for a domain
   */
  getFeatureDisablementBehavior(domain: string): FeatureDisablementBehavior {
    return this.config.featureDisablement[domain] || 'immediate_disable';
  }

  /**
   * Determine transition type based on tier hierarchy
   */
  private determineTransitionType(
    fromTier: string,
    toTier: string
  ): TierTransitionType {
    const hierarchy = TIER_HIERARCHY;

    const fromLevel = hierarchy[fromTier] || 0;
    const toLevel = hierarchy[toTier] || 0;

    if (fromLevel < toLevel) {
      return 'upgrade';
    } else if (fromLevel > toLevel) {
      return 'downgrade';
    } else {
      return 'lateral';
    }
  }
}

/**
 * Default tier lifecycle configuration
 */
export const DEFAULT_LIFECYCLE_CONFIG: TierLifecycleConfig = {
  defaultGracePeriodDays: 7,

  tierGracePeriods: {
    // Downgrades get longer grace periods
    'enterprise->professional': 14,
    'professional->starter': 14,
    'starter->free': 7,
    // Upgrades are immediate
    'free->starter': 0,
    'starter->professional': 0,
    'professional->enterprise': 0,
  },

  featureDisablement: {
    // Critical features disabled immediately for safety
    voice: 'immediate_disable',
    // Process features frozen to preserve existing workflows
    sla: 'frozen_preserve',
    escalation: 'frozen_preserve',
    // Core features gracefully constrained
    routing: 'graceful_degrade',
    scoring: 'graceful_degrade',
    // Advanced features fall back safely
    integrationMappings: 'safe_fallback',
    deploymentMode: 'safe_fallback',
  },

  transitionRules: {
    allowedTransitions: {
      free: ['starter'],
      starter: ['professional', 'free'],
      professional: ['enterprise', 'starter'],
      enterprise: ['professional'],
    },

    transitionEffects: {
      enterprise: {
        professional: {
          type: 'downgrade',
          effectiveTiming: 'grace_period',
          gracePeriodDays: 14,
          preserveConfig: true,
          notifyTenant: true,
          specialHandling: [
            'preserve_existing_voice_configurations',
            'freeze_sla_escalation_rules',
            'constrain_routing_capacity',
          ],
        },
      },
      professional: {
        starter: {
          type: 'downgrade',
          effectiveTiming: 'grace_period',
          gracePeriodDays: 14,
          preserveConfig: true,
          notifyTenant: true,
          specialHandling: [
            'disable_voice_features',
            'freeze_escalation_rules',
            'reduce_routing_capacity',
          ],
        },
        enterprise: {
          type: 'upgrade',
          effectiveTiming: 'immediate',
          preserveConfig: true,
          notifyTenant: false, // Upgrades don't need warning
        },
      },
      starter: {
        free: {
          type: 'downgrade',
          effectiveTiming: 'grace_period',
          gracePeriodDays: 7,
          preserveConfig: true,
          notifyTenant: true,
          specialHandling: [
            'disable_routing_features',
            'disable_sla_features',
            'preserve_basic_scoring',
          ],
        },
        professional: {
          type: 'upgrade',
          effectiveTiming: 'immediate',
          preserveConfig: true,
          notifyTenant: false,
        },
      },
      free: {
        starter: {
          type: 'upgrade',
          effectiveTiming: 'immediate',
          preserveConfig: true,
          notifyTenant: false,
        },
      },
    },
  },

  expiryBehavior: {
    fallbackTier: 'free',
    notifyBeforeExpiry: true,
    notificationDays: [30, 14, 7, 3, 1],
    preserveConfigOnExpiry: true,
    postExpiryGraceDays: 3,
  },
};

/**
 * Tier hierarchy levels (higher number = higher tier)
 */
export const TIER_HIERARCHY: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

/**
 * Feature downgrade handlers
 * Define how to safely disable features during tier transitions
 */
export class FeatureDowngradeHandler {
  /**
   * Handle voice feature disablement
   * Voice features are disabled immediately for billing safety
   */
  static handleVoiceDisablement(tenantId: string): Record<string, any> {
    return {
      action: 'disable_voice',
      tenantId,
      domains: {
        voice: {
          _disabled: true,
          _disabledReason: 'tier_downgrade',
          _disabledAt: new Date().toISOString(),
          _previousConfig: {}, // Would capture current voice config
        },
      },
      notifications: [
        {
          type: 'feature_disabled',
          feature: 'voice',
          reason: 'tier_downgrade',
          reactivateTier: 'professional',
        },
      ],
    };
  }

  /**
   * Handle SLA/escalation freezing
   * Existing SLA and escalation rules are frozen but preserved
   */
  static handleSLAFreeze(tenantId: string): Record<string, any> {
    return {
      action: 'freeze_sla_escalation',
      tenantId,
      domains: {
        sla: {
          _frozen: true,
          _frozenReason: 'tier_downgrade',
          _frozenAt: new Date().toISOString(),
        },
        escalation: {
          _frozen: true,
          _frozenReason: 'tier_downgrade',
          _frozenAt: new Date().toISOString(),
        },
      },
      notifications: [
        {
          type: 'features_frozen',
          features: ['sla', 'escalation'],
          reason: 'tier_downgrade',
          note: 'Existing rules preserved but cannot be modified',
        },
      ],
    };
  }

  /**
   * Handle routing graceful degradation
   * Routing capacity is reduced but configurations remain valid
   */
  static handleRoutingDegrade(
    tenantId: string,
    targetTier: string
  ): Record<string, any> {
    const capacityLimits = {
      starter: 5,
      free: 1,
    };

    const maxCapacity =
      capacityLimits[targetTier as keyof typeof capacityLimits] || 1;

    return {
      action: 'degrade_routing',
      tenantId,
      domains: {
        routing: {
          _degraded: true,
          _degradedReason: 'tier_downgrade',
          _degradedAt: new Date().toISOString(),
          _maxCapacity: maxCapacity,
        },
      },
      notifications: [
        {
          type: 'feature_degraded',
          feature: 'routing',
          reason: 'tier_downgrade',
          note: `Routing capacity reduced to ${maxCapacity} teams`,
        },
      ],
    };
  }

  /**
   * Handle integration safe fallback
   * Complex integrations fall back to basic equivalents
   */
  static handleIntegrationFallback(tenantId: string): Record<string, any> {
    return {
      action: 'fallback_integrations',
      tenantId,
      domains: {
        integrationMappings: {
          _fallback: true,
          _fallbackReason: 'tier_downgrade',
          _fallbackAt: new Date().toISOString(),
          _allowedIntegrations: ['crm-basic'],
        },
      },
      notifications: [
        {
          type: 'integrations_limited',
          reason: 'tier_downgrade',
          note: 'Advanced integrations disabled, basic integrations available',
        },
      ],
    };
  }
}

// Export default lifecycle manager instance
export const tierLifecycleManager = new TierLifecycleManager();
