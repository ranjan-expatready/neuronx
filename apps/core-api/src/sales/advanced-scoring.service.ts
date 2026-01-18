import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CipherService } from '../cipher/cipher.service';
import { ConfigLoader } from '../config/config.loader';
import {
  TenantContext,
  createSystemTenantContext,
} from '../config/tenant-context';
import { UsageService } from '../usage/usage.service';
import { UsageEventEmitter } from '../usage/usage.events';
import { CacheService } from '../cache/cache.service';

export interface ConversationSignal {
  sentiment: number; // -1 to 1 (negative to positive)
  responseTimeMinutes: number;
  messageLength: number;
  topicRelevance: number; // 0 to 1
  interactionFrequency: number; // interactions per day
}

export interface EnhancedScoringResult {
  originalScore: number;
  enhancedScore: number;
  adjustment: number;
  confidence: number;
  factors: {
    baseScore: { value: number; weight: number; contribution: number };
    sentimentScore: { value: number; weight: number; contribution: number };
    timingScore: { value: number; weight: number; contribution: number };
    frequencyScore: { value: number; weight: number; contribution: number };
    industryAdjustment: { value: number; weight: number; contribution: number };
  };
  reasoning: string[];
  cipherDecision?: any;
  cacheSource?: 'cache' | 'computed'; // WI-015: Indicate cache vs compute
}

@Injectable()
export class AdvancedScoringService {
  private readonly logger = new Logger(AdvancedScoringService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly cipherService: CipherService,
    private readonly configLoader: ConfigLoader,
    private readonly usageService: UsageService,
    private readonly cacheService: CacheService
  ) {}

  async calculateEnhancedScore(
    leadId: string,
    tenantId: string,
    baseScore: number,
    industry: string,
    conversationSignal: ConversationSignal,
    correlationId: string
  ): Promise<EnhancedScoringResult> {
    const startTime = Date.now();
    this.logger.log(`Calculating enhanced score for lead ${leadId}`, {
      tenantId,
      baseScore,
      industry,
      correlationId,
    });

    // Get configuration with tenant isolation
    const config = await this.getScoringConfig(tenantId);

    // WI-015: Check cache first (deterministic key based on inputs)
    const cacheInputs = {
      leadId, // Include leadId for uniqueness (not stored in cache value)
      baseScore,
      industry,
      conversationSignal, // Hash of signal data
    };

    const cacheOptions = {
      tenantId,
      domain: 'scoring',
      modelVersion: 'v1.0', // Would come from config in production
      configHash: this.getConfigHash(config), // From WI-012 effective config
      ttlSeconds: 15 * 60, // 15 minutes
    };

    // Try cache first (fail-open - cache miss triggers compute)
    const cachedResult = await this.cacheService.get<EnhancedScoringResult>(
      cacheInputs,
      cacheOptions
    );
    if (cachedResult) {
      this.logger.debug(`Cache hit for lead ${leadId} scoring`, {
        tenantId,
        baseScore,
        industry,
        correlationId,
        computedAt: cachedResult.computedAt,
      });

      return {
        ...cachedResult.value,
        cacheSource: 'cache',
      };
    }

    this.logger.debug(`Cache miss for lead ${leadId} scoring - computing`, {
      tenantId,
      correlationId,
    });

    // Calculate enhanced score components
    const sentimentScore = this.calculateSentimentScore(
      conversationSignal.sentiment
    );
    const timingScore = this.calculateTimingScore(
      conversationSignal.responseTimeMinutes
    );
    const frequencyScore = this.calculateFrequencyScore(
      conversationSignal.interactionFrequency
    );
    const industryAdjustment = this.calculateIndustryAdjustment(
      industry,
      config.industryMultipliers
    );

    // Apply weights
    const factors = {
      baseScore: {
        value: baseScore / 100, // Normalize to 0-1
        weight: config.enhancedWeights.baseScore,
        contribution: (baseScore / 100) * config.enhancedWeights.baseScore,
      },
      sentimentScore: {
        value: sentimentScore,
        weight: config.enhancedWeights.sentimentScore,
        contribution: sentimentScore * config.enhancedWeights.sentimentScore,
      },
      timingScore: {
        value: timingScore,
        weight: config.enhancedWeights.timingScore,
        contribution: timingScore * config.enhancedWeights.timingScore,
      },
      frequencyScore: {
        value: frequencyScore,
        weight: config.enhancedWeights.frequencyScore,
        contribution: frequencyScore * config.enhancedWeights.frequencyScore,
      },
      industryAdjustment: {
        value: industryAdjustment,
        weight: 0, // Industry adjustment is multiplicative, not additive
        contribution: industryAdjustment,
      },
    };

    // Calculate weighted sum
    const weightedSum =
      factors.baseScore.contribution +
      factors.sentimentScore.contribution +
      factors.timingScore.contribution +
      factors.frequencyScore.contribution;

    // Apply industry adjustment
    const enhancedScore = Math.min(
      100,
      Math.max(0, weightedSum * industryAdjustment * 100)
    );

    // Calculate adjustment and confidence
    const adjustment = enhancedScore - baseScore;
    const confidence = this.calculateConfidence(factors);

    // Build reasoning
    const reasoning = this.buildReasoning(
      factors,
      industryAdjustment,
      baseScore,
      enhancedScore
    );

    const result: EnhancedScoringResult = {
      originalScore: baseScore,
      enhancedScore,
      adjustment,
      confidence,
      factors,
      reasoning,
    };

    // Cipher checkpoint for enhanced scoring decision
    if (this.cipherService.isEnabled()) {
      const cipherDecision = await this.cipherService.checkDecision({
        tenantId,
        correlationId,
        operation: 'enhanced_scoring',
        data: {
          leadId,
          originalScore: baseScore,
          enhancedScore,
          adjustment,
          industry,
          factors: result.factors,
        },
      });

      result.cipherDecision = cipherDecision;

      this.logger.log(
        `Cipher decision for enhanced scoring: ${cipherDecision.decision}`,
        {
          tenantId,
          leadId,
          correlationId,
          cipherReason: cipherDecision.reason,
          cipherConfidence: cipherDecision.confidence,
        }
      );
    }

    const processingTime = Date.now() - startTime;
    this.logger.log(`Enhanced scoring completed for lead ${leadId}`, {
      tenantId,
      originalScore: baseScore,
      enhancedScore,
      adjustment,
      confidence,
      correlationId,
      processingTimeMs: processingTime,
    });

    // Performance profiling log
    this.logger.log(`PERF: Enhanced scoring performance`, {
      operation: 'enhanced_scoring',
      tenantId,
      leadId,
      correlationId,
      processingTimeMs: processingTime,
      baseScore,
      finalScore: enhancedScore,
      scoreImprovement: adjustment,
      confidence,
      timestamp: new Date().toISOString(),
    });

    // Emit usage events for metering
    try {
      const scoringEvent = UsageEventEmitter.emitScoringRequest(
        tenantId,
        leadId,
        config.model,
        correlationId,
        'advanced-scoring'
      );
      await this.usageService.recordUsage(scoringEvent);
    } catch (error) {
      // Log but don't fail the scoring operation
      this.logger.warn(
        `Failed to emit scoring usage event for lead ${leadId}`,
        {
          tenantId,
          error: error.message,
          correlationId,
        }
      );
    }

    // WI-015: Cache the computed result (fail-open - cache write failure doesn't break scoring)
    await this.cacheService.set(cacheInputs, result, cacheOptions);

    this.logger.debug(`Cached scoring result for lead ${leadId}`, {
      tenantId,
      correlationId,
    });

    return {
      ...result,
      cacheSource: 'computed',
    };
  }

