/**
 * Webhook Repository - WI-018: Outbound Webhook Delivery System
 *
 * PostgreSQL-backed webhook repository with tenant isolation and idempotency.
 * Manages endpoints, deliveries, and attempts with proper constraints.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  WebhookEndpoint,
  WebhookDelivery,
  WebhookAttempt,
  CreateWebhookEndpointRequest,
  UpdateWebhookEndpointRequest,
  WebhookDeliveryStatus,
} from './webhook.types';

@Injectable()
export class WebhookRepository {
  private readonly logger = new Logger(WebhookRepository.name);

  constructor(private readonly prisma: PrismaClient) {}

  // ============================================================================
  // ENDPOINT MANAGEMENT
  // ============================================================================

  /**
   * Create webhook endpoint
   */
  async createEndpoint(request: CreateWebhookEndpointRequest): Promise<string> {
    try {
      const endpoint = await this.prisma.webhookEndpoint.create({
        data: {
          tenantId: request.tenantId,
          name: request.name,
          url: request.url,
          // Never persist plaintext secrets. Use secretRef provided by service.
          secretRef: request.secretRef || undefined,
          previousSecretRef: request.previousSecretRef || undefined,
          secretProvider: request.secretProvider || 'db',
          secretUpdatedAt: new Date(),
          eventTypes: request.eventTypes,
          timeoutMs: request.timeoutMs || 5000,
          maxAttempts: request.maxAttempts || 10,
          backoffBaseSeconds: request.backoffBaseSeconds || 30,
        },
      });

      this.logger.debug(`Created webhook endpoint: ${endpoint.id}`, {
        tenantId: request.tenantId,
        name: request.name,
        url: request.url,
      });

      return endpoint.id;
    } catch (error: any) {
      if (error.code === 'P2002') {
        this.logger.warn(`Webhook endpoint already exists for URL`, {
          tenantId: request.tenantId,
          url: request.url,
        });
        throw new Error('Webhook endpoint already exists for this URL');
      }
      throw error;
    }
  }

  /**
   * Update webhook endpoint
   */
  async updateEndpoint(
    tenantId: string,
    endpointId: string,
    updates: UpdateWebhookEndpointRequest
  ): Promise<void> {
    // Strip any plaintext secret updates defensively
    const {
      secretRef,
      previousSecretRef,
      secretProvider,
      secretUpdatedAt,
      ...rest
    } = updates as any;

    await this.prisma.webhookEndpoint.updateMany({
      where: {
        tenantId,
        id: endpointId,
      },
      data: {
        ...rest,
        // allow metadata updates only
        ...(typeof secretRef !== 'undefined' ? { secretRef } : {}),
        ...(typeof previousSecretRef !== 'undefined'
          ? { previousSecretRef }
          : {}),
        ...(typeof secretProvider !== 'undefined' ? { secretProvider } : {}),
        ...(typeof secretUpdatedAt !== 'undefined' ? { secretUpdatedAt } : {}),
        updatedAt: new Date(),
      },
    });

    this.logger.debug(`Updated webhook endpoint: ${endpointId}`, {
      tenantId,
      updates: Object.keys(updates),
    });
  }

  /**
   * Get webhook endpoint by ID
   */
  async getEndpointById(
    tenantId: string,
    endpointId: string
  ): Promise<WebhookEndpoint | null> {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: {
        tenantId,
        id: endpointId,
      },
    });

    return endpoint ? this.mapEndpoint(endpoint) : null;
  }

  /**
   * List active webhook endpoints for tenant
   */
  async listActiveEndpoints(tenantId: string): Promise<WebhookEndpoint[]> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        enabled: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return endpoints.map(this.mapEndpoint);
  }

  /**
   * Get endpoints that accept specific event type
   */
  async getEndpointsForEventType(
    tenantId: string,
    eventType: string
  ): Promise<WebhookEndpoint[]> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        enabled: true,
        eventTypes: {
          has: eventType,
        },
      },
    });

    return endpoints.map(this.mapEndpoint);
  }

  /**
   * Delete webhook endpoint
   */
  async deleteEndpoint(tenantId: string, endpointId: string): Promise<void> {
    await this.prisma.webhookEndpoint.deleteMany({
      where: {
        tenantId,
        id: endpointId,
      },
    });

    this.logger.debug(`Deleted webhook endpoint: ${endpointId}`, { tenantId });
  }

  // ============================================================================
  // DELIVERY MANAGEMENT
  // ============================================================================

  /**
   * Create webhook delivery (idempotent)
   */
  async createDelivery(
    tenantId: string,
    endpointId: string,
    outboxEventId: string,
    outboxEventType: string,
    correlationId?: string
  ): Promise<string | null> {
    try {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          tenantId,
          endpointId,
          outboxEventId,
          outboxEventType,
          correlationId,
        },
      });

      this.logger.debug(`Created webhook delivery: ${delivery.id}`, {
        tenantId,
        endpointId,
        outboxEventId,
        outboxEventType,
      });

      return delivery.id;
    } catch (error: any) {
      // Handle unique constraint violations (idempotency)
      if (error.code === 'P2002') {
        this.logger.debug(`Webhook delivery already exists`, {
          tenantId,
          endpointId,
          outboxEventId,
        });
        return null; // Already exists
      }
      throw error;
    }
  }

  /**
   * Create deliveries for published outbox events (fanout)
   * Idempotent - safe to call repeatedly
   */
  async createDeliveriesForPublishedEvents(): Promise<number> {
    // Get published events from last 15 minutes (configurable window)
    const cutoffTime = new Date(Date.now() - 15 * 60 * 1000);

    const publishedEvents = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'PUBLISHED',
        createdAt: {
          gte: cutoffTime,
        },
      },
      select: {
        id: true,
        tenantId: true,
        eventType: true,
        correlationId: true,
      },
    });

    if (publishedEvents.length === 0) {
      return 0;
    }

    let totalDeliveriesCreated = 0;

    // Group events by tenant for efficient endpoint lookup
    const eventsByTenant = new Map<string, typeof publishedEvents>();

    for (const event of publishedEvents) {
      if (!eventsByTenant.has(event.tenantId)) {
        eventsByTenant.set(event.tenantId, []);
      }
      eventsByTenant.get(event.tenantId)!.push(event);
    }

    // Process each tenant's events
    for (const [tenantId, events] of eventsByTenant) {
      const endpoints = await this.listActiveEndpoints(tenantId);

      for (const event of events) {
        for (const endpoint of endpoints) {
          if (endpoint.eventTypes.includes(event.eventType)) {
            const deliveryId = await this.createDelivery(
              tenantId,
              endpoint.id,
              event.id,
              event.eventType,
              event.correlationId || undefined
            );

            if (deliveryId) {
              totalDeliveriesCreated++;
            }
          }
        }
      }
    }

    this.logger.debug(
      `Created ${totalDeliveriesCreated} webhook deliveries from ${publishedEvents.length} events`
    );
    return totalDeliveriesCreated;
  }

  /**
   * Claim pending deliveries for processing (multi-instance safe)
   */
  async claimPendingDeliveries(limit: number = 50): Promise<any[]> {
    // Use SKIP LOCKED to prevent multiple instances from claiming the same deliveries
    const deliveries = await this.prisma.$queryRaw<any[]>`
      UPDATE webhook_deliveries
      SET
        status = 'SENDING',
        attempts = attempts + 1,
        nextAttemptAt = NOW() + INTERVAL '30 seconds',
        updatedAt = NOW()
      WHERE id IN (
        SELECT id FROM webhook_deliveries
        WHERE status IN ('PENDING', 'FAILED')
          AND nextAttemptAt <= NOW()
          AND attempts < (SELECT maxAttempts FROM webhook_endpoints WHERE id = webhook_deliveries.endpointId)
        ORDER BY nextAttemptAt ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id, tenantId, endpointId, outboxEventId, outboxEventType, correlationId,
        attempts, nextAttemptAt
    `;

    if (deliveries.length > 0) {
      this.logger.debug(
        `Claimed ${deliveries.length} webhook deliveries for processing`
      );
    }

    return deliveries;
  }

  /**
   * Mark delivery as delivered
   */
  async markDelivered(tenantId: string, deliveryId: string): Promise<void> {
    await this.prisma.webhookDelivery.updateMany({
      where: {
        tenantId,
        id: deliveryId,
        status: 'SENDING',
      },
      data: {
        status: 'DELIVERED',
        updatedAt: new Date(),
      },
    });

    this.logger.debug(`Marked webhook delivery as delivered: ${deliveryId}`, {
      tenantId,
    });
  }

  /**
   * Mark delivery as failed (will be retried)
   */
  async markFailed(
    tenantId: string,
    deliveryId: string,
    error: string
  ): Promise<void> {
    await this.prisma.webhookDelivery.updateMany({
      where: {
        tenantId,
        id: deliveryId,
        status: 'SENDING',
      },
      data: {
        status: 'FAILED',
        lastError: error,
        nextAttemptAt: new Date(Date.now() + 30 * 1000), // Retry in 30 seconds
        updatedAt: new Date(),
      },
    });

    this.logger.warn(`Marked webhook delivery as failed: ${deliveryId}`, {
      tenantId,
      error,
    });
  }

  /**
   * Mark delivery as dead letter
   */
  async markDeadLetter(
    tenantId: string,
    deliveryId: string,
    finalError: string
  ): Promise<void> {
    await this.prisma.webhookDelivery.updateMany({
      where: {
        tenantId,
        id: deliveryId,
        status: 'FAILED',
      },
      data: {
        status: 'DEAD_LETTER',
        lastError: finalError,
        updatedAt: new Date(),
      },
    });

    this.logger.error(`Marked webhook delivery as dead letter: ${deliveryId}`, {
      tenantId,
      finalError,
    });
  }

  // ============================================================================
  // ATTEMPT MANAGEMENT
  // ============================================================================

  /**
   * Record webhook attempt
   */
  async recordAttempt(
    tenantId: string,
    deliveryId: string,
    attemptNumber: number,
    result: {
      success: boolean;
      statusCode?: number;
      responseBody?: string;
      durationMs: number;
      error?: string;
    }
  ): Promise<void> {
    await this.prisma.webhookAttempt.create({
      data: {
        tenantId,
        deliveryId,
        attemptNumber,
        requestTimestamp: new Date(),
        responseStatus: result.statusCode,
        responseBodySnippet: result.responseBody?.substring(0, 2048), // First 2KB
        durationMs: result.durationMs,
        errorMessage: result.error,
      },
    });

    this.logger.debug(
      `Recorded webhook attempt ${attemptNumber} for delivery: ${deliveryId}`,
      {
        tenantId,
        success: result.success,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
      }
    );
  }

  // ============================================================================
  // MONITORING & CLEANUP
  // ============================================================================

  /**
   * Get delivery statistics for monitoring
   */
  async getDeliveryStats(tenantId?: string): Promise<{
    pending: number;
    sending: number;
    delivered: number;
    failed: number;
    deadLetter: number;
    total: number;
  }> {
    const where = tenantId ? { tenantId } : {};

    const stats = await this.prisma.webhookDelivery.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
    });

    const result = {
      pending: 0,
      sending: 0,
      delivered: 0,
      failed: 0,
      deadLetter: 0,
      total: 0,
    };

    for (const stat of stats) {
      const count = stat._count.status;
      result.total += count;

      switch (stat.status) {
        case 'PENDING':
          result.pending = count;
          break;
        case 'SENDING':
          result.sending = count;
          break;
        case 'DELIVERED':
          result.delivered = count;
          break;
        case 'FAILED':
          result.failed = count;
          break;
        case 'DEAD_LETTER':
          result.deadLetter = count;
          break;
      }
    }

    return result;
  }

  /**
   * Get dead letter deliveries for investigation
   */
  async getDeadLetterDeliveries(
    tenantId?: string,
    limit: number = 100
  ): Promise<any[]> {
    const where = tenantId ? { tenantId } : {};

    return await this.prisma.webhookDelivery.findMany({
      where: {
        ...where,
        status: 'DEAD_LETTER',
      },
      include: {
        _count: {
          select: { attempts: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Clean up old deliveries and attempts (retention policy)
   */
  async cleanupOldDeliveries(
    olderThanDays: number = 90
  ): Promise<{ deliveries: number; attempts: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const deliveriesResult = await this.prisma.webhookDelivery.deleteMany({
      where: {
        status: { in: ['DELIVERED', 'DEAD_LETTER'] },
        updatedAt: {
          lt: cutoffDate,
        },
      },
    });

    const attemptsResult = await this.prisma.webhookAttempt.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(
      `Cleaned up ${deliveriesResult.count} webhook deliveries and ${attemptsResult.count} attempts`
    );

    return {
      deliveries: deliveriesResult.count,
      attempts: attemptsResult.count,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private mapEndpoint(endpoint: any): WebhookEndpoint {
    return {
      id: endpoint.id,
      tenantId: endpoint.tenantId,
      name: endpoint.name,
      url: endpoint.url,
      secretRef: endpoint.secretRef || undefined,
      previousSecretRef: endpoint.previousSecretRef || undefined,
      secretProvider: endpoint.secretProvider || undefined,
      enabled: endpoint.enabled,
      eventTypes: endpoint.eventTypes || [],
      timeoutMs: endpoint.timeoutMs,
      maxAttempts: endpoint.maxAttempts,
      backoffBaseSeconds: endpoint.backoffBaseSeconds,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt,
    } as WebhookEndpoint;
  }
}
