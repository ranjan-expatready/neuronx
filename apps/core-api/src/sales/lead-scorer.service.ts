import { Injectable } from '@nestjs/common';
import { NeuronxEvent } from '@neuronx/contracts';
import { ConfigService } from '../config/config.service';

export interface ScoringResult {
  score: number;
  routingThreshold: number;
  shouldRoute: boolean;
}

@Injectable()
export class LeadScorerService {
  constructor(private readonly configService: ConfigService) {}

  async evaluateLead(event: NeuronxEvent): Promise<ScoringResult> {
    // Get scoring configuration
    const scoringConfig = await this.configService.getScoringConfig(
      event.tenantId
    );

    // Pure function: evaluate scoring rules
    const score = this.calculateScore(event.data, scoringConfig);

    // Get routing threshold from config
    const routingThreshold = scoringConfig.routingThreshold || 70;

    return {
      score,
      routingThreshold,
      shouldRoute: score >= routingThreshold,
    };
  }

  // Pure function: no side effects, deterministic
  private calculateScore(leadData: any, scoringConfig: any): number {
    let score = 0;

    // Rule 1: Source-based scoring
    if (leadData.source === 'paid') {
      score += scoringConfig.weights?.source?.paid || 80;
    } else {
      score += scoringConfig.weights?.source?.organic || 30;
    }

    // Rule 2: Company size scoring (if available)
    if (leadData.companySize) {
      if (leadData.companySize >= 1000) {
        score += scoringConfig.weights?.companySize?.enterprise || 20;
      } else if (leadData.companySize >= 100) {
        score += scoringConfig.weights?.companySize?.mid || 10;
      }
    }

    // Rule 3: Industry scoring (if available)
    if (leadData.industry) {
      const industryScore =
        scoringConfig.weights?.industry?.[leadData.industry] || 0;
      score += industryScore;
    }

    // Ensure score is within valid range
    return Math.max(0, Math.min(100, score));
  }
}
