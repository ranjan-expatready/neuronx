import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CipherService } from '../cipher/cipher.service';
import { ConfigLoader } from '../config/config.loader';
import {
  TenantContext,
  createSystemTenantContext,
} from '../config/tenant-context';

export interface TeamProfile {
  teamId: string;
  name: string;
  industryExpertise: string[];
  performanceScore: number; // 0-1
  currentLoad: number; // Current number of active leads
  capacityLimit: number; // Maximum concurrent leads
  regions: string[]; // Geographic regions served
  averageResponseTime: number; // Average response time in minutes
}

export interface LeadProfile {
  leadId: string;
  score: number;
  industry: string;
  region: string;
  urgency: 'low' | 'medium' | 'high';
  preferredLanguage?: string;
}

export interface RoutingRecommendation {
  recommendedTeam: TeamProfile;
  confidence: number; // 0-1
  reasoning: string[];
  alternatives: Array<{
    team: TeamProfile;
    score: number;
    reason: string;
  }>;
  factors: {
    scoreMatch: { value: number; weight: number; contribution: number };
    industryMatch: { value: number; weight: number; contribution: number };
    performanceMatch: { value: number; weight: number; contribution: number };
    capacityMatch: { value: number; weight: number; contribution: number };
    geographicMatch: { value: number; weight: number; contribution: number };
  };
  cipherDecision?: any;
}

@Injectable()
export class PredictiveRoutingService {
  private readonly logger = new Logger(PredictiveRoutingService.name);

  // Base team definitions (algorithmic structure - not configurable)
  private readonly baseTeams: Omit<TeamProfile, 'capacityLimit'>[] = [
    {
      teamId: 'team-enterprise',
      name: 'Enterprise Solutions',
      industryExpertise: ['technology', 'healthcare', 'finance'],
      performanceScore: 0.92,
      currentLoad: 8,
      regions: ['north-america', 'europe'],
      averageResponseTime: 15,
    },
    {
      teamId: 'team-startup',
      name: 'Startup Specialists',
      industryExpertise: ['technology', 'retail', 'media'],
      performanceScore: 0.88,
      currentLoad: 12,
      regions: ['north-america', 'asia-pacific'],
      averageResponseTime: 25,
    },
    {
      teamId: 'team-global',
      name: 'Global Accounts',
      industryExpertise: ['manufacturing', 'energy', 'finance'],
      performanceScore: 0.95,
      currentLoad: 5,
      regions: ['europe', 'asia-pacific', 'latin-america'],
      averageResponseTime: 20,
    },
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly cipherService: CipherService,
    private readonly configLoader: ConfigLoader
  ) {}

  async predictOptimalRouting(
    tenantId: string,
    leadProfile: LeadProfile,
    correlationId: string
  ): Promise<RoutingRecommendation> {
    const startTime = Date.now();
    this.logger.log(
      `Predicting optimal routing for lead ${leadProfile.leadId}`,
      {
        tenantId,
        leadScore: leadProfile.score,
        leadIndustry: leadProfile.industry,
        leadRegion: leadProfile.region,
        correlationId,
      }
    );

    // Get configuration and teams with tenant-specific capacities
    const config = await this.getRoutingConfig(tenantId);
    const teams = this.getTeamsWithCapacities(config);

    // Calculate routing scores for all eligible teams
    const teamScores = teams
      .filter(team => this.isTeamEligible(team, leadProfile))
      .map(team => ({
        team,
        score: this.calculateTeamScore(team, leadProfile, config),
        factors: this.calculateTeamFactors(team, leadProfile, config),
      }))
      .sort((a, b) => b.score - a.score);

    if (teamScores.length === 0) {
      throw new Error(`No eligible teams found for lead ${leadProfile.leadId}`);
    }

    // Build recommendation
    const bestTeam = teamScores[0];
    const alternatives = teamScores.slice(1, 4).map(item => ({
      team: item.team,
      score: item.score,
      reason: this.generateAlternativeReason(
        item.team,
        item.score,
        bestTeam.score
      ),
    }));

    const confidence = this.calculateConfidence(bestTeam.score, teamScores);
    const reasoning = this.buildReasoning(
      bestTeam.team,
      bestTeam.factors,
      leadProfile
    );

    const recommendation: RoutingRecommendation = {
      recommendedTeam: bestTeam.team,
      confidence,
      reasoning,
      alternatives,
      factors: bestTeam.factors,
    };

    // Cipher checkpoint for routing decision
    if (this.cipherService.isEnabled()) {
      const cipherDecision = await this.cipherService.checkDecision({
        tenantId,
        correlationId,
        operation: 'predictive_routing',
        data: {
          leadId: leadProfile.leadId,
          recommendedTeamId: bestTeam.team.teamId,
          confidence,
          factors: recommendation.factors,
        },
      });

      recommendation.cipherDecision = cipherDecision;

      this.logger.log(
        `Cipher decision for routing: ${cipherDecision.decision}`,
        {
          tenantId,
          leadId: leadProfile.leadId,
          recommendedTeam: bestTeam.team.teamId,
          correlationId,
          cipherReason: cipherDecision.reason,
        }
      );
    }

    const processingTime = Date.now() - startTime;
    this.logger.log(
      `Routing prediction completed for lead ${leadProfile.leadId}`,
      {
        tenantId,
        recommendedTeam: bestTeam.team.teamId,
        confidence,
        alternativesCount: alternatives.length,
        correlationId,
        processingTimeMs: processingTime,
      }
    );

    // Performance profiling log
    this.logger.log(`PERF: Predictive routing performance`, {
      operation: 'predictive_routing',
      tenantId,
      leadId: leadProfile.leadId,
      correlationId,
      processingTimeMs: processingTime,
      leadScore: leadProfile.score,
      recommendedTeam: bestTeam.team.teamId,
      confidence,
      alternativesCount: alternatives.length,
      timestamp: new Date().toISOString(),
    });

    return recommendation;
  }

