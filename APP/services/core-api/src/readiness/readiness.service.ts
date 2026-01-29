import { Injectable, Logger } from '@nestjs/common';
import { ReadinessEngine } from '@neuronx/production-readiness';
import { ReadinessReport } from '@neuronx/production-readiness';

@Injectable()
export class ReadinessService {
  private readonly logger = new Logger(ReadinessService.name);

  constructor(private readonly readinessEngine: ReadinessEngine) {}

  /**
   * Generate comprehensive readiness report for a tenant
   */
  async generateReadinessReport(
    tenantId: string,
    includeDetails: boolean = true,
    correlationId?: string
  ): Promise<ReadinessReport> {
    this.logger.log(`Generating readiness report for tenant: ${tenantId}`, {
      correlationId,
      includeDetails,
    });

    try {
      const report = await this.readinessEngine.generateReadinessReport(
        tenantId,
        includeDetails,
        correlationId
      );

      // Emit audit event
      this.logger.log(`Readiness report generated`, {
        tenantId,
        correlationId: report.correlationId,
        overallStatus: report.overall.status,
        domainStatuses: Object.fromEntries(
          Object.entries(report.domains).map(([domain, status]) => [
            domain,
            status.status,
          ])
        ),
      });

      return report;
    } catch (error) {
      this.logger.error(
        `Failed to generate readiness report for tenant: ${tenantId}`,
        {
          correlationId,
          error: (error as Error).message,
        }
      );
      throw error;
    }
  }

  /**
   * Get specific domain status
   */
  async getDomainStatus(
    tenantId: string,
    domain: string,
    correlationId?: string
  ) {
    this.logger.log(
      `Getting domain status for tenant: ${tenantId}, domain: ${domain}`,
      {
        correlationId,
      }
    );

    try {
      return await this.readinessEngine.getDomainStatus(
        tenantId,
        domain as any,
        correlationId
      );
    } catch (error) {
      this.logger.error(
        `Failed to get domain status for tenant: ${tenantId}, domain: ${domain}`,
        {
          correlationId,
          error: (error as Error).message,
        }
      );
      throw error;
    }
  }
}
