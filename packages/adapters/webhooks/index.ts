// Webhook Normalization Layer - Production Hardened
// Converts vendor-specific webhooks into canonical NeuronX domain events

import { EventBus } from '@neuronx/eventing';
import { GhlWebhookPayload } from '../ghl/ghl.types';
import { createHmac } from 'crypto';

export interface WebhookEvent {
  type: string;
  tenantId: string;
  data: any;
  metadata: {
    correlationId: string;
    timestamp: Date;
    source: 'webhook';
    vendor: string;
    webhookId?: string; // For deduplication
  };
}

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  algorithm?: string;
}

export interface ReplayCheckResult {
  isDuplicate: boolean;
  processedAt?: Date;
}

export interface WebhookHandler {
  canHandle(payload: any): boolean;
  normalize(
    payload: any,
    tenantId: string,
    webhookId?: string
  ): WebhookEvent | null;
}

export class WebhookSignatureVerifier {
  constructor(private webhookSecret?: string) {}

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  verifySignature(
    payload: any,
    signature: string,
    algorithm: string = 'sha256'
  ): WebhookVerificationResult {
    if (!this.webhookSecret) {
      // In development, allow skipping verification with explicit warning
      console.warn(
        'WEBHOOK VERIFICATION DISABLED: No webhook secret configured'
      );
      return { valid: true, algorithm: 'none' };
    }

    if (!signature) {
      return { valid: false, error: 'Missing signature' };
    }

    try {
      // Extract algorithm and signature from header (e.g., "sha256=abc123")
      const [sigAlgorithm, sigValue] = signature.split('=');

      if (!sigAlgorithm || !sigValue) {
        return { valid: false, error: 'Invalid signature format' };
      }

      if (sigAlgorithm !== algorithm) {
        return {
          valid: false,
          error: `Unsupported algorithm: ${sigAlgorithm}`,
        };
      }

      // Create expected signature
      const payloadString =
        typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expectedSignature = createHmac(algorithm, this.webhookSecret)
        .update(payloadString, 'utf8')
        .digest('hex');

      // Compare signatures (constant-time comparison)
      const valid = this.constantTimeCompare(sigValue, expectedSignature);

      return {
        valid,
        algorithm: sigAlgorithm,
        error: valid ? undefined : 'Signature mismatch',
      };
    } catch (error) {
      return {
        valid: false,
        error: `Verification error: ${error.message}`,
      };
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

export class WebhookReplayProtector {
  private processedWebhooks = new Map<string, Date>();
  private readonly retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Check if webhook has been processed recently
   */
  checkReplay(webhookId: string, timestamp: Date): ReplayCheckResult {
    // Clean up old entries
    this.cleanup();

    const key = this.generateKey(webhookId, timestamp);
    const processedAt = this.processedWebhooks.get(key);

    if (processedAt) {
      return { isDuplicate: true, processedAt };
    }

    // Mark as processed
    this.processedWebhooks.set(key, new Date());
    return { isDuplicate: false };
  }

  /**
   * Generate unique key for webhook deduplication
   */
  private generateKey(webhookId: string, timestamp: Date): string {
    // Include timestamp rounded to minute to catch near-duplicate events
    const minuteTimestamp = Math.floor(timestamp.getTime() / 60000) * 60000;
    return `${webhookId}:${minuteTimestamp}`;
  }

  /**
   * Clean up old processed webhook records
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.retentionPeriod;

    for (const [key, processedAt] of this.processedWebhooks.entries()) {
      if (processedAt.getTime() < cutoff) {
        this.processedWebhooks.delete(key);
      }
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): { processedCount: number; retentionPeriod: number } {
    return {
      processedCount: this.processedWebhooks.size,
      retentionPeriod: this.retentionPeriod,
    };
  }
}

export class GhlWebhookHandler implements WebhookHandler {
  canHandle(payload: any): boolean {
    return (
      payload.event && typeof payload.event === 'string' && payload.locationId
    );
  }

  normalize(
    payload: GhlWebhookPayload,
    tenantId: string,
    webhookId?: string
  ): WebhookEvent | null {
    const correlationId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    switch (payload.event) {
      case 'contact.created':
        return {
          type: 'neuronx.contact.ingested',
          tenantId,
          data: {
            externalId: payload.data.id,
            email: payload.data.email,
            phone: payload.data.phone,
            firstName: payload.data.firstName,
            lastName: payload.data.lastName,
            source: 'ghl_webhook',
            locationId: payload.locationId,
          },
          metadata: {
            correlationId,
            timestamp: new Date(),
            source: 'webhook',
            vendor: 'ghl',
            webhookId,
          },
        };

      case 'contact.updated':
        return {
          type: 'neuronx.contact.updated',
          tenantId,
          data: {
            externalId: payload.data.id,
            changes: payload.data.changes || {},
            locationId: payload.locationId,
          },
          metadata: {
            correlationId,
            timestamp: new Date(),
            source: 'webhook',
            vendor: 'ghl',
          },
        };

      case 'opportunity.created':
        return {
          type: 'neuronx.opportunity.created',
          tenantId,
          data: {
            externalId: payload.data.id,
            leadId: payload.data.contactId,
            name: payload.data.name,
            value: payload.data.value,
            pipelineId: payload.data.pipelineId,
            locationId: payload.locationId,
          },
          metadata: {
            correlationId,
            timestamp: new Date(),
            source: 'webhook',
            vendor: 'ghl',
          },
        };

      case 'opportunity.stage_changed':
        return {
          type: 'neuronx.opportunity.stage_changed',
          tenantId,
          data: {
            externalId: payload.data.id,
            oldStage: payload.data.oldStageName,
            newStage: payload.data.newStageName,
            value: payload.data.value,
            locationId: payload.locationId,
          },
          metadata: {
            correlationId,
            timestamp: new Date(),
            source: 'webhook',
            vendor: 'ghl',
          },
        };

      case 'conversation.message.received':
        return {
          type: 'neuronx.conversation.message.received',
          tenantId,
          data: {
            conversationId: payload.data.conversationId,
            messageId: payload.data.messageId,
            content: payload.data.message,
            contactId: payload.data.contactId,
            type: payload.data.type,
            locationId: payload.locationId,
          },
          metadata: {
            correlationId,
            timestamp: new Date(),
            source: 'webhook',
            vendor: 'ghl',
          },
        };

      case 'workflow.triggered':
        return {
          type: 'neuronx.workflow.started',
          tenantId,
          data: {
            workflowId: payload.data.workflowId,
            contactId: payload.data.contactId,
            triggerType: payload.data.trigger,
            locationId: payload.locationId,
          },
          metadata: {
            correlationId,
            timestamp: new Date(),
            source: 'webhook',
            vendor: 'ghl',
          },
        };

      case 'calendar.event.created':
        return {
          type: 'neuronx.appointment.scheduled',
          tenantId,
          data: {
            externalId: payload.data.id,
            contactId: payload.data.contactId,
            title: payload.data.title,
            startTime: payload.data.startTime,
            endTime: payload.data.endTime,
            locationId: payload.locationId,
          },
          metadata: {
            correlationId,
            timestamp: new Date(),
            source: 'webhook',
            vendor: 'ghl',
          },
        };

      default:
        // Unknown event type - log but don't fail
        console.warn(`Unknown GHL webhook event: ${payload.event}`, {
          correlationId,
          event: payload.event,
          locationId: payload.locationId,
        });
        return null;
    }
  }
}

export class WebhookNormalizer {
  private handlers: WebhookHandler[] = [new GhlWebhookHandler()];
  private signatureVerifier: WebhookSignatureVerifier;
  private replayProtector: WebhookReplayProtector;

  constructor(
    eventBus: EventBus,
    options: {
      webhookSecret?: string;
    } = {}
  ) {
    this.eventBus = eventBus;
    this.signatureVerifier = new WebhookSignatureVerifier(
      options.webhookSecret
    );
    this.replayProtector = new WebhookReplayProtector();
  }

  /**
   * Process an incoming webhook with full verification and deduplication
   */
  async processWebhook(
    payload: any,
    signature: string,
    headers: Record<string, string>,
    tenantId: string
  ): Promise<{
    processed: boolean;
    event?: WebhookEvent;
    verification?: WebhookVerificationResult;
    replayCheck?: ReplayCheckResult;
  }> {
    const webhookId = this.extractWebhookId(payload, headers);
    const timestamp = new Date();

    // Find appropriate handler
    const handler = this.handlers.find(h => h.canHandle(payload));
    if (!handler) {
      console.warn('No handler found for webhook payload', {
        tenantId,
        webhookId,
        payload: JSON.stringify(payload).slice(0, 200),
      });
      return { processed: false };
    }

    // Verify signature
    const verification = this.signatureVerifier.verifySignature(
      payload,
      signature
    );
    if (!verification.valid) {
      console.error('GHL webhook signature verification failed', {
        tenantId,
        webhookId,
        correlationId,
        verificationError: verification.error,
        algorithm: verification.algorithm,
        signatureLength: signature ? signature.length : 0,
        signaturePrefix: signature
          ? signature.substring(0, 10) + '...'
          : 'none',
        headersPresent: Object.keys(headers).filter(h =>
          h.toLowerCase().includes('signature')
        ),
        payloadSize: JSON.stringify(payload).length,
        hashInput: 'Raw JSON payload, UTF-8 encoded',
        timestamp: new Date().toISOString(),
      });
      return {
        processed: false,
        verification,
      };
    }

    // Check for replay attacks
    const replayCheck = this.replayProtector.checkReplay(webhookId, timestamp);
    if (replayCheck.isDuplicate) {
      console.warn('Webhook replay detected, ignoring duplicate', {
        tenantId,
        webhookId,
        originalProcessedAt: replayCheck.processedAt,
      });
      return {
        processed: false,
        verification,
        replayCheck,
      };
    }

    // Normalize to domain event
    const event = handler.normalize(payload, tenantId, webhookId);
    if (!event) {
      console.warn('Webhook normalization returned null', {
        tenantId,
        webhookId,
        payload: JSON.stringify(payload).slice(0, 200),
      });
      return {
        processed: false,
        verification,
        replayCheck,
      };
    }

    // Publish to event bus
    await this.eventBus.publish(event);

    console.log('Webhook processed successfully', {
      tenantId,
      webhookId,
      eventType: event.type,
      correlationId: event.metadata.correlationId,
    });

    return {
      processed: true,
      event,
      verification,
      replayCheck,
    };
  }

  /**
   * Extract webhook ID for deduplication
   */
  private extractWebhookId(
    payload: any,
    headers: Record<string, string>
  ): string {
    // Try various sources for webhook ID
    if (payload.id) return payload.id;
    if (payload.webhookId) return payload.webhookId;
    if (headers['x-webhook-id']) return headers['x-webhook-id'];
    if (headers['x-request-id']) return headers['x-request-id'];

    // Fallback: generate deterministic ID from payload
    const payloadString = JSON.stringify(payload);
    return createHmac('sha256', 'neuronx-webhook')
      .update(payloadString)
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * Register additional webhook handlers
   */
  registerHandler(handler: WebhookHandler): void {
    this.handlers.push(handler);
  }
}

// Express middleware for webhook processing
export function createWebhookMiddleware(normalizer: WebhookNormalizer) {
  return async (req: any, res: any) => {
    const startTime = Date.now();
    const requestId =
      req.headers['x-request-id'] ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const signature =
        req.headers['x-webhook-signature'] || req.headers['x-signature'];
      const tenantId = req.headers['x-tenant-id'] || 'default';

      console.log('Webhook received', {
        requestId,
        tenantId,
        userAgent: req.headers['user-agent'],
        contentLength: req.headers['content-length'],
        hasSignature: !!signature,
      });

      const result = await normalizer.processWebhook(
        req.body,
        signature,
        req.headers,
        tenantId
      );

      const processingTime = Date.now() - startTime;

      if (result.processed) {
        console.log('Webhook processed successfully', {
          requestId,
          tenantId,
          eventType: result.event?.type,
          correlationId: result.event?.metadata.correlationId,
          processingTime,
        });

        res.status(200).json({
          status: 'processed',
          eventId: result.event?.metadata.correlationId,
          processingTime,
        });
      } else {
        const reason =
          result.verification?.valid === false
            ? 'signature_invalid'
            : result.replayCheck?.isDuplicate
              ? 'duplicate_webhook'
              : 'unsupported_webhook_type';

        console.warn('Webhook processing skipped', {
          requestId,
          tenantId,
          reason,
          verificationError: result.verification?.error,
          processingTime,
        });

        res.status(result.verification?.valid === false ? 401 : 400).json({
          status: 'skipped',
          reason,
          processingTime,
        });
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;

      console.error('Webhook processing error:', {
        requestId,
        tenantId: req.headers['x-tenant-id'],
        error: error.message,
        stack: error.stack,
        processingTime,
      });

      res.status(500).json({
        status: 'error',
        message: 'Webhook processing failed',
        requestId,
        processingTime,
      });
    }
  };
}