  private isTeamEligible(team: TeamProfile, lead: LeadProfile): boolean {
    // Check capacity
    if (team.currentLoad >= team.capacityLimit) {
      return false;
    }

    // Check region
    if (!team.regions.includes(lead.region)) {
      return false;
    }

    // Check industry expertise (at least one match preferred, but allow others)
    const hasIndustryMatch = team.industryExpertise.includes(
      lead.industry.toLowerCase()
    );
    if (!hasIndustryMatch && team.industryExpertise.length > 0) {
      // Allow teams without specific expertise for low-priority leads
      return lead.score < 60;
    }

    return true;
  }

  private calculateTeamScore(
    team: TeamProfile,
    lead: LeadProfile,
    config: any
  ): number {
    const factors = this.calculateTeamFactors(team, lead, config);

    return (
      factors.scoreMatch.contribution +
      factors.industryMatch.contribution +
      factors.performanceMatch.contribution +
      factors.capacityMatch.contribution +
      factors.geographicMatch.contribution
    );
  }

  private calculateTeamFactors(
    team: TeamProfile,
    lead: LeadProfile,
    config: any
  ) {
    // Lead score match (higher lead score prefers higher-performing teams)
    const scoreMatch = Math.min(lead.score / 100, 1.0);

    // Industry expertise match
    const industryMatch = team.industryExpertise.includes(
      lead.industry.toLowerCase()
    )
      ? 1.0
      : 0.3;

    // Performance match (higher performing teams get higher scores)
    const performanceMatch = team.performanceScore;

    // Capacity match (prefer less loaded teams)
    const capacityRatio = team.currentLoad / team.capacityLimit;
    const capacityMatch = 1.0 - capacityRatio; // Less loaded = higher score

    // Geographic match (exact region match)
    const geographicMatch = team.regions.includes(lead.region) ? 1.0 : 0.0;

    return {
      scoreMatch: {
        value: scoreMatch,
        weight: config.predictionWeights.leadScore,
        contribution: scoreMatch * config.predictionWeights.leadScore,
      },
      industryMatch: {
        value: industryMatch,
        weight: config.predictionWeights.industryMatch,
        contribution: industryMatch * config.predictionWeights.industryMatch,
      },
      performanceMatch: {
        value: performanceMatch,
        weight: config.predictionWeights.performanceHistory,
        contribution:
          performanceMatch * config.predictionWeights.performanceHistory,
      },
      capacityMatch: {
        value: capacityMatch,
        weight: config.predictionWeights.capacityLoad,
        contribution: capacityMatch * config.predictionWeights.capacityLoad,
      },
      geographicMatch: {
        value: geographicMatch,
        weight: config.predictionWeights.geographicMatch,
        contribution:
          geographicMatch * config.predictionWeights.geographicMatch,
      },
    };
  }

  private calculateConfidence(bestScore: number, allScores: any[]): number {
    if (allScores.length < 2) return 0.8; // High confidence with limited options

    const scores = allScores.map(s => s.score);
    const best = scores[0];
    const secondBest = scores[1];

    // Confidence based on gap between best and second best
    const gap = best - secondBest;
    return Math.min(1.0, Math.max(0.1, gap / 0.2)); // Scale gap to confidence
  }

  private generateAlternativeReason(
    team: TeamProfile,
    score: number,
    bestScore: number
  ): string {
    const gap = bestScore - score;
    if (gap < 0.1) {
      return 'Very close match, could be suitable alternative';
    } else if (gap < 0.2) {
      return 'Good alternative with slightly lower overall fit';
    } else {
      return 'Viable backup option if primary team unavailable';
    }
  }

