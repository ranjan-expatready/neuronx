import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '../eventing';
import { ConfigService } from '@nestjs/config';
import { CipherService } from '../cipher/cipher.service';
import { CipherService } from '../cipher/cipher.service';

export interface LeadQualificationResult {
  qualified: boolean;
  score: number;
  reasons: string[];
  threshold: number;
}

export interface QualificationConfig {
  threshold: number;
  rules: {
    requireEmail: boolean;
    requirePhone: boolean;
    industryPriority: Record<string, number>;
    companySizeMin: number;
  };
}

@Injectable()
export class QualificationService {
  private readonly logger = new Logger(QualificationService.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly configService: ConfigService,
    private readonly cipherService: CipherService
  ) {}

  async qualifyLead(
    tenantId: string,
    leadId: string,
    leadData: {
      email?: string;
      phone?: string;
      industry?: string;
      companySize?: number;
      score: number;
    },
    correlationId: string
  ): Promise<LeadQualificationResult> {
    this.logger.log(`Qualifying lead ${leadId} for tenant ${tenantId}`, {
      correlationId,
    });

    // Cipher checkpoint: Check before qualification
    const cipherDecision = await this.cipherService.checkDecision({
      tenantId,
      correlationId,
      operation: 'lead_qualification',
      data: {
        leadId,
        score: leadData.score,
        industry: leadData.industry,
        companySize: leadData.companySize,
        email: leadData.email,
        phone: leadData.phone,
      },
    });

    if (!cipherDecision.allowed && this.cipherService.isEnabled()) {
      this.logger.warn(`Cipher denied qualification for lead ${leadId}`, {
        tenantId,
        leadId,
        correlationId,
        cipherReason: cipherDecision.reason,
        cipherDecision: cipherDecision.decision,
      });

      // In enforce mode, block qualification
      if (cipherDecision.decision === 'deny') {
        return {
          qualified: false,
          score: leadData.score,
          reasons: [`Cipher blocked qualification: ${cipherDecision.reason}`],
          threshold: 0, // Not applicable
        };
      }
    }

    const config = this.getQualificationConfig(tenantId);
    const reasons: string[] = [];

    // Check basic requirements
    if (config.rules.requireEmail && !leadData.email) {
      reasons.push('Email required but missing');
    }

    if (config.rules.requirePhone && !leadData.phone) {
      reasons.push('Phone required but missing');
    }

    if (
      leadData.companySize &&
      leadData.companySize < config.rules.companySizeMin
    ) {
      reasons.push(
        `Company size ${leadData.companySize} below minimum ${config.rules.companySizeMin}`
      );
    }

    // Apply industry priority multiplier
    let adjustedScore = leadData.score;
    if (leadData.industry && config.rules.industryPriority[leadData.industry]) {
      const multiplier = config.rules.industryPriority[leadData.industry];
      adjustedScore = Math.min(100, adjustedScore * multiplier);
      reasons.push(
        `Industry ${leadData.industry} priority applied (${multiplier}x)`
      );
    }

    const qualified = adjustedScore >= config.threshold;

    const result: LeadQualificationResult = {
      qualified,
      score: adjustedScore,
      reasons,
      threshold: config.threshold,
    };

    this.logger.log(
      `Lead ${leadId} qualification result: ${qualified ? 'QUALIFIED' : 'NOT QUALIFIED'}`,
      {
        tenantId,
        leadId,
        score: adjustedScore,
        threshold: config.threshold,
        reasons,
        correlationId,
      }
    );

    // Emit qualification event
    await this.eventBus.publish({
      type: 'sales.lead.qualified',
      tenantId,
      correlationId,
      timestamp: new Date(),
      payload: {
        leadId,
        qualified,
        score: adjustedScore,
        threshold: config.threshold,
        reasons,
      },
    });

    return result;
  }

  private getQualificationConfig(tenantId: string): QualificationConfig {
    // In a real implementation, this would fetch from the control plane
    // For now, return sensible defaults
    return {
      threshold: this.configService.get('QUALIFICATION_THRESHOLD', 70),
      rules: {
        requireEmail: this.configService.get(
          'QUALIFICATION_REQUIRE_EMAIL',
          true
        ),
        requirePhone: this.configService.get(
          'QUALIFICATION_REQUIRE_PHONE',
          false
        ),
        industryPriority: {
          technology: 1.2,
          healthcare: 1.1,
          finance: 1.1,
        },
        companySizeMin: this.configService.get(
          'QUALIFICATION_COMPANY_SIZE_MIN',
          10
        ),
      },
    };
  }
}
