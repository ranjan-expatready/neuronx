/**
 * Action Dispatch SDK - WI-061: UI Infrastructure & Governance Layer
 *
 * Enforces explain→authorize→execute sequencing. NO business logic in UI.
 * All actions are attributable, authorized, explainable, auditable.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  ExecutionCommand,
  DecisionResult,
  ExecutionPlan,
  ActionResult,
  ActionErrorCode,
  UiSdkError,
  SkillTier,
} from '../types';
import { httpClient } from '../http/client';
import { CorrelationContext } from '../http/correlation';
import { getTenantId } from '../auth/principal';
import { requireSkillTier } from '../governance/surface-gates';

/**
 * Action Dispatcher
 * Enforces governance for all UI-initiated actions
 */
export class ActionDispatcher {
  private static instance: ActionDispatcher;
  private activePlans: Map<string, ExecutionPlan> = new Map();

  static getInstance(): ActionDispatcher {
    if (!ActionDispatcher.instance) {
      ActionDispatcher.instance = new ActionDispatcher();
    }
    return ActionDispatcher.instance;
  }

  /**
   * EXPLAIN: Get explanation for a decision or plan
   * First step in action dispatch - user must see why something happened
   */
  async explainDecision(decisionId: string): Promise<any> {
    const correlationId = CorrelationContext.get();
    const tenantId = await getTenantId();

    try {
      // TODO: Call explainability endpoint when available
      // For now, return mock explanation
      const explanation = {
        decisionId,
        explanation: `Decision ${decisionId} was made based on policy evaluation`,
        policyReferences: ['decision-policy.yaml'],
        evidence: [],
        correlationId,
      };

      return explanation;
    } catch (error) {
      throw new UiSdkError(
        `Failed to explain decision: ${(error as Error).message}`,
        'EXPLANATION_FAILED',
        correlationId
      );
    }
  }

  /**
   * PLAN: Create execution plan for a command + decision combination
   * Second step - creates auditable plan that may require approval
   */
  async planExecution(
    opportunityId: string,
    command: ExecutionCommand,
    decision: DecisionResult,
    context?: {
      dealValue?: number;
      riskScore?: number;
      slaUrgency?: 'low' | 'normal' | 'high' | 'urgent';
      retryCount?: number;
      evidenceSoFar?: string[];
    }
  ): Promise<ExecutionPlan> {
    const correlationId = CorrelationContext.get();
    const tenantId = await getTenantId();

    try {
      const response = await httpClient.post<ExecutionPlan>(
        '/execution/plan',
        {
          opportunityId,
          executionCommand: command,
          decisionResult: decision,
          context,
          correlationId,
        },
        {
          correlationId,
          tenantId,
        }
      );

      if (!response.success || !response.data) {
        throw new UiSdkError(
          response.error || 'Failed to plan execution',
          'PLAN_EXECUTION_FAILED',
          response.correlationId
        );
      }

      const plan = response.data;
      this.activePlans.set(plan.planId, plan);

      return plan;
    } catch (error) {
      throw this.handleActionError(
        error,
        'PLAN_EXECUTION_FAILED',
        correlationId
      );
    }
  }

  /**
   * APPROVE: Approve execution plan (if required)
   * Third step - principal attribution required for audit trail
   */
  async approveExecution(
    planId: string,
    notes?: string
  ): Promise<ActionResult> {
    const correlationId = CorrelationContext.get();
    const tenantId = await getTenantId();

    try {
      // Check if plan exists and is valid
      const plan = this.activePlans.get(planId);
      if (!plan) {
        throw new UiSdkError(
          `Plan not found: ${planId}`,
          'PLAN_NOT_FOUND',
          correlationId
        );
      }

      // Check if approval is required
      if (!plan.requiresApproval) {
        throw new UiSdkError(
          `Plan ${planId} does not require approval`,
          'APPROVAL_NOT_REQUIRED',
          correlationId
        );
      }

      // Check skill tier for approval authority
      await requireSkillTier(SkillTier.L3); // L3+ can approve

      const response = await httpClient.post<ActionResult>(
        `/execution/approve/${planId}`,
        {
          notes,
          correlationId,
        },
        {
          correlationId,
          tenantId,
        }
      );

      if (!response.success) {
        throw new UiSdkError(
          response.error || 'Failed to approve execution',
          'APPROVAL_FAILED',
          response.correlationId
        );
      }

      return (
        response.data || {
          success: true,
          correlationId: response.correlationId!,
          auditId: `audit_${planId}`,
        }
      );
    } catch (error) {
      throw this.handleActionError(error, 'APPROVAL_FAILED', correlationId);
    }
  }

