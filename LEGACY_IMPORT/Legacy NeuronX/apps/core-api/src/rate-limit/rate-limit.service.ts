/**
 * Rate Limit Service - REQ-RATE: Programmatic Rate Limiting
 *
 * Service for programmatic rate limiting that can be called from controllers
 * after authentication/signature verification. Reuses the same store, policy,
 * and key building logic as the guard, but throws exceptions for blocking.
 */

import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { RateLimitPolicyService } from './rate-limit.policy';
import { TenantResolver } from './tenant-resolver';
import { IRateLimitStore } from './rate-limit.store';
import { RateLimitKey, RateLimitScope } from './rate-limit.types';

@Injectable()
export class RateLimitService {
  constructor(
    private readonly policyService: RateLimitPolicyService,
    private readonly store: IRateLimitStore
  ) {}

  /**
   * Enforce rate limiting for webhooks (called after signature verification)
   * This method assumes tenant authentication has already been verified
   */
  async enforceWebhookRateLimit(params: {
    req: Request;
    providerId: string;
    routeKeyOverride?: string;
  }): Promise<void> {
    const { req, providerId, routeKeyOverride } = params;

    // For webhooks, we expect tenant ID to be available since signature was verified
    const tenantResult = TenantResolver.resolveTenantIdForWebhook(req);

    // If we still don't have a valid tenant ID, fail closed (security)
    if (
      tenantResult.confidence === 'unknown' ||
      !tenantResult.tenantId ||
      tenantResult.tenantId === 'unknown'
    ) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid tenant context for webhook',
          error: 'Bad Request',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Build rate limit key for webhook
    const key: RateLimitKey = this.buildWebhookKey(
      req,
      tenantResult.tenantId,
      providerId,
      routeKeyOverride
    );

    // Get policy for webhook scope
    const policy = await this.policyService.getPolicyForTenant(
      tenantResult.tenantId,
      'webhook'
    );

    // Consume from token bucket
    const decision = await this.store.consume(policy, key, Date.now());

    if (!decision.allowed) {
      // Rate limit exceeded - throw 429 with proper headers
      const retryAfter = decision.retryAfterSeconds || 60;

      // Set rate limit headers on response if available
      if (req.res) {
        req.res.set('Retry-After', retryAfter.toString());
        req.res.set('X-RateLimit-Retry-After', retryAfter.toString());
        if (decision.resetTime) {
          req.res.set('X-RateLimit-Reset', decision.resetTime);
        }
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          error: 'Too Many Requests',
          retryAfter,
          details: {
            reason: decision.reason,
            retryAfterSeconds: retryAfter,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Rate limit passed - add headers to response for visibility
    const response = req.res;
    if (response) {
      response.set('X-RateLimit-Remaining', decision.remaining.toString());
      response.set('X-RateLimit-Policy', 'token-bucket');
      if (decision.resetTime) {
        response.set('X-RateLimit-Reset', decision.resetTime);
      }
    }
  }

  /**
   * Enforce rate limiting for API endpoints (called from controllers if needed)
   * This is an alternative to the guard for programmatic control
   */
  async enforceApiRateLimit(params: {
    req: Request;
    routeKeyOverride?: string;
  }): Promise<void> {
    const { req, routeKeyOverride } = params;

    // Resolve tenant for API
    const tenantResult = TenantResolver.resolveTenantIdForAPI(req);
    const tenantId = tenantResult.tenantId;

    // Build rate limit key for API
    const key: RateLimitKey = this.buildApiKey(req, tenantId, routeKeyOverride);

    // Get policy for API scope
    const policy = await this.policyService.getPolicyForTenant(tenantId, 'api');

    // Consume from token bucket
    const decision = await this.store.consume(policy, key, Date.now());

    if (!decision.allowed) {
      // Rate limit exceeded - throw 429 with proper headers
      const retryAfter = decision.retryAfterSeconds || 60;

      // Set rate limit headers on response if available
      if (req.res) {
        req.res.set('Retry-After', retryAfter.toString());
        req.res.set('X-RateLimit-Retry-After', retryAfter.toString());
        if (decision.resetTime) {
          req.res.set('X-RateLimit-Reset', decision.resetTime);
        }
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          error: 'Too Many Requests',
          retryAfter,
          details: {
            reason: decision.reason,
            retryAfterSeconds: retryAfter,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Rate limit passed - add headers
    const response = req.res;
    if (response) {
      response.set('X-RateLimit-Remaining', decision.remaining.toString());
      response.set('X-RateLimit-Policy', 'token-bucket');
      if (decision.resetTime) {
        response.set('X-RateLimit-Reset', decision.resetTime);
      }
    }
  }

  /**
   * Build rate limit key for webhook requests
   */
  private buildWebhookKey(
    req: Request,
    tenantId: string,
    providerId: string,
    routeKeyOverride?: string
  ): RateLimitKey {
    return {
      tenantId,
      scope: 'webhook',
      routeKey: routeKeyOverride || this.extractRouteKey(req),
      method: req.method,
      providerId,
    };
  }

  /**
   * Build rate limit key for API requests
   */
  private buildApiKey(
    req: Request,
    tenantId: string,
    routeKeyOverride?: string
  ): RateLimitKey {
    return {
      tenantId,
      scope: 'api',
      routeKey: routeKeyOverride || this.extractRouteKey(req),
      method: req.method,
    };
  }

  /**
   * Extract route key for rate limiting
   * Groups similar endpoints together
   */
  private extractRouteKey(req: Request): string {
    const url = req.url;

    // Webhook endpoints - group by provider
    if (url.includes('/webhooks/')) {
      const segments = url.split('/').filter(Boolean);
      const webhooksIndex = segments.indexOf('webhooks');
      if (webhooksIndex >= 0 && webhooksIndex + 1 < segments.length) {
        return `webhooks/${segments[webhooksIndex + 1]}`;
      }
      return 'webhooks';
    }

    // API endpoints
    if (
      url.startsWith('/api/') ||
      url.startsWith('/sales') ||
      url.startsWith('/leads')
    ) {
      const pathSegments = url.split('/').filter(Boolean);
      const routeKey = pathSegments
        .map(segment => {
          // Replace numeric IDs with placeholders
          return /^\d+$/.test(segment) ? '{id}' : segment;
        })
        .join('/');

      return routeKey || 'api/default';
    }

    // Default fallback
    return 'default';
  }

  /**
   * Get current rate limit state for a key (for debugging/monitoring)
   */
  async getRateLimitState(params: {
    tenantId: string;
    scope: RateLimitScope;
    routeKey: string;
    method: string;
    providerId?: string;
  }): Promise<any> {
    const key: RateLimitKey = {
      tenantId: params.tenantId,
      scope: params.scope,
      routeKey: params.routeKey,
      method: params.method,
      providerId: params.providerId,
    };

    return this.store.getState(key);
  }
}
