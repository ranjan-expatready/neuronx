import { Injectable, Logger } from '@nestjs/common';
import { EventBus, EventHandler } from '../eventing';
import { NeuronxEvent } from '../../packages/contracts';
import { QualificationService } from './qualification.service';
import { OpportunityService } from './opportunity.service';

@Injectable()
export class QualificationHandler implements EventHandler {
  private readonly logger = new Logger(QualificationHandler.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly qualificationService: QualificationService,
    private readonly opportunityService: OpportunityService
  ) {}

  async handle(event: NeuronxEvent): Promise<void> {
    const correlationId = event.metadata?.correlationId || event.correlationId;

    try {
      if (event.type === 'sales.lead.scored') {
        await this.handleLeadScored(event, correlationId);
      }
    } catch (error) {
      this.logger.error(`Failed to handle qualification event: ${event.id}`, {
        error: error.message,
        eventType: event.type,
        correlationId,
      });
    }
  }

  private async handleLeadScored(
    event: NeuronxEvent,
    correlationId: string
  ): Promise<void> {
    const tenantId = event.tenantId;
    const leadId = event.payload.leadId;
    const leadData = event.payload.leadData; // Would contain contact info, industry, etc.

    // Mock lead data - in real implementation, this would be fetched from event payload or DB
    const mockLeadData = {
      email: 'john@example.com',
      phone: '+1234567890',
      industry: 'technology',
      companySize: 150,
      score: event.payload.score,
    };

    // Run qualification
    const qualificationResult = await this.qualificationService.qualifyLead(
      tenantId,
      leadId,
      mockLeadData,
      correlationId
    );

    if (qualificationResult.qualified) {
      this.logger.log(`Lead ${leadId} qualified, creating opportunity`, {
        tenantId,
        score: qualificationResult.score,
        correlationId,
      });

      // Create opportunity
      const opportunityData = {
        leadId,
        contactName: 'John Doe', // Would come from lead data
        contactEmail: mockLeadData.email,
        contactPhone: mockLeadData.phone,
        companyName: 'Tech Corp', // Would come from lead data
        companySize: mockLeadData.companySize,
        industry: mockLeadData.industry,
        score: qualificationResult.score,
        source: 'neuronx_qualification',
      };

      const opportunityResult =
        await this.opportunityService.createOpportunityFromLead(
          tenantId,
          'location-123', // Would come from tenant config or lead data
          opportunityData,
          correlationId
        );

      if (opportunityResult.success) {
        this.logger.log(
          `Opportunity created successfully: ${opportunityResult.opportunityId}`,
          {
            tenantId,
            leadId,
            opportunityId: opportunityResult.opportunityId,
            correlationId,
          }
        );
      } else {
        this.logger.error(
          `Failed to create opportunity for qualified lead ${leadId}`,
          {
            tenantId,
            leadId,
            error: opportunityResult.error,
            correlationId,
          }
        );
      }
    } else {
      this.logger.log(`Lead ${leadId} not qualified`, {
        tenantId,
        score: qualificationResult.score,
        threshold: qualificationResult.threshold,
        reasons: qualificationResult.reasons,
        correlationId,
      });
    }
  }
}