  /**
   * EXECUTE: Execute approved plan with token
   * Final step - cannot bypass previous steps
   */
  async executeToken(tokenId: string): Promise<ActionResult> {
    const correlationId = CorrelationContext.get();
    const tenantId = await getTenantId();

    try {
      const response = await httpClient.post<ActionResult>(
        `/execution/execute/${tokenId}`,
        {
          correlationId,
        },
        {
          correlationId,
          tenantId,
        }
      );

      if (!response.success) {
        throw new UiSdkError(
          response.error || 'Failed to execute token',
          'EXECUTION_FAILED',
          response.correlationId
        );
      }

      return (
        response.data || {
          success: true,
          correlationId: response.correlationId!,
          auditId: `audit_${tokenId}`,
        }
      );
    } catch (error) {
      throw this.handleActionError(error, 'EXECUTION_FAILED', correlationId);
    }
  }

  /**
   * REQUEST OVERRIDE: Request override for blocked action (L4 only)
   */
  async requestOverride(
    actionType: string,
    reason: string,
    justification: string,
    context: any
  ): Promise<ActionResult> {
    const correlationId = CorrelationContext.get();
    const tenantId = await getTenantId();

    try {
      // Require L4 for overrides
      await requireSkillTier(SkillTier.L4);

      const response = await httpClient.post<ActionResult>(
        '/overrides/request',
        {
          actionType,
          reason,
          justification,
          context,
          correlationId,
        },
        {
          correlationId,
          tenantId,
        }
      );

      if (!response.success) {
        throw new UiSdkError(
          response.error || 'Failed to request override',
          'OVERRIDE_REQUEST_FAILED',
          response.correlationId
        );
      }

      return (
        response.data || {
          success: true,
          correlationId: response.correlationId!,
        }
      );
    } catch (error) {
      throw this.handleActionError(
        error,
        'OVERRIDE_REQUEST_FAILED',
        correlationId
      );
    }
  }

  /**
   * Validate action before dispatch (pre-flight check)
   */
  async validateAction(
    opportunityId: string,
    command: ExecutionCommand,
    decision: DecisionResult
  ): Promise<{
    canExecute: boolean;
    requiresApproval: boolean;
    blockingReasons?: string[];
  }> {
    const correlationId = CorrelationContext.get();
    const tenantId = await getTenantId();

    try {
      // TODO: Call validation endpoint when available
      // For now, return mock validation
      return {
        canExecute: true,
        requiresApproval: command.commandType.includes('high_value'),
        blockingReasons: [],
      };
    } catch (error) {
      console.warn('Action validation failed, assuming blocked', {
        correlationId,
        error: (error as Error).message,
      });
      return {
        canExecute: false,
        requiresApproval: false,
        blockingReasons: ['Validation service unavailable'],
      };
    }
  }

  /**
   * Clean up completed plans
   */
  cleanupPlan(planId: string): void {
    this.activePlans.delete(planId);
  }

  /**
   * Handle action errors with proper typing and codes
   */
  private handleActionError(
    error: any,
    defaultCode: string,
    correlationId: string
  ): UiSdkError {
    if (error instanceof UiSdkError) {
      return error;
    }

    // Map common errors to action error codes
    let errorCode = defaultCode;
    const message = error.message || 'Unknown error';

    if (message.includes('403') || message.includes('Forbidden')) {
      errorCode = ActionErrorCode.FORBIDDEN;
    } else if (message.includes('401') || message.includes('Unauthorized')) {
      errorCode = ActionErrorCode.UNAUTHORIZED;
    } else if (message.includes('billing')) {
      errorCode = ActionErrorCode.BILLING_BLOCKED;
    } else if (message.includes('policy') || message.includes('blocked')) {
      errorCode = ActionErrorCode.BLOCKED_BY_POLICY;
    } else if (message.includes('scope')) {
      errorCode = ActionErrorCode.SCOPE_BLOCKED;
    } else if (message.includes('drift')) {
      errorCode = ActionErrorCode.DRIFT_BLOCKED;
    }

    return new UiSdkError(message, errorCode, correlationId);
  }
}

/**
 * Default action dispatcher instance
 */
export const actionDispatcher = ActionDispatcher.getInstance();

/**
 * Convenience functions for action dispatch
 */
export const explainDecision = (decisionId: string) =>
  actionDispatcher.explainDecision(decisionId);
export const planExecution = (
  opportunityId: string,
  command: ExecutionCommand,
  decision: DecisionResult,
  context?: any
) => actionDispatcher.planExecution(opportunityId, command, decision, context);
export const approveExecution = (planId: string, notes?: string) =>
  actionDispatcher.approveExecution(planId, notes);
export const executeToken = (tokenId: string) =>
  actionDispatcher.executeToken(tokenId);
export const requestOverride = (
  actionType: string,
  reason: string,
  justification: string,
  context: any
) =>
  actionDispatcher.requestOverride(actionType, reason, justification, context);
export const validateAction = (
  opportunityId: string,
  command: ExecutionCommand,
  decision: DecisionResult
) => actionDispatcher.validateAction(opportunityId, command, decision);
