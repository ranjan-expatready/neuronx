/**
 * Health Controller - WI-024: Observability & Metrics Foundation
 *
 * Health check endpoints for liveness and readiness probes.
 */

import { Controller, Get, Logger } from '@nestjs/common';
import { ReadinessService, HealthStatus } from './readiness.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly readinessService: ReadinessService) {}

  /**
   * Liveness probe - always returns OK
   * Used by Kubernetes to determine if the pod should be restarted
   */
  @Get('live')
  async getLiveness(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe - checks dependencies
   * Used by Kubernetes to determine if the pod should receive traffic
   */
  @Get('ready')
  async getReadiness(): Promise<HealthStatus> {
    try {
      return await this.readinessService.checkReadiness();
    } catch (error: any) {
      this.logger.error('Readiness check failed', { error: error.message });

      // Return error status if readiness check itself fails
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'error', message: 'Readiness check failed' },
          secrets: { status: 'error', message: 'Readiness check failed' },
          storage: { status: 'error', message: 'Readiness check failed' },
        },
      };
    }
  }

  /**
   * Combined health check (for convenience)
   */
  @Get()
  async getHealth(): Promise<HealthStatus> {
    return this.getReadiness();
  }
}