  private calculateSentimentScore(sentiment: number): number {
    // Convert -1 to 1 range to 0 to 1 range
    return (sentiment + 1) / 2;
  }

  private calculateTimingScore(responseTimeMinutes: number): number {
    // Faster response = higher score (max 60 minutes)
    const normalizedTime = Math.min(responseTimeMinutes, 60) / 60;
    return 1 - normalizedTime; // Invert so faster = higher score
  }

  private calculateFrequencyScore(interactionsPerDay: number): number {
    // More frequent interactions = higher score (cap at 10 per day)
    return Math.min(interactionsPerDay, 10) / 10;
  }

  private calculateIndustryAdjustment(
    industry: string,
    industryMultipliers: Record<string, number> = {}
  ): number {
    const industryKey = industry.toLowerCase();

    // Use tenant-specific industry multipliers from configuration
    const multiplier = industryMultipliers[industryKey];

    // Return configured multiplier or default to 1.0 (no adjustment)
    return multiplier !== undefined ? multiplier : 1.0;
  }

  private calculateConfidence(factors: any): number {
    // Simple confidence calculation based on factor agreement
    const contributions = Object.values(factors).map(
      (f: any) => f.contribution
    );
    const mean =
      contributions.reduce((sum, val) => sum + val, 0) / contributions.length;
    const variance =
      contributions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      contributions.length;
    const stdDev = Math.sqrt(variance);

    // Higher confidence when factors agree (low standard deviation)
    return Math.max(0.1, Math.min(1.0, 1 - stdDev / mean));
  }

