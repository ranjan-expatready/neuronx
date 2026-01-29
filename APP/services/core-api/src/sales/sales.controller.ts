/**
 * Sales Controller - WI-038: Org Admin + Integration Mapping Ops Pack
 *
 * Sales-related operations including opportunity team reassignment.
 */

import {
  Controller,
  Post,
  Body,
  Logger,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { OpportunityService } from './opportunity.service';
import { OpportunityTeamBackfillRunner } from './opportunity-team-backfill.runner';
import { AuthGuard } from '../authz/auth.guard';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/permissions.decorator';
import { PrincipalContext } from '../authz/principal';
import { OrgAuthorityService } from '../org-authority/org-authority.service';
import { ActionType, RiskLevel } from '@neuronx/org-authority';

@Controller('sales')
@UseGuards(AuthGuard, PermissionsGuard)
export class SalesController {
  private readonly logger = new Logger(SalesController.name);

  constructor(
    private readonly opportunityService: OpportunityService,
    private readonly backfillRunner: OpportunityTeamBackfillRunner,
    private readonly orgAuthorityService: OrgAuthorityService
  ) {}

  // ============================================================================
  // OPPORTUNITY TEAM MANAGEMENT (WI-038)
  // ============================================================================

  @Patch('opportunities/:id/reassign-team')
  @RequirePermissions('admin:all') // TODO: Allow agency/team admins with proper scope checking
  async reassignOpportunityTeam(
    @Req() request: any,
    @Body()
    body: {
      newTeamId: string;
      reason: string;
      requiresApproval?: boolean;
    }
  ) {
    const opportunityId = request.params.id;
    const principal = PrincipalContext.requirePrincipal(request);
    const tenantId = principal.tenantId;

    this.logger.log(
      `Reassigning opportunity ${opportunityId} to team ${body.newTeamId}`,
      {
        tenantId,
        userId: principal.userId,
        reason: body.reason,
        requiresApproval: body.requiresApproval,
      }
    );

    try {
      // Get current opportunity
      const opportunity = await this.opportunityService.getOpportunityById(
        opportunityId,
        tenantId
      );
      if (!opportunity) {
        return {
          success: false,
          error: 'Opportunity not found',
        };
      }

      const oldTeamId = opportunity.teamId;
      const oldAgencyId = opportunity.agencyId;

      // Check if reassignment requires approval
      let approvalGranted = true;
      if (body.requiresApproval) {
        // Check approval requirements based on deal value and risk
        const approvalReq = this.orgAuthorityService.getApprovalRequirement({
          actionType: ActionType.ESCALATE, // Treat as escalation for approval
          riskLevel:
            opportunity.value && opportunity.value > 100000
              ? RiskLevel.HIGH
              : RiskLevel.MEDIUM,
          dealValue: opportunity.value || 0,
        });

        if (approvalReq.required) {
          // For now, require admin approval - could be extended to workflow
          await this.orgAuthorityService.requireCapabilityFromRequest(
            request,
            approvalReq.requiredCapabilities[0]
          );
        }
      }

      // Check that the user can act on both old and new teams
      if (oldTeamId) {
        // Verify user can act on current team (to reassign from it)
        await this.orgAuthorityService.assertCanActOnTeam(
          await this.orgAuthorityService.getAuthorityContextFromRequest(
            request
          ),
          oldTeamId
        );
      }

      // Verify user can act on new team (to reassign to it)
      await this.orgAuthorityService.assertCanActOnTeam(
        await this.orgAuthorityService.getAuthorityContextFromRequest(request),
        body.newTeamId
      );

      // Perform reassignment
      const updatedOpportunity = await this.opportunityService.reassignTeam(
        opportunityId,
        tenantId,
        {
          newTeamId: body.newTeamId,
          reason: body.reason,
          reassignedBy: principal.userId,
          correlationId: `reassign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        }
      );

      this.logger.log(`Successfully reassigned opportunity ${opportunityId}`, {
        tenantId,
        userId: principal.userId,
        oldTeamId,
        newTeamId: body.newTeamId,
        reason: body.reason,
      });

      return {
        success: true,
        opportunity: updatedOpportunity,
        oldTeamId,
        newTeamId: body.newTeamId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to reassign opportunity team: ${error.message}`,
        {
          tenantId,
          userId: principal.userId,
          opportunityId,
          newTeamId: body.newTeamId,
          error: error.stack,
        }
      );

      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // BACKFILL OPERATIONS (WI-038)
  // ============================================================================

  @Post('opportunities/backfill-teams')
  @RequirePermissions('admin:all')
  async backfillOpportunityTeams(
    @Req() request: any,
    @Body()
    body: {
      dryRun?: boolean;
      batchSize?: number;
      maxRows?: number;
      correlationId?: string;
    }
  ) {
    const principal = PrincipalContext.requirePrincipal(request);
    const tenantId = principal.tenantId;
    const correlationId =
      body.correlationId ||
      `backfill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(`Starting opportunity team backfill`, {
      tenantId,
      userId: principal.userId,
      dryRun: body.dryRun,
      batchSize: body.batchSize,
      maxRows: body.maxRows,
      correlationId,
    });

    try {
      const result = await this.backfillRunner.run({
        tenantId,
        dryRun: body.dryRun,
        batchSize: body.batchSize,
        maxRows: body.maxRows,
        correlationId,
      });

      this.logger.log(`Completed opportunity team backfill`, {
        tenantId,
        userId: principal.userId,
        result,
        correlationId,
      });

      return {
        success: true,
        result,
      };
    } catch (error) {
      this.logger.error(`Opportunity team backfill failed: ${error.message}`, {
        tenantId,
        userId: principal.userId,
        correlationId,
        error: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('opportunities/backfill-stats')
  @RequirePermissions('admin:all')
  async getBackfillStats(@Req() request: any) {
    const principal = PrincipalContext.requirePrincipal(request);
    const tenantId = principal.tenantId;

    try {
      const stats = await this.backfillRunner.getBackfillStats(tenantId);

      return {
        success: true,
        stats,
      };
    } catch (error) {
      this.logger.error(`Failed to get backfill stats: ${error.message}`, {
        tenantId,
        userId: principal.userId,
        error: error.stack,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }
}
