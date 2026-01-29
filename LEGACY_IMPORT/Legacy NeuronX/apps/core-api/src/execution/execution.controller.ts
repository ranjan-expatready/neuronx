/**
 * Execution Controller - WI-034: Multi-Channel Execution Authority
 *
 * REST endpoints for execution planning and token management.
 */

import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Headers,
  Logger,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { TenantContext } from '../config/tenant-context';
import { AuthGuard } from '../authz/auth.guard';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/permissions.decorator';
import { PrincipalContext } from '../authz/principal';

@Controller('execution')
@UseGuards(AuthGuard, PermissionsGuard)
export class ExecutionController {
  private readonly logger = new Logger(ExecutionController.name);

  constructor(
    private readonly executionService: ExecutionService,
    private readonly tenantContext: TenantContext
  ) {}

  /**
   * Plan execution (POST /api/execution/plan)
   * Creates an execution plan for a command + decision combination
   */
  @Post('plan')
  @RequirePermissions('execution:plan')
  async planExecution(
    @Body()
    body: {
      opportunityId: string;
      executionCommand: any;
      decisionResult: any;
      context?: {
        dealValue?: number;
        riskScore?: number;
        slaUrgency?: 'low' | 'normal' | 'high' | 'urgent';
        retryCount?: number;
        evidenceSoFar?: string[];
      };
      correlationId?: string;
    }
  ) {
    const correlationId =
      body.correlationId ||
      `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tenantId = this.tenantContext.tenantId;

    this.logger.log(
      `Planning execution for opportunity ${body.opportunityId}`,
      {
        correlationId,
        tenantId,
        commandType: body.executionCommand.commandType,
      }
    );

    try {
      const plan = await this.executionService.planExecution({
        tenantId,
        opportunityId: body.opportunityId,
        executionCommand: body.executionCommand,
        decisionResult: body.decisionResult,
        currentStage: 'QUALIFIED', // TODO: Get from opportunity
        dealValue: body.context?.dealValue || 0,
        riskScore: body.context?.riskScore || 50,
        slaUrgency: body.context?.slaUrgency || 'normal',
        retryCount: body.context?.retryCount || 0,
        evidenceSoFar: body.context?.evidenceSoFar || [],
        correlationId,
      });

      return {
        success: true,
        plan,
        correlationId,
      };
    } catch (error) {
      this.logger.error(`Execution planning failed: ${error.message}`, {
        correlationId,
        tenantId,
        error: error.stack,
      });

      return {
        success: false,
        error: error.message,
        correlationId,
      };
    }
  }

  /**
   * Approve execution (POST /api/execution/approve)
   * For APPROVAL_REQUIRED executions, operators can approve and issue tokens
   */
  @Post('approve')
  @RequirePermissions('execution:approve')
  async approveExecution(
    @Body()
    body: {
      planId: string;
      notes?: string;
      correlationId: string;
      riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      dealValue?: number;
    },
    @Req() request: any
  ) {
    const correlationId = body.correlationId;
    const tenantId = this.tenantContext.tenantId;
    const principal = PrincipalContext.requirePrincipal(request);

    this.logger.log(`Approving execution plan ${body.planId}`, {
      correlationId,
      tenantId,
      userId: principal.userId,
      displayName: principal.displayName,
      notes: body.notes,
    });

    try {
      const result = await this.executionService.approveExecution(
        principal,
        body.planId,
        body.notes,
        correlationId,
        body.riskLevel,
        body.dealValue
      );

      return {
        success: true,
        token: result.token,
        correlationId,
      };
    } catch (error) {
      this.logger.error(`Execution approval failed: ${error.message}`, {
        correlationId,
        tenantId,
        userId,
        error: error.stack,
      });

      return {
        success: false,
        error: error.message,
        correlationId,
      };
    }
  }

  /**
   * Execute command (POST /api/execution/execute)
   * Executes side effects via adapters using validated tokens
   */
  @Post('execute')
  @RequirePermissions('execution:execute')
  async executeCommand(
    @Body()
    body: {
      tokenId: string;
      correlationId: string;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() request: any
  ) {
    const correlationId = body.correlationId;
    const tenantId = this.tenantContext.tenantId;
    const principal = PrincipalContext.requirePrincipal(request);

    // Generate idempotency key if not provided
    const finalIdempotencyKey =
      idempotencyKey ||
      `exec_${body.tokenId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(`Executing command with token ${body.tokenId}`, {
      correlationId,
      tenantId,
      userId: principal.userId,
      displayName: principal.displayName,
      idempotencyKey: finalIdempotencyKey,
    });

    try {
      const result = await this.executionService.executeCommand(
        body.tokenId,
        finalIdempotencyKey,
        principal,
        correlationId
      );

      return {
        success: true,
        receipt: result,
        correlationId,
      };
    } catch (error) {
      this.logger.error(`Command execution failed: ${error.message}`, {
        correlationId,
        tenantId,
        userId,
        tokenId: body.tokenId,
        error: error.stack,
      });

      return {
        success: false,
        error: error.message,
        correlationId,
      };
    }
  }

  /**
   * Get execution capabilities (GET /api/execution/capabilities)
   */
  @Get('capabilities')
  @RequirePermissions('execution:read')
  async getCapabilities() {
    const capabilities = await this.executionService.getCapabilities();

    return {
      success: true,
      capabilities,
    };
  }

  /**
   * Get token statistics (GET /api/execution/tokens/stats)
   */
  @Get('tokens/stats')
  @RequirePermissions('execution:admin')
  async getTokenStats() {
    const stats = await this.executionService.getTokenStats();

    return {
      success: true,
      stats,
    };
  }

  /**
   * Get execution plan by ID (GET /api/execution/plans/:planId)
   * For debugging and audit purposes
   */
  @Get('plans/:planId')
  @RequirePermissions('execution:read')
  async getExecutionPlan(@Param('planId') planId: string) {
    // TODO: Implement plan retrieval
    return {
      success: false,
      error: 'Plan retrieval not yet implemented',
    };
  }

  /**
   * Revoke execution token (POST /api/execution/tokens/:tokenId/revoke)
   * Emergency control for security incidents
   */
  @Post('tokens/:tokenId/revoke')
  @RequirePermissions('execution:admin')
  async revokeToken(
    @Param('tokenId') tokenId: string,
    @Body()
    body: {
      reason: string;
      correlationId: string;
    }
  ) {
    const correlationId = body.correlationId;
    const tenantId = this.tenantContext.tenantId;
    const userId = 'current_user'; // TODO: Get from auth context

    this.logger.log(`Revoking execution token ${tokenId}`, {
      correlationId,
      tenantId,
      userId,
      reason: body.reason,
    });

    try {
      await this.executionService.revokeToken(tokenId, userId, body.reason);

      return {
        success: true,
        correlationId,
      };
    } catch (error) {
      this.logger.error(`Token revocation failed: ${error.message}`, {
        correlationId,
        tenantId,
        userId,
        tokenId,
        error: error.stack,
      });

      return {
        success: false,
        error: error.message,
        correlationId,
      };
    }
  }
}
