/**
 * Entitlement Sync Service - WI-041
 *
 * Syncs billing state from GHL into NeuronX entitlements.
 * Deterministic mapping with full audit trails.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BillingSyncService } from '@neuronx/billing-entitlements';
import {
  NormalizedBillingEvent,
  GhlBillingEventType,
  GhlSubscriptionStatus,
  BillingStatus,
  EntitlementSyncResult,
  GhlBillingConfig,
} from './types';
import { PlanMappingPolicyResolver } from './policy/plan-mapping-policy.resolver';

@Injectable()
export class EntitlementSyncService {
  private readonly logger = new Logger(EntitlementSyncService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly billingSyncService: BillingSyncService,
    private readonly planMappingResolver: PlanMappingPolicyResolver,
    private readonly config: GhlBillingConfig // Kept for backwards compatibility, but productMappings should not be used
  ) {}

  /**
   * Sync a normalized billing event into NeuronX entitlements
   */
  async syncBillingEvent(
    event: NormalizedBillingEvent
  ): Promise<EntitlementSyncResult> {
    const { eventId, eventType, tenantId, ghlAccountId, subscriptionStatus } =
      event;

    this.logger.log(`Syncing billing event`, {
      eventId,
      eventType,
      tenantId,
      ghlAccountId,
      subscriptionStatus,
    });

    try {
      // Map GHL billing state to NeuronX entitlement state
      const billingStatus = this.mapToBillingStatus(
        eventType,
        subscriptionStatus
      );
      const planTier = this.mapToPlanTier(event);

      // Get current state for comparison
      const currentState = await this.getCurrentEntitlementState(tenantId);

      // Update entitlement state
      await this.billingSyncService.setBillingStatus(
        tenantId,
        billingStatus,
        `Synced from GHL ${eventType}`
      );
      await this.billingSyncService.setPlanTier(
        tenantId,
        planTier as any,
        `Synced from GHL ${eventType}`
      );

      const updated =
        billingStatus !== currentState?.billingStatus ||
        planTier !== currentState?.planTier;

      // Audit the sync operation
      await this.auditSyncOperation(
        event,
        billingStatus,
        planTier,
        currentState
      );

      const result: EntitlementSyncResult = {
        tenantId,
        billingStatus,
        planTier,
        reason: `Synced from GHL ${eventType}`,
        changed: updated,
        previousStatus: currentState?.billingStatus,
        previousPlanTier: currentState?.planTier,
      };

      this.logger.log(`Billing sync completed`, {
        eventId,
        tenantId,
        billingStatus,
        planTier,
        changed: updated,
      });

      return result;
    } catch (error) {
      this.logger.error(`Billing sync failed`, {
        eventId,
        tenantId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Map GHL event + subscription status to NeuronX billing status
   */
  private mapToBillingStatus(
    eventType: GhlBillingEventType,
    subscriptionStatus?: GhlSubscriptionStatus
  ): BillingStatus {
    // For subscription events, map based on status
    if (eventType.includes('subscription')) {
      switch (subscriptionStatus) {
        case GhlSubscriptionStatus.ACTIVE:
        case GhlSubscriptionStatus.TRIALING:
          return BillingStatus.ACTIVE;

        case GhlSubscriptionStatus.PAST_DUE:
        case GhlSubscriptionStatus.UNPAID:
          return BillingStatus.GRACE;

        case GhlSubscriptionStatus.CANCELED:
          return BillingStatus.BLOCKED;

        default:
          this.logger.warn(`Unknown subscription status, defaulting to GRACE`, {
            subscriptionStatus,
          });
          return BillingStatus.GRACE;
      }
    }

    // For invoice events, we don't change billing status directly
    // Let subscription events handle that
    return BillingStatus.ACTIVE; // No change
  }

  /**
   * Map GHL event to NeuronX plan tier using policy resolver
   */
  private mapToPlanTier(event: NormalizedBillingEvent): string {
    const { productId, tenantId } = event;

    if (!productId) {
      // Policy-driven: No product ID - use fallback behavior
      this.logger.warn(`No product ID in billing event, using fallback`, {
        eventId: event.eventId,
        tenantId,
      });

      const fallbackResult = this.planMappingResolver.resolvePlanTier({
        ghlProductId: '', // Empty string to trigger fallback
        environment: process.env.NODE_ENV || 'production',
        tenantId,
      });

      // Audit the fallback usage
      this.auditFallbackUsage(event, fallbackResult);

      return fallbackResult.planTier;
    }

    // Policy-driven: Resolve using plan mapping policy
    const resolutionResult = this.planMappingResolver.resolvePlanTier({
      ghlProductId: productId,
      sku: event.rawPayload?.sku, // If available in webhook payload
      priceId: event.rawPayload?.price?.id, // If available
      environment: process.env.NODE_ENV || 'production',
      tenantId,
    });

    // Audit fallback usage if applicable
    if (resolutionResult.fallbackUsed) {
      this.auditFallbackUsage(event, resolutionResult);
    }

    return resolutionResult.planTier;
  }

  /**
   * Get current entitlement state for tenant
   */
  private async getCurrentEntitlementState(tenantId: string): Promise<{
    billingStatus: BillingStatus;
    planTier: string;
  } | null> {
    // For now, return null as we don't have persistent billing state
    // In future, this would query a billing state table
    return null;
  }

  /**
   * Audit the sync operation
   */
  private async auditSyncOperation(
    event: NormalizedBillingEvent,
    newBillingStatus: BillingStatus,
    newPlanTier: string,
    previousState?: { billingStatus: BillingStatus; planTier: string }
  ): Promise<void> {
    // Create audit event
    await this.prisma.auditLog.create({
      data: {
        tenantId: event.tenantId,
        actorId: 'ghl-billing-sync',
        actorType: 'system',
        action: 'billing_sync_completed',
        resourceType: 'billing_entitlement',
        resourceId: event.tenantId,
        oldValues: previousState
          ? {
              billingStatus: previousState.billingStatus,
              planTier: previousState.planTier,
            }
          : undefined,
        newValues: {
          billingStatus: newBillingStatus,
          planTier: newPlanTier,
        },
        changes: {
          ghlEventId: event.eventId,
          ghlEventType: event.eventType,
          ghlAccountId: event.ghlAccountId,
          subscriptionId: event.subscriptionId,
          invoiceId: event.invoiceId,
        },
        metadata: {
          correlationId: `billing_sync_${event.eventId}`,
          occurredAt: event.occurredAt.toISOString(),
          rawPayload: event.rawPayload, // For debugging
        },
      },
    });
  }

  /**
   * Audit fallback usage for unmapped products
   */
  private async auditFallbackUsage(
    event: NormalizedBillingEvent,
    resolutionResult: any
  ): Promise<void> {
    if (!this.planMappingResolver.isAuditEnabled()) return;

    await this.prisma.auditLog.create({
      data: {
        tenantId: event.tenantId,
        actorId: 'plan-mapping-policy',
        actorType: 'system',
        action: 'plan_mapping_fallback_used',
        resourceType: 'billing_entitlement',
        resourceId: event.tenantId,
        oldValues: null,
        newValues: {
          ghlProductId: event.productId || 'none',
          resolvedPlanTier: resolutionResult.planTier,
          fallbackReason: resolutionResult.reason,
          policyVersion: this.planMappingResolver.getPolicy().version,
        },
        changes: {
          eventId: event.eventId,
          eventType: event.eventType,
          fallbackUsed: resolutionResult.fallbackUsed,
          mappingUsed: resolutionResult.mapping
            ? {
                ghlProductId: resolutionResult.mapping.ghlProductId,
                neuronxPlanTier: resolutionResult.mapping.neuronxPlanTier,
                description: resolutionResult.mapping.description,
              }
            : null,
        },
        metadata: {
          correlationId: `plan_mapping_fallback_${event.eventId}`,
          occurredAt: event.occurredAt.toISOString(),
          environment: process.env.NODE_ENV || 'production',
          policyVersion: this.planMappingResolver.getPolicy().version,
        },
      },
    });
  }

  /**
   * Check if an event has already been processed (idempotency)
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const existingEvent = await this.prisma.auditLog.findFirst({
      where: {
        action: 'billing_sync_completed',
        'metadata.correlationId': `billing_sync_${eventId}`,
      },
    });

    return !!existingEvent;
  }
}
