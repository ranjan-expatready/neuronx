/**
 * Golden Run Controller - WI-066B: UAT Harness Hardening
 *
 * REST API endpoint for triggering golden runs.
 * Ensures all requests go through proper UAT safety validation.
 */

import { Controller, Post, Headers, Logger, UseGuards } from '@nestjs/common';
import { GoldenRunService } from './golden-run.service';
import { UatGuard } from './uat.guard';

@Controller('uat/golden-run')
@UseGuards(UatGuard)
export class GoldenRunController {
  private readonly logger = new Logger(GoldenRunController.name);

  constructor(private readonly goldenRunService: GoldenRunService) {}

  /**
   * Trigger a complete golden run workflow
   */
  @Post()
  async triggerGoldenRun(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId?: string
  ) {
    const correlationIdToUse =
      correlationId ||
      `api_golden_run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(
      `Golden run triggered via API for tenant ${tenantId}, correlation ${correlationIdToUse}`
    );

    try {
      const result = await this.goldenRunService.executeGoldenRun(
        tenantId,
        correlationIdToUse
      );

      this.logger.log(
        `Golden run ${result.runId} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`
      );

      return {
        success: result.success,
        runId: result.runId,
        correlationId: result.correlationId,
        duration: result.duration,
        phases: result.phases,
        selectedOpportunity: result.selectedOpportunity,
        errors: result.errors,
        warnings: result.warnings,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Golden run failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Golden run execution failed',
        correlationId: correlationIdToUse,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
