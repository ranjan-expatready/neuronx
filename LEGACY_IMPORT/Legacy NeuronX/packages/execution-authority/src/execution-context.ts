/**
 * Execution Context - WI-034: Multi-Channel Execution Authority
 *
 * Helper for building execution contexts from various sources.
 */

import { ExecutionContext } from './types';

/**
 * Execution context builder
 */
export class ExecutionContextBuilder {
  private context: Partial<ExecutionContext> = {};

  withTenantId(tenantId: string): this {
    this.context.tenantId = tenantId;
    return this;
  }

  withOpportunityId(opportunityId: string): this {
    this.context.opportunityId = opportunityId;
    return this;
  }

  withExecutionCommand(command: any): this {
    this.context.executionCommand = command;
    return this;
  }

  withDecisionResult(result: any): this {
    this.context.decisionResult = result;
    return this;
  }

  withCurrentStage(stage: any): this {
    this.context.currentStage = stage;
    return this;
  }

  withDealValue(value: number): this {
    this.context.dealValue = value;
    return this;
  }

  withRiskScore(score: number): this {
    this.context.riskScore = score;
    return this;
  }

  withSlaUrgency(urgency: 'low' | 'normal' | 'high' | 'urgent'): this {
    this.context.slaUrgency = urgency;
    return this;
  }

  withRetryCount(count: number): this {
    this.context.retryCount = count;
    return this;
  }

  withEvidenceSoFar(evidence: string[]): this {
    this.context.evidenceSoFar = evidence;
    return this;
  }

  withCorrelationId(id: string): this {
    this.context.correlationId = id;
    return this;
  }

  build(): ExecutionContext {
    if (
      !this.context.tenantId ||
      !this.context.opportunityId ||
      !this.context.executionCommand ||
      !this.context.decisionResult ||
      !this.context.correlationId
    ) {
      throw new Error('Missing required fields for ExecutionContext');
    }

    return this.context as ExecutionContext;
  }

  static fromExisting(
    context: Partial<ExecutionContext>
  ): ExecutionContextBuilder {
    const builder = new ExecutionContextBuilder();
    builder.context = { ...context };
    return builder;
  }
}
