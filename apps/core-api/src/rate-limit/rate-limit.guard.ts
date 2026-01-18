/**
 * Rate Limit Guard - REQ-RATE: NestJS Rate Limiting Implementation
 *
 * CanActivate guard that enforces tenant-aware rate limiting with proper error responses.
 * Integrates tenant resolution, policy lookup, and token bucket consumption.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RateLimitScope, RateLimitKey } from './rate-limit.types';
import { TenantResolver } from './tenant-resolver';
import { RateLimitPolicyService } from './rate-limit.policy';
import { IRateLimitStore } from './rate-limit.store';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly policyService: RateLimitPolicyService,
    private readonly store: IRateLimitStore
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Check if rate limiting is globally enabled
    if (!this.policyService.getConfig().enabled) {
      return true;
    }

    // Check if route is excluded
    if (this.policyService.isRouteExcluded(request.url)) {
      return true;
    }

    try {
      // Determine scope based on request
      const scope = this.determineScope(request);

      // Resolve tenant ID
      const tenantResult = TenantResolver.resolveTenantIdFromRequest(request);

      // Get rate limit policy for tenant and scope
      const policy = await this.policyService.getPolicyForTenant(
        tenantResult.tenantId,
        scope
      );

      // Generate rate limit key
      const key = this.generateRateLimitKey(
        request,
        tenantResult.tenantId,
        scope
      );

      // Check rate limit
      const decision = await this.store.consume(policy, key, Date.now());

      // Log decision for monitoring
      this.logDecision(decision, key, policy, tenantResult);

      if (decision.allowed) {
        // Add rate limit headers to successful requests
        this.addRateLimitHeaders(response, decision);
        return true;
      } else {
        // Handle rate limit violation
        return this.handleRateLimitViolation(response, decision, policy);
      }
    } catch (error) {
      // On rate limiting errors, fail according to policy mode
      this.logger.error('Rate limiting error', {
        error: error.message,
        url: request.url,
        method: request.method,
        stack: error.stack,
      });

      // Default to fail-closed for errors
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limiting temporarily unavailable',
          error: 'Service Unavailable',
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  /**
   * Determine the rate limiting scope based on the request
   */
  private determineScope(request: Request): RateLimitScope {
    const url = request.url;

    // Admin endpoints
    if (url.startsWith('/admin') || url.startsWith('/api/admin')) {
      return 'admin';
    }

    // Webhook endpoints
    if (url.includes('/webhooks') || url.includes('/hooks')) {
      return 'webhook';
    }

    // Default to API for all other endpoints
    return 'api';
  }

  /**
   * Generate rate limit key from request and tenant
   */
  private generateRateLimitKey(
    request: Request,
    tenantId: string,
    scope: RateLimitScope
  ): RateLimitKey {
    const url = request.url;
    const method = request.method;

    // Extract route key (controller + handler or path pattern)
    let routeKey = this.extractRouteKey(request);

    // For webhooks, include provider ID if available
    let providerId: string | undefined;
    if (scope === 'webhook') {
      providerId = this.extractProviderId(request);
    }

    return {
      tenantId,
      scope,
      routeKey,
      method,
      providerId,
    };
  }

  /**
   * Extract route key for rate limiting
   * Groups similar endpoints together
   */
  private extractRouteKey(request: Request): string {
    const url = request.url;
    const method = request.method;

    // Health checks
    if (
      url.startsWith('/health') ||
      url.startsWith('/readiness') ||
      url.startsWith('/liveness')
    ) {
      return 'health';
    }

    // API documentation
    if (url.startsWith('/api/docs')) {
      return 'docs';
    }

    // Webhook endpoints - group by provider
    if (url.includes('/webhooks/')) {
      const segments = url.split('/').filter(Boolean);
      const webhooksIndex = segments.indexOf('webhooks');
      if (webhooksIndex >= 0 && webhooksIndex + 1 < segments.length) {
        return `webhooks/${segments[webhooksIndex + 1]}`;
      }
      return 'webhooks';
    }

    // Sales endpoints
    if (url.startsWith('/sales') || url.startsWith('/api/sales')) {
      return 'sales';
    }

    // Default: use path pattern without IDs, keeping API prefix for API routes
    const pathSegments = url.split('/').filter(Boolean);
    const routeKey = pathSegments
      .map((segment, index) => {
        // Replace numeric IDs with placeholders
        if (/^\d+$/.test(segment)) {
          return '{id}';
        }
        return segment;
      })
      .join('/');

    return routeKey || 'default';
  }

  /**
   * Extract provider ID from webhook requests
   */
  private extractProviderId(request: Request): string | undefined {
    const url = request.url;

    // Extract from URL path like /webhooks/stripe or /payments/webhooks/stripe
    const webhookPatterns = [
      /\/webhooks\/([^\/]+)/,
      /\/payments\/webhooks\/([^\/]+)/,
      /\/integrations\/([^\/]+)\/webhooks/,
    ];

    for (const pattern of webhookPatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Add rate limit headers to successful responses
   */
  private addRateLimitHeaders(response: Response, decision: any): void {
    if (decision.remaining !== undefined) {
      response.set('X-RateLimit-Remaining', decision.remaining.toString());
    }

    if (decision.retryAfterSeconds) {
      response.set(
        'X-RateLimit-Retry-After',
        decision.retryAfterSeconds.toString()
      );
    }

    if (decision.resetTime) {
      response.set('X-RateLimit-Reset', decision.resetTime);
    }

    // Add policy information for debugging
    response.set('X-RateLimit-Policy', 'token-bucket');
  }

  /**
   * Handle rate limit violation
   */
  private handleRateLimitViolation(
    response: Response,
    decision: any,
    policy: any
  ): false {
    const statusCode = HttpStatus.TOO_MANY_REQUESTS;
    const retryAfter = decision.retryAfterSeconds || 60;

    // Set rate limit headers
    response.set('Retry-After', retryAfter.toString());
    response.set('X-RateLimit-Retry-After', retryAfter.toString());

    if (decision.resetTime) {
      response.set('X-RateLimit-Reset', decision.resetTime);
    }

    // Log violation if enabled
    if (this.policyService.getConfig().logViolations) {
      this.logger.warn('Rate limit exceeded', {
        retryAfter,
        reason: decision.reason,
        policy: {
          limitPerMinute: policy.limitPerMinute,
          burst: policy.burst,
        },
      });
    }

    // Return structured error response
    throw new HttpException(
      {
        statusCode,
        message: 'Rate limit exceeded',
        error: 'Too Many Requests',
        retryAfter,
        details: {
          reason: decision.reason,
          retryAfterSeconds: retryAfter,
        },
      },
      statusCode
    );
  }

  /**
   * Log rate limit decisions for monitoring
   */
  private logDecision(
    decision: any,
    key: RateLimitKey,
    policy: any,
    tenantResult: any
  ): void {
    const logData = {
      allowed: decision.allowed,
      tenantId: key.tenantId,
      scope: key.scope,
      routeKey: key.routeKey,
      method: key.method,
      remaining: decision.remaining,
      tenantConfidence: tenantResult.confidence,
      policy: {
        limitPerMinute: policy.limitPerMinute,
        burst: policy.burst,
      },
    };

    if (decision.allowed) {
      this.logger.debug('Rate limit allowed', logData);
    } else {
      this.logger.warn('Rate limit blocked', {
        ...logData,
        retryAfter: decision.retryAfterSeconds,
        reason: decision.reason,
      });
    }
  }
}

/**
 * Decorator to skip rate limiting for specific routes
 */
export const SkipRateLimit = () => {
  // Implementation would use SetMetadata decorator
  // For now, routes are excluded via configuration
};

/**
 * Decorator to override rate limit policy for specific routes
 */
export const OverrideRateLimit = (policy: Partial<any>) => {
  // Implementation would use SetMetadata decorator
  // For now, policy overrides are handled via configuration
};
