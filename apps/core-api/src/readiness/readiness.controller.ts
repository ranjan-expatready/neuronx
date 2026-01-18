import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  HttpException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ReadinessService } from './readiness.service';
import { ReadinessReport } from '@neuronx/production-readiness';

// TODO: Import proper auth guard
// import { PrincipalGuard } from '../auth/principal.guard';

@Controller('readiness')
export class ReadinessController {
  private readonly logger = new Logger(ReadinessController.name);

  constructor(private readonly readinessService: ReadinessService) {}

  /**
   * Get comprehensive readiness report for a tenant
   * GET /api/readiness/:tenantId
   */
  @Get(':tenantId')
  // @UseGuards(PrincipalGuard) // TODO: Add proper authentication guard
  async getReadinessReport(
    @Param('tenantId') tenantId: string,
    @Query('includeDetails') includeDetails?: string,
    @Query('correlationId') correlationId?: string
  ): Promise<ReadinessReport> {
    try {
      // Validate tenant ID
      if (!tenantId || tenantId.trim().length === 0) {
        throw new HttpException(
          'Tenant ID is required',
          HttpStatus.BAD_REQUEST
        );
      }

      // Parse includeDetails query param
      const includeDetailsBool = includeDetails !== 'false';

      // Generate correlation ID if not provided
      const requestCorrelationId =
        correlationId ||
        `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Readiness report requested`, {
        tenantId,
        includeDetails: includeDetailsBool,
        correlationId: requestCorrelationId,
      });

      const report = await this.readinessService.generateReadinessReport(
        tenantId,
        includeDetailsBool,
        requestCorrelationId
      );

      return report;
    } catch (error) {
      this.logger.error(`Readiness report request failed`, {
        tenantId,
        correlationId,
        error: (error as Error).message,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to generate readiness report',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get specific domain status for a tenant
   * GET /api/readiness/:tenantId/domain/:domain
   */
  @Get(':tenantId/domain/:domain')
  // @UseGuards(PrincipalGuard) // TODO: Add proper authentication guard
  async getDomainStatus(
    @Param('tenantId') tenantId: string,
    @Param('domain') domain: string,
    @Query('correlationId') correlationId?: string
  ) {
    try {
      // Validate parameters
      if (!tenantId || tenantId.trim().length === 0) {
        throw new HttpException(
          'Tenant ID is required',
          HttpStatus.BAD_REQUEST
        );
      }

      if (!domain || domain.trim().length === 0) {
        throw new HttpException('Domain is required', HttpStatus.BAD_REQUEST);
      }

      // Validate domain is known
      const validDomains = [
        'systemHealth',
        'governance',
        'ghlTrust',
        'voiceRisk',
        'billingRevenue',
      ];

      if (!validDomains.includes(domain)) {
        throw new HttpException(
          `Invalid domain: ${domain}. Valid domains: ${validDomains.join(', ')}`,
          HttpStatus.BAD_REQUEST
        );
      }

      const requestCorrelationId =
        correlationId ||
        `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.logger.log(`Domain status requested`, {
        tenantId,
        domain,
        correlationId: requestCorrelationId,
      });

      const status = await this.readinessService.getDomainStatus(
        tenantId,
        domain,
        requestCorrelationId
      );

      return status;
    } catch (error) {
      this.logger.error(`Domain status request failed`, {
        tenantId,
        domain,
        correlationId,
        error: (error as Error).message,
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to get domain status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
