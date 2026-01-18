// Token Refresh Service - Automatic token lifecycle management

import { TokenVault, TokenMetadata } from '@neuronx/token-vault';
import { config } from '@neuronx/config';

export interface RefreshResult {
  tenantId: string;
  environment: 'dev' | 'stage' | 'prod';
  tokensRefreshed: number;
  tokensFailed: number;
  duration: number;
  nextRefresh?: Date;
}

export interface RefreshStats {
  totalTenants: number;
  totalTokens: number;
  refreshedTokens: number;
  failedTokens: number;
  averageRefreshTime: number;
  errors: string[];
}

export class TokenRefreshService {
  constructor(private tokenVault: TokenVault) {}

  /**
   * Refresh all expired tokens for all tenants
   */
  async refreshAllExpiredTokens(): Promise<RefreshStats> {
    const startTime = Date.now();
    const stats: RefreshStats = {
      totalTenants: 0,
      totalTokens: 0,
      refreshedTokens: 0,
      failedTokens: 0,
      averageRefreshTime: 0,
      errors: [],
    };

    try {
      // Get all unique tenant IDs (this would need optimization in production)
      const allTenants = await this.getAllTenantIds();

      for (const tenantId of allTenants) {
        stats.totalTenants++;

        for (const environment of ['dev', 'stage', 'prod'] as const) {
          try {
            const result = await this.refreshTenantTokens(
              tenantId,
              environment
            );
            stats.totalTokens += result.tokensRefreshed + result.tokensFailed;
            stats.refreshedTokens += result.tokensRefreshed;
            stats.failedTokens += result.tokensFailed;
          } catch (error) {
            stats.errors.push(
              `Tenant ${tenantId}/${environment}: ${error.message}`
            );
            stats.failedTokens++;
          }
        }
      }

      stats.averageRefreshTime =
        stats.totalTokens > 0
          ? (Date.now() - startTime) / stats.totalTokens
          : 0;
    } catch (error) {
      stats.errors.push(`Refresh operation failed: ${error.message}`);
    }

    return stats;
  }

  /**
   * Refresh tokens for a specific tenant
   */
  async refreshTenantTokens(
    tenantId: string,
    environment: 'dev' | 'stage' | 'prod'
  ): Promise<RefreshResult> {
    const startTime = Date.now();
    const result: RefreshResult = {
      tenantId,
      environment,
      tokensRefreshed: 0,
      tokensFailed: 0,
      duration: 0,
    };

    try {
      // Get all GHL tokens for this tenant/environment
      const tokens = await this.tokenVault.listTenantTokens(tenantId);
      const ghlTokens = tokens.filter(
        t => t.provider === 'ghl' && t.environment === environment
      );

      // Process each token
      for (const token of ghlTokens) {
        try {
          const refreshed = await this.refreshSingleToken(token);
          if (refreshed) {
            result.tokensRefreshed++;
          }
        } catch (error) {
          console.error(
            `Token refresh failed for ${tenantId}/${token.locationId}:`,
            error
          );
          result.tokensFailed++;
        }
      }

      // Schedule next refresh (tokens expire in ~1 hour, refresh at 80% of lifespan)
      result.nextRefresh = new Date(Date.now() + 45 * 60 * 1000); // 45 minutes from now
    } catch (error) {
      console.error(
        `Tenant token refresh failed for ${tenantId}/${environment}:`,
        error
      );
      result.tokensFailed++;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Refresh a single token if it's expired or will expire soon
   */
  private async refreshSingleToken(token: TokenMetadata): Promise<boolean> {
    const query = {
      tenantId: token.tenantId,
      provider: token.provider,
      environment: token.environment,
      locationId: token.locationId,
    };

    // Check if refresh is needed (within 5 minutes of expiry)
    const needsRefresh = this.isTokenExpired(token.expiresAt);

    if (!needsRefresh) {
      return false; // No refresh needed
    }

    // Get refresh token
    const refreshToken = await this.tokenVault.getRefreshToken(query);

    // Perform refresh
    const newTokens = await this.performTokenRefresh(refreshToken);

    // Update stored tokens
    await this.tokenVault.updateToken(query, {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      lastRotatedBy: 'auto_refresh',
    });

    return true;
  }

  /**
   * Check if token needs refresh (expired or expires within 5 minutes)
   */
  private isTokenExpired(expiresAt: Date): boolean {
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    return expiresAt.getTime() < Date.now() + bufferTime;
  }

  /**
   * Perform the actual token refresh HTTP request
   */
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
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get all unique tenant IDs (simplified - in production this would be optimized)
   */
  private async getAllTenantIds(): Promise<string[]> {
    // This is a simplified implementation
    // In production, you'd have a dedicated tenant registry or database query
    // For now, we'll return a placeholder
    return ['placeholder-tenant-id'];
  }

  /**
   * Start background refresh scheduler
   */
  startScheduler(): void {
    // Run refresh every 30 minutes
    setInterval(
      async () => {
        try {
          const stats = await this.refreshAllExpiredTokens();

          console.log('Token refresh completed:', {
            tenants: stats.totalTenants,
            tokens: stats.totalTokens,
            refreshed: stats.refreshedTokens,
            failed: stats.failedTokens,
            avgTime: `${stats.averageRefreshTime.toFixed(0)}ms`,
          });

          if (stats.errors.length > 0) {
            console.error('Token refresh errors:', stats.errors);
          }
        } catch (error) {
          console.error('Token refresh scheduler failed:', error);
        }
      },
      30 * 60 * 1000
    ); // 30 minutes
  }

  /**
   * Manual refresh trigger for specific tenant
   */
  async refreshTenantNow(
    tenantId: string,
    environment: 'dev' | 'stage' | 'prod'
  ): Promise<RefreshResult> {
    return this.refreshTenantTokens(tenantId, environment);
  }

  /**
   * Get refresh status for monitoring
   */
  async getRefreshStatus(): Promise<{
    lastRun?: Date;
    nextRun?: Date;
    stats?: RefreshStats;
  }> {
    // This would track the last scheduler run
    // For now, return placeholder data
    return {
      lastRun: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      nextRun: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
    };
  }
}
