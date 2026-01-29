import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '../eventing';
import { ConfigService } from '@nestjs/config';

export interface ConversationSignal {
  leadId: string;
  messageContent: string;
  responseTimeMinutes: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  topicRelevance: number; // 0-1 score
  messageLength: number; // character count
}

export interface ScoreAdjustment {
  leadId: string;
  currentScore: number;
  adjustment: number;
  newScore: number;
  reasons: string[];
  routingRecommended: boolean;
  recommendedTeam?: string;
}

export interface ConversationScoringConfig {
  weights: {
    industry: number;
    companySize: number;
    engagement: number;
    behavior: number;
    conversation: number;
  };
  conversationSignals: {
    responseTimeWeight: number;
    messageLengthWeight: number;
    sentimentWeight: number;
    topicRelevanceWeight: number;
  };
}

@Injectable()
export class ConversationSignalService {
  private readonly logger = new Logger(ConversationSignalService.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly configService: ConfigService
  ) {}

  async processConversationSignal(
    tenantId: string,
    signal: ConversationSignal,
    correlationId: string
  ): Promise<ScoreAdjustment> {
    this.logger.log(
      `Processing conversation signal for lead ${signal.leadId}`,
      {
        tenantId,
        correlationId,
      }
    );

    const config = this.getConversationScoringConfig(tenantId);
    const reasons: string[] = [];

    // Calculate conversation score adjustment
    let conversationScore = 0;

    // Response time factor (faster is better)
    const responseTimeScore = Math.max(0, 1 - signal.responseTimeMinutes / 60); // Max 1 hour
    conversationScore +=
      responseTimeScore * config.conversationSignals.responseTimeWeight;
    reasons.push(
      `Response time: ${signal.responseTimeMinutes}min (${(responseTimeScore * 100).toFixed(1)}% score)`
    );

    // Message length factor (moderate length is better)
    const optimalLength = 100;
    const lengthScore =
      1 - Math.abs(signal.messageLength - optimalLength) / optimalLength;
    conversationScore +=
      Math.max(0, lengthScore) * config.conversationSignals.messageLengthWeight;
    reasons.push(
      `Message length: ${signal.messageLength} chars (${(lengthScore * 100).toFixed(1)}% score)`
    );

    // Sentiment factor
    const sentimentScore =
      signal.sentiment === 'positive'
        ? 1
        : signal.sentiment === 'neutral'
          ? 0.5
          : 0;
    conversationScore +=
      sentimentScore * config.conversationSignals.sentimentWeight;
    reasons.push(
      `Sentiment: ${signal.sentiment} (${(sentimentScore * 100).toFixed(1)}% score)`
    );

    // Topic relevance factor
    conversationScore +=
      signal.topicRelevance * config.conversationSignals.topicRelevanceWeight;
    reasons.push(
      `Topic relevance: ${(signal.topicRelevance * 100).toFixed(1)}%`
    );

    // Normalize conversation score to 0-20 point adjustment
    const adjustment = Math.round(conversationScore * 20);

    // Assume we have access to current lead score (would be fetched from DB in real impl)
    const currentScore = 75; // Placeholder - would be fetched
    const newScore = Math.min(100, Math.max(0, currentScore + adjustment));

    // Simple routing recommendation based on score change
    const routingRecommended = adjustment > 5; // Significant positive signal
    const recommendedTeam = routingRecommended
      ? this.determineTeam(signal)
      : undefined;

    const result: ScoreAdjustment = {
      leadId: signal.leadId,
      currentScore,
      adjustment,
      newScore,
      reasons,
      routingRecommended,
      recommendedTeam,
    };

    this.logger.log(`Conversation signal processed for lead ${signal.leadId}`, {
      tenantId,
      currentScore,
      adjustment,
      newScore,
      routingRecommended,
      recommendedTeam,
      reasons,
      correlationId,
    });

    // Emit rescore event
    await this.eventBus.publish({
      type: 'sales.lead.rescored',
      tenantId,
      correlationId,
      timestamp: new Date(),
      payload: {
        leadId: signal.leadId,
        previousScore: currentScore,
        newScore,
        adjustment,
        trigger: 'conversation_signal',
        reasons,
      },
    });

    // Emit routing event if recommended
    if (routingRecommended && recommendedTeam) {
      await this.eventBus.publish({
        type: 'sales.lead.routed',
        tenantId,
        correlationId,
        timestamp: new Date(),
        payload: {
          leadId: signal.leadId,
          team: recommendedTeam,
          reason: 'conversation_signal_positive',
          score: newScore,
        },
      });
    }

    return result;
  }

  private getConversationScoringConfig(
    tenantId: string
  ): ConversationScoringConfig {
    // In a real implementation, this would fetch from the control plane
    // For now, return sensible defaults
    return {
      weights: {
        industry: 0.2,
        companySize: 0.2,
        engagement: 0.2,
        behavior: 0.2,
        conversation: 0.2,
      },
      conversationSignals: {
        responseTimeWeight: 0.3,
        messageLengthWeight: 0.2,
        sentimentWeight: 0.3,
        topicRelevanceWeight: 0.2,
      },
    };
  }

  private determineTeam(signal: ConversationSignal): string {
    // Simple team determination based on signal characteristics
    if (signal.sentiment === 'positive' && signal.topicRelevance > 0.8) {
      return 'priority-response';
    } else if (signal.responseTimeMinutes < 30) {
      return 'fast-track';
    } else {
      return 'standard';
    }
  }
}
