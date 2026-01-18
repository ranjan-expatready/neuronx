import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface CipherDecision {
  allowed: boolean;
  decision: 'allow' | 'deny' | 'suggest';
  reason: string;
  suggestions?: any[];
  confidence?: number;
  metadata: {
    checkpoint: string;
    policyVersion: string;
    processingTimeMs: number;
  };
}

export interface CipherContext {
  tenantId: string;
  correlationId: string;
  operation: string;
  data: Record<string, any>;
}

export interface CipherPolicy {
  enabled: boolean;
  mode: 'monitor' | 'enforce' | 'disabled';
  version?: string;
  checkpoints: Record<string, any>;
  decisionRules: Record<string, any>;
}

@Injectable()
export class CipherService {
  private readonly logger = new Logger(CipherService.name);
  private policy: CipherPolicy = {
    enabled: false,
    mode: 'disabled',
    checkpoints: {},
    decisionRules: {},
  };

  constructor(private readonly _configService: ConfigService) {
    this.loadPolicy();
  }

  async checkDecision(context: CipherContext): Promise<CipherDecision> {
    const startTime = Date.now();

    // Check environment variable override
    const envEnabled = process.env.CIPHER_ENABLED !== 'false';
    if (!envEnabled) {
      return this.createDecision(
        true,
        'allow',
        'Cipher disabled via environment variable',
        {
          checkpoint: context.operation,
          policyVersion: this.policy.version || 'unknown',
          processingTimeMs: Date.now() - startTime,
        }
      );
    }

    const checkpoint = this.getCheckpointForOperation(context.operation);

    if (!this.policy.enabled || !checkpoint?.enabled) {
      return this.createDecision(
        true,
        'allow',
        'Cipher disabled or checkpoint not configured',
        {
          checkpoint: context.operation,
          policyVersion: this.policy.version || 'unknown',
          processingTimeMs: Date.now() - startTime,
        }
      );
    }

    try {
      // Evaluate decision rules
      const decision = await this.evaluateRules(context, checkpoint);

      // Log decision (always in monitor mode, conditionally in enforce mode)
      this.logDecision(context, decision);

      return decision;
    } catch (error: any) {
      this.logger.error(
        `Cipher decision failed for operation ${context.operation}`,
        {
          error: error.message,
          tenantId: context.tenantId,
          correlationId: context.correlationId,
        }
      );

      // Fail-safe: allow operation but log the failure
      return this.createDecision(
        true,
        'allow',
        `Cipher evaluation failed: ${error.message}`,
        {
          checkpoint: context.operation,
          policyVersion: this.policy.version || 'unknown',
          processingTimeMs: Date.now() - startTime,
        }
      );
    }
  }

  private async evaluateRules(
    context: CipherContext,
    _checkpoint: any
  ): Promise<CipherDecision> {
    // Score anomaly detection
    if (context.data.score !== undefined) {
      const anomalyResult = this.checkScoreAnomaly(
        context.data.score,
        context.tenantId
      );
      if (anomalyResult.flagged) {
        return this.createDecision(
          false,
          'suggest',
          'Score anomaly detected',
          {
            checkpoint: context.operation,
            policyVersion: this.policy.version || 'unknown',
            processingTimeMs: 0,
          },
          [anomalyResult.suggestion]
        );
      }
    }

    // Industry risk assessment
    if (context.data.industry) {
      const riskResult = this.checkIndustryRisk(context.data.industry);
      if (riskResult.requiresReview) {
        return this.createDecision(
          false,
          'deny',
          'Industry requires additional review',
          {
            checkpoint: context.operation,
            policyVersion: this.policy.version || 'unknown',
            processingTimeMs: 0,
          }
        );
      }
    }

    // Company size validation
    if (context.data.companySize) {
      const sizeResult = this.checkCompanySize(context.data.companySize);
      if (sizeResult.isOutlier) {
        return this.createDecision(
          false,
          'suggest',
          'Company size appears unusual',
          {
            checkpoint: context.operation,
            policyVersion: this.policy.version || 'unknown',
            processingTimeMs: 0,
          },
          [sizeResult.suggestion]
        );
      }
    }

    // Default: allow
    return this.createDecision(true, 'allow', 'All checks passed', {
      checkpoint: context.operation,
      policyVersion: this.policy.version || 'unknown',
      processingTimeMs: 0,
    });
  }

  private checkScoreAnomaly(
    score: number,
    _tenantId: string
  ): { flagged: boolean; suggestion?: any } {
    // Simplified anomaly detection - in real implementation, would use statistical analysis
    if (score > 95 || score < 5) {
      return {
        flagged: true,
        suggestion: { type: 'review_required', reason: 'Extreme score value' },
      };
    }
    return { flagged: false };
  }

  private checkIndustryRisk(industry: string): { requiresReview: boolean } {
    const highRiskIndustries = [
      'cryptocurrency',
      'gambling',
      'pharmaceuticals',
    ];
    return {
      requiresReview: highRiskIndustries.includes(industry.toLowerCase()),
    };
  }

  private checkCompanySize(size: number): {
    isOutlier: boolean;
    suggestion?: any;
  } {
    if (size > 100000 || size < 1) {
      return {
        isOutlier: true,
        suggestion: {
          type: 'data_validation_required',
          reason: 'Unusual company size',
        },
      };
    }
    return { isOutlier: false };
  }

  private getCheckpointForOperation(operation: string): any {
    return (
      this.policy.checkpoints?.[operation] ||
      this.policy.checkpoints?.[operation.replace('sales.', '')]
    );
  }

  private createDecision(
    allowed: boolean,
    decision: 'allow' | 'deny' | 'suggest',
    reason: string,
    metadata: any,
    suggestions?: any[]
  ): CipherDecision {
    return {
      allowed,
      decision,
      reason,
      suggestions,
      confidence: 0.95, // Placeholder confidence score
      metadata,
    };
  }

  private logDecision(context: CipherContext, decision: CipherDecision): void {
    // Remove sensitive data from logging
    const safeContext = { ...context };
    delete safeContext.data.passwords;
    delete safeContext.data.tokens;
    delete safeContext.data.secrets;

    this.logger.log(`Cipher decision: ${decision.decision}`, {
      operation: context.operation,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
      allowed: decision.allowed,
      reason: decision.reason,
      confidence: decision.confidence,
      processingTimeMs: decision.metadata.processingTimeMs,
    });
  }

  private loadPolicy(): void {
    try {
      const policyPath = path.join(
        process.cwd(),
        'config',
        'cipher_policy.json'
      );
      const policyData = fs.readFileSync(policyPath, 'utf8');
      this.policy = JSON.parse(policyData);
      this.logger.log(
        `Cipher policy loaded: v${this.policy.version || 'unknown'}`
      );
    } catch (error: any) {
      this.logger.error(`Failed to load Cipher policy: ${error.message}`);
      // Default disabled policy
      this.policy = {
        enabled: false,
        mode: 'disabled',
        checkpoints: {},
        decisionRules: {},
      };
    }
  }

  // Method to reload policy (for runtime updates)
  reloadPolicy(): void {
    this.loadPolicy();
  }

  // Method to check if Cipher is enabled
  isEnabled(): boolean {
    const envEnabled = process.env.CIPHER_ENABLED !== 'false';
    return envEnabled && this.policy.enabled && this.policy.mode !== 'disabled';
  }

  // Method to get current policy status
  getStatus(): { enabled: boolean; mode: string; version: string } {
    return {
      enabled: this.policy.enabled,
      mode: this.policy.mode,
      version: this.policy.version || 'unknown',
    };
  }
}