import { Injectable, Logger } from '@nestjs/common';
import { EventBus, EventHandler } from '../eventing';
import { NeuronxEvent } from '../../packages/contracts';
import { AdvancedScoringService } from './advanced-scoring.service';

@Injectable()
export class AdvancedScoringHandler implements EventHandler {
  private readonly logger = new Logger(AdvancedScoringHandler.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly advancedScoringService: AdvancedScoringService
  ) {}

  async handle(event: NeuronxEvent): Promise<void> {
    const correlationId = event.metadata?.correlationId || event.correlationId;

    try {
      if (event.type === 'sales.lead.qualified') {
        await this.handleLeadQualified(event, correlationId);
      } else if (event.type === 'sales.conversation.analyzed') {
        await this.handleConversationAnalyzed(event, correlationId);
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle advanced scoring event: ${event.id}`,
        {
          error: error.message,
          eventType: event.type,
          correlationId,
        }
      );
    }
  }

  private async handleLeadQualified(
    event: NeuronxEvent,
    correlationId: string
  ): Promise<void> {
    const tenantId = event.tenantId;
    const leadId = event.payload.leadId;
    const score = event.payload.score || 75; // Default score if not provided

    // Mock conversation signal data - in real implementation, this would be fetched
    const conversationSignal = {
      sentiment: 0.7, // Positive sentiment
      responseTimeMinutes: 15,
      messageLength: 150,
      topicRelevance: 0.8,
      interactionFrequency: 3, // 3 interactions per day
    };

    // Mock industry - in real implementation, this would come from lead data
    const industry = 'technology';

    this.logger.log(`Running advanced scoring for qualified lead ${leadId}`, {
      tenantId,
      baseScore: score,
      correlationId,
    });

    const enhancedResult =
      await this.advancedScoringService.calculateEnhancedScore(
        leadId,
        tenantId,
        score,
        industry,
        conversationSignal,
        correlationId
      );

    // Emit advanced scoring event
    await this.eventBus.publish({
      type: 'sales.lead.advancedScored',
      tenantId,
      correlationId,
      timestamp: new Date(),
      payload: {
        leadId,
        originalScore: enhancedResult.originalScore,
        enhancedScore: enhancedResult.enhancedScore,
        adjustment: enhancedResult.adjustment,
        confidence: enhancedResult.confidence,
        factors: enhancedResult.factors,
        reasoning: enhancedResult.reasoning,
      },
    });

    this.logger.log(`Advanced scoring completed for lead ${leadId}`, {
      tenantId,
      originalScore: enhancedResult.originalScore,
      enhancedScore: enhancedResult.enhancedScore,
      adjustment: enhancedResult.adjustment,
      confidence: enhancedResult.confidence,
      correlationId,
    });
  }

  private async handleConversationAnalyzed(
    event: NeuronxEvent,
    correlationId: string
  ): Promise<void> {
    // This handler could trigger re-scoring when new conversation data is available
    // For now, it's a placeholder for future enhancement
    this.logger.debug(
      `Conversation analyzed event received: ${event.payload.leadId}`,
      {
        correlationId,
      }
    );
  }
}
