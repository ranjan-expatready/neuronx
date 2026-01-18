import {
  ReadinessReport,
  ReadinessEvaluationContext,
  ReadinessDomain,
  DomainEvaluator,
  ReadinessStatus,
  OverallReadiness,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_SCORING_THRESHOLDS,
  ReadinessEngineConfig,
} from './readiness.types';
import { SystemHealthEvaluator } from './evaluators/systemHealth.eval';
import { GovernanceEvaluator } from './evaluators/governance.eval';
import { GhlTrustEvaluator } from './evaluators/ghlTrust.eval';
import { VoiceRiskEvaluator } from './evaluators/voiceRisk.eval';
import { BillingRevenueEvaluator } from './evaluators/billing.eval';

/**
 * Production Readiness Engine
 * Orchestrates domain evaluators to provide comprehensive tenant readiness assessment
 */
export class ReadinessEngine {
  private readonly evaluators: Map<ReadinessDomain, DomainEvaluator>;
  private readonly config: ReadinessEngineConfig;
  // private readonly prismaClient: any; // TODO: Import proper Prisma type - will be used when evaluators implement DB queries

  constructor(
    _prismaClient: any, // TODO: Import proper Prisma type - will be used when evaluators implement DB queries
    config?: Partial<ReadinessEngineConfig>
  ) {
    this.config = {
      evaluationTimeoutMs: 30000, // 30 seconds
      enableDetailedSignals: true,
      scoringWeights: DEFAULT_SCORING_WEIGHTS,
      scoringThresholds: DEFAULT_SCORING_THRESHOLDS,
      ...config,
    };

    // Initialize domain evaluators
    this.evaluators = new Map();
    this.initializeEvaluators(_prismaClient);
  }

  /**
   * Generate comprehensive readiness report for a tenant
   */
  async generateReadinessReport(
    tenantId: string,
    includeDetails: boolean = true,
    correlationId?: string
  ): Promise<ReadinessReport> {
    const evaluationContext: ReadinessEvaluationContext = {
      tenantId,
      correlationId: correlationId || this.generateCorrelationId(),
      evaluationStartTime: new Date(),
      includeDetails,
    };

    const generatedAt = new Date();

    // Evaluate all domains in parallel
    const evaluationPromises = Array.from(this.evaluators.entries()).map(
      async ([domain, evaluator]) => {
        try {
          return await this.evaluateDomainWithTimeout(
            evaluator,
            evaluationContext
          );
        } catch (error) {
          // Return degraded domain status on evaluation failure
          return this.createErrorDomainStatus(domain, error as Error);
        }
      }
    );

    const domainResults = await Promise.all(evaluationPromises);

    // Organize results by domain
    const domains = domainResults.reduce((acc, result) => {
      acc[result.domain] = result.status;
      return acc;
    }, {} as any);

    // Calculate overall readiness
    const overall = this.calculateOverallReadiness(domains);

    const report: ReadinessReport = {
      tenantId,
      correlationId: evaluationContext.correlationId,
      generatedAt,
      overall,
      domains,
      evidence: {
        linksOrPaths: this.generateEvidenceLinks(
          tenantId,
          evaluationContext.correlationId
        ),
      },
    };

    return report;
  }

  /**
   * Get specific domain status
   */
  async getDomainStatus(
    tenantId: string,
    domain: ReadinessDomain,
    correlationId?: string
  ): Promise<any> {
    const evaluator = this.evaluators.get(domain);
    if (!evaluator) {
      throw new Error(`Unknown domain: ${domain}`);
    }

    const context: ReadinessEvaluationContext = {
      tenantId,
      correlationId: correlationId || this.generateCorrelationId(),
      evaluationStartTime: new Date(),
      includeDetails: true,
    };

    const status = await evaluator.evaluate(context);
    return { ...status, domain };
  }

  private initializeEvaluators(prismaClient: any): void {
    // Initialize all domain evaluators
    this.evaluators.set(
      ReadinessDomain.SYSTEM_HEALTH,
      new SystemHealthEvaluator(prismaClient)
    );

    this.evaluators.set(
      ReadinessDomain.GOVERNANCE,
      new GovernanceEvaluator(prismaClient)
    );

    this.evaluators.set(
      ReadinessDomain.GHL_TRUST,
      new GhlTrustEvaluator(prismaClient)
    );

    this.evaluators.set(
      ReadinessDomain.VOICE_RISK,
      new VoiceRiskEvaluator(prismaClient)
    );

    this.evaluators.set(
      ReadinessDomain.BILLING_REVENUE,
      new BillingRevenueEvaluator(prismaClient)
    );
  }

