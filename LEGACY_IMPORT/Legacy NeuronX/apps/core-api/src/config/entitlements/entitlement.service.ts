/**
 * Entitlement Service - REQ-019: Configuration as IP
 *
 * Manages NeuronX-owned entitlement tiers and enforces feature access controls.
 * Entitlements define what features and limits tenants are allowed to use.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EntitlementTier,
  TenantEntitlement,
  EntitlementCheckResult,
  UsageTracking,
  EntitlementViolation,
  TierQueryOptions,
} from './entitlement.types';
import {
  TierLifecycleManager,
  TierTransitionRequest,
  TierTransitionResult,
  FeatureDowngradeHandler,
  tierLifecycleManager,
} from './tier.lifecycle';
import { EntitlementRepository } from './entitlement.repository';

@Injectable()
export class EntitlementService implements OnModuleInit {
  private readonly logger = new Logger(EntitlementService.name);
  private violations: EntitlementViolation[] = [];
  private usageTracking: Map<string, UsageTracking> = new Map();
  private tenantEntitlements: Map<string, TenantEntitlement> = new Map();
  private scheduledActions: Map<string, any[]> = new Map();
  private tiers: Map<string, EntitlementTier> = new Map();
  private builtinTiers: EntitlementTier[] = [];

  constructor(
    private readonly lifecycleManager: TierLifecycleManager = tierLifecycleManager,
    private readonly entitlementRepository: EntitlementRepository
  ) {}

  /**
   * Initialize canonical tiers on module startup
   */
  async onModuleInit(): Promise<void> {
    await this.entitlementRepository.initializeCanonicalTiers();
  }

  /**
   * Get tier by ID
   */
  async getTier(tierId: string): Promise<EntitlementTier | null> {
    return this.entitlementRepository.getTier(tierId);
  }

  /**
   * List tiers with optional filtering
   */
  async listTiers(options: TierQueryOptions = {}): Promise<EntitlementTier[]> {
    return this.entitlementRepository.listTiers(options);
  }

  /**
   * Assign tier to tenant (immediate upgrade or lateral move)
   */
  async assignTenantTier(
    tenantId: string,
    tierId: string,
    assignedBy: string,
    correlationId?: string
  ): Promise<TenantEntitlement> {
    // Validate tier exists and is active
    const tier = await this.getTier(tierId);
    if (!tier) {
      throw new Error(`Tier ${tierId} not found`);
    }

    if (!tier.isActive) {
      throw new Error(`Tier ${tierId} is not active`);
    }

    // Check if tenant already has an entitlement
    const existing = await this.getTenantEntitlement(tenantId);
    if (existing && existing.status === 'active') {
      throw new Error(
        `Tenant ${tenantId} already has active entitlement to ${existing.tierId}`
      );
    }

    // Use repository for atomic operation
    const entitlement = await this.entitlementRepository.setTierImmediate(
      tenantId,
      tierId,
      assignedBy,
      correlationId
    );

    this.logger.log(`Assigned tier ${tierId} to tenant ${tenantId}`, {
      assignedBy,
      previousTier: existing?.tierId,
      correlationId,
    });

    return entitlement;
  }

  /**
   * Get tenant entitlement
   */
  async getTenantEntitlement(
    tenantId: string
  ): Promise<TenantEntitlement | null> {
    return this.entitlementRepository.getTenantEntitlement(tenantId);
  }

  /**
   * Check if tenant is entitled to a feature
   */
  async checkFeatureEntitlement(
    tenantId: string,
    feature: string
  ): Promise<EntitlementCheckResult> {
    const entitlement = await this.getTenantEntitlement(tenantId);
    if (!entitlement || entitlement.status !== 'active') {
      return {
        allowed: false,
        reason: 'No active entitlement found for tenant',
        checkedAt: new Date().toISOString(),
      };
    }

    const tier = await this.getTier(entitlement.tierId);
    if (!tier) {
      return {
        allowed: false,
        reason: 'Assigned tier no longer exists',
        checkedAt: new Date().toISOString(),
      };
    }

    // Check feature access based on tier
    const allowed = this.isFeatureAllowedInTier(feature, tier);

    return {
      allowed,
      reason: allowed
        ? 'Feature allowed by tier'
        : 'Feature not included in tier',
      tier: {
        tierId: tier.tierId,
        name: tier.name,
        category: tier.category,
      },
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if tenant can use a configuration domain
   */
  async checkDomainEntitlement(
    tenantId: string,
    domain: string
  ): Promise<EntitlementCheckResult> {
    const entitlement = await this.getTenantEntitlement(tenantId);
    if (!entitlement || entitlement.status !== 'active') {
      return {
        allowed: false,
        reason: 'No active entitlement found for tenant',
        checkedAt: new Date().toISOString(),
      };
    }

    const tier = await this.getTier(entitlement.tierId);
    if (!tier) {
      return {
        allowed: false,
        reason: 'Assigned tier no longer exists',
        checkedAt: new Date().toISOString(),
      };
    }

    // Check domain access
    const domainAccess =
      tier.features.domains[domain as keyof typeof tier.features.domains];
    const allowed = domainAccess === true;

    return {
      allowed,
      reason: allowed
        ? 'Domain allowed by tier'
        : 'Domain not included in tier',
      tier: {
        tierId: tier.tierId,
        name: tier.name,
        category: tier.category,
      },
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Check usage against limits
   */
  async checkUsageLimit(
    tenantId: string,
    resource: keyof UsageTracking['usage'],
    requestedAmount: number = 1
  ): Promise<EntitlementCheckResult> {
    const entitlement = await this.getTenantEntitlement(tenantId);
    if (!entitlement || entitlement.status !== 'active') {
      return {
        allowed: false,
        reason: 'No active entitlement found for tenant',
        checkedAt: new Date().toISOString(),
      };
    }

    const tier = await this.getTier(entitlement.tierId);
    if (!tier) {
      return {
        allowed: false,
        reason: 'Assigned tier no longer exists',
        checkedAt: new Date().toISOString(),
      };
    }

    // Get current usage
    const usageKey = `${tenantId}:${this.getCurrentPeriod()}`;
    const currentUsage = this.usageTracking.get(usageKey)?.usage[resource] || 0;

    // Get limit from tier
    let limit = 0;
    const limits = tier.limits;

    switch (resource) {
      case 'leads':
        limit = limits.leads.monthlyLimit;
        break;
      case 'api':
        limit = limits.api.monthlyLimit;
        break;
      case 'voice':
        limit = limits.voice.monthlyMinutes;
        break;
      case 'team':
        limit = limits.team.maxMembers;
        break;
      case 'storage':
        limit = limits.storage.maxVolumeGB;
        break;
      case 'integrations':
        limit = limits.integrations.maxWebhooks;
        break;
    }

    // Check if request would exceed limit
    const newTotal = currentUsage + requestedAmount;
    const allowed = newTotal <= limit;

    return {
      allowed,
      reason: allowed ? 'Within usage limits' : 'Usage limit exceeded',
      usage: {
        current: currentUsage,
        limit,
        percentage: limit > 0 ? (currentUsage / limit) * 100 : 0,
      },
      tier: {
        tierId: tier.tierId,
        name: tier.name,
        category: tier.category,
      },
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Record usage for tracking
   */
  async recordUsage(
    tenantId: string,
    resource: keyof UsageTracking['usage'],
    amount: number = 1
  ): Promise<void> {
    const period = this.getCurrentPeriod();
    const usageKey = `${tenantId}:${period}`;

    const existing = this.usageTracking.get(usageKey) || {
      tenantId,
      period,
      usage: {
        leads: 0,
        api: 0,
        team: 0,
        storage: 0,
        voice: 0,
        integrations: 0,
      },
      lastUpdated: new Date().toISOString(),
    };

    existing.usage[resource] += amount;
    existing.lastUpdated = new Date().toISOString();

    this.usageTracking.set(usageKey, existing);
  }

  /**
   * Get usage tracking for tenant
   */
  async getUsageTracking(tenantId: string): Promise<UsageTracking[]> {
    const tenantUsage: UsageTracking[] = [];

    for (const [key, usage] of this.usageTracking.entries()) {
      if (usage.tenantId === tenantId) {
        tenantUsage.push(usage);
      }
    }

    return tenantUsage;
  }

  /**
   * Report entitlement violation
   */
  async reportViolation(
    tenantId: string,
    type: EntitlementViolation['type'],
    resource: string,
    details: EntitlementViolation['details']
  ): Promise<EntitlementViolation> {
    const violation: EntitlementViolation = {
      violationId: crypto.randomUUID(),
      tenantId,
      type,
      resource,
      details,
      occurredAt: new Date().toISOString(),
      status: 'open',
    };

    this.violations.push(violation);

    this.logger.warn(
      `Entitlement violation reported: ${violation.violationId}`,
      {
        tenantId,
        type,
        resource,
        violationId: violation.violationId,
      }
    );

    return violation;
  }

  /**
   * Get violations for tenant
   */
  async getViolations(tenantId: string): Promise<EntitlementViolation[]> {
    return this.violations.filter(v => v.tenantId === tenantId);
  }

  /**
   * Request tier transition with lifecycle management
   * Handles upgrade/downgrade rules, grace periods, and safe feature disablement
   */
  async requestTierTransition(
    request: TierTransitionRequest
  ): Promise<TierTransitionResult> {
    const { tenantId, fromTier, toTier, reason, requestedBy, context } =
      request;

    this.logger.log(`Processing tier transition request`, {
      tenantId,
      fromTier,
      toTier,
      reason,
      requestedBy,
    });

    try {
      // Validate transition is allowed
      const validation = this.lifecycleManager.validateTransition(
        fromTier,
        toTier
      );
      if (!validation.allowed) {
        return {
          success: false,
          errors: [validation.reason!],
        };
      }

      // Get current entitlement
      const currentEntitlement = await this.getTenantEntitlement(tenantId);
      if (!currentEntitlement || currentEntitlement.tierId !== fromTier) {
        return {
          success: false,
          errors: [`Tenant ${tenantId} is not currently on tier ${fromTier}`],
        };
      }

      // Calculate transition effect
      const transitionEffect = this.lifecycleManager.calculateTransitionEffect(
        fromTier,
        toTier
      );

      // Determine effective date
      const effectiveDate = this.calculateEffectiveDate(
        transitionEffect,
        request.effectiveDate
      );

      // Create updated entitlement
      const updatedEntitlement: TenantEntitlement = {
        ...currentEntitlement,
        tierId: toTier,
        assignedAt: effectiveDate,
        assignedBy: requestedBy,
        effectiveAt: effectiveDate,
        status: transitionEffect.type === 'suspension' ? 'suspended' : 'active',
        statusChangedAt: new Date().toISOString(),
      };

      // Handle immediate vs delayed application
      if (transitionEffect.effectiveTiming === 'immediate') {
        // Apply transition immediately
        this.tenantEntitlements.set(tenantId, updatedEntitlement);

        // Handle immediate feature changes
        if (transitionEffect.type === 'downgrade') {
          await this.applyImmediateDowngradeEffects(tenantId, fromTier, toTier);
        }

        this.logger.log(`Applied immediate tier transition`, {
          tenantId,
          fromTier,
          toTier,
          effectiveDate,
        });

        return {
          success: true,
          transition: {
            type: transitionEffect.type,
            effectiveTiming: 'immediate',
            effectiveDate,
          },
          entitlement: updatedEntitlement,
        };
      } else {
        // Schedule delayed transition
        const gracePeriodDays =
          transitionEffect.gracePeriodDays ||
          this.lifecycleManager.getGracePeriod(fromTier, toTier);

        const scheduledDate = new Date(effectiveDate);
        scheduledDate.setDate(scheduledDate.getDate() + gracePeriodDays);

        // Schedule the transition
        const scheduledActions = this.scheduleTierTransition(
          tenantId,
          updatedEntitlement,
          scheduledDate.toISOString(),
          transitionEffect
        );

        // Update entitlement with pending status (conceptually)
        // In a real system, you'd have a pending state

        this.logger.log(`Scheduled delayed tier transition`, {
          tenantId,
          fromTier,
          toTier,
          effectiveDate,
          gracePeriodDays,
          scheduledDate: scheduledDate.toISOString(),
        });

        return {
          success: true,
          transition: {
            type: transitionEffect.type,
            effectiveTiming: 'grace_period',
            effectiveDate: scheduledDate.toISOString(),
            gracePeriodDays,
          },
          entitlement: updatedEntitlement,
          scheduledActions,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to process tier transition request`, {
        tenantId,
        fromTier,
        toTier,
        error: (error as Error).message,
      });

      return {
        success: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Apply immediate downgrade effects
   * Safely disable features according to lifecycle rules
   */
  private async applyImmediateDowngradeEffects(
    tenantId: string,
    fromTier: string,
    toTier: string
  ): Promise<void> {
    const effects: any[] = [];

    // Apply feature disablement based on lifecycle rules
    if (fromTier === 'professional' && toTier === 'starter') {
      effects.push(FeatureDowngradeHandler.handleVoiceDisablement(tenantId));
    }

    if (fromTier === 'enterprise' && toTier === 'professional') {
      // Enterprise downgrades don't disable voice immediately
    }

    if (
      ['enterprise', 'professional'].includes(fromTier) &&
      toTier === 'starter'
    ) {
      effects.push(FeatureDowngradeHandler.handleSLAFreeze(tenantId));
    }

    if (fromTier === 'starter' && toTier === 'free') {
      effects.push(
        FeatureDowngradeHandler.handleRoutingDegrade(tenantId, toTier)
      );
    }

    // Store scheduled actions for these effects
    if (effects.length > 0) {
      this.scheduledActions.set(`${tenantId}-downgrade-${Date.now()}`, effects);
    }

    this.logger.log(`Applied immediate downgrade effects`, {
      tenantId,
      fromTier,
      toTier,
      effectsCount: effects.length,
    });
  }

  /**
   * Schedule tier transition for delayed application
   */
  private scheduleTierTransition(
    tenantId: string,
    entitlement: TenantEntitlement,
    executeAt: string,
    transitionEffect: any
  ): any[] {
    const actions = [
      {
        actionId: `transition-${tenantId}-${Date.now()}`,
        type: 'tier_transition',
        executeAt,
        details: {
          tenantId,
          entitlement,
          transitionEffect,
          scheduledBy: 'entitlement-service',
        },
      },
    ];

    // Add feature disablement actions based on transition
    if (transitionEffect.type === 'downgrade') {
      const disablementActions = this.createFeatureDisablementActions(
        tenantId,
        entitlement.tierId,
        executeAt
      );
      actions.push(...disablementActions);
    }

    // Store scheduled actions
    this.scheduledActions.set(`${tenantId}-transition-${Date.now()}`, actions);

    return actions;
  }

  /**
   * Create feature disablement actions for downgrade
   */
  private createFeatureDisablementActions(
    tenantId: string,
    targetTier: string,
    executeAt: string
  ): any[] {
    const actions: any[] = [];

    // Voice disablement (immediate for safety)
    if (!['professional', 'enterprise'].includes(targetTier)) {
      actions.push({
        actionId: `voice-disable-${tenantId}-${Date.now()}`,
        type: 'feature_disable',
        executeAt: new Date().toISOString(), // Immediate
        details: FeatureDowngradeHandler.handleVoiceDisablement(tenantId),
      });
    }

    // SLA/Escalation freeze
    if (!['enterprise', 'professional', 'starter'].includes(targetTier)) {
      actions.push({
        actionId: `sla-freeze-${tenantId}-${Date.now()}`,
        type: 'feature_disable',
        executeAt,
        details: FeatureDowngradeHandler.handleSLAFreeze(tenantId),
      });
    }

    // Routing degradation
    if (targetTier === 'free') {
      actions.push({
        actionId: `routing-degrade-${tenantId}-${Date.now()}`,
        type: 'feature_disable',
        executeAt,
        details: FeatureDowngradeHandler.handleRoutingDegrade(
          tenantId,
          targetTier
        ),
      });
    }

    return actions;
  }

  /**
   * Calculate effective date for transition
   */
  private calculateEffectiveDate(
    transitionEffect: any,
    requestedDate?: string
  ): string {
    if (requestedDate) {
      return requestedDate;
    }

    if (transitionEffect.effectiveTiming === 'immediate') {
      return new Date().toISOString();
    }

    // For delayed transitions, effective date is now, enforcement later
    return new Date().toISOString();
  }

  /**
   * Process expired entitlements
   * Automatically move tenants to free tier after expiry
   */
  async processExpiredEntitlements(): Promise<void> {
    // In a real system, this would be called by a scheduled job
    // For now, it's a no-op placeholder
    this.logger.log('Processing expired entitlements (placeholder)');
  }

  /**
   * Get scheduled actions for tenant
   */
  getScheduledActions(tenantId: string): any[] {
    const actions: any[] = [];

    for (const [key, actionList] of this.scheduledActions.entries()) {
      if (key.startsWith(`${tenantId}-`)) {
        actions.push(...actionList);
      }
    }

    return actions;
  }

  /**
   * Clear scheduled actions (for testing)
   */
  clearScheduledActions(): void {
    this.scheduledActions.clear();
  }

  /**
   * Initialize built-in tiers
   */
  private initializeTiers(): void {
    for (const tier of this.builtinTiers) {
      this.tiers.set(tier.tierId, tier);
    }
    this.logger.log(
      `Initialized ${this.builtinTiers.length} built-in entitlement tiers`
    );
  }

  /**
   * Create free tier
   */
  private createFreeTier(): EntitlementTier {
    return {
      tierId: 'free',
      name: 'Free Tier',
      description: 'Basic features for trying NeuronX',
      category: 'free',
      isActive: true,
      features: {
        domains: {
          scoring: true,
          routing: false,
          sla: false,
          escalation: false,
          featureFlags: false,
          deploymentMode: false,
          integrationMappings: false,
          voice: false,
        },
        features: {
          basicScoring: true,
        },
        integrations: {
          allowedTypes: ['crm-basic'],
          maxActiveIntegrations: 1,
          customIntegrations: false,
        },
        ai: {
          advancedScoring: false,
          predictiveRouting: false,
          voiceAI: false,
          customModels: false,
        },
        support: {
          level: 'basic',
          responseTimeHours: 72,
          customSuccess: false,
        },
      },
      limits: {
        leads: { monthlyLimit: 100, burstLimit: 10, perMinuteLimit: 5 },
        api: { monthlyLimit: 1000, perMinuteLimit: 10, burstAllowance: 5 },
        team: { maxMembers: 1, maxConcurrentUsers: 1, maxTeams: 1 },
        storage: {
          retentionDays: 30,
          maxVolumeGB: 1,
          backupFrequency: 'weekly',
        },
        voice: {
          monthlyMinutes: 0,
          maxConcurrentCalls: 0,
          recordingRetentionDays: 0,
        },
        integrations: {
          maxWebhooks: 1,
          apiRateLimit: 10,
          syncFrequencyMinutes: 60,
        },
      },
      metadata: {
        targetSegment: 'trial-users',
        valueProposition: 'Try NeuronX basic features for free',
        useCases: ['Evaluate sales automation', 'Small personal use'],
        requirements: [],
        includedServices: ['Basic scoring', 'Email support'],
        transitions: {
          upgradeTo: ['starter', 'professional'],
          downgradeTo: [],
          proration: 'none',
        },
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
  }

  /**
   * Create starter tier
   */
  private createStarterTier(): EntitlementTier {
    const freeTier = this.createFreeTier();

    return {
      ...freeTier,
      tierId: 'starter',
      name: 'Starter Tier',
      description: 'Essential features for small teams',
      category: 'paid',
      features: {
        ...freeTier.features,
        domains: {
          ...freeTier.features.domains,
          routing: true,
          sla: true,
        },
      },
      limits: {
        ...freeTier.limits,
        leads: { monthlyLimit: 1000, burstLimit: 50, perMinuteLimit: 20 },
        api: { monthlyLimit: 10000, perMinuteLimit: 50, burstAllowance: 25 },
        team: { maxMembers: 5, maxConcurrentUsers: 3, maxTeams: 2 },
        storage: {
          retentionDays: 90,
          maxVolumeGB: 5,
          backupFrequency: 'weekly',
        },
      },
      metadata: {
        ...freeTier.metadata,
        targetSegment: 'small-business',
        valueProposition: 'Essential sales automation for small teams',
        useCases: ['Basic lead routing', 'Simple SLA management'],
        includedServices: [
          'Lead routing',
          'Basic SLA tracking',
          'Phone support',
        ],
        transitions: {
          upgradeTo: ['professional', 'enterprise'],
          downgradeTo: ['free'],
          proration: 'monthly',
        },
      },
    };
  }

  /**
   * Create professional tier
   */
  private createProfessionalTier(): EntitlementTier {
    const starterTier = this.createStarterTier();

    return {
      ...starterTier,
      tierId: 'professional',
      name: 'Professional Tier',
      description: 'Advanced features for growing teams',
      category: 'paid',
      features: {
        ...starterTier.features,
        domains: {
          ...starterTier.features.domains,
          escalation: true,
          voice: true,
        },
        ai: {
          ...starterTier.features.ai,
          advancedScoring: true,
          predictiveRouting: true,
        },
      },
      limits: {
        ...starterTier.limits,
        leads: { monthlyLimit: 10000, burstLimit: 200, perMinuteLimit: 100 },
        api: { monthlyLimit: 100000, perMinuteLimit: 200, burstAllowance: 100 },
        team: { maxMembers: 25, maxConcurrentUsers: 15, maxTeams: 5 },
        storage: {
          retentionDays: 365,
          maxVolumeGB: 50,
          backupFrequency: 'daily',
        },
        voice: {
          monthlyMinutes: 500,
          maxConcurrentCalls: 5,
          recordingRetentionDays: 90,
        },
        integrations: {
          maxWebhooks: 10,
          apiRateLimit: 100,
          syncFrequencyMinutes: 15,
        },
      },
      metadata: {
        ...starterTier.metadata,
        targetSegment: 'mid-market',
        valueProposition: 'Advanced AI-powered sales orchestration',
        useCases: [
          'Predictive routing',
          'Advanced escalation',
          'Voice integration',
        ],
        includedServices: [
          'AI routing',
          'Advanced SLA',
          'Voice calls',
          'Priority support',
        ],
        transitions: {
          upgradeTo: ['enterprise'],
          downgradeTo: ['starter', 'free'],
          proration: 'monthly',
        },
      },
    };
  }

  /**
   * Create enterprise tier
   */
  private createEnterpriseTier(): EntitlementTier {
    const professionalTier = this.createProfessionalTier();

    return {
      ...professionalTier,
      tierId: 'enterprise',
      name: 'Enterprise Tier',
      description: 'Full platform capabilities for large organizations',
      category: 'enterprise',
      features: {
        ...professionalTier.features,
        domains: {
          ...professionalTier.features.domains,
          featureFlags: true,
          deploymentMode: true,
          integrationMappings: true,
        },
        integrations: {
          ...professionalTier.features.integrations,
          customIntegrations: true,
        },
        ai: {
          ...professionalTier.features.ai,
          voiceAI: true,
          customModels: true,
        },
        support: {
          ...professionalTier.features.support,
          level: 'enterprise',
          responseTimeHours: 4,
          customSuccess: true,
        },
      },
      limits: {
        ...professionalTier.limits,
        leads: { monthlyLimit: 100000, burstLimit: 1000, perMinuteLimit: 500 },
        api: {
          monthlyLimit: 1000000,
          perMinuteLimit: 1000,
          burstAllowance: 500,
        },
        team: { maxMembers: 500, maxConcurrentUsers: 200, maxTeams: 50 },
        storage: {
          retentionDays: 2555,
          maxVolumeGB: 1000,
          backupFrequency: 'daily',
        }, // 7 years
        voice: {
          monthlyMinutes: 5000,
          maxConcurrentCalls: 50,
          recordingRetentionDays: 2555,
        },
        integrations: {
          maxWebhooks: 100,
          apiRateLimit: 1000,
          syncFrequencyMinutes: 5,
        },
      },
      metadata: {
        ...professionalTier.metadata,
        targetSegment: 'enterprise',
        valueProposition: 'Complete AI-powered sales orchestration platform',
        useCases: [
          'Custom integrations',
          'Advanced AI',
          'Enterprise SLA',
          'Dedicated support',
        ],
        includedServices: [
          'Everything included',
          'Custom development',
          'Dedicated CSM',
          'White-label options',
        ],
        transitions: {
          upgradeTo: [],
          downgradeTo: ['professional', 'starter'],
          proration: 'monthly',
        },
      },
    };
  }

  /**
   * Check if feature is allowed in tier
   */
  private isFeatureAllowedInTier(
    feature: string,
    tier: EntitlementTier
  ): boolean {
    // Check domain features
    if (feature.startsWith('domain.')) {
      const domain = feature.replace('domain.', '');
      return (
        tier.features.domains[domain as keyof typeof tier.features.domains] ===
        true
      );
    }

    // Check specific features
    if (tier.features.features[feature] !== undefined) {
      return tier.features.features[feature];
    }

    // Check AI features
    if (feature.startsWith('ai.')) {
      const aiFeature = feature.replace('ai.', '');
      return (
        tier.features.ai[aiFeature as keyof typeof tier.features.ai] === true
      );
    }

    // Check integration features
    if (feature.startsWith('integration.')) {
      const intFeature = feature.replace('integration.', '');
      if (intFeature === 'custom') {
        return tier.features.integrations.customIntegrations;
      }
    }

    // Default to not allowed
    return false;
  }

  /**
   * Get current usage period (YYYY-MM)
   */
  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
