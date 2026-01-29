// GHL Health Controller - Integration monitoring and diagnostics

import { Controller, Get, Logger } from '@nestjs/common';
import { TokenVault } from '@neuronx/token-vault';
import { config } from '@neuronx/config';

@Controller('integrations/ghl/health')
export class GhlHealthController {
  private readonly logger = new Logger(GhlHealthController.name);

  constructor(private readonly tokenVault: TokenVault) {}

  /**
   * Get GHL integration health status
   */
  @Get()
  async getHealth() {
    const correlationId = `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.logger.log('GHL health check requested', {
        correlationId,
        operation: 'ghl.health.check',
      });

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        integration: 'ghl',
        version: '1.0.0',
        environment: config.NEURONX_ENV,
        checks: {
          configuration: await this.checkConfiguration(),
          tokenVault: await this.checkTokenVault(),
          webhookVerification: this.checkWebhookVerification(),
        },
      };

      // Determine overall status
      const hasFailures = Object.values(health.checks).some(
        check => check.status === 'error'
      );
      health.status = hasFailures ? 'degraded' : 'healthy';

      this.logger.log('GHL health check completed', {
        correlationId,
        status: health.status,
        checks: Object.keys(health.checks).length,
      });

      return health;
    } catch (error) {
      this.logger.error('GHL health check failed', {
        correlationId,
        error: error.message,
        stack: error.stack,
      });

      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        integration: 'ghl',
        error: error.message,
      };
    }
  }

  /**
   * Check configuration health
   */
  private async checkConfiguration() {
    try {
      const requiredVars = [
        'GHL_CLIENT_ID',
        'GHL_CLIENT_SECRET',
        'GHL_REDIRECT_URI',
        'TOKEN_VAULT_MASTER_KEY',
        'TOKEN_VAULT_KEY_ID',
      ];

      const missing = requiredVars.filter(varName => !config[varName]);

      if (missing.length > 0) {
        return {
          status: 'error',
          message: `Missing required configuration: ${missing.join(', ')}`,
          missing,
        };
      }

      // Check webhook secret (required unless explicitly skipped)
      if (!config.SKIP_WEBHOOK_VERIFICATION && !config.GHL_WEBHOOK_SECRET) {
        return {
          status: 'error',
          message:
            'Webhook verification enabled but GHL_WEBHOOK_SECRET not configured',
        };
      }

      return {
        status: 'ok',
        message: 'Configuration is valid',
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Configuration check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check token vault health
   */
  private async checkTokenVault() {
    try {
      // Attempt to get token metadata for a test tenant
      // This verifies the vault is accessible and functional
      const testTenant = 'health_check_tenant';

      // Note: This will return empty array if no tokens exist, which is fine
      await this.tokenVault.listTenantTokens(testTenant);

      return {
        status: 'ok',
        message: 'Token vault is accessible',
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Token vault check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check webhook verification configuration
   */
  private checkWebhookVerification() {
    if (config.SKIP_WEBHOOK_VERIFICATION) {
      return {
        status: 'warning',
        message: 'Webhook verification is disabled (development mode)',
      };
    }

    if (!config.GHL_WEBHOOK_SECRET) {
      return {
        status: 'error',
        message: 'Webhook verification enabled but secret not configured',
      };
    }

    return {
      status: 'ok',
      message: 'Webhook verification is properly configured',
    };
  }
}
