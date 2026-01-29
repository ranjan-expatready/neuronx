/**
 * Work Queue Controller - WI-037: Opportunity → Team Binding
 *
 * Provides team-scoped work queue for operators.
 */

import { Controller, Get, Query, Logger, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '../authz/auth.guard';
import { WorkQueueService, WorkQueueFilters } from './work-queue.service';
import { PrincipalContext } from '../authz/principal';

@Controller('work-queue')
@UseGuards(AuthGuard)
export class WorkQueueController {
  private readonly logger = new Logger(WorkQueueController.name);

  constructor(private readonly workQueueService: WorkQueueService) {}

  /**
   * Get work queue items for authenticated principal
   */
  @Get()
  async getWorkQueue(
    @Req() request: any,
    @Query()
    query: {
      reason?: string;
      priority?: string;
      slaUrgent?: string;
      teamId?: string;
      agencyId?: string;
      limit?: string;
      offset?: string;
    }
  ) {
    const principal = PrincipalContext.requirePrincipal(request);

    // Parse filters
    const filters: WorkQueueFilters = {
      reason: query.reason?.split(','),
      priority: query.priority?.split(','),
      slaUrgent: query.slaUrgent === 'true',
      teamId: query.teamId,
      agencyId: query.agencyId,
    };

    const pagination = {
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    };

    this.logger.log('Getting work queue', {
      tenantId: principal.tenantId,
      userId: principal.userId,
      filters,
      pagination,
      correlationId: principal.correlationId,
    });

    const result = await this.workQueueService.getWorkQueue(
      principal,
      filters,
      pagination
    );

    return {
      success: true,
      data: result,
      meta: {
        principal: {
          userId: principal.userId,
          authType: principal.authType,
          correlationId: principal.correlationId,
        },
        filters,
        pagination,
      },
    };
  }

  /**
   * Get work queue statistics
   */
  @Get('stats')
  async getWorkQueueStats(@Req() request: any) {
    const principal = PrincipalContext.requirePrincipal(request);

    this.logger.log('Getting work queue stats', {
      tenantId: principal.tenantId,
      userId: principal.userId,
      correlationId: principal.correlationId,
    });

    const stats = await this.workQueueService.getWorkQueueStats(principal);

    return {
      success: true,
      data: stats,
      meta: {
        principal: {
          userId: principal.userId,
          authType: principal.authType,
        },
      },
    };
  }

  /**
   * Validate access to specific opportunity
   */
  @Get('validate-access/:opportunityId')
  async validateAccess(@Req() request: any, opportunityId: string) {
    const principal = PrincipalContext.requirePrincipal(request);

    this.logger.log('Validating work queue access', {
      tenantId: principal.tenantId,
      userId: principal.userId,
      opportunityId,
      correlationId: principal.correlationId,
    });

    const validation = await this.workQueueService.validateWorkQueueAccess(
      principal,
      opportunityId
    );

    return {
      success: true,
      data: validation,
      meta: {
        principal: {
          userId: principal.userId,
          authType: principal.authType,
        },
      },
    };
  }
}
