/**
 * Entitlement Evaluator - WI-040: Billing & Entitlements Authority
 * WI-044: Billing Plan & Limit Configuration
 *
 * Evaluates entitlement requests against current usage and plan limits.
 * All limits and enforcement behavior now driven by policy configuration.
 */

import { PrismaClient } from '@prisma/client';
import {
  EntitlementCheckRequest,
  BillingDecision,
  EnforcementMode,
  UsageType,
  PlanLimits,
} from './types';
import { BillingPolicyResolver } from './policy/billing-policy.resolver';

export class EntitlementEvaluator {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policyResolver: BillingPolicyResolver
  ) {}

  /**
   * Check if usage is allowed under current plan
   */
  async checkEntitlement(
    request: EntitlementCheckRequest
  ): Promise<BillingDecision> {
    const { tenantId, usageType, quantity, correlationId } = request;

    try {
      // Get current plan
      const plan = await this.getCurrentPlan(tenantId);
      if (!plan) {
        // Policy-driven: Use default enforcement mode when no plan found
        const defaultEnforcementMode =
          this.policyResolver.getDefaultEnforcementMode();
        return this.createDecision(false, 'No active plan found', {
          enforcementMode: defaultEnforcementMode,
          planTier: undefined,
        });
      }

      // Get current usage for this period
      const currentUsage = await this.getCurrentUsage(tenantId, usageType);

      // Policy-driven: Get limit for this usage type from plan configuration
      const limit = this.getLimitForType(plan.tier, usageType);

      // Policy-driven: Check if limit is unlimited
      if (this.policyResolver.isUnlimited(limit)) {
        const enforcementMode = this.policyResolver.getPlanEnforcementMode(
          plan.tier
        );
        return this.createDecision(true, 'Unlimited plan', {
          enforcementMode,
          planTier: plan.tier,
          currentUsage,
          limit,
          remainingQuota: -1,
        });
      }

      // Calculate remaining quota
      const remainingQuota = Math.max(0, limit - currentUsage);
      const newUsage = currentUsage + quantity;
      const wouldExceed = newUsage > limit;

      // Policy-driven: Get enforcement mode for this plan
      const enforcementMode = this.policyResolver.getPlanEnforcementMode(
        plan.tier
      );

      // Make decision based on enforcement mode
      let allowed: boolean;
      let reason: string;

      switch (enforcementMode) {
        case EnforcementMode.MONITOR_ONLY:
          allowed = true;
          reason = `Monitor mode: would ${wouldExceed ? 'exceed' : 'not exceed'} limit`;
          break;

        case EnforcementMode.BLOCK:
          allowed = !wouldExceed;
          reason = allowed
            ? 'Within limits'
            : `Would exceed ${usageType} limit (${newUsage}/${limit})`;
          break;

        case EnforcementMode.GRACE_PERIOD:
          allowed = true; // Allow but warn
          reason = wouldExceed
            ? `Grace period: exceeded ${usageType} limit (${newUsage}/${limit})`
            : 'Within limits';
          break;

        default:
          allowed = false;
          reason = `Unknown enforcement mode: ${enforcementMode}`;
      }

      return this.createDecision(allowed, reason, {
        enforcementMode,
        planTier: plan.tier,
        currentUsage,
        limit,
        remainingQuota,
      });
    } catch (error) {
      // Policy-driven: Fail closed on errors (configurable)
      const failClosed =
        this.policyResolver.getPolicy().enforcement.failClosedOnErrors;
      const defaultEnforcementMode =
        this.policyResolver.getDefaultEnforcementMode();
      return this.createDecision(
        failClosed ? false : true,
        `Entitlement check failed: ${error.message}`,
        {
          enforcementMode: defaultEnforcementMode,
        }
      );
    }
  }

  /**
   * Get current active plan for tenant
   */
  private async getCurrentPlan(tenantId: string): Promise<any | null> {
    // For now, return a default plan
    // TODO: Implement proper plan storage and retrieval
    return {
      planId: 'default',
      tenantId,
      name: 'Default Plan',
      tier: 'FREE' as const,
      limits: {
        executionsPerMonth: 100,
        voiceMinutesPerMonth: 10,
        experimentsPerMonth: 1,
        teams: 1,
        operators: 1,
      },
      isActive: true,
    };
  }

  /**
   * Get current usage for tenant and type in current period
   */
  private async getCurrentUsage(
    tenantId: string,
    usageType: UsageType
  ): Promise<number> {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const meter = await this.prisma.usageMeter.upsert({
      where: {
        tenantId_period_type: {
          tenantId,
          period,
          type: usageType,
        },
      },
      update: {}, // No update needed
      create: {
        tenantId,
        period,
        type: usageType,
        totalQuantity: 0,
        lastUpdated: new Date(),
      },
    });

    return meter.totalQuantity;
  }

  /**
   * Get limit for specific usage type from plan configuration (policy-driven)
   */
  private getLimitForType(planTier: any, usageType: UsageType): number {
    const planLimits = this.policyResolver.getPlanLimits(planTier);
    if (!planLimits) {
      return 0;
    }

    switch (usageType) {
      case UsageType.EXECUTION:
        return planLimits.executionsPerMonth;
      case UsageType.VOICE_MINUTE:
        return planLimits.voiceMinutesPerMonth;
      case UsageType.EXPERIMENT:
        return planLimits.experimentsPerMonth;
      default:
        return 0;
    }
  }

  /**
   * Create standardized billing decision
   */
  private createDecision(
    allowed: boolean,
    reason: string,
    metadata: Partial<BillingDecision>
  ): BillingDecision {
    return {
      allowed,
      reason,
      ...metadata,
    } as BillingDecision;
  }
}
