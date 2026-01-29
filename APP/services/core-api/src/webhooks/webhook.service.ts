/**
 * Webhook Service - WI-018: Outbound Webhook Delivery System + WI-020: Webhook Endpoint Management APIs
 *
 * Orchestrates webhook delivery with tenant isolation and durability.
 * Manages endpoints and provides monitoring capabilities.
 * Added management APIs for CRUD operations, secret rotation, and testing.
 */

import { Injectable, Logger } from '@nestjs/common';
import { WebhookRepository } from './webhook.repository';
import { SecretService } from '../secrets/secret.service';
import {
  CreateWebhookEndpointRequest,
  UpdateWebhookEndpointRequest,
  RotateWebhookSecretRequest,
  TestWebhookDeliveryRequest,
  WebhookEndpointResponse,
  WebhookEndpointSummary,
  RotateWebhookSecretResponse,
  TestWebhookDeliveryResponse,
  WebhookValidation,
} from './webhook.dto';
import { WebhookEndpoint } from './webhook.types';

// Simple in-memory rate limiter for test deliveries (production would use Redis)
// TODO: STOP-SHIP - Ensure tenant isolation is maintained if this moves to shared Redis
// Current implementation uses tenantId as key, which provides isolation
const testDeliveryRateLimit = new Map<
  string,
  { count: number; resetTime: number }
