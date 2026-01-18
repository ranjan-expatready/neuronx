/**
 * Execution Service - WI-034: Multi-Channel Execution Authority
 *
 * Orchestrates execution planning, token management, and adapter execution.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  NeuronXExecutionAuthority,
  ExecutionContext,
  ExecutionPlan,
} from '@neuronx/execution-authority';
import {
  ExecutionTokenRepository,
  IdempotencyRecordRepository,
} from './execution.repository';
import { IdempotencyHandler } from '@neuronx/execution-authority';
import { AuditService } from '../audit/audit.service';
import { TenantContext } from '../config/tenant-context';
import { OrgAuthorityService } from '../org-authority/org-authority.service';
import { ActionType, RiskLevel, ActionContext } from '@neuronx/org-authority';
import { Principal } from '../authz/principal';
import { BillingGuard } from '@neuronx/billing-entitlements';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  private readonly executionAuthority: NeuronXExecutionAuthority;
  private readonly idempotencyHandler: IdempotencyHandler;

  constructor(
    private readonly tokenRepository: ExecutionTokenRepository,
    private readonly idempotencyRepository: IdempotencyRecordRepository,
    private readonly auditService: AuditService,
    private readonly tenantContext: TenantContext,
    private readonly orgAuthorityService: OrgAuthorityService,
    private readonly prisma: PrismaClient,
    private readonly billingGuard: BillingGuard
  ) {
    this.executionAuthority = new NeuronXExecutionAuthority(
      this.tokenRepository
    );
    this.idempotencyHandler = new IdempotencyHandler(
      this.idempotencyRepository
    );
  }

  /**
   * Plan execution for a command
   */
  async planExecution(context: ExecutionContext): Promise<ExecutionPlan> {
    // Load opportunity data for team binding validation
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: context.opportunityId },
      select: {
        id: true,
        tenantId: true,
        teamId: true,
        agencyId: true,
        value: true,
        stage: true,
      },
    });

    if (!opportunity) {
      throw new Error(`Opportunity ${context.opportunityId} not found`);
    }

    // Enrich context with opportunity data
    const enrichedContext: ExecutionContext = {
      ...context,
      currentStage: opportunity.stage as any, // TODO: Fix type mapping
      dealValue: opportunity.value || 0,
    };

    const plan = await this.executionAuthority.planExecution(enrichedContext);

    // WI-040: Check billing entitlement BEFORE allowing execution
    if (plan.allowed) {
      const billingDecision = await this.billingGuard.checkExecutionEntitlement(
        {
          tenantId: context.tenantId,
          executionCommand: context.executionCommand,
          decisionResult: context.decisionResult,
          correlationId: context.correlationId,
        }
      );

      // If billing blocks execution, override the plan
      if (!billingDecision.allowed) {
        this.logger.warn(
          `Execution blocked by billing: ${billingDecision.reason}`,
          {
            tenantId: context.tenantId,
            correlationId: context.correlationId,
            remainingQuota: billingDecision.remainingQuota,
            enforcementMode: billingDecision.enforcementMode,
          }
        );

        // Return blocked plan
        return {
          ...plan,
          allowed: false,
          reason: `Billing: ${billingDecision.reason}`,
          riskAssessment: {
            ...plan.riskAssessment,
            factors: [
              ...(plan.riskAssessment.factors || []),
              `Billing: ${billingDecision.reason}`,
            ],
          },
        };
      }

      this.logger.debug(`Execution allowed by billing`, {
        tenantId: context.tenantId,
        correlationId: context.correlationId,
        remainingQuota: billingDecision.remainingQuota,
      });
    }

    // Audit the planning decision (including billing outcome)
    await this.auditService.logEvent({
      eventType: 'execution_planned',
      tenantId: context.tenantId,
      userId: 'system',
      resourceId: context.opportunityId,
      resourceType: 'opportunity',
      action: 'execution_planned',
      details: {
        allowed: plan.allowed,
        reason: plan.reason,
        channel: plan.channel,
        actor: plan.actor,
        mode: plan.mode,
        riskLevel: plan.riskAssessment.level,
        teamId: opportunity.teamId,
        correlationId: context.correlationId,
        billingChecked: true,
      },
    });

    return plan;
  }

  /**
   * Approve execution and issue token
   */
  /**
   * Check if this is the tenant's first execution
   */
  private async isTenantFirstExecution(tenantId: string): Promise<boolean> {
    // Check for any completed executions for this tenant
    const completedExecution = await this.auditService.findEvents({
      tenantId,
      eventType: 'execution_completed',
      limit: 1,
    });

    return completedExecution.length === 0;
  }

  async approveExecution(
    principal: Principal,
    planId: string,
    notes: string,
    correlationId: string,
    riskLevel?: RiskLevel,
    dealValue?: number
  ) {
    // Load opportunity to check team scope
    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: planId },
      select: {
        id: true,
        tenantId: true,
        teamId: true,
        agencyId: true,
        value: true,
        stage: true,
        externalId: true,
      },
    });

    if (!opportunity) {
      throw new Error(`Opportunity ${planId} not found`);
    }

    // FIRST EXECUTION SAFETY: Check if this is the tenant's first execution
    const isFirstExecution = await this.isTenantFirstExecution(
      opportunity.tenantId
    );

    // For first executions, enforce additional safety measures
    if (isFirstExecution) {
      this.logger.log(`🎯 FIRST EXECUTION for tenant ${opportunity.tenantId}`, {
        opportunityId: planId,
        correlationId,
      });

      // First executions must be LOW risk
      const executionRiskLevel = riskLevel || RiskLevel.LOW;
      if (executionRiskLevel !== RiskLevel.LOW) {
        throw new Error(
          'First execution must be LOW risk. Please use a low-value test opportunity.'
        );
      }

      // First executions require explicit approval notes
      if (!notes || notes.trim().length < 10) {
        throw new Error(
          'First execution requires detailed approval notes explaining the test scenario.'
        );
      }

      // First executions must be approved by enterprise admin
      const authorityContext =
        await this.orgAuthorityService.getAuthorityContext(principal);
      const hasEnterpriseAdmin = authorityContext.roleAssignments.some(
        ra => ra.role === 'ENTERPRISE_ADMIN' && ra.scopeType === 'enterprise'
      );

      if (!hasEnterpriseAdmin) {
        throw new Error(
          'First execution must be approved by an Enterprise Admin.'
        );
      }
    }

    // Check team scope if opportunity has team binding
    if (opportunity.teamId) {
      await this.orgAuthorityService.assertCanActOnTeam(
        await this.orgAuthorityService.getAuthorityContext(principal),
        opportunity.teamId
      );
    } else {
      // Unassigned opportunities can only be viewed, not approved
      throw new Error(
        `Opportunity ${planId} is not assigned to a team and cannot be approved`
      );
    }

    // Check org authority for approval action
    const actionContext: ActionContext = {
      actionType: ActionType.APPROVE,
      riskLevel: riskLevel || RiskLevel.MEDIUM,
      dealValue: dealValue || opportunity.value || 0,
      opportunityId: planId,
    };

    const approvalRequirement =
      this.orgAuthorityService.getApprovalRequirement(actionContext);

    if (approvalRequirement.required) {
      // Check if approver has required capabilities
      await this.orgAuthorityService.requireCapability(
        principal,
        approvalRequirement.requiredCapabilities[0]
      );
    }

    // For now, assume planId is actually a plan object passed from client
    // TODO: Implement plan storage and retrieval

    const mockPlan: ExecutionPlan = {
      allowed: true,
      reason: 'Approved by operator',
      actor: 'HUMAN',
      mode: 'AUTONOMOUS',
      channel: 'voice',
      adapterCommand: {
        commandId: `cmd_${Date.now()}`,
        commandType: 'EXECUTE_CONTACT',
        channelData: {},
      },
      constraints: {},
      correlationId,
      auditReason: `Approved by ${approvedBy}: ${notes}`,
      riskAssessment: {
        level: riskLevel || 'medium',
        score:
          riskLevel === RiskLevel.CRITICAL
            ? 90
            : riskLevel === RiskLevel.HIGH
              ? 75
              : 50,
        factors: [],
        mitigationStrategies: [],
      },
    };

    const token = await this.executionAuthority.issueToken(
      mockPlan,
      approvedBy
    );

    // Audit the approval
    await this.auditService.logEvent({
      eventType: 'execution_approved',
      tenantId: this.tenantContext.tenantId,
      userId: approvedBy,
      resourceId: planId,
      resourceType: 'execution_plan',
      action: 'execution_approved',
      details: {
        tokenId: token.tokenId,
        notes,
        correlationId,
      },
    });

    return { token };
  }

  /**
   * Execute command using token
   */
  async executeCommand(
    tokenId: string,
    idempotencyKey: string,
    principal: Principal,
    correlationId: string
  ) {
    const tenantId = this.tenantContext.tenantId;

    // Check idempotency
    const idempotencyCheck = await this.idempotencyHandler.checkIdempotency(
      idempotencyKey,
      '/api/execution/execute',
      tenantId
    );

    if (idempotencyCheck.isDuplicate) {
      this.logger.log(
        `Idempotent execution detected for key ${idempotencyKey}`,
        {
          correlationId,
          tenantId,
          tokenId,
        }
      );
      return idempotencyCheck.record!.response;
    }

    try {
      // Verify token
      const tokenVerification = await this.executionAuthority.verifyToken(
        tokenId,
        {
          channel: 'voice', // TODO: Get from token
          commandType: 'EXECUTE_CONTACT', // TODO: Get from token
        }
      );

      if (!tokenVerification.canUse) {
        throw new Error(
          `Token verification failed: ${tokenVerification.reason}`
        );
      }

      // Additional scope check: verify executor can act on the opportunity's team
      if (tokenVerification.token?.opportunityId) {
        const opportunity = await this.prisma.opportunity.findUnique({
          where: { id: tokenVerification.token.opportunityId },
          select: { teamId: true },
        });

        if (opportunity?.teamId) {
          await this.orgAuthorityService.assertCanActOnTeam(
            await this.orgAuthorityService.getAuthorityContext(principal),
            opportunity.teamId
          );
        }
      }

      // Mark token as used
      await this.executionAuthority.markTokenUsed(tokenId, principal.userId);

      // Execute via adapter
      // TODO: Route to appropriate adapter based on token channel
      const receipt = {
        receiptId: `receipt_${Date.now()}`,
        status: 'success',
        externalRef: 'CA123456', // Mock external reference
        correlationId,
      };

      // WI-040: Record actual usage after successful execution
      if (receipt.status === 'success') {
        await this.billingGuard.recordExecutionUsage(
          tenantId,
          { commandType: 'EXECUTE_CONTACT', channel: 'voice' }, // TODO: Get from token
          { voiceMode: 'SCRIPTED', actor: 'AI' }, // TODO: Get from token
          correlationId
        );
      }

      // Store idempotency result
      await this.idempotencyHandler.storeResult(
        idempotencyKey,
        '/api/execution/execute',
        tenantId,
        receipt,
        200
      );

      // Check if this is the tenant's first execution for audit purposes
      const isFirstExecution = await this.isTenantFirstExecution(tenantId);

      // Audit the execution
      await this.auditService.logEvent({
        eventType: 'execution_completed',
        tenantId,
        userId: principal.userId,
        resourceId: tokenId,
        resourceType: 'execution_token',
        action: 'execution_completed',
        details: {
          status: receipt.status,
          externalRef: receipt.externalRef,
          correlationId,
          firstExecution: isFirstExecution,
          executedBy: {
            userId: principal.userId,
            displayName: principal.displayName,
            authType: principal.authType,
          },
        },
      });

      if (isFirstExecution) {
        this.logger.log(`🎉 FIRST EXECUTION COMPLETED for tenant ${tenantId}`, {
          tokenId,
          correlationId,
          executedBy: principal.userId,
        });
      }

      return receipt;
    } catch (error) {
      // Store failed result for idempotency
      await this.idempotencyHandler.storeResult(
        idempotencyKey,
        '/api/execution/execute',
        tenantId,
        { error: error.message },
        400
      );

      throw error;
    }
  }

  /**
   * Revoke execution token
   */
  async revokeToken(tokenId: string, revokedBy: string, reason: string) {
    await this.executionAuthority.revokeToken(tokenId, revokedBy, reason);

    // Audit the revocation
    await this.auditService.logEvent({
      eventType: 'execution_token_revoked',
      tenantId: this.tenantContext.tenantId,
      userId: revokedBy,
      resourceId: tokenId,
      resourceType: 'execution_token',
      action: 'token_revoked',
      details: {
        reason,
        revokedBy,
      },
    });
  }

  /**
   * Get execution capabilities
   */
  async getCapabilities() {
    return {
      channels: ['voice', 'sms', 'email', 'whatsapp', 'calendar'],
      actors: ['AI', 'HUMAN', 'HYBRID'],
      modes: ['AUTONOMOUS', 'ASSISTED', 'APPROVAL_REQUIRED'],
      tokenExpiryMinutes: 10,
      idempotencyEnabled: true,
      auditEnabled: true,
    };
  }

  /**
   * Get token statistics
   */
  async getTokenStats() {
    return this.executionAuthority['tokenService'].getTokenStats();
  }
}
