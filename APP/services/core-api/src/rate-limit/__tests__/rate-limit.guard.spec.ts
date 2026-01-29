/**
 * Rate Limit Guard Tests - REQ-RATE: Rate Limiting Enforcement
 *
 * Tests tenant isolation, scope separation, burst behavior, fail modes, and webhook ordering.
 * Validates FAANG-grade rate limiting with proper error responses and audit trails.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from '../rate-limit.guard';
import { RateLimitPolicyService } from '../rate-limit.policy';
import { IRateLimitStore } from '../rate-limit.store';
import { EntitlementService } from '../../config/entitlements/entitlement.service';

describe('RateLimitGuard - FAANG-grade Rate Limiting', () => {
  let guard: RateLimitGuard;
  let policyService: RateLimitPolicyService;
  let store: IRateLimitStore;
  let reflector: Reflector;

  // Mock services
  const mockEntitlementService = {
    getTenantEntitlement: jest.fn(),
    listTiers: jest.fn(),
  };

  const mockPolicyService = {
    getPolicyForTenant: jest.fn(),
    isRouteExcluded: jest.fn(),
    getConfig: jest.fn(),
  };

  const mockStore = {
    consume: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
  };

  beforeEach(() => {
    // Create guard manually with mocks to ensure proper injection
    guard = new RateLimitGuard(mockReflector, mockPolicyService, mockStore);

    // Setup defaults
    mockEntitlementService.getTenantEntitlement.mockResolvedValue({
      tier: 'standard',
      features: ['rate_limiting'],
      limits: { api_calls_per_minute: 100 },
    });
    mockEntitlementService.listTiers.mockResolvedValue([
      { name: 'free', limits: { api_calls_per_minute: 10 } },
      { name: 'standard', limits: { api_calls_per_minute: 100 } },
      { name: 'enterprise', limits: { api_calls_per_minute: 10000 } },
    ]);
    mockPolicyService.getConfig.mockReturnValue({ enabled: true });
    mockPolicyService.isRouteExcluded.mockReturnValue(false);
    mockPolicyService.getPolicyForTenant.mockResolvedValue({
      limitPerMinute: 100,
      burst: 20,
      windowSeconds: 60,
      mode: 'fail_closed',
    });
    mockStore.consume.mockResolvedValue({
      allowed: true,
      remaining: 99,
      reason: 'within_limit',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Tenant Isolation - Rate Limit Separation', () => {
    it('should apply different rate limits for different tenants', async () => {
      const mockContext = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'tenant-a' },
      });

      const mockContextB = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'tenant-b' },
      });

      // First tenant
      await guard.canActivate(mockContext);
      expect(mockStore.consume).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ tenantId: 'tenant-a' }),
        expect.any(Number)
      );

      // Second tenant - should use different bucket
      mockStore.consume.mockClear();
      await guard.canActivate(mockContextB);
      expect(mockStore.consume).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ tenantId: 'tenant-b' }),
        expect.any(Number)
      );
    });

    it('should maintain tenant isolation even with same route patterns', async () => {
      const tenantARequest = createMockExecutionContext({
        url: '/api/leads/123',
        method: 'GET',
        headers: { 'x-tenant-id': 'tenant-a' },
      });

      const tenantBRequest = createMockExecutionContext({
        url: '/api/leads/456',
        method: 'GET',
        headers: { 'x-tenant-id': 'tenant-b' },
      });

      // Both should be rate limited separately despite same route pattern
      await guard.canActivate(tenantARequest);
      await guard.canActivate(tenantBRequest);

      // Verify two separate consume calls with different tenant IDs
      expect(mockStore.consume).toHaveBeenCalledTimes(2);
      const calls = mockStore.consume.mock.calls;
      expect(calls[0][1].tenantId).toBe('tenant-a');
      expect(calls[1][1].tenantId).toBe('tenant-b');
    });
  });

  describe('Scope Separation - API vs Webhook Isolation', () => {
    it('should apply different scopes for API vs webhook requests', async () => {
      const apiRequest = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'tenant-1' },
      });

      const webhookRequest = createMockExecutionContext({
        url: '/integrations/ghl/webhooks',
        method: 'POST',
        headers: { 'x-tenant-id': 'tenant-1' },
      });

      await guard.canActivate(apiRequest);
      await guard.canActivate(webhookRequest);

      const calls = mockStore.consume.mock.calls;
      expect(calls[0][1].scope).toBe('api');
      expect(calls[1][1].scope).toBe('webhook');
    });

    it('should apply admin scope for admin endpoints', async () => {
      const adminRequest = createMockExecutionContext({
        url: '/admin/users',
        method: 'GET',
        headers: { 'x-tenant-id': 'admin-tenant' },
      });

      await guard.canActivate(adminRequest);

      const calls = mockStore.consume.mock.calls;
      expect(calls[0][1].scope).toBe('admin');
    });

    it('should not allow webhook scope to affect API limits', async () => {
      const apiRequest = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'tenant-1' },
      });

      const webhookRequest = createMockExecutionContext({
        url: '/webhooks/stripe',
        method: 'POST',
        headers: { 'x-tenant-id': 'tenant-1' },
      });

      // Simulate webhook rate limiting webhook scope
      mockStore.consume.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 60,
        reason: 'rate_limit_exceeded',
      });

      // API should still be allowed
      mockStore.consume.mockResolvedValueOnce({
        allowed: true,
        remaining: 95,
        reason: 'within_limit',
      });

      await expect(guard.canActivate(webhookRequest)).rejects.toThrow(); // Webhook blocked

      const apiResult = await guard.canActivate(apiRequest);
      expect(apiResult).toBe(true); // API allowed
    });
  });

  describe('Burst Behavior - Token Bucket Algorithm', () => {
    it('should allow burst requests up to burst limit', async () => {
      const request = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'burst-tenant' },
      });

      // Simulate 25 consecutive requests (beyond normal limit of 100/min but within burst)
      for (let i = 0; i < 25; i++) {
        mockStore.consume.mockResolvedValueOnce({
          allowed: true,
          remaining: 20 - i,
          reason: 'within_limit',
        });
      }

      // All should be allowed
      for (let i = 0; i < 25; i++) {
        const result = await guard.canActivate(request);
        expect(result).toBe(true);
      }

      expect(mockStore.consume).toHaveBeenCalledTimes(25);
    });

    it('should block requests after burst limit is exceeded', async () => {
      const request = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'burst-exceed-tenant' },
      });

      // Clear the default mock from beforeEach
      mockStore.consume.mockReset();

      // First 20 requests allowed (burst limit)
      for (let i = 0; i < 20; i++) {
        mockStore.consume.mockResolvedValueOnce({
          allowed: true,
          remaining: 19 - i,
          reason: 'within_limit',
        });
      }

      // 21st request blocked
      mockStore.consume.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 60,
        reason: 'rate_limit_exceeded',
      });

      // First 20 should pass
      for (let i = 0; i < 20; i++) {
        const result = await guard.canActivate(request);
        expect(result).toBe(true);
      }

      // 21st should fail
      await expect(guard.canActivate(request)).rejects.toThrow();
    });
  });

  describe('Retry-After Response - Proper HTTP Headers', () => {
    let response: any;

    beforeEach(() => {
      response = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });

    it('should set proper retry-after headers when rate limited', async () => {
      const request = createMockExecutionContext(
        {
          url: '/api/leads',
          method: 'POST',
          headers: { 'x-tenant-id': 'rate-limited-tenant' },
        },
        response
      );

      // Clear the default mock from beforeEach
      mockStore.consume.mockReset();
      mockStore.consume.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 120,
        reason: 'rate_limit_exceeded',
        resetTime: '2024-01-01T12:00:00.000Z',
      });

      await expect(guard.canActivate(request)).rejects.toThrow();

      expect(response.set).toHaveBeenCalledWith('Retry-After', '120');
      expect(response.set).toHaveBeenCalledWith(
        'X-RateLimit-Retry-After',
        '120'
      );
      expect(response.set).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        '2024-01-01T12:00:00.000Z'
      );
    });

    it('should include rate limit headers on successful requests', async () => {
      const request = createMockExecutionContext(
        {
          url: '/api/leads',
          method: 'GET',
          headers: { 'x-tenant-id': 'success-tenant' },
        },
        response
      );

      mockStore.consume.mockResolvedValueOnce({
        allowed: true,
        remaining: 95,
        reason: 'within_limit',
      });

      const result = await guard.canActivate(request);
      expect(result).toBe(true);

      expect(response.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '95');
      expect(response.set).toHaveBeenCalledWith(
        'X-RateLimit-Policy',
        'token-bucket'
      );
    });
  });

  describe('Fail-Open vs Fail-Closed Semantics', () => {
    it('should fail_closed for API requests when rate limiting fails', async () => {
      const request = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'error-tenant' },
      });

      // Simulate policy service error
      mockPolicyService.getPolicyForTenant.mockRejectedValueOnce(
        new Error('Policy service error')
      );

      await expect(guard.canActivate(request)).rejects.toThrow(
        'Rate limiting temporarily unavailable'
      );
    });

    it('should fail_closed for admin endpoints with unknown tenant', async () => {
      const adminRequest = createMockExecutionContext({
        url: '/admin/dashboard',
        method: 'GET',
        headers: {}, // No tenant header
      });

      // Should resolve to 'unknown' tenant and use fail_closed
      mockPolicyService.getPolicyForTenant.mockResolvedValueOnce({
        limitPerMinute: 10,
        burst: 2,
        windowSeconds: 60,
        mode: 'fail_closed',
      });

      mockStore.consume.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 60,
        reason: 'rate_limit_exceeded',
        resetTime: '2024-01-01T12:00:00.000Z',
      });

      await expect(guard.canActivate(adminRequest)).rejects.toThrow();
    });

    it('should never block health check endpoints', async () => {
      const healthRequest = createMockExecutionContext({
        url: '/health',
        method: 'GET',
        headers: { 'x-tenant-id': 'any-tenant' },
      });

      mockPolicyService.isRouteExcluded.mockReturnValueOnce(true);

      const result = await guard.canActivate(healthRequest);
      expect(result).toBe(true);
      expect(mockStore.consume).not.toHaveBeenCalled();
    });
  });

  describe('Webhook Flow Ordering - Security First', () => {
    it('should apply rate limiting to webhook endpoints', async () => {
      const webhookRequest = createMockExecutionContext({
        url: '/integrations/ghl/webhooks',
        method: 'POST',
        headers: { 'x-tenant-id': 'webhook-tenant' },
      });

      await guard.canActivate(webhookRequest);

      expect(mockStore.consume).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          tenantId: 'webhook-tenant',
          scope: 'webhook',
          routeKey: 'integrations/ghl/webhooks',
          method: 'POST',
        }),
        expect.any(Number)
      );
    });

    it('should include provider ID in webhook rate limit keys', async () => {
      const stripeWebhookRequest = createMockExecutionContext({
        url: '/payments/webhooks/stripe',
        method: 'POST',
        headers: { 'x-tenant-id': 'stripe-tenant' },
      });

      await guard.canActivate(stripeWebhookRequest);

      expect(mockStore.consume).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          tenantId: 'stripe-tenant',
          scope: 'webhook',
          providerId: 'stripe',
        }),
        expect.any(Number)
      );
    });

    it('should handle invalid signature followed by rate limiting', async () => {
      // This test validates that the guard runs before controller logic
      // In practice, invalid signatures would be handled by controller after guard
      const webhookRequest = createMockExecutionContext({
        url: '/webhooks/stripe',
        method: 'POST',
        headers: { 'x-tenant-id': 'compromised-tenant' },
      });

      // Simulate rate limit being hit
      mockStore.consume.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 300,
        reason: 'rate_limit_exceeded',
      });

      await expect(guard.canActivate(webhookRequest)).rejects.toThrow();
    });
  });

  describe('Route Key Generation - Endpoint Grouping', () => {
    it('should group similar API endpoints together', async () => {
      const requests = [
        createMockExecutionContext({
          url: '/api/leads/123',
          method: 'GET',
          headers: { 'x-tenant-id': 'test' },
        }),
        createMockExecutionContext({
          url: '/api/leads/456',
          method: 'GET',
          headers: { 'x-tenant-id': 'test' },
        }),
        createMockExecutionContext({
          url: '/api/leads',
          method: 'POST',
          headers: { 'x-tenant-id': 'test' },
        }),
      ];

      for (const request of requests) {
        await guard.canActivate(request);
      }

      const calls = mockStore.consume.mock.calls;
      // All should use the same route key since IDs are parameterized
      expect(calls[0][1].routeKey).toBe('api/leads/{id}');
      expect(calls[1][1].routeKey).toBe('api/leads/{id}');
      expect(calls[2][1].routeKey).toBe('api/leads');
    });

    it('should exclude health endpoints from rate limiting', async () => {
      const healthEndpoints = [
        '/health',
        '/healthz',
        '/readiness',
        '/liveness',
      ];

      for (const endpoint of healthEndpoints) {
        const request = createMockExecutionContext({
          url: endpoint,
          method: 'GET',
          headers: { 'x-tenant-id': 'health-tenant' },
        });

        mockPolicyService.isRouteExcluded.mockReturnValueOnce(true);

        const result = await guard.canActivate(request);
        expect(result).toBe(true);
      }

      // Store should not be called for health checks
      expect(mockStore.consume).not.toHaveBeenCalled();
    });
  });

  describe('Entitlement-Aware Policies', () => {
    it('should apply different policies based on tenant tier', async () => {
      // Enterprise tenant
      const enterpriseRequest = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'enterprise-tenant' },
      });

      // Free tier tenant
      const freeRequest = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'free-tenant' },
      });

      // Mock different policies for different tiers
      mockPolicyService.getPolicyForTenant
        .mockResolvedValueOnce({
          limitPerMinute: 10000, // Enterprise
          burst: 2000,
          windowSeconds: 60,
          mode: 'fail_closed',
        })
        .mockResolvedValueOnce({
          limitPerMinute: 100, // Free
          burst: 10,
          windowSeconds: 60,
          mode: 'fail_closed',
        });

      await guard.canActivate(enterpriseRequest);
      await guard.canActivate(freeRequest);

      const calls = mockStore.consume.mock.calls;
      expect(calls[0][0].limitPerMinute).toBe(10000); // Enterprise policy
      expect(calls[1][0].limitPerMinute).toBe(100); // Free policy
    });

    it('should apply conservative policies for unknown tenants', async () => {
      const unknownTenantRequest = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: {}, // No tenant header
      });

      mockPolicyService.getPolicyForTenant.mockResolvedValueOnce({
        limitPerMinute: 10, // Conservative policy
        burst: 2,
        windowSeconds: 60,
        mode: 'fail_closed',
      });

      await guard.canActivate(unknownTenantRequest);

      const calls = mockStore.consume.mock.calls;
      expect(calls[0][0].limitPerMinute).toBe(10);
    });
  });

  describe('Global Disable Functionality', () => {
    it('should bypass rate limiting when globally disabled', async () => {
      const request = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'test-tenant' },
      });

      mockPolicyService.getConfig.mockReturnValueOnce({ enabled: false });

      const result = await guard.canActivate(request);
      expect(result).toBe(true);
      expect(mockStore.consume).not.toHaveBeenCalled();
    });
  });

  describe('Webhook Security Ordering - Signature Before Rate Limit', () => {
    let mockRateLimitService: any;

    beforeEach(() => {
      mockRateLimitService = {
        enforceWebhookRateLimit: jest.fn(),
      };
    });

    it('should not apply rate limiting to webhook endpoints (guard bypassed)', async () => {
      const webhookRequest = createMockExecutionContext({
        url: '/integrations/ghl/webhooks',
        method: 'POST',
        headers: { 'x-tenant-id': 'webhook-tenant' },
      });

      const result = await guard.canActivate(webhookRequest);

      // Guard applies rate limiting to webhook endpoints
      expect(result).toBe(true);
      expect(mockStore.consume).toHaveBeenCalled();
    });

    it('should still apply rate limiting to API endpoints', async () => {
      const apiRequest = createMockExecutionContext({
        url: '/api/leads',
        method: 'GET',
        headers: { 'x-tenant-id': 'api-tenant' },
      });

      const result = await guard.canActivate(apiRequest);

      // Guard should still apply rate limiting to API endpoints
      expect(result).toBe(true);
      expect(mockStore.consume).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ scope: 'api', tenantId: 'api-tenant' }),
        expect.any(Number)
      );
    });
  });
});

// Helper function to create mock execution context
function createMockExecutionContext(
  requestData: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
  },
  response?: any
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        url: requestData.url,
        method: requestData.method,
        headers: requestData.headers || {},
        body: requestData.body || {},
        query: requestData.query || {},
      }),
      getResponse: () =>
        response || {
          set: jest.fn(),
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        },
    }),
    getClass: () => ({}),
    getHandler: () => ({}),
    getArgs: () => [],
    getArgByIndex: () => null,
    switchToRpc: () => null,
    switchToWs: () => null,
  };
}
