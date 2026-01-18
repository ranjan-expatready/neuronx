/**
 * Tenant Resolver - REQ-RATE: Consistent Tenant ID Resolution
 *
 * Provides consistent tenant ID resolution across API requests and webhooks.
 * Supports multiple resolution strategies with fallback behavior.
 */

import { Request } from 'express';
import { TenantResolutionResult } from './rate-limit.types';

/**
 * Tenant resolver utility for consistent tenant ID extraction
 */
export class TenantResolver {
  /**
   * Resolve tenant ID from HTTP request
   * Supports multiple resolution strategies with security considerations
   */
  static resolveTenantIdFromRequest(req: Request): TenantResolutionResult {
    const url = req.url;
    const headers = req.headers;
    const query = req.query;

    // Strategy 1: Check for explicit tenant header (highest priority)
    const headerTenantId = headers['x-tenant-id'] as string;
    if (headerTenantId && this.isValidTenantId(headerTenantId)) {
      return {
        tenantId: headerTenantId,
        confidence: 'high',
        source: 'header',
        explicit: true,
      };
    }

    // Strategy 2: Check for tenant in query parameters (medium priority)
    const queryTenantId =
      (query.tenantId as string) || (query.tenant_id as string);
    if (queryTenantId && this.isValidTenantId(queryTenantId)) {
      return {
        tenantId: queryTenantId,
        confidence: 'medium',
        source: 'query',
        explicit: true,
      };
    }

    // Strategy 3: Check for tenant in path parameters (webhooks)
    const pathSegments = url.split('/').filter(Boolean);
    const pathTenantIndex = pathSegments.findIndex(
      segment => segment === 'tenants' || segment === 'webhooks'
    );
    if (pathTenantIndex >= 0 && pathTenantIndex + 1 < pathSegments.length) {
      const pathTenantId = pathSegments[pathTenantIndex + 1];
      if (this.isValidTenantId(pathTenantId)) {
        return {
          tenantId: pathTenantId,
          confidence: 'high',
          source: 'path',
          explicit: true,
        };
      }
    }

    // Strategy 4: Check for tenant in JWT token (if available)
    const jwtTenantId = this.extractTenantFromJWT(req);
    if (jwtTenantId && this.isValidTenantId(jwtTenantId)) {
      return {
        tenantId: jwtTenantId,
        confidence: 'high',
        source: 'jwt',
        explicit: true,
      };
    }

    // Strategy 5: Check for webhook-specific tenant patterns
    const webhookTenantId = this.extractTenantFromWebhookContext(req);
    if (webhookTenantId && this.isValidTenantId(webhookTenantId)) {
      return {
        tenantId: webhookTenantId,
        confidence: 'medium',
        source: 'header',
        explicit: false,
      };
    }

    // Strategy 6: Default fallback (lowest priority)
    const defaultTenantId = this.getDefaultTenantId(req);
    return {
      tenantId: defaultTenantId,
      confidence: 'low',
      source: 'default',
      explicit: false,
    };
  }

  /**
   * Resolve tenant ID for webhook processing
   * Special handling for webhook security requirements
   */
  static resolveTenantIdForWebhook(req: Request): TenantResolutionResult {
    const result = this.resolveTenantIdFromRequest(req);

    // For webhooks, we require explicit tenant identification
    // Unknown tenants should fail closed (reject the webhook)
    if (result.confidence === 'low' || result.confidence === 'unknown') {
      return {
        tenantId: 'unknown',
        confidence: 'unknown',
        source: 'default',
        explicit: false,
      };
    }

    return result;
  }

  /**
   * Resolve tenant ID for API processing
   * More permissive for API requests than webhooks
   */
  static resolveTenantIdForAPI(req: Request): TenantResolutionResult {
    return this.resolveTenantIdFromRequest(req);
  }

  /**
   * Validate tenant ID format
   */
  private static isValidTenantId(tenantId: string): boolean {
    // Basic validation: alphanumeric, hyphens, underscores, reasonable length
    const tenantIdRegex = /^[a-zA-Z0-9_-]{1,64}$/;
    return (
      tenantIdRegex.test(tenantId) &&
      tenantId !== 'unknown' &&
      tenantId !== 'default'
    );
  }