  private buildReasoning(
    factors: any,
    industryAdjustment: number,
    originalScore: number,
    enhancedScore: number
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Original score: ${originalScore}`);

    if (factors.sentimentScore.contribution > 0.1) {
      reasoning.push(
        `Strong positive sentiment (+${(factors.sentimentScore.contribution * 100).toFixed(1)} points)`
      );
    }

    if (factors.timingScore.contribution > 0.1) {
      reasoning.push(
        `Fast response time (+${(factors.timingScore.contribution * 100).toFixed(1)} points)`
      );
    }

    if (factors.frequencyScore.contribution > 0.1) {
      reasoning.push(
        `High engagement frequency (+${(factors.frequencyScore.contribution * 100).toFixed(1)} points)`
      );
    }

    if (Math.abs(industryAdjustment - 1.0) > 0.01) {
      const direction = industryAdjustment > 1.0 ? 'boosted' : 'reduced';
      const percent = (Math.abs(industryAdjustment - 1.0) * 100).toFixed(1);
      reasoning.push(`Industry adjustment: score ${direction} by ${percent}%`);
    }

    reasoning.push(
      `Final enhanced score: ${enhancedScore.toFixed(1)} (adjustment: ${(enhancedScore - originalScore).toFixed(1)})`
    );

    return reasoning;
  }

  private async getScoringConfig(tenantId: string): Promise<any> {
    try {
      // Create tenant context - use system tenant as fallback
      const tenantContext = { tenantId, environment: 'prod' as const };

      // Load configuration with tenant isolation
      const config = await this.configLoader.loadConfig(
        'neuronx-config',
        tenantContext
      );

      if (!config) {
        this.logger.warn(
          `No configuration found for tenant ${tenantId}, using defaults`,
          {
            tenantId,
            operation: 'scoring_config_fallback',
          }
        );
        return this.getDefaultScoringConfig();
      }

      // Extract scoring configuration from loaded config
      const scoringConfig = config.domains.scoring;

      // Validate configuration has required fields
      if (!scoringConfig.weights || typeof scoringConfig.weights !== 'object') {
        this.logger.warn(
          `Invalid scoring configuration for tenant ${tenantId}, using defaults`,
          {
            tenantId,
            operation: 'scoring_config_validation_failed',
            missingField: 'weights',
          }
        );
        return this.getDefaultScoringConfig();
      }

      // Convert configuration weights from percentages (0-100) to decimal weights (0-1)
      // Normalize weights to ensure they sum to 1.0
      const rawWeights = scoringConfig.weights;
      const totalWeight =
        rawWeights.sentiment +
        rawWeights.responseTime +
        rawWeights.frequency +
        rawWeights.industry +
        rawWeights.customFields;

      if (totalWeight === 0) {
        this.logger.warn(
          `Zero total weights in scoring configuration for tenant ${tenantId}, using defaults`,
          {
            tenantId,
            operation: 'scoring_config_zero_weights',
          }
        );
        return this.getDefaultScoringConfig();
      }

      // Build tenant-specific configuration
      return {
        enhancedWeights: {
          baseScore: 0.4, // Base score weight is fixed in algorithm, not configurable
          sentimentScore: rawWeights.sentiment / totalWeight,
          timingScore: rawWeights.responseTime / totalWeight,
          frequencyScore: rawWeights.frequency / totalWeight,
          industryAdjustment: 1.0, // Will be computed from industry multipliers
        },
        industryMultipliers: scoringConfig.industryMultipliers || {},
        qualificationThreshold: scoringConfig.qualificationThreshold || 0.7,
        model: scoringConfig.model || 'advanced',
      };
    } catch (error) {
      this.logger.error(
        `Failed to load scoring configuration for tenant ${tenantId}`,
        {
          tenantId,
          error: error.message,
          operation: 'scoring_config_load_error',
        }
      );

      // Return safe defaults on any configuration loading failure
      return this.getDefaultScoringConfig();
    }
  }

  /**
   * Generate deterministic hash of scoring configuration for cache versioning
   */
  private getConfigHash(config: any): string {
    // Create a deterministic string from relevant config parts
    const configString = JSON.stringify(
      {
        enhancedWeights: config.enhancedWeights,
        industryMultipliers: config.industryMultipliers,
        // Add other config parts that affect scoring
      },
      Object.keys(config).sort()
    );

    return require('crypto')
      .createHash('md5')
      .update(configString)
      .digest('hex')
      .substring(0, 8);
  }

  private getDefaultScoringConfig(): any {
    return {
      enhancedWeights: {
        baseScore: 0.4,
        sentimentScore: 0.25,
        timingScore: 0.15,
        frequencyScore: 0.15,
        industryAdjustment: 1.0,
      },
      industryMultipliers: {
        technology: 1.1,
        healthcare: 1.05,
        finance: 1.08,
        retail: 0.95,
        manufacturing: 0.98,
      },
      qualificationThreshold: 0.7,
      model: 'advanced',
    };
  }
}
