/**
 * Billing Factor Builder - WI-052: Decision Explainability Engine
 *
 * Builds billing factors for decision explanations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { BillingFactor } from '../explanation-types';
import { ExtractedFactors } from '../factors/factor-extractor';

@Injectable()
export class BillingFactorBuilder {
  private readonly logger = new Logger(BillingFactorBuilder.name);

  /**
   * Build billing factors from extracted factors
   */
  async buildBillingFactors(
    factors: ExtractedFactors
  ): Promise<BillingFactor[]> {
    const billingFactors: BillingFactor[] = [];

    try {
      if (factors.billingState) {
        billingFactors.push(...this.buildBillingStateFactors(factors));
      } else {
        this.logger.warn('Billing state not available for factor building');
        // Add unknown billing factor
        billingFactors.push(this.buildUnknownBillingFactor());
      }

      this.logger.debug('Built billing factors', {
        count: billingFactors.length,
      });
    } catch (error) {
      this.logger.error('Failed to build billing factors', {
        error: error.message,
      });
      billingFactors.push(this.buildErrorBillingFactor(error));
    }

    return billingFactors;
  }

  /**
   * Build billing state factors
   */
  private buildBillingStateFactors(factors: ExtractedFactors): BillingFactor[] {
    const factors_: BillingFactor[] = [];

    // Example billing factors
    // In a real implementation, this would check actual billing state

    factors_.push({
      planTier: 'PRO',
      billingStatus: 'ACTIVE',
      quotaChecked: 'monthly_voice_minutes',
      remaining: 150,
      allowed: true,
      reason: 'Voice minutes quota available',
    });

    factors_.push({
      planTier: 'PRO',
      billingStatus: 'ACTIVE',
      quotaChecked: 'monthly_executions',
      remaining: 25,
      allowed: true,
      reason: 'Execution quota available',
    });

    return factors_;
  }

  /**
   * Build unknown billing factor
   */
  private buildUnknownBillingFactor(): BillingFactor {
    return {
      planTier: 'UNKNOWN',
      billingStatus: 'ACTIVE',
      quotaChecked: 'billing_verification',
      allowed: true,
      reason: 'Billing state could not be determined',
    };
  }

  /**
   * Build error billing factor
   */
  private buildErrorBillingFactor(error: any): BillingFactor {
    return {
      planTier: 'ERROR',
      billingStatus: 'BLOCKED',
      quotaChecked: 'billing_check',
      allowed: false,
      reason: `Billing check failed: ${error.message}`,
    };
  }
}