  /**
   * Extract tenant ID from JWT token
   */
  private static extractTenantFromJWT(req: Request): string | null {
    try {
      // Check for Authorization header with Bearer token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      // In a real implementation, you'd decode and validate the JWT
      // For now, we'll check for a mock tenant claim in the header
      const token = authHeader.substring(7);

      // Mock JWT decoding - in production, use proper JWT library
      if (token.includes('tenant-')) {
        const tenantMatch = token.match(/tenant-([a-zA-Z0-9_-]+)/);
        if (tenantMatch && tenantMatch[1]) {
          return `tenant-${tenantMatch[1]}`;
        }
      }

      return null;
    } catch (error) {
      // Silently fail JWT extraction
      return null;
    }
  }

  /**
   * Extract tenant ID from webhook-specific context
   */
  private static extractTenantFromWebhookContext(req: Request): string | null {
    const headers = req.headers;

    // Check webhook-specific headers used by different providers
    const webhookTenantHeaders = [
      'x-tenant-id',
      'x-webhook-tenant',
      'x-organization-id',
      'x-account-id',
    ];

    for (const headerName of webhookTenantHeaders) {
      const tenantId = headers[headerName] as string;
      if (tenantId && this.isValidTenantId(tenantId)) {
        return tenantId;
      }
    }

    // Check for tenant in webhook URL path (common pattern)
    const url = req.url;
    const webhookTenantPatterns = [
      /\/webhooks\/([^\/]+)\/([^\/]+)/, // /webhooks/provider/tenant
      /\/tenants\/([^\/]+)\/webhooks/, // /tenants/tenant/webhooks
    ];

    for (const pattern of webhookTenantPatterns) {
      const match = url.match(pattern);
      if (match && match[2] && this.isValidTenantId(match[2])) {
        return match[2];
      }
      if (match && match[1] && this.isValidTenantId(match[1])) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Get default tenant ID based on request context
   */
  private static getDefaultTenantId(req: Request): string {
    // For health checks and public endpoints, allow 'unknown'
    const healthEndpoints = ['/health', '/healthz', '/readiness', '/liveness'];
    if (healthEndpoints.some(endpoint => req.url.startsWith(endpoint))) {
      return 'unknown';
    }

    // For API documentation, use 'unknown'
    if (req.url.includes('/api/docs')) {
      return 'unknown';
    }

    // For webhook endpoints, default to 'unknown' (will be rejected)
    if (req.url.includes('/webhooks') || req.url.includes('/hooks')) {
      return 'unknown';
    }

    // For regular API endpoints, use 'unknown' (will have conservative limits)
    return 'unknown';
  }

  /**
   * Get security context for tenant resolution
   * Helps determine appropriate rate limit policies based on confidence
   */
  static getSecurityContext(result: TenantResolutionResult): {
    requiresStrictPolicy: boolean;
    allowUnknownTenant: boolean;
    logSuspiciousActivity: boolean;
  } {
    switch (result.confidence) {
      case 'high':
        return {
          requiresStrictPolicy: false,
          allowUnknownTenant: false,
          logSuspiciousActivity: false,
        };

      case 'medium':
        return {
          requiresStrictPolicy: true,
          allowUnknownTenant: false,
          logSuspiciousActivity: false,
        };

      case 'low':
      case 'unknown':
        return {
          requiresStrictPolicy: true,
          allowUnknownTenant:
            result.source === 'default' && result.tenantId === 'unknown',
          logSuspiciousActivity: true,
        };
    }
  }
}

/**
 * Utility functions for tenant resolution
 */
export const resolveTenantForRateLimit = {
  /**
   * Resolve tenant for API requests
   */
  api: (req: Request): TenantResolutionResult => {
    return TenantResolver.resolveTenantIdForAPI(req);
  },

  /**
   * Resolve tenant for webhook requests
   */
  webhook: (req: Request): TenantResolutionResult => {
    return TenantResolver.resolveTenantIdForWebhook(req);
  },

  /**
   * Resolve tenant for admin requests
   */
  admin: (req: Request): TenantResolutionResult => {
    return TenantResolver.resolveTenantIdForAPI(req);
  },
};
