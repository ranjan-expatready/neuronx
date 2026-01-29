import { Injectable, Logger } from '@nestjs/common';
import { EventBus, EventHandler } from '../eventing';
import { NeuronxEvent } from '../../packages/contracts';
import { PredictiveRoutingService } from './predictive-routing.service';

@Injectable()
export class PredictiveRoutingHandler implements EventHandler {
  private readonly logger = new Logger(PredictiveRoutingHandler.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly predictiveRoutingService: PredictiveRoutingService
  ) {}

  async handle(event: NeuronxEvent): Promise<void> {
    const correlationId = event.metadata?.correlationId || event.correlationId;

    try {
      if (event.type === 'sales.lead.advancedScored') {
        await this.handleLeadAdvancedScored(event, correlationId);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle predictive routing event: ${event.id}`,
        {
          error: error.message,
          eventType: event.type,
          correlationId,
        }
      );
    }
  }

  private async handleLeadAdvancedScored(
    event: NeuronxEvent,
    correlationId: string
  ): Promise<void> {
    const tenantId = event.tenantId;
    const leadId = event.payload.leadId;
    const enhancedScore =
      event.payload.enhancedScore || event.payload.score || 75;

    // Mock lead profile data - in real implementation, this would be fetched from lead data
    const leadProfile = {
      leadId,
      score: enhancedScore,
      industry: 'technology', // Would come from lead data
      region: 'north-america', // Would come from lead data
      urgency:
        enhancedScore > 80
          ? 'high'
          : enhancedScore > 60
            ? 'medium'
            : ('low' as 'low' | 'medium' | 'high'),
    };

    this.logger.log(`Running predictive routing for lead ${leadId}`, {
      tenantId,
      enhancedScore,
      correlationId,
    });

    const routingRecommendation =
      await this.predictiveRoutingService.predictOptimalRouting(
        tenantId,
        leadProfile,
        correlationId
      );

    // Emit routing prediction event
    await this.eventBus.publish({
      type: 'sales.routing.predicted',
      tenantId,
      correlationId,
      timestamp: new Date(),
      payload: {
        leadId,
        recommendedTeamId: routingRecommendation.recommendedTeam.teamId,
        recommendedTeamName: routingRecommendation.recommendedTeam.name,
        confidence: routingRecommendation.confidence,
        reasoning: routingRecommendation.reasoning,
        alternatives: routingRecommendation.alternatives.map(alt => ({
          teamId: alt.team.teamId,
          teamName: alt.team.name,
          score: alt.score,
          reason: alt.reason,
        })),
        factors: routingRecommendation.factors,
      },
    });

    this.logger.log(`Predictive routing completed for lead ${leadId}`, {
      tenantId,
      recommendedTeam: routingRecommendation.recommendedTeam.teamId,
      confidence: routingRecommendation.confidence,
      alternativesCount: routingRecommendation.alternatives.length,
      correlationId,
    });
  }
}
