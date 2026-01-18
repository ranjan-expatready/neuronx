/**
 * Billing Sync Service - WI-041: External Billing State Sync
 *
 * Service for external systems (like GHL billing adapter) to sync billing state.
 * Maintains billing status and plan tier for tenants.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BillingStatus, PlanTier } from './types';

@Injectable()
export class BillingSyncService {
  private readonly logger = new Logger(BillingSyncService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Set billing status for a tenant
   */
  async setBillingStatus(
    tenantId: string,
    status: BillingStatus,
    reason?: string
  ): Promise<void> {
    this.logger.log(`Setting billing status for tenant`, {
      tenantId,
      status,
      reason,
    });

    await this.prisma.tenantBillingState.upsert({
      where: { tenantId },
      update: {
        billingStatus: status,
        statusReason: reason,
        statusUpdatedAt: new Date(),
      },
      create: {
        tenantId,
        billingStatus: status,
        statusReason: reason,
        statusUpdatedAt: new Date(),
        planTier: 'FREE', // Default
        planTierUpdatedAt: new Date(),
      },
    });
  }

  /**
   * Set plan tier for a tenant
   */
  async setPlanTier(
    tenantId: string,
    planTier: PlanTier,
    reason?: string
  ): Promise<void> {
    this.logger.log(`Setting plan tier for tenant`, {
      tenantId,
      planTier,
      reason,
    });

    await this.prisma.tenantBillingState.upsert({
      where: { tenantId },
      update: {
        planTier,
        planTierReason: reason,
        planTierUpdatedAt: new Date(),
      },
      create: {
        tenantId,
        billingStatus: BillingStatus.ACTIVE,
        statusUpdatedAt: new Date(),
        planTier,
        planTierReason: reason,
        planTierUpdatedAt: new Date(),
      },
    });
  }

  /**
   * Get current billing state for a tenant
   */
  async getBillingState(tenantId: string): Promise<{
    billingStatus: BillingStatus;
    planTier: PlanTier;
    statusUpdatedAt: Date;
    planTierUpdatedAt: Date;
  } | null> {
    const state = await this.prisma.tenantBillingState.findUnique({
      where: { tenantId },
    });

    if (!state) {
      return null;
    }

    return {
      billingStatus: state.billingStatus as BillingStatus,
      planTier: state.planTier as PlanTier,
      statusUpdatedAt: state.statusUpdatedAt,
      planTierUpdatedAt: state.planTierUpdatedAt,
    };
  }

  /**
   * Check if tenant has active billing status
   */
  async isBillingActive(tenantId: string): Promise<boolean> {
    const state = await this.getBillingState(tenantId);
    return state?.billingStatus === BillingStatus.ACTIVE;
  }

  /**
   * Check if tenant is in grace period
   */
  async isBillingGrace(tenantId: string): Promise<boolean> {
    const state = await this.getBillingState(tenantId);
    return state?.billingStatus === BillingStatus.GRACE;
  }

  /**
   * Check if tenant is blocked
   */
  async isBillingBlocked(tenantId: string): Promise<boolean> {
    const state = await this.getBillingState(tenantId);
    return state?.billingStatus === BillingStatus.BLOCKED;
  }
}
