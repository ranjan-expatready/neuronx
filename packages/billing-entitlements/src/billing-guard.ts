/**
 * Billing Guard - WI-040: Billing & Entitlements Authority
 * WI-044: Billing Plan & Limit Configuration
 *
 * Guards execution by checking entitlements before allowing operations.
 * All usage estimation and limits now driven by policy configuration.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EntitlementEvaluator } from './entitlement-evaluator';
import { UsageAggregator } from './usage-aggregator';
import { BillingDecision, UsageType, BillingGuardContext } from './types';
import { BillingPolicyResolver } from './policy/billing-policy.resolver';

@Injectable()
export class BillingGuard {
  private readonly logger = new Logger(BillingGuard.name);

  constructor(
    private readonly evaluator: EntitlementEvaluator,
    private readonly aggregator: UsageAggregator,
    private readonly policyResolver: BillingPolicyResolver
  ) {}

  /**
   * Check billing entitlement for execution context
   */
  async checkExecutionEntitlement(
    context: BillingGuardContext
  ): Promise<BillingDecision> {
    const { tenantId, executionCommand, decisionResult, correlationId } =
      context;

    this.logger.debug(`Checking billing entitlement for execution`, {
      tenantId,
      commandType: executionCommand.commandType,
      correlationId,
    });

    try {
      // Determine usage type and quantity from execution command
      const { usageType, quantity } = this.extractUsageFromCommand(
        executionCommand,
        decisionResult
      );

      // Check entitlement
      const decision = await this.evaluator.checkEntitlement({
        tenantId,
        usageType,
        quantity,
        correlationId,
      });

      this.logger.log(
        `Billing decision: ${decision.allowed ? 'ALLOWED' : 'DENIED'}`,
        {
          tenantId,
          usageType,
          quantity,
          reason: decision.reason,
          remainingQuota: decision.remainingQuota,
          correlationId,
        }
      );

      // If allowed, record the usage intent (will be committed on actual execution)
      if (decision.allowed) {
        await this.recordUsageIntent(
          tenantId,
          usageType,
          quantity,
          correlationId
        );
      }

      return decision;
    } catch (error) {
      this.logger.error(`Billing check failed: ${error.message}`, {
        tenantId,
        correlationId,
        error: error.stack,
      });

      // Fail closed on errors
      return {
        allowed: false,
        reason: `Billing system error: ${error.message}`,
        enforcementMode: this.evaluator['enforcementMode'],
      };
    }
  }

  /**
   * Record actual usage after successful execution
   */
  async recordExecutionUsage(
    tenantId: string,
    executionCommand: any,
    decisionResult: any,
    correlationId: string
  ): Promise<void> {
    try {
      const { usageType, quantity } = this.extractUsageFromCommand(
        executionCommand,
        decisionResult
      );

      // Record the actual usage
      await this.aggregator.recordUsage({
        eventId: `exec_${correlationId}`,
        tenantId,
        type: usageType,
        quantity,
        correlationId,
        metadata: {
          commandType: executionCommand.commandType,
          channel: executionCommand.channel,
          voiceMode: decisionResult?.voiceMode,
          actor: decisionResult?.actor,
        },
        occurredAt: new Date(),
      });

      this.logger.debug(`Recorded execution usage`, {
        tenantId,
        usageType,
        quantity,
        correlationId,
      });
    } catch (error) {
      this.logger.error(`Failed to record execution usage: ${error.message}`, {
        tenantId,
        correlationId,
        error: error.stack,
      });
      // Don't throw - usage recording failure shouldn't break execution
    }
  }

  /**
   * Extract usage type and quantity from execution command (policy-driven)
   */
  private extractUsageFromCommand(
    executionCommand: any,
    decisionResult: any
  ): { usageType: UsageType; quantity: number } {
    const channel = executionCommand.channel;

    // Policy-driven: Get usage type mapping for this channel
    const usageMapping = this.policyResolver.getUsageTypeMapping(channel);

    if (!usageMapping) {
      // Fallback for unmapped channels
      this.logger.warn(
        `No usage mapping found for channel: ${channel}, defaulting to EXECUTION`
      );
      return { usageType: UsageType.EXECUTION, quantity: 1 };
    }

    if (channel === 'voice') {
      // Policy-driven: Voice usage is measured in minutes, estimated by voice mode
      const voiceMode = decisionResult?.voiceMode || 'SCRIPTED';
      const estimatedMinutes =
        this.policyResolver.getVoiceMinuteEstimate(voiceMode);
      return { usageType: UsageType.VOICE_MINUTE, quantity: estimatedMinutes };
    } else {
      // Policy-driven: Non-voice channels use fixed quantity from mapping
      return {
        usageType: usageMapping.usageType,
        quantity: usageMapping.quantity,
      };
    }
  }

  /**
   * Record usage intent (for pre-execution checks)
   */
  private async recordUsageIntent(
    tenantId: string,
    usageType: UsageType,
    quantity: number,
    correlationId: string
  ): Promise<void> {
    // For now, we don't pre-record intent
    // Future: Could implement reservation system to prevent race conditions
    this.logger.debug(`Usage intent recorded`, {
      tenantId,
      usageType,
      quantity,
      correlationId,
    });
  }

  /**
   * Get usage summary for tenant
   */
  async getUsageSummary(tenantId: string, period?: string) {
    return this.aggregator.getUsageSummary({ tenantId, period });
  }

  /**
   * Get usage events for auditing
   */
  async getUsageEvents(
    tenantId: string,
    type?: UsageType,
    limit?: number,
    offset?: number
  ) {
    return this.aggregator.getUsageEvents(tenantId, type, limit, offset);
  }
}
