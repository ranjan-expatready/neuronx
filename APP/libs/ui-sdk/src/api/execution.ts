/**
 * Execution API Client - WI-061: UI Infrastructure & Governance Layer
 *
 * Typed client for execution planning and approval endpoints.
 */

import { ExecutionPlan, ActionResult, ApiResponse } from '../types';
import { httpClient } from '../http/client';
import { getTenantId } from '../auth/principal';
import { CorrelationContext } from '../http/correlation';

/**
 * Execution API Client
 * Provides typed access to execution planning and approval endpoints
 */
export class ExecutionApiClient {
  /**
   * Plan execution for an opportunity
   */
  async planExecution(
    opportunityId: string,
    executionCommand: any,
    decisionResult: any,
    context?: {
      dealValue?: number;
      riskScore?: number;
      slaUrgency?: 'low' | 'normal' | 'high' | 'urgent';
      retryCount?: number;
      evidenceSoFar?: string[];
    },
    correlationId?: string
  ): Promise<ExecutionPlan> {
    const tenantId = await getTenantId();
    const requestCorrelationId = correlationId || CorrelationContext.get();

    const response: ApiResponse<ExecutionPlan> = await httpClient.post(
      '/execution/plan',
      {
        opportunityId,
        executionCommand,
        decisionResult,
        context,
        correlationId: requestCorrelationId,
      },
      {
        correlationId: requestCorrelationId,
        tenantId,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to plan execution');
    }

    return response.data;
  }

  /**
   * Approve execution plan
   */
  async approveExecution(
    planId: string,
    notes?: string,
    correlationId?: string
  ): Promise<ActionResult> {
    const tenantId = await getTenantId();
    const requestCorrelationId = correlationId || CorrelationContext.get();

    const response: ApiResponse<ActionResult> = await httpClient.post(
      `/execution/approve/${planId}`,
      {
        notes,
        correlationId: requestCorrelationId,
      },
      {
        correlationId: requestCorrelationId,
        tenantId,
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to approve execution');
    }

    return (
      response.data || {
        success: true,
        correlationId: response.correlationId!,
        auditId: `audit_approve_${planId}`,
      }
    );
  }

  /**
   * Execute approved plan with token
   */
  async executeToken(
    tokenId: string,
    correlationId?: string
  ): Promise<ActionResult> {
    const tenantId = await getTenantId();
    const requestCorrelationId = correlationId || CorrelationContext.get();

    const response: ApiResponse<ActionResult> = await httpClient.post(
      `/execution/execute/${tokenId}`,
      {
        correlationId: requestCorrelationId,
      },
      {
        correlationId: requestCorrelationId,
        tenantId,
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to execute token');
    }

    return (
      response.data || {
        success: true,
        correlationId: response.correlationId!,
        auditId: `audit_execute_${tokenId}`,
      }
    );
  }
}

/**
 * Default execution API client instance
 */
export const executionApiClient = new ExecutionApiClient();
