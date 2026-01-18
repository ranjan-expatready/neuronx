/**
 * UAT Controller - WI-066: UAT Harness + Seed + Safety
 *
 * API endpoints for UAT operations and monitoring.
 * Provides UAT status, controls, and safety monitoring.
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { UatService } from './uat.service';
import { UatGuard } from './uat.guard';

@Controller('uat')
@UseGuards(UatGuard)
export class UatController {
  constructor(private readonly uatService: UatService) {}

  /**
   * Get current UAT status
   */
  @Get('status')
  getUatStatus() {
    return this.uatService.getUatStatus();
  }

  /**
   * Validate UAT readiness
   */
  @Get('readiness')
  validateUatReadiness() {
    return this.uatService.validateUatReadiness();
  }

  /**
   * Trigger golden run
   */
  @Post('golden-run')
  async triggerGoldenRun(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId?: string
  ) {
    return this.uatService.triggerGoldenRun(tenantId, correlationId);
  }

  /**
   * Get UAT audit events
   */
  @Get('audit')
  async getUatAuditEvents(
    @Headers('x-tenant-id') tenantId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    return this.uatService.getUatAuditEvents(tenantId, limitNum, offsetNum);
  }
}
