/**
 * Metrics Controller - WI-024: Observability & Metrics Foundation
 *
 * Exposes Prometheus metrics endpoint for monitoring and alerting.
 */

import { Controller, Get, Header, Logger } from '@nestjs/common';
import { RequireAdmin } from '../authz/permissions.decorator';
import { getMetricsText } from './metrics';

@Controller('metrics')
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  /**
   * Prometheus metrics endpoint
   * Returns metrics in Prometheus text format
   */
  @Get()
  @RequireAdmin() // Admin-only access to prevent information leakage
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async getMetrics(): Promise<string> {
    try {
      const metricsText = await getMetricsText();

      this.logger.debug('Metrics endpoint accessed', {
        metricsLength: metricsText.length,
        linesCount: metricsText.split('\n').length,
      });

      return metricsText;
    } catch (error: any) {
      this.logger.error('Failed to generate metrics', { error: error.message });

      // Return minimal metrics on error to avoid breaking monitoring
      return `# Error generating metrics: ${error.message}\n`;
    }
  }
}
