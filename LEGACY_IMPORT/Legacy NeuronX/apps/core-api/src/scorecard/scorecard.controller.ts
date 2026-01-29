/**
 * Scorecard Controller - WI-065: Scorecard Engine & Analytics Integration
 *
 * REST API endpoints for scorecard generation and drill-down operations.
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Headers,
  UseGuards,
  Logger,
  ParseIntPipe,
  ValidationPipe,
} from '@nestjs/common';
import { ScorecardService } from './scorecard.service';
import { UatGuard } from '../uat/uat.guard';

@Controller('scorecards')
@UseGuards(UatGuard)
export class ScorecardController {
  private readonly logger = new Logger(ScorecardController.name);

  constructor(private readonly scorecardService: ScorecardService) {}

  /**
   * Get scorecard for a tenant
   */
  @Get(':tenantId')
  async getScorecard(
    @Param('tenantId') tenantId: string,
    @Query('surface') surface: string,
    @Query('timeRange') timeRange: string,
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
    @Query('includeDetails') includeDetails?: string,
    @Headers('x-correlation-id') correlationId?: string
  ) {
    this.logger.log(
      `Scorecard request: tenant=${tenantId}, surface=${surface}, timeRange=${timeRange}`
    );

    try {
      const scorecard = await this.scorecardService.generateScorecard(
        tenantId,
        surface,
        timeRange,
        teamId,
        userId,
        correlationId
      );

      return {
        success: true,
        data: scorecard,
        correlationId: scorecard.correlationId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Scorecard generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Scorecard generation failed',
        tenantId,
        surface,
        timeRange,
        correlationId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get drill-down data for a specific metric
   */
  @Get(':tenantId/drilldown')
  async getMetricDrilldown(
    @Param('tenantId') tenantId: string,
    @Query('metricKey') metricKey: string,
    @Query('timeRange') timeRange: string,
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
    @Query('page', ParseIntPipe) page?: number,
    @Query('limit', ParseIntPipe) limit?: number,
    @Headers('x-correlation-id') correlationId?: string
  ) {
    this.logger.log(
      `Drill-down request: tenant=${tenantId}, metric=${metricKey}, timeRange=${timeRange}`
    );

    try {
      const drilldown = await this.scorecardService.getMetricDrilldown(
        tenantId,
        metricKey,
        timeRange,
        teamId,
        userId,
        page,
        limit,
        correlationId
      );

      return {
        success: true,
        data: drilldown,
        correlationId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Drill-down failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Drill-down failed',
        tenantId,
        metricKey,
        timeRange,
        correlationId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get scorecard metadata and available options
   */
  @Get('metadata')
  async getScorecardMetadata(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId?: string
  ) {
    this.logger.log(`Scorecard metadata request: tenant=${tenantId}`);

    try {
      const metadata =
        await this.scorecardService.getScorecardMetadata(tenantId);

      return {
        success: true,
        data: metadata,
        correlationId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Metadata retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Metadata retrieval failed',
        correlationId,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
