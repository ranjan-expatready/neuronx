import { Injectable, Logger } from '@nestjs/common';
import { EventBus, EventHandler } from '../eventing';
import { NeuronxEvent } from '../../packages/contracts';
import { EscalationService } from './escalation.service';

@Injectable()
export class EscalationHandler implements EventHandler {
  private readonly logger = new Logger(EscalationHandler.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly escalationService: EscalationService
  ) {}

  async handle(event: NeuronxEvent): Promise<void> {
    const correlationId = event.metadata?.correlationId || event.correlationId;

    try {
      if (event.type === 'sales.lead.escalated') {
        await this.handleLeadEscalation(event, correlationId);
      }
    } catch (error) {
      this.logger.error(`Failed to handle escalation event: ${event.id}`, {
        error: error.message,
        eventType: event.type,
        correlationId,
      });
    }
  }

  private async handleLeadEscalation(
    event: NeuronxEvent,
    correlationId: string
  ): Promise<void> {
    const tenantId = event.tenantId;
    const leadId = event.payload.leadId;
    const escalationReason = event.payload.escalationReason;
    const locationId = 'location-123'; // Would come from tenant config or lead data

    this.logger.log(`Processing escalation for lead ${leadId}`, {
      tenantId,
      leadId,
      escalationReason,
      correlationId,
    });

    await this.escalationService.handleEscalation(
      tenantId,
      locationId,
      leadId,
      escalationReason,
      correlationId
    );

    this.logger.log(`Escalation processing completed for lead ${leadId}`, {
      tenantId,
      leadId,
      correlationId,
    });
  }
}