  private async evaluateDomainWithTimeout(
    evaluator: DomainEvaluator,
    context: ReadinessEvaluationContext
  ): Promise<{ domain: ReadinessDomain; status: any }> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Evaluation timeout')),
        this.config.evaluationTimeoutMs
      );
    });

    const evaluationPromise = evaluator.evaluate(context);

    try {
      const status = await Promise.race([evaluationPromise, timeoutPromise]);
      return { domain: evaluator.domain, status };
    } catch (error) {
      return {
        domain: evaluator.domain,
        status: this.createErrorDomainStatus(evaluator.domain, error as Error),
      };
    }
  }

  private createErrorDomainStatus(domain: ReadinessDomain, error: Error): any {
    return {
      domain,
      status: ReadinessStatus.UNKNOWN,
      summary: `Evaluation failed: ${error.message}`,
      signals: [],
      actionableNextSteps: [
        {
          title: `${domain} evaluation error`,
          action: `Investigate and resolve: ${error.message}`,
          ownerRole: 'ENGINEERING',
          estimatedMins: 30,
          priority: 'HIGH' as const,
        },
      ],
      lastEvaluated: new Date(),
      evaluationDurationMs: 0,
    };
  }

  private calculateOverallReadiness(domains: any): OverallReadiness {
    const domainStatuses = Object.values(domains) as any[];
    const blockingReasons: string[] = [];

    // Check for BLOCKED domains
    const blockedDomains = domainStatuses.filter(
      d => d.status === ReadinessStatus.BLOCKED
    );
    if (blockedDomains.length > 0) {
      blockedDomains.forEach(domain => {
        blockingReasons.push(`${domain.domain}: ${domain.summary}`);
      });

      return {
        status: ReadinessStatus.BLOCKED,
        summary: `${blockedDomains.length} domain(s) blocked`,
        blockingReasons,
        lastEvaluated: new Date(),
      };
    }

    // Calculate weighted score if enabled
    let overallScore: number | undefined;
    if (this.config.scoringWeights && this.config.scoringThresholds) {
      overallScore = this.calculateWeightedScore(domains);
    }

    // Determine overall status
    const unknownDomains = domainStatuses.filter(
      d => d.status === ReadinessStatus.UNKNOWN
    );
    const warnDomains = domainStatuses.filter(
      d => d.status === ReadinessStatus.WARN
    );

    let overallStatus: ReadinessStatus;
    let summary: string;

    if (unknownDomains.length > 0) {
      overallStatus = ReadinessStatus.UNKNOWN;
      summary = `${unknownDomains.length} domain(s) have unknown status`;
    } else if (warnDomains.length > 0) {
      overallStatus = ReadinessStatus.WARN;
      summary = `${warnDomains.length} domain(s) have warnings`;
    } else {
      overallStatus = ReadinessStatus.READY;
      summary = 'All domains ready for production';
    }

    // Override with score-based status if available
    if (overallScore !== undefined && this.config.scoringThresholds) {
      if (overallScore >= this.config.scoringThresholds.readyMinScore) {
        overallStatus = ReadinessStatus.READY;
      } else if (overallScore >= this.config.scoringThresholds.warnMinScore) {
        overallStatus = ReadinessStatus.WARN;
      } else {
        overallStatus = ReadinessStatus.BLOCKED;
        blockingReasons.push(
          `Overall score ${overallScore} below minimum threshold`
        );
      }
    }

    return {
      status: overallStatus,
      summary,
      score: overallScore,
      blockingReasons,
      lastEvaluated: new Date(),
    };
  }

  private calculateWeightedScore(domains: any): number {
    if (!this.config.scoringWeights) return 0;

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(domains).forEach(([domain, status]: [string, any]) => {
      const weight =
        this.config.scoringWeights![domain as ReadinessDomain] || 0;
      const domainScore =
        status.domainScore || this.statusToScore(status.status);

      totalScore += domainScore * weight;
      totalWeight += weight;
    });

    return totalWeight > 0
      ? Math.round((totalScore / totalWeight) * 100) / 100
      : 0;
  }

  private statusToScore(status: ReadinessStatus): number {
    switch (status) {
      case ReadinessStatus.READY:
        return 100;
      case ReadinessStatus.WARN:
        return 75;
      case ReadinessStatus.BLOCKED:
        return 25;
      case ReadinessStatus.UNKNOWN:
        return 50;
      default:
        return 0;
    }
  }

  private generateCorrelationId(): string {
    return `readiness-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEvidenceLinks(
    tenantId: string,
    correlationId: string
  ): string[] {
    return [
      `docs/EVIDENCE/production-readiness/${new Date().toISOString().split('T')[0]}-wi-054/README.md`,
      `audit:readiness_report_generated:${tenantId}:${correlationId}`,
      `policies:active_versions:${tenantId}`,
      `snapshots:latest:${tenantId}`,
    ];
  }
}
