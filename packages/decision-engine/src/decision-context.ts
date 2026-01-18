/**
 * Decision Context Builder - WI-029: Decision Engine & Actor Orchestration
 *
 * Builds and validates DecisionContext objects with fail-safe defaults.
 */

import { DecisionContext, ExecutionCommand } from './types';

export interface DecisionContextBuilder {
  /**
   * Build a complete decision context from partial inputs
   */
  buildContext(partial: PartialDecisionContext): DecisionContext;

  /**
   * Validate that a decision context has all required fields
   */
  validateContext(context: DecisionContext): {
    valid: boolean;
    errors: string[];
  };
}

export interface PartialDecisionContext {
  tenantId?: string;
  opportunityId?: string;
  stageId?: string;
  executionCommand?: ExecutionCommand;
  dealValue?: number;
  customerRiskScore?: number;
  slaUrgency?: 'low' | 'normal' | 'high' | 'critical';
  retryCount?: number;
  evidenceSoFar?: string[];
  playbookVersion?: string;
  correlationId?: string;
  requestedAt?: Date;
}

export class DecisionContextBuilderImpl implements DecisionContextBuilder {
  buildContext(partial: PartialDecisionContext): DecisionContext {
    // Validate required fields
    const errors = this.validatePartialContext(partial);
    if (errors.length > 0) {
      throw new Error(`Invalid decision context: ${errors.join(', ')}`);
    }

    // Build with defaults for optional fields
    return {
      tenantId: partial.tenantId!,
      opportunityId: partial.opportunityId!,
      stageId: partial.stageId!,
      executionCommand: partial.executionCommand!,
      dealValue: partial.dealValue ?? 0,
      customerRiskScore: partial.customerRiskScore ?? 0.5, // Neutral risk
      slaUrgency: partial.slaUrgency ?? 'normal',
      retryCount: partial.retryCount ?? 0,
      evidenceSoFar: partial.evidenceSoFar ?? [],
      playbookVersion: partial.playbookVersion ?? '1.0.0',
      correlationId:
        partial.correlationId ??
        `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requestedAt: partial.requestedAt ?? new Date(),
    };
  }

  validateContext(context: DecisionContext): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!context.tenantId || typeof context.tenantId !== 'string') {
      errors.push('tenantId is required and must be a string');
    }

    if (!context.opportunityId || typeof context.opportunityId !== 'string') {
      errors.push('opportunityId is required and must be a string');
    }

    if (!context.stageId || typeof context.stageId !== 'string') {
      errors.push('stageId is required and must be a string');
    }

    if (!context.executionCommand) {
      errors.push('executionCommand is required');
    } else {
      // Validate execution command structure
      if (!context.executionCommand.commandType) {
        errors.push('executionCommand.commandType is required');
      }
      if (!context.executionCommand.tenantId) {
        errors.push('executionCommand.tenantId is required');
      }
      if (!context.executionCommand.opportunityId) {
        errors.push('executionCommand.opportunityId is required');
      }
    }

    if (
      context.dealValue !== undefined &&
      (typeof context.dealValue !== 'number' || context.dealValue < 0)
    ) {
      errors.push('dealValue must be a non-negative number');
    }

    if (
      context.customerRiskScore !== undefined &&
      (typeof context.customerRiskScore !== 'number' ||
        context.customerRiskScore < 0 ||
        context.customerRiskScore > 1)
    ) {
      errors.push('customerRiskScore must be a number between 0.0 and 1.0');
    }

    if (
      context.retryCount !== undefined &&
      (typeof context.retryCount !== 'number' || context.retryCount < 0)
    ) {
      errors.push('retryCount must be a non-negative number');
    }

    if (!['low', 'normal', 'high', 'critical'].includes(context.slaUrgency)) {
      errors.push('slaUrgency must be one of: low, normal, high, critical');
    }

    if (!Array.isArray(context.evidenceSoFar)) {
      errors.push('evidenceSoFar must be an array');
    }

    if (!context.correlationId || typeof context.correlationId !== 'string') {
      errors.push('correlationId is required and must be a string');
    }

    if (
      !(context.requestedAt instanceof Date) ||
      isNaN(context.requestedAt.getTime())
    ) {
      errors.push('requestedAt must be a valid Date');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validatePartialContext(partial: PartialDecisionContext): string[] {
    const errors: string[] = [];

    if (!partial.tenantId) {
      errors.push('tenantId is required');
    }

    if (!partial.opportunityId) {
      errors.push('opportunityId is required');
    }

    if (!partial.stageId) {
      errors.push('stageId is required');
    }

    if (!partial.executionCommand) {
      errors.push('executionCommand is required');
    }

    return errors;
  }
}
