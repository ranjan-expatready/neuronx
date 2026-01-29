// GHL OAuth Service - Production OAuth Flow Implementation

import { config } from '@neuronx/config';
import { createHmacSignature, verifyHmacSignature } from '@neuronx/token-vault';
import { TokenVault, TokenCreateRequest } from '@neuronx/token-vault';

export interface OAuthState {
  tenantId: string;
  agencyEnv: 'dev' | 'stage' | 'prod';
  nonce: string;
  issuedAt: Date;
  scopes: string[];
}

export interface OAuthResult {
  success: boolean;
  redirectUrl?: string;
  error?: string;
  tokensStored?: number;
}

export class GhlOAuthService {
  private readonly stateSecret: string;

  constructor(
    private tokenVault: TokenVault,
    stateSecret?: string
  ) {
    // Use provided secret or derive from master key
    this.stateSecret = stateSecret || config.TOKEN_VAULT_MASTER_KEY;
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(
    tenantId: string,
    agencyEnv: 'dev' | 'stage' | 'prod',
    requestedScopes: string[] = []
  ): { url: string; state: string } {
    // Default scopes based on environment
    const defaultScopes = this.getDefaultScopes(agencyEnv);
    const scopes = requestedScopes.length > 0 ? requestedScopes : defaultScopes;
    const scopeString = scopes.join(' ');

    // Create state with CSRF protection
    const stateData: OAuthState = {
      tenantId,
      agencyEnv,
      nonce: this.generateNonce(),
      issuedAt: new Date(),
      scopes,
    };

    const state = this.signState(stateData);

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.GHL_CLIENT_ID,
      redirect_uri: config.GHL_REDIRECT_URI,
      scope: scopeString,
      state,
    });

    const url = `${config.GHL_AUTH_URL}?${params.toString()}`;

    return { url, state };
  }

  /**
   * Process OAuth callback and exchange code for tokens
   */
  async processCallback(
    code: string,
    state: string,
    tenantId: string
  ): Promise<OAuthResult> {
    try {
      // Verify state to prevent CSRF
      const stateData = this.verifyState(state);
      if (!stateData || stateData.tenantId !== tenantId) {
        return {
          success: false,
          error: 'Invalid or expired state parameter',
        };
      }

      // Check state expiration (5 minutes)
      const stateAge = Date.now() - stateData.issuedAt.getTime();
      if (stateAge > 5 * 60 * 1000) {
        return {
          success: false,
          error: 'State parameter expired',
        };
      }

      // Exchange code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(code);

      // Store tokens in vault
      const tokensStored = await this.storeTokens(
        tenantId,
        stateData.agencyEnv,
        tokenResponse,
        stateData.scopes
      );

      return {
        success: true,
        tokensStored,
      };
    } catch (error) {
      console.error('OAuth callback processing failed:', error);
      return {
        success: false,
        error: error.message || 'OAuth processing failed',
      };
    }
  }

  /**
   * Refresh expired tokens
   */
  async refreshTokens(
    tenantId: string,
    agencyEnv: 'dev' | 'stage' | 'prod'
  ): Promise<{ refreshed: number; failed: number }> {
    let refreshed = 0;
    let failed = 0;

    try {
      // Get all tokens for this tenant/environment
      const tokens = await this.tokenVault.listTenantTokens(tenantId);
      const relevantTokens = tokens.filter(
        t => t.provider === 'ghl' && t.environment === agencyEnv
      );

      for (const token of relevantTokens) {
        try {
          // Attempt refresh
          const refreshToken = await this.tokenVault.getRefreshToken({
            tenantId,
            provider: 'ghl',
            environment: agencyEnv,
            locationId: token.locationId,
          });

          const newTokens = await this.performTokenRefresh(refreshToken);

          // Update stored tokens
          await this.tokenVault.updateToken(
            {
              tenantId,
              provider: 'ghl',
              environment: agencyEnv,
              locationId: token.locationId,
            },
            {
              accessToken: newTokens.access_token,
              refreshToken: newTokens.refresh_token,
              expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
              lastRotatedBy: 'auto_refresh',
            }
          );

          refreshed++;
        } catch (error) {
          console.error(
            `Token refresh failed for ${tenantId}/${agencyEnv}:`,
            error
          );
          failed++;
        }
      }
    } catch (error) {
      console.error('Token refresh operation failed:', error);
      failed++;
    }

    return { refreshed, failed };
  }

  // ===== PRIVATE METHODS =====

  private getDefaultScopes(agencyEnv: 'dev' | 'stage' | 'prod'): string[] {
    const baseScopes = [
      'contacts.readonly',
      'contacts.write',
      'opportunities.readonly',
      'opportunities.write',
      'locations.readonly',
    ];

    // Add production scopes for stage/prod
    if (agencyEnv !== 'dev') {
      baseScopes.push(
        'campaigns.readonly',
        'campaigns.write',
        'workflows.readonly',
        'workflows.write',
        'conversations.readonly',
        'conversations.write',
        'conversations.message.send'
      );
    }

    return baseScopes;
  }

  private generateNonce(): string {
    return Buffer.from(Math.random().toString())
      .toString('base64')
      .slice(0, 16);
  }

  private signState(stateData: OAuthState): string {
    const stateString = JSON.stringify({
      ...stateData,
      issuedAt: stateData.issuedAt.toISOString(),
    });

    const signature = createHmacSignature(stateString, this.stateSecret);
    return Buffer.from(`${stateString}:${signature}`).toString('base64');
  }

  private verifyState(state: string): OAuthState | null {
    try {
      const decoded = Buffer.from(state, 'base64').toString();
      const [stateString, signature] = decoded.split(':');

      if (!verifyHmacSignature(stateString, signature, this.stateSecret)) {
        return null;
      }

      const stateData = JSON.parse(stateString);
      return {
        ...stateData,
        issuedAt: new Date(stateData.issuedAt),
      };
    } catch {
      return null;
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<any> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.GHL_CLIENT_ID,
      client_secret: config.GHL_CLIENT_SECRET,
      redirect_uri: config.GHL_REDIRECT_URI,
    });

    const response = await fetch(config.GHL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  private async performTokenRefresh(refreshToken: string): Promise<any> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.GHL_CLIENT_ID,
      client_secret: config.GHL_CLIENT_SECRET,
    });

    const response = await fetch(config.GHL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  private async storeTokens(
    tenantId: string,
    agencyEnv: 'dev' | 'stage' | 'prod',
    tokenResponse: any,
    scopes: string[]
  ): Promise<number> {
    let tokensStored = 0;

    // Store company token (always present)
    if (tokenResponse.access_token) {
      const companyTokenRequest: TokenCreateRequest = {
        tenantId,
        provider: 'ghl',
        environment: agencyEnv,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        scope: scopes,
        expiresIn: tokenResponse.expires_in,
        createdBy: 'oauth_flow',
      };

      await this.tokenVault.storeToken(companyTokenRequest);
      tokensStored++;
    }

    // Store location-specific tokens if provided
    // Note: GHL may provide location tokens in the OAuth response
    if (tokenResponse.locationTokens) {
      for (const locationToken of tokenResponse.locationTokens) {
        const locationTokenRequest: TokenCreateRequest = {
          tenantId,
          provider: 'ghl',
          environment: agencyEnv,
          locationId: locationToken.locationId,
          accessToken: locationToken.access_token,
          refreshToken: locationToken.refresh_token,
          scope: scopes,
          expiresIn: locationToken.expires_in,
          createdBy: 'oauth_flow',
        };

        await this.tokenVault.storeToken(locationTokenRequest);
        tokensStored++;
      }
    }

    return tokensStored;
  }
}
