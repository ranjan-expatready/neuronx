/**
 * Entitlement Repository - WI-010: Entitlement Persistence
 *
 * PostgreSQL-backed entitlement repository with ACID transactions.
 * Manages tier definitions, tenant entitlements, transitions, and scheduled actions.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaClient,
  EntitlementTier as PrismaEntitlementTier,
  TenantEntitlement as PrismaTenantEntitlement,
} from '@prisma/client';
import {
  EntitlementTier,
  TenantEntitlement,
  TierTransitionRequest,
  TierTransitionResult,
  UsageTracking,
  EntitlementViolation,
  EntitlementOverride,
  ScheduledAction,
} from './entitlement.types';

@Injectable()
export class EntitlementRepository {
  private readonly logger = new Logger(EntitlementRepository.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Initialize canonical tiers (run once on system setup)
   */
  async initializeCanonicalTiers(): Promise<void> {
    const canonicalTiers = [
      this.createFreeTier(),
      this.createStarterTier(),
      this.createProfessionalTier(),
      this.createEnterpriseTier(),
    ];

    for (const tier of canonicalTiers) {
      await this.prisma.entitlementTier.upsert({
        where: { tierId: tier.tierId },
        update: {
          name: tier.name,
          description: tier.description,
          category: tier.category,
          isActive: tier.isActive,
          features: tier.features as any,
          limits: tier.limits as any,
          metadata: tier.metadata as any,
          updatedAt: new Date(),
        },
        create: {
          tierId: tier.tierId,
          name: tier.name,
          description: tier.description,
          category: tier.category,
          isActive: tier.isActive,
          features: tier.features as any,
          limits: tier.limits as any,
          metadata: tier.metadata as any,
        },
      });
    }

    this.logger.log('Canonical entitlement tiers initialized');
  }

  /**
   * Get tier by ID
   */
  async getTier(tierId: string): Promise<EntitlementTier | null> {
    const tier = await this.prisma.entitlementTier.findUnique({
      where: { tierId },
    });

    return tier ? this.mapTierToDomain(tier) : null;
  }

  /**
   * List tiers with optional filtering
   */
  async listTiers(
    options: {
      category?: string;
      isActive?: boolean;
      targetSegment?: string;
      offset?: number;
      limit?: number;
    } = {}
  ): Promise<EntitlementTier[]> {
    const where: any = {};

    if (options.category) {
      where.category = options.category;
    }

    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options.targetSegment) {
      where.metadata = {
        path: ['targetSegment'],
        equals: options.targetSegment,
      };
    }

    const tiers = await this.prisma.entitlementTier.findMany({
      where,
      skip: options.offset,
      take: options.limit,
      orderBy: { tierId: 'asc' },
    });

    return tiers.map(this.mapTierToDomain);
  }

  /**
   * Get tenant entitlement
   */
  async getTenantEntitlement(
    tenantId: string
  ): Promise<TenantEntitlement | null> {
    const entitlement = await this.prisma.tenantEntitlement.findUnique({
      where: { tenantId },
      include: {
        tier: true,
      },
    });

    return entitlement ? this.mapTenantEntitlementToDomain(entitlement) : null;
  }

  /**
   * Set tenant tier immediately (upgrade or immediate lateral move)
   */
  async setTierImmediate(
    tenantId: string,
    tierId: string,
    actorId: string,
    correlationId?: string
  ): Promise<TenantEntitlement> {
    return await this.prisma.$transaction(async tx => {
      // Ensure tier exists
      const tier = await tx.entitlementTier.findUnique({
        where: { tierId },
      });
      if (!tier) {
        throw new Error(`Tier ${tierId} not found`);
      }

      // Create or update tenant entitlement
      const entitlement = await tx.tenantEntitlement.upsert({
        where: { tenantId },
        update: {
          tierId,
          status: 'active',
          effectiveAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          tenantId,
          tierId,
          status: 'active',
          effectiveAt: new Date(),
        },
        include: {
          tier: true,
        },
      });

      // Record transition
      await tx.tierTransition.create({
        data: {
          tenantId,
          fromTierId: null, // Will be set by service if needed
          toTierId: tierId,
          transitionType: 'upgrade', // Simplified - service handles logic
          requestedBy: actorId,
          effectiveAt: new Date(),
          status: 'effective',
          toTenantId: tenantId,
        },
      });

      return this.mapTenantEntitlementToDomain(entitlement);
    });
  }

  /**
   * Request tier transition (handles upgrade vs downgrade logic)
   */
  async requestTierTransition(
    tenantId: string,
    request: TierTransitionRequest,
    actorId: string,
    correlationId?: string
  ): Promise<TierTransitionResult> {
    return await this.prisma.$transaction(async tx => {
      const { toTierId, reason, transitionType, gracePeriodDays } = request;

      // Validate tier exists
      const toTier = await tx.entitlementTier.findUnique({
        where: { tierId: toTierId },
      });
      if (!toTier) {
        throw new Error(`Target tier ${toTierId} not found`);
      }

      // Get current entitlement
      const currentEntitlement = await tx.tenantEntitlement.findUnique({
        where: { tenantId },
        include: { tier: true },
      });

      const fromTierId = currentEntitlement?.tierId;
      const effectiveAt = new Date();
      const graceEndsAt = gracePeriodDays
        ? new Date(
            effectiveAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000
          )
        : effectiveAt;

      // Create transition record
      const transition = await tx.tierTransition.create({
        data: {
          tenantId,
          fromTierId,
          toTierId,
          transitionType,
          reason,
          requestedBy: actorId,
          requestedAt: new Date(),
          effectiveAt,
          graceEndsAt: graceEndsAt > effectiveAt ? graceEndsAt : null,
          status: 'pending',
          toTenantId: tenantId,
        },
      });

      // For immediate transitions (upgrades), apply immediately
      if (transitionType === 'upgrade' || !gracePeriodDays) {
        await tx.tenantEntitlement.upsert({
          where: { tenantId },
          update: {
            tierId: toTierId,
            status: 'active',
            effectiveAt,
            updatedAt: new Date(),
            // Reset disablement flags for upgrades
            voiceDisabled: false,
            slaFrozen: false,
            escalationFrozen: false,
            routingDegraded: false,
          },
          create: {
            tenantId,
            tierId: toTierId,
            status: 'active',
            effectiveAt,
          },
        });

        await tx.tierTransition.update({
          where: { id: transition.id },
          data: { status: 'effective' },
        });
      } else {
        // For delayed transitions (downgrades), schedule enforcement actions
        const actions: Omit<
          ScheduledAction,
          | 'id'
          | 'tenantId'
          | 'tenantEntitlementId'
          | 'correlationId'
          | 'createdAt'
          | 'updatedAt'
        >[] = [];

        // Voice disable (immediate for downgrades)
        actions.push({
          actionType: 'voice_disable',
          payload: { transitionId: transition.id },
          executeAt: effectiveAt,
          status: 'pending',
        });

        // SLA and escalation freeze
        actions.push({
          actionType: 'sla_freeze',
          payload: { transitionId: transition.id },
          executeAt: effectiveAt,
          status: 'pending',
        });

        actions.push({
          actionType: 'escalation_freeze',
          payload: { transitionId: transition.id },
          executeAt: effectiveAt,
          status: 'pending',
        });

        // Routing degradation
        actions.push({
          actionType: 'routing_degrade',
          payload: { transitionId: transition.id },
          executeAt: effectiveAt,
          status: 'pending',
        });

        // Grace period enforcement
        if (graceEndsAt > effectiveAt) {
          actions.push({
            actionType: 'apply_downgrade',
            payload: { transitionId: transition.id, fromTierId, toTierId },
            executeAt: graceEndsAt,
            status: 'pending',
          });
        }

        // Create scheduled actions
        for (const action of actions) {
          await tx.scheduledAction.create({
            data: {
              ...action,
              tenantId,
              tenantEntitlementId: tenantId,
              correlationId,
            },
          });
        }
      }

      return {
        transitionId: transition.id,
        tenantId,
        fromTierId,
        toTierId,
        transitionType,
        effectiveAt: effectiveAt.toISOString(),
        graceEndsAt:
          graceEndsAt > effectiveAt ? graceEndsAt.toISOString() : undefined,
        status: transitionType === 'upgrade' ? 'effective' : 'pending',
      };
    });
  }

  /**
   * Execute due scheduled actions (called by scheduler)
   */
  async executeDueScheduledActions(now: Date = new Date()): Promise<number> {
    let executedCount = 0;

    // Find pending actions due for execution
    const dueActions = await this.prisma.scheduledAction.findMany({
      where: {
        executeAt: { lte: now },
        status: 'pending',
      },
      orderBy: { executeAt: 'asc' },
    });

    for (const action of dueActions) {
      try {
        // Mark as executing to prevent concurrent execution
        await this.prisma.scheduledAction.update({
          where: { id: action.id },
          data: { status: 'executing' },
        });

        // Execute the action
        await this.executeScheduledAction(action);

        // Mark as completed
        await this.prisma.scheduledAction.update({
          where: { id: action.id },
          data: {
            status: 'completed',
            executedAt: now,
          },
        });

        executedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to execute scheduled action ${action.id}:`,
          error
        );

        // Mark as failed and increment retry count
        await this.prisma.scheduledAction.update({
          where: { id: action.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            retryCount: { increment: 1 },
          },
        });
      }
    }

    return executedCount;
  }

  /**
   * Execute a specific scheduled action
   */
  private async executeScheduledAction(action: any): Promise<void> {
    const { actionType, payload, tenantId } = action;

    switch (actionType) {
      case 'voice_disable':
        await this.prisma.tenantEntitlement.update({
          where: { tenantId },
          data: { voiceDisabled: true },
        });
        break;

      case 'sla_freeze':
        await this.prisma.tenantEntitlement.update({
          where: { tenantId },
          data: { slaFrozen: true },
        });
        break;

      case 'escalation_freeze':
        await this.prisma.tenantEntitlement.update({
          where: { tenantId },
          data: { escalationFrozen: true },
        });
        break;

      case 'routing_degrade':
        await this.prisma.tenantEntitlement.update({
          where: { tenantId },
          data: { routingDegraded: true },
        });
        break;

      case 'apply_downgrade':
        // Complete the downgrade transition
        await this.prisma.tenantEntitlement.update({
          where: { tenantId },
          data: { tierId: payload.toTierId },
        });

        await this.prisma.tierTransition.update({
          where: { id: payload.transitionId },
          data: { status: 'effective' },
        });
        break;

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  /**
   * Get active entitlement overrides for a tenant
   */
  async getActiveOverrides(tenantId: string): Promise<EntitlementOverride[]> {
    const overrides = await this.prisma.entitlementOverride.findMany({
      where: {
        tenantId,
        expiresAt: { gt: new Date() },
        expiredAt: null,
      },
      include: {
        tenantEntitlement: true,
      },
    });

    return overrides.map(this.mapOverrideToDomain);
  }

  /**
   * Create entitlement override
   */
  async createOverride(
    tenantId: string,
    override: Omit<
      EntitlementOverride,
      'id' | 'tenantId' | 'overrideAt' | 'createdAt' | 'updatedAt'
    >
  ): Promise<EntitlementOverride> {
    const created = await this.prisma.entitlementOverride.create({
      data: {
        tenantId,
        entitlementType: override.entitlementType,
        originalLimit: override.originalLimit,
        overrideLimit: override.overrideLimit,
        overrideReason: override.overrideReason,
        overrideBy: override.overrideBy,
        expiresAt: new Date(override.expiresAt),
        tenantEntitlementId: tenantId,
      },
      include: {
        tenantEntitlement: true,
      },
    });

    return this.mapOverrideToDomain(created);
  }

  /**
   * Canonical tier definitions (used for initialization)
   */
  private createFreeTier(): EntitlementTier {
    return {
      tierId: 'free',
      name: 'Free',
      description: 'Basic features for getting started',
      category: 'free',
      isActive: true,
      features: {
        domains: {
          scoring: true,
          routing: true,
          sla: false,
          escalation: false,
          featureFlags: false,
          deploymentMode: false,
          integrationMappings: false,
          voice: false,
        },
        features: {},
        integrations: {
          allowedTypes: ['webhook'],
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
        leads: { monthly: 100 },
        scoring: { monthly: 100 },
        routing: { monthly: 50 },
        voice: { minutes: 0 },
        api: { monthly: 1000 },
      },
      metadata: {
        targetSegment: 'individuals',
        pricing: { amount: 0, currency: 'USD' },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private createStarterTier(): EntitlementTier {
    return {
      tierId: 'starter',
      name: 'Starter',
      description: 'Essential features for small teams',
      category: 'paid',
      isActive: true,
      features: {
        domains: {
          scoring: true,
          routing: true,
          sla: true,
          escalation: false,
          featureFlags: false,
          deploymentMode: false,
          integrationMappings: true,
          voice: false,
        },
        features: {},
        integrations: {
          allowedTypes: ['webhook', 'api'],
          maxActiveIntegrations: 3,
          customIntegrations: false,
        },
        ai: {
          advancedScoring: false,
          predictiveRouting: false,
          voiceAI: false,
          customModels: false,
        },
        support: {
          level: 'premium',
          responseTimeHours: 24,
          customSuccess: false,
        },
      },
      limits: {
        leads: { monthly: 1000 },
        scoring: { monthly: 1000 },
        routing: { monthly: 500 },
        voice: { minutes: 0 },
        api: { monthly: 10000 },
      },
      metadata: {
        targetSegment: 'small_teams',
        pricing: { amount: 99, currency: 'USD' },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private createProfessionalTier(): EntitlementTier {
    return {
      tierId: 'professional',
      name: 'Professional',
      description: 'Advanced features for growing businesses',
      category: 'paid',
      isActive: true,
      features: {
        domains: {
          scoring: true,
          routing: true,
          sla: true,
          escalation: true,
          featureFlags: true,
          deploymentMode: false,
          integrationMappings: true,
          voice: true,
        },
        features: {},
        integrations: {
          allowedTypes: ['webhook', 'api', 'database'],
          maxActiveIntegrations: 10,
          customIntegrations: true,
        },
        ai: {
          advancedScoring: true,
          predictiveRouting: true,
          voiceAI: true,
          customModels: false,
        },
        support: {
          level: 'premium',
          responseTimeHours: 12,
          customSuccess: true,
        },
      },
      limits: {
        leads: { monthly: 10000 },
        scoring: { monthly: 10000 },
        routing: { monthly: 5000 },
        voice: { minutes: 1000 },
        api: { monthly: 100000 },
      },
      metadata: {
        targetSegment: 'growing_businesses',
        pricing: { amount: 499, currency: 'USD' },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private createEnterpriseTier(): EntitlementTier {
    return {
      tierId: 'enterprise',
      name: 'Enterprise',
      description: 'Full-featured platform for enterprise organizations',
      category: 'enterprise',
      isActive: true,
      features: {
        domains: {
          scoring: true,
          routing: true,
          sla: true,
          escalation: true,
          featureFlags: true,
          deploymentMode: true,
          integrationMappings: true,
          voice: true,
        },
        features: {},
        integrations: {
          allowedTypes: ['webhook', 'api', 'database', 'event_stream'],
          maxActiveIntegrations: 100,
          customIntegrations: true,
        },
        ai: {
          advancedScoring: true,
          predictiveRouting: true,
          voiceAI: true,
          customModels: true,
        },
        support: {
          level: 'dedicated',
          responseTimeHours: 4,
          customSuccess: true,
        },
      },
      limits: {
        leads: { monthly: 100000 },
        scoring: { monthly: 100000 },
        routing: { monthly: 50000 },
        voice: { minutes: 10000 },
        api: { monthly: 1000000 },
      },
      metadata: {
        targetSegment: 'enterprise',
        pricing: { amount: 0, currency: 'USD', custom: true },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Domain mapping functions
   */
  private mapTierToDomain(prismaTier: PrismaEntitlementTier): EntitlementTier {
    return {
      tierId: prismaTier.tierId,
      name: prismaTier.name,
      description: prismaTier.description,
      category: prismaTier.category,
      isActive: prismaTier.isActive,
      features: prismaTier.features as any,
      limits: prismaTier.limits as any,
      metadata: prismaTier.metadata as any,
      createdAt: prismaTier.createdAt.toISOString(),
      updatedAt: prismaTier.updatedAt.toISOString(),
    };
  }

  private mapTenantEntitlementToDomain(entitlement: any): TenantEntitlement {
    return {
      tenantId: entitlement.tenantId,
      tierId: entitlement.tierId,
      status: entitlement.status,
      effectiveAt: entitlement.effectiveAt.toISOString(),
      expiresAt: entitlement.expiresAt?.toISOString(),
      voiceDisabled: entitlement.voiceDisabled,
      slaFrozen: entitlement.slaFrozen,
      escalationFrozen: entitlement.escalationFrozen,
      routingDegraded: entitlement.routingDegraded,
      createdAt: entitlement.createdAt.toISOString(),
      updatedAt: entitlement.updatedAt.toISOString(),
    };
  }

  private mapOverrideToDomain(override: any): EntitlementOverride {
    return {
      id: override.id,
      tenantId: override.tenantId,
      entitlementType: override.entitlementType,
      originalLimit: override.originalLimit,
      overrideLimit: override.overrideLimit,
      overrideReason: override.overrideReason,
      overrideBy: override.overrideBy,
      overrideAt: override.overrideAt.toISOString(),
      expiresAt: override.expiresAt.toISOString(),
      expiredAt: override.expiredAt?.toISOString(),
      expiryReason: override.expiryReason,
      createdAt: override.createdAt.toISOString(),
      updatedAt: override.updatedAt.toISOString(),
    };
  }
}
