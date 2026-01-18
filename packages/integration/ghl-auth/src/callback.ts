// OAuth Callback Handler - Processes authorization code responses

import { Request, Response } from 'express';
import { GhlOAuthService, OAuthResult } from './oauth';

export interface CallbackResult {
  success: boolean;
  html?: string;
  redirectUrl?: string;
  error?: string;
}

export class OAuthCallbackHandler {
  constructor(private oauthService: GhlOAuthService) {}

  /**
   * Handle OAuth callback from GHL
   */
  async handleCallback(req: Request, res: Response): Promise<void> {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      await this.handleOAuthError(
        error as string,
        error_description as string,
        res
      );
      return;
    }

    // Validate required parameters
    if (!code || !state) {
      await this.handleValidationError(
        'Missing authorization code or state',
        res
      );
      return;
    }

    // Extract tenant ID from request (could be from headers, session, etc.)
    const tenantId = this.extractTenantId(req);
    if (!tenantId) {
      await this.handleValidationError('Unable to identify tenant', res);
      return;
    }

    // Process the OAuth callback
    const result = await this.oauthService.processCallback(
      code as string,
      state as string,
      tenantId
    );

    // Generate appropriate response
    const callbackResult = await this.generateResponse(result, tenantId);
    await this.sendResponse(callbackResult, res);
  }

  private async handleOAuthError(
    error: string,
    errorDescription: string,
    res: Response
  ): Promise<void> {
    console.error('OAuth error:', { error, errorDescription });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .error { color: #dc3545; background: #f8d7da; padding: 15px; border-radius: 4px; }
          .details { background: #f8f9fa; padding: 10px; margin-top: 15px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>🔐 OAuth Authorization Failed</h1>
        <div class="error">
          <strong>Error:</strong> ${error}
        </div>
        ${
          errorDescription
            ? `
        <div class="details">
          <strong>Description:</strong> ${errorDescription}
        </div>
        `
            : ''
        }

        <h2>Common Solutions:</h2>
        <ul>
          <li>Try the authorization process again</li>
          <li>Ensure your GHL app has the correct redirect URI configured</li>
          <li>Check that all required scopes are approved</li>
          <li>Contact support if the issue persists</li>
        </ul>

        <p><a href="/integrations/ghl/setup">← Back to Setup</a></p>
      </body>
      </html>
    `;

    res.status(400).send(html);
  }

  private async handleValidationError(
    message: string,
    res: Response
  ): Promise<void> {
    console.error('OAuth validation error:', message);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Validation Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .error { color: #dc3545; background: #f8d7da; padding: 15px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>🔍 Validation Error</h1>
        <div class="error">
          <strong>Issue:</strong> ${message}
        </div>

        <h2>What to check:</h2>
        <ul>
          <li>Ensure you're accessing the correct URL</li>
          <li>Try the authorization flow again</li>
          <li>Contact support if this persists</li>
        </ul>

        <p><a href="/integrations/ghl/setup">← Back to Setup</a></p>
      </body>
      </html>
    `;

    res.status(400).send(html);
  }

  private extractTenantId(req: Request): string | null {
    // Extract tenant ID from various sources
    // Priority: header > session > query param > default

    const tenantId =
      (req.headers['x-tenant-id'] as string) ||
      (req.session as any)?.tenantId ||
      (req.query.tenantId as string) ||
      'default';

    return tenantId && tenantId !== 'default' ? tenantId : null;
  }

  private async generateResponse(
    result: OAuthResult,
    tenantId: string
  ): Promise<CallbackResult> {
    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    // Success response
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Success</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .success { color: #28a745; background: #d4edda; padding: 15px; border-radius: 4px; }
          .details { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 4px; }
          .stats { display: flex; justify-content: space-between; margin: 10px 0; }
          .stat { text-align: center; flex: 1; }
          .stat-number { font-size: 24px; font-weight: bold; color: #28a745; }
        </style>
      </head>
      <body>
        <h1>✅ OAuth Authorization Successful!</h1>

        <div class="success">
          <strong>NeuronX is now connected to GoHighLevel</strong>
        </div>

        <div class="details">
          <h3>Connection Details:</h3>
          <div class="stats">
            <div class="stat">
              <div class="stat-number">${result.tokensStored || 0}</div>
              <div>Tokens Stored</div>
            </div>
            <div class="stat">
              <div class="stat-number">${tenantId.slice(0, 8)}...</div>
              <div>Tenant ID</div>
            </div>
          </div>
        </div>

        <h2>🎯 What's Next:</h2>
        <ul>
          <li>✅ OAuth tokens are securely stored</li>
          <li>🔄 Webhooks will start flowing automatically</li>
          <li>📊 Data synchronization will begin shortly</li>
          <li>🤖 AI features are now enabled</li>
        </ul>

        <h2>🔍 Monitor Your Integration:</h2>
        <ul>
          <li>Check <code>/integrations/ghl/health</code> for connection status</li>
          <li>View <code>/integrations/ghl/debug/tokens</code> for token details</li>
          <li>Monitor application logs for sync activity</li>
        </ul>

        <p style="margin-top: 30px;">
          <a href="/dashboard" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
            Continue to Dashboard →
          </a>
        </p>
      </body>
      </html>
    `;

    return {
      success: true,
      html,
    };
  }

  private async sendResponse(
    result: CallbackResult,
    res: Response
  ): Promise<void> {
    if (result.success && result.html) {
      res.status(200).send(result.html);
    } else if (result.redirectUrl) {
      res.redirect(result.redirectUrl);
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Unknown error',
      });
    }
  }
}