>();
const TEST_DELIVERY_LIMIT = 10; // per tenant per minute
const TEST_DELIVERY_WINDOW = 60 * 1000; // 1 minute

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly webhookRepository: WebhookRepository,
    private readonly secretService: SecretService
  ) {}

  /**
   * Create webhook endpoint (Management API)
   */
  async createEndpoint(
    tenantId: string,
    request: CreateWebhookEndpointRequest,
    correlationId?: string
  ): Promise<WebhookEndpointResponse> {
    // Validate inputs (already done in controller, but defensive programming)
    WebhookValidation.validateHttpsUrl(request.url);
    WebhookValidation.validateEventTypes(request.eventTypes);

    // Generate secure secret for the endpoint
    const secretName = `webhook-endpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const secretRef = await this.secretService.putSecret(
      tenantId,
      secretName,
      this.generateSecureSecret(),
      {
        createdBy: 'webhook-api',
        correlationId,
        endpointName: request.name,
      }
    );

    // Create endpoint in database
    const createRequest = {
      tenantId,
      name: request.name,
      url: request.url,
      secretRef,
      eventTypes: request.eventTypes,
      timeoutMs: request.timeoutMs || 5000,
      maxAttempts: request.maxAttempts || 10,
      backoffBaseSeconds: request.backoffBaseSeconds || 30,
    };

    const endpointId =
      await this.webhookRepository.createEndpoint(createRequest);

    // Get the created endpoint for response
    const endpoint = await this.webhookRepository.getEndpointById(
      tenantId,
      endpointId
    );
    if (!endpoint) {
      throw new Error('Failed to retrieve created endpoint');
    }

    return this.mapEndpointToResponse(endpoint);
  }

  /**
   * List webhook endpoints with pagination (Management API)
   */
  async listEndpoints(
    tenantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ endpoints: WebhookEndpointSummary[]; total: number }> {
    // For now, get all and paginate in memory (production would optimize this)
    const allEndpoints =
      await this.webhookRepository.listActiveEndpoints(tenantId);

    const total = allEndpoints.length;
    const paginatedEndpoints = allEndpoints.slice(offset, offset + limit);

    return {
      endpoints: paginatedEndpoints.map(this.mapEndpointToSummary),
      total,
    };
  }

  /**
   * Update webhook endpoint (Management API)
   */
  async updateEndpoint(
    tenantId: string,
    endpointId: string,
    updates: UpdateWebhookEndpointRequest,
    correlationId?: string
  ): Promise<WebhookEndpointResponse | null> {
    await this.webhookRepository.updateEndpoint(tenantId, endpointId, {
      ...updates,
      updatedAt: new Date(),
    });

    const endpoint = await this.webhookRepository.getEndpointById(
      tenantId,
      endpointId
    );
    return endpoint ? this.mapEndpointToResponse(endpoint) : null;
  }

  /**
   * Disable webhook endpoint (Management API)
   */
  async disableEndpoint(
    tenantId: string,
    endpointId: string,
    correlationId?: string
  ): Promise<boolean> {
    // Soft delete by disabling (for audit trail)
    await this.webhookRepository.updateEndpoint(tenantId, endpointId, {
      enabled: false,
      updatedAt: new Date(),
    });

    return true;
  }

  /**
   * Rotate webhook endpoint secret (Management API)
   */
  async rotateEndpointSecret(
    tenantId: string,
    endpointId: string,
    actor: string,
    correlationId?: string,
    reason?: string
  ): Promise<RotateWebhookSecretResponse> {
    // Get current endpoint
    const endpoint = await this.webhookRepository.getEndpointById(
      tenantId,
      endpointId
    );
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${endpointId} not found`);
    }

    if (!endpoint.secretRef) {
      throw new Error(`Webhook endpoint ${endpointId} has no secret reference`);
    }

    // Rotate the secret
    const newSecretRef = await this.secretService.rotateSecret(
      tenantId,
      `webhook-endpoint-${endpointId}`,
      this.generateSecureSecret(),
      actor,
      correlationId
    );

    // Update endpoint with new secret reference
    await this.webhookRepository.updateEndpoint(tenantId, endpointId, {
      secretRef: newSecretRef,
      previousSecretRef: endpoint.secretRef,
      secretUpdatedAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      endpointId,
      previousSecretRef: endpoint.secretRef,
      newSecretRef,
      rotatedAt: new Date(),
      actor,
      correlationId,
    };
  }

  /**
   * Test webhook endpoint delivery (Management API)
   */
  async testEndpointDelivery(
    tenantId: string,
    endpointId: string,
    actor: string,
    correlationId?: string,
    message?: string
  ): Promise<TestWebhookDeliveryResponse> {
    // Rate limiting check
    if (!this.checkTestDeliveryRateLimit(tenantId)) {
      throw new Error('Test delivery rate limit exceeded. Try again later.');
    }

    // Get endpoint
    const endpoint = await this.webhookRepository.getEndpointById(
      tenantId,
      endpointId
    );
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${endpointId} not found`);
    }

    // Create synthetic test event
    const testEventId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const testEvent = {
      eventType: 'webhook.test' as const,
      eventId: testEventId,
      occurredAt: new Date().toISOString(),
      payload: {
        message: message || 'This is a test webhook delivery',
        timestamp: new Date().toISOString(),
        endpointId,
        tenantId,
      },
      tenantId,
      correlationId,
    };

    // Create delivery record for the test event
    const deliveryId = await this.webhookRepository.createDelivery(
      tenantId,
      endpointId,
      `test-${testEventId}`, // Fake outbox event ID for test
      'webhook.test',
      correlationId
    );

    // The delivery will be processed by the normal dispatcher
    // Since this is a test event that doesn't exist in outbox,
    // we need to create a synthetic delivery record that the dispatcher can handle

    return {
      deliveryId: deliveryId || `test-delivery-${testEventId}`,
      endpointId,
      testEventId,
      status: 'QUEUED',
      queuedAt: new Date(),
    };
  }

  /**
   * Legacy create method (kept for backward compatibility)
   */
  async createEndpoint(request: CreateWebhookEndpointRequest): Promise<string> {
    throw new Error(
      'Use the management API version: createEndpoint(tenantId, request, correlationId)'
    );
  }

  /**
   * Update webhook endpoint
   */
  async updateEndpoint(
    tenantId: string,
    endpointId: string,
    updates: UpdateWebhookEndpointRequest
  ): Promise<void> {
    // Validate URL if provided
    if (updates.url) {
      try {
        new URL(updates.url);
      } catch {
        throw new Error('Invalid URL format');
      }

      if (!updates.url.startsWith('https://')) {
        throw new Error('Webhook endpoints must use HTTPS');
      }
    }

    // Validate event types if provided
    if (updates.eventTypes) {
      const validEventTypes = await this.getValidEventTypes();
      for (const eventType of updates.eventTypes) {
        if (!validEventTypes.includes(eventType)) {
          throw new Error(`Invalid event type: ${eventType}`);
        }
      }
    }

    await this.webhookRepository.updateEndpoint(tenantId, endpointId, updates);
  }

  /**
   * Get webhook endpoint
   */
  async getEndpoint(
    tenantId: string,
    endpointId: string
  ): Promise<WebhookEndpoint | null> {
    return await this.webhookRepository.getEndpointById(tenantId, endpointId);
  }

  /**
   * List webhook endpoints for tenant
   */
  async listEndpoints(tenantId: string): Promise<WebhookEndpoint[]> {
    return await this.webhookRepository.listActiveEndpoints(tenantId);
  }

  /**
   * Delete webhook endpoint
   */
  async deleteEndpoint(tenantId: string, endpointId: string): Promise<void> {
    // TODO: Consider marking as disabled instead of deleting for audit purposes
    await this.webhookRepository.deleteEndpoint(tenantId, endpointId);
  }

  /**
   * Get webhook delivery statistics
   */
  async getDeliveryStats(tenantId?: string) {
    return await this.webhookRepository.getDeliveryStats(tenantId);
  }

  /**
   * Get dead letter deliveries for investigation
   */
  async getDeadLetterDeliveries(tenantId?: string, limit: number = 100) {
    return await this.webhookRepository.getDeadLetterDeliveries(
      tenantId,
      limit
    );
  }

  /**
   * Manually trigger delivery fanout (for testing)
   */
  async triggerDeliveryFanout(): Promise<number> {
    return await this.webhookRepository.createDeliveriesForPublishedEvents();
  }

  /**
   * Get valid event types that can be delivered via webhooks
   * Based on outbox events that exist in the system
   */
  private async getValidEventTypes(): Promise<string[]> {
    // For now, return known event types from WI-014 and related work
    // In production, this could query the outbox schema dynamically
    return [
      'payment.paid', // WI-011 - Revenue critical
      'sla.timer.due', // WI-017 - SLA management
      'sla.escalation.triggered', // WI-017 - SLA management
      'voice.attempt.started', // WI-013 - Voice state
      'voice.attempt.completed', // WI-013 - Voice state
      'voice.attempt.failed', // WI-013 - Voice state
      'voice.webhook.received', // WI-013 - Voice provider updates
      'webhook.test', // WI-020 - Test deliveries
      // Add more as they become available in outbox
    ];
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Generate a secure random secret for webhook endpoints
   */
  private generateSecureSecret(): string {
    // Generate a 32-byte (256-bit) random secret
    return require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Map WebhookEndpoint to WebhookEndpointResponse (no secrets)
   */
  private mapEndpointToResponse(
    endpoint: WebhookEndpoint
  ): WebhookEndpointResponse {
    return {
      id: endpoint.id,
      tenantId: endpoint.tenantId,
      name: endpoint.name,
      url: endpoint.url,
      enabled: endpoint.enabled,
      eventTypes: endpoint.eventTypes,
      timeoutMs: endpoint.timeoutMs,
      maxAttempts: endpoint.maxAttempts,
      backoffBaseSeconds: endpoint.backoffBaseSeconds,
      secretProvider: endpoint.secretProvider,
      secretUpdatedAt: endpoint.secretUpdatedAt,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt,
    };
  }

  /**
   * Map WebhookEndpoint to WebhookEndpointSummary
   */
  private mapEndpointToSummary(
    endpoint: WebhookEndpoint
  ): WebhookEndpointSummary {
    return {
      id: endpoint.id,
      name: endpoint.name,
      url: endpoint.url,
      enabled: endpoint.enabled,
      eventTypes: endpoint.eventTypes,
      secretProvider: endpoint.secretProvider,
      secretUpdatedAt: endpoint.secretUpdatedAt,
      createdAt: endpoint.createdAt,
      updatedAt: endpoint.updatedAt,
    };
  }

  /**
   * Check test delivery rate limit
   */
  private checkTestDeliveryRateLimit(tenantId: string): boolean {
    const now = Date.now();
    const key = tenantId;
    const limit = testDeliveryRateLimit.get(key);

    if (!limit || now > limit.resetTime) {
      // Reset or initialize limit
      testDeliveryRateLimit.set(key, {
        count: 1,
        resetTime: now + TEST_DELIVERY_WINDOW,
      });
      return true;
    }

    if (limit.count >= TEST_DELIVERY_LIMIT) {
      return false;
    }

    limit.count++;
    return true;
  }
}