  private buildReasoning(
    team: TeamProfile,
    factors: any,
    lead: LeadProfile
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Recommended team: ${team.name} (${team.teamId})`);

    if (factors.industryMatch.value > 0.5) {
      reasoning.push(`Strong industry expertise in ${lead.industry}`);
    }

    if (factors.performanceMatch.value > 0.9) {
      reasoning.push(
        `High-performing team (${(factors.performanceMatch.value * 100).toFixed(1)}% success rate)`
      );
    }

    if (factors.capacityMatch.value > 0.7) {
      const loadPercentage = (
        (team.currentLoad / team.capacityLimit) *
        100
      ).toFixed(1);
      reasoning.push(`Good capacity availability (${loadPercentage}% loaded)`);
    }

    if (factors.geographicMatch.value > 0.9) {
      reasoning.push(`Perfect geographic match for ${lead.region}`);
    }

    const loadStatus =
      team.currentLoad >= team.capacityLimit * 0.8 ? 'high' : 'normal';
    reasoning.push(
      `Current load: ${team.currentLoad}/${team.capacityLimit} (${loadStatus})`
    );

    return reasoning;
  }

  /**
   * Get teams with tenant-specific capacity configurations
   */
  private getTeamsWithCapacities(config: any): TeamProfile[] {
    return this.baseTeams.map(baseTeam => {
      // Get tenant-configured capacity for this team, fallback to defaults
      const tenantCapacity = config.teamCapacities?.[baseTeam.teamId];
      const capacityLimit =
        tenantCapacity?.maxConcurrent ||
        this.getDefaultCapacity(baseTeam.teamId);

      return {
        ...baseTeam,
        capacityLimit,
      };
    });
  }

  /**
   * Get default capacity for a team
   */
  private getDefaultCapacity(teamId: string): number {
    const defaults: Record<string, number> = {
      'team-enterprise': 15,
      'team-startup': 20,
      'team-global': 10,
    };
    return defaults[teamId] || 10;
  }

  /**
   * Get routing configuration with tenant isolation
   */
  private async getRoutingConfig(tenantId: string): Promise<any> {
    try {
      // Create tenant context - use system tenant as fallback
      const tenantContext = { tenantId, environment: 'prod' as const };

      // Load configuration with tenant isolation
      const config = await this.configLoader.loadConfig(
        'neuronx-config',
        tenantContext
      );

      if (!config) {
        return this.getDefaultRoutingConfig();
      }

      // Extract routing configuration from loaded config
      const routingConfig = config.domains.routing;

      // Build tenant-specific routing configuration
      return {
        geographicPreferences: routingConfig.geographicPreferences || {},
        algorithm: routingConfig.algorithm || 'capacity-based',
        teamCapacities: routingConfig.teamCapacities || {},
        thresholds: routingConfig.thresholds || {
          highLoadPercentage: 80,
          lowLoadPercentage: 20,
          rebalanceIntervalMinutes: 30,
        },
        // For predictive routing, we also need weights (derived from algorithm selection)
        predictionWeights: this.getPredictionWeights(
          routingConfig.algorithm || 'capacity-based'
        ),
      };
    } catch (error) {
      this.logger.warn(
        `Failed to load routing configuration for tenant ${tenantId}, using defaults`,
        {
          tenantId,
          error: error.message,
          operation: 'routing_config_load_error',
        }
      );

      // Return safe defaults on any configuration loading failure
      return this.getDefaultRoutingConfig();
    }
  }

  /**
   * Get prediction weights based on algorithm selection
   */
  private getPredictionWeights(algorithm: string): any {
    // Different algorithms emphasize different factors
    const weightPresets: Record<string, any> = {
      'capacity-based': {
        leadScore: 0.2,
        industryMatch: 0.2,
        performanceHistory: 0.15,
        capacityLoad: 0.3, // Higher weight on capacity
        geographicMatch: 0.15,
      },
      'expertise-first': {
        leadScore: 0.25,
        industryMatch: 0.35, // Higher weight on expertise
        performanceHistory: 0.15,
        capacityLoad: 0.1,
        geographicMatch: 0.15,
      },
      geographic: {
        leadScore: 0.2,
        industryMatch: 0.15,
        performanceHistory: 0.15,
        capacityLoad: 0.15,
        geographicMatch: 0.35, // Higher weight on geography
      },
      'round-robin': {
        leadScore: 0.25,
        industryMatch: 0.2,
        performanceHistory: 0.2,
        capacityLoad: 0.2,
        geographicMatch: 0.15,
      },
    };

    return weightPresets[algorithm] || weightPresets['capacity-based'];
  }

  /**
   * Get default routing configuration
   */
  private getDefaultRoutingConfig(): any {
    return {
      geographicPreferences: {
        'asia-pacific': ['team-global'],
        europe: ['team-global'],
        'north-america': ['team-enterprise', 'team-startup'],
        'latin-america': ['team-global'],
      },
      algorithm: 'capacity-based',
      teamCapacities: {},
      thresholds: {
        highLoadPercentage: 80,
        lowLoadPercentage: 20,
        rebalanceIntervalMinutes: 30,
      },
      predictionWeights: this.getPredictionWeights('capacity-based'),
    };
  }
}
