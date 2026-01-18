// GHL OAuth Controller - Production OAuth flow endpoints

import {
  Controller,
  Get,
  Query,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { GhlOAuthService, OAuthResult } from '@neuronx/ghl-auth';
import { config } from '@neuronx/config';

@Controller('integrations/ghl/auth')
export class GhlAuthController {
  private readonly logger = new Logger(GhlAuthController.name);

  constructor(private readonly oauthService: GhlOAuthService) {}

  /**
   * Generate GHL OAuth install URL
   */
  @Get('install')
  async install(
    @Query('tenantId') tenantId: string,
    @Query('agencyEnv') agencyEnv: 'dev' | 'stage' | 'prod' = 'dev',
    @Query('redirect') redirect: string = 'false',
    @Res() res: Response
  ) {
    const correlationId = `install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.logger.log('GHL OAuth install requested', {
        tenantId,
        agencyEnv,
        correlationId,
        operation: 'ghl.auth.install',
      });

      const { url, state } = this.oauthService.generateAuthUrl(
        tenantId,
        agencyEnv
      );

      this.logger.log('GHL OAuth install URL generated', {
        tenantId,
        agencyEnv,
        correlationId,
        maskedState: state ? `${state.slice(0, 8)}...` : 'none',
      });

      // Return URL for programmatic use, or redirect directly
      if (redirect === 'true') {
        return res.redirect(url);
      }

      return res.json({
        installUrl: url,
        state,
        instructions: [
          '1. Visit the install URL above',
          '2. Select your GHL agency/location',
          '3. Authorize NeuronX to access your data',
          '4. You will be redirected back to complete setup',
        ],
      });
    } catch (error) {
      this.logger.error('GHL OAuth install failed', {
        tenantId,
        agencyEnv,
        correlationId,
        error: error.message,
        stack: error.stack,
      });

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to generate install URL',
        message: error.message,
      });
    }
  }

  /**
   * Handle OAuth callback from GHL
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response
  ) {
    const correlationId = `callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Handle OAuth provider errors
    if (error) {
      this.logger.error('GHL OAuth provider error', {
        error,
        errorDescription,
        correlationId,
        operation: 'ghl.auth.callback',
      });

      return this.renderErrorPage(res, {
        title: 'OAuth Authorization Failed',
        error: 'Provider Error',
        message: errorDescription || error,
        nextSteps: [
          'Try the authorization process again',
          'Check your GHL app configuration',
          'Contact support if the issue persists',
        ],
      });
    }

    // Validate required parameters
    if (!code || !state) {
      this.logger.error('GHL OAuth callback missing parameters', {
        hasCode: !!code,
        hasState: !!state,
        correlationId,
      });

      return this.renderErrorPage(res, {
        title: 'OAuth Validation Error',
        error: 'Missing Parameters',
        message: 'Authorization code or state parameter is missing',
        nextSteps: [
          'Try the authorization process again',
          'Ensure you complete the full OAuth flow',
        ],
      });
    }

    try {
      // Extract tenant ID from request (in production, this might come from session or JWT)
      // For now, we'll use a default and log the need for proper tenant identification
      const tenantId = 'default_tenant'; // TODO: Implement proper tenant identification

      this.logger.log('GHL OAuth callback processing', {
        tenantId,
        correlationId,
        operation: 'ghl.auth.callback',
        maskedCode: code ? `${code.slice(0, 8)}...` : 'none',
      });

      const result: OAuthResult = await this.oauthService.processCallback(
        code,
        state,
        tenantId
      );

      if (!result.success) {
        this.logger.error('GHL OAuth callback failed', {
          tenantId,
          correlationId,
          error: result.error,
        });

        return this.renderErrorPage(res, {
          title: 'OAuth Processing Failed',
          error: 'Processing Error',
          message: result.error || 'Failed to process authorization',
          nextSteps: [
            'Check application logs for details',
            'Verify GHL app credentials',
            'Try the authorization process again',
          ],
        });
      }

      this.logger.log('GHL OAuth callback successful', {
        tenantId,
        correlationId,
        tokensStored: result.tokensStored,
        operation: 'ghl.auth.callback',
      });

      // Success page for development, redirect for production
      if (config.NEURONX_ENV === 'dev') {
        return this.renderSuccessPage(res, {
          tenantId,
          tokensStored: result.tokensStored || 0,
          nextSteps: [
            '✅ OAuth tokens are securely stored',
            '🔄 Webhooks will start flowing automatically',
            '📊 Check /integrations/ghl/health for connection status',
            '🤖 AI features are now enabled',
          ],
        });
      } else {
        // Production: redirect to dashboard or success page
        return res.redirect('/dashboard?integration=ghl&status=success');
      }
    } catch (error) {
      this.logger.error('GHL OAuth callback exception', {
        correlationId,
        error: error.message,
        stack: error.stack,
      });

      return this.renderErrorPage(res, {
        title: 'OAuth Server Error',
        error: 'Server Error',
        message: 'An unexpected error occurred during authorization',
        nextSteps: [
          'Check application logs for details',
          'Try the authorization process again',
          'Contact support if the issue persists',
        ],
      });
    }
  }

  /**
   * Render error page for development
   */
  private renderErrorPage(
    res: Response,
    data: {
      title: string;
      error: string;
      message: string;
      nextSteps: string[];
    }
  ) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${data.title}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .error { color: #dc3545; background: #f8d7da; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .next-steps { background: #f8f9fa; padding: 15px; border-radius: 4px; }
          ul { margin: 10px 0; }
          li { margin: 5px 0; }
          a { color: #007bff; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>🔐 ${data.title}</h1>

        <div class="error">
          <strong>${data.error}:</strong> ${data.message}
        </div>

        <h2>Next Steps:</h2>
        <div class="next-steps">
          <ul>
            ${data.nextSteps.map(step => `<li>${step}</li>`).join('')}
          </ul>
        </div>

        <p><a href="/integrations/ghl/setup">← Back to Setup</a></p>
      </body>
      </html>
    `;

    return res.status(HttpStatus.BAD_REQUEST).send(html);
  }

  /**
   * Render success page for development
   */
  private renderSuccessPage(
    res: Response,
    data: {
      tenantId: string;
      tokensStored: number;
      nextSteps: string[];
    }
  ) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Success</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .success { color: #28a745; background: #d4edda; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .stats { display: flex; justify-content: space-between; margin: 15px 0; }
          .stat { text-align: center; flex: 1; }
          .stat-number { font-size: 24px; font-weight: bold; color: #28a745; }
          .next-steps { background: #f8f9fa; padding: 15px; border-radius: 4px; }
          ul { margin: 10px 0; }
          li { margin: 5px 0; }
          a { color: #007bff; text-decoration: none; }
        </ul>
        </style>
      </head>
      <body>
        <h1>✅ GHL Integration Successful!</h1>

        <div class="success">
          <strong>NeuronX is now connected to GoHighLevel</strong>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat-number">${data.tokensStored}</div>
            <div>Tokens Stored</div>
          </div>
          <div class="stat">
            <div class="stat-number">${data.tenantId.slice(0, 8)}...</div>
            <div>Tenant ID</div>
          </div>
        </div>

        <h2>🎯 What's Next:</h2>
        <div class="next-steps">
          <ul>
            ${data.nextSteps.map(step => `<li>${step}</li>`).join('')}
          </ul>
        </div>

        <p style="margin-top: 30px;">
          <a href="/dashboard">Continue to Dashboard →</a>
        </p>
      </body>
      </html>
    `;

    return res.send(html);
  }
}
