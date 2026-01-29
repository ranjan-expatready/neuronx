import { Injectable } from '@nestjs/common';
import { EventPublisher } from '@neuronx/eventing';
import { NeuronxEvent } from '@neuronx/contracts';

@Injectable()
export class WebhookService {
  constructor(private eventPublisher: EventPublisher) {}

  async processLeadCreatedWebhook(
    payload: any,
    tenantId: string
  ): Promise<void> {
    // Transform GHL webhook payload to NeuronX event
    const neuronxEvent: NeuronxEvent = {
      id: crypto.randomUUID(),
      tenantId,
      type: 'sales.lead.created',
      data: {
        externalId: payload.id,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        company: payload.company,
        source: payload.source || 'unknown',
        createdAt: payload.createdAt || new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date(),
        correlationId: crypto.randomUUID(),
        source: 'ghl-webhook',
        originalId: payload.id,
        idempotencyKey: payload.id, // Use external ID for idempotency
      },
    };

    // Publish event via EventBus interface
    await this.eventPublisher.publish(neuronxEvent);
  }

  // Stub for signature validation (interface ready for real implementation)
  validateWebhookSignature(payload: any, signature: string): boolean {
    // TODO: Implement real signature validation
    // For now, accept all webhooks in development
    return true;
  }
}
