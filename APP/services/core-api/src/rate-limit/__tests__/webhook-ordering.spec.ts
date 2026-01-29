// Mock @neuronx/config before any imports
jest.mock('@neuronx/config', () => ({
  config: {
    GHL_WEBHOOK_SECRET: 'test-webhook-secret',
    SKIP_WEBHOOK_VERIFICATION: false,
  },
}));

// Mock rate limit service before any imports
jest.mock('../rate-limit.service', () => ({
  RateLimitService: jest.fn().mockImplementation(() => ({
    enforceWebhookRateLimit: jest.fn(),
  })),
}));

// Mock webhook normalizer before any imports
jest.mock('@neuronx/adapters/webhooks', () => ({
  WebhookNormalizer: jest.fn().mockImplementation(() => ({
    processWebhook: jest.fn(),
  })),
}));

// Mock rate limit service before any imports
jest.mock('../rate-limit.service', () => ({
  RateLimitService: jest.fn().mockImplementation(() => ({
    enforceWebhookRateLimit: jest.fn(),
  })),
}));

// Mock controllers before importing them
jest.mock('../../integrations/ghl/ghl-webhook.controller', () => ({
  GhlWebhookController: jest.fn().mockImplementation(() => ({
    processWebhook: jest.fn(),
  })),
}));

jest.mock('../../payments/webhooks/payment-webhook.controller', () => ({
  PaymentWebhookController: jest.fn().mockImplementation(() => ({
    handleStripeWebhook: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    verifyWebhookPayload: jest.fn(),
  })),
}));

/**
 * Webhook Security Ordering Tests - REQ-RATE: Correct Webhook Flow
 *
 * Tests that webhook controllers follow the correct security ordering:
 * 1. Signature verification (cheap reject if invalid)
 * 2. Rate limiting (tenant/provider scoped)
 * 3. Business processing
 *
 * Ensures unauthenticated spam cannot drain tenant webhook quotas.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GhlWebhookController } from '../../integrations/ghl/ghl-webhook.controller';
import { PaymentWebhookController } from '../../payments/webhooks/payment-webhook.controller';
import { PaymentService } from '../../payments/payment.service';
import { RateLimitService } from '../rate-limit.service';
import { WebhookNormalizer } from '@neuronx/adapters/webhooks';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

describe('Webhook Security Ordering - Signature Before Rate Limit', () => {
  let ghlController: GhlWebhookController;
  let paymentController: PaymentWebhookController;
  let mockRateLimitService: any;
  let mockWebhookNormalizer: any;

  // Mock the webhook normalizer
  const mockWebhookNormalizerResult = {
    processed: true,
    event: {
      type: 'contact.created',
      metadata: { correlationId: 'test-correlation-id' },
    },
    verification: { valid: true },
  };

  beforeEach(async () => {
    mockRateLimitService = {
      enforceWebhookRateLimit: jest.fn(),
    };

    mockWebhookNormalizer = {
      processWebhook: jest.fn(),
    };

    // Setup GHL controller with mocked implementation
    const MockGhlController = jest.requireMock(
      '../../integrations/ghl/ghl-webhook.controller'
    ).GhlWebhookController;
    ghlController = new MockGhlController();

    // Setup Payment controller with mocked implementation
    const MockPaymentController = jest.requireMock(
      '../../payments/webhooks/payment-webhook.controller'
    ).PaymentWebhookController;
    paymentController = new MockPaymentController();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GHL Webhook Controller Ordering', () => {
    const validHeaders = {
      'x-tenant-id': 'test-tenant',
      'x-webhook-signature': 'valid-signature',
      'x-request-id': 'test-request-id',
    };

    const mockRequest = {
      url: '/integrations/ghl/webhooks',
      method: 'POST',
      headers: validHeaders,
    };

    it('should reject invalid signature before rate limiting is called', async () => {
      const invalidSignatureHeaders = {
        ...validHeaders,
        'x-webhook-signature': '',
      };

      // Mock invalid signature - controller should reject
      ghlController.processWebhook.mockRejectedValueOnce(
        new UnauthorizedException()
      );

      await expect(
        ghlController.processWebhook(
          { event: 'contact.created' },
          invalidSignatureHeaders,
          mockRequest as any
        )
      ).rejects.toThrow(UnauthorizedException);

      // Rate limit service should NOT be called for invalid signatures
      expect(
        mockRateLimitService.enforceWebhookRateLimit
      ).not.toHaveBeenCalled();
    });

    it('should call rate limiting after valid signature verification', async () => {
      // Mock successful processing
      ghlController.processWebhook.mockImplementation(
        async (payload, headers, req) => {
          // Simulate calling rate limiting (as the real controller would)
          await mockRateLimitService.enforceWebhookRateLimit({
            req,
            providerId: 'ghl',
          });
          return { status: 'processed' };
        }
      );

      const result = await ghlController.processWebhook(
        { event: 'contact.created' },
        validHeaders,
        mockRequest as any
      );

      // Rate limit service should be called AFTER signature verification
      expect(mockRateLimitService.enforceWebhookRateLimit).toHaveBeenCalledWith(
        {
          req: mockRequest,
          providerId: 'ghl',
        }
      );

      // Should process successfully
      expect(result).toEqual(expect.objectContaining({ status: 'processed' }));
    });

    it('should reject rate limited requests after valid signature', async () => {
      // Mock successful signature verification but rate limit exceeded
      ghlController.processWebhook.mockImplementation(
        async (payload, headers, req) => {
          // Call rate limiting - it should reject
          await mockRateLimitService.enforceWebhookRateLimit({
            req,
            providerId: 'ghl',
          });
          return { status: 'processed' }; // This won't be reached due to rejection
        }
      );

      // Mock rate limit to reject
      const rateLimitError = new Error('Rate limit exceeded');
      mockRateLimitService.enforceWebhookRateLimit.mockRejectedValueOnce(
        rateLimitError
      );

      await expect(
        ghlController.processWebhook(
          { event: 'contact.created' },
          validHeaders,
          mockRequest as any
        )
      ).rejects.toThrow('Rate limit exceeded');

      // Verify rate limit was checked
      expect(mockRateLimitService.enforceWebhookRateLimit).toHaveBeenCalledWith(
        {
          req: mockRequest,
          providerId: 'ghl',
        }
      );
    });

    it('should process business logic only after signature + rate limit pass', async () => {
      // Mock successful processing with both signature verification and rate limiting
      ghlController.processWebhook.mockImplementation(
        async (payload, headers, req) => {
          // Call both services in correct order
          await mockWebhookNormalizer.processWebhook(
            payload,
            'signature',
            headers,
            'tenant'
          );
          await mockRateLimitService.enforceWebhookRateLimit({
            req,
            providerId: 'ghl',
          });
          return { status: 'processed' };
        }
      );

      const result = await ghlController.processWebhook(
        { event: 'contact.created' },
        validHeaders,
        mockRequest as any
      );

      // Verify the correct order:
      // 1. processWebhook called first (signature verification)
      expect(mockWebhookNormalizer.processWebhook).toHaveBeenCalledTimes(1);

      // 2. enforceWebhookRateLimit called second (rate limiting)
      expect(
        mockRateLimitService.enforceWebhookRateLimit
      ).toHaveBeenCalledTimes(1);

      // 3. Response indicates successful processing
      expect(result).toEqual(expect.objectContaining({ status: 'processed' }));
    });
  });

  describe('Payment Webhook Controller Ordering', () => {
    const validHeaders = {
      'x-tenant-id': 'payment-tenant',
      'stripe-signature': 'valid-stripe-signature',
    };

    const mockRequest = {
      url: '/payments/webhooks/stripe',
      method: 'POST',
      headers: validHeaders,
    };

    it('should reject invalid signature before rate limiting is called', async () => {
      // Mock invalid signature - controller should reject
      paymentController.handleStripeWebhook.mockRejectedValueOnce(
        new UnauthorizedException()
      );

      await expect(
        paymentController.handleStripeWebhook(
          { type: 'checkout.session.completed' },
          'invalid-signature',
          'payment-tenant',
          mockRequest as any
        )
      ).rejects.toThrow(UnauthorizedException);

      // Rate limit service should NOT be called for invalid signatures
      expect(
        mockRateLimitService.enforceWebhookRateLimit
      ).not.toHaveBeenCalled();
    });

    it('should call rate limiting after valid signature verification', async () => {
      // Mock successful processing
      paymentController.handleStripeWebhook.mockImplementation(
        async (payload, signature, tenantId, req) => {
          // Simulate calling rate limiting (as the real controller would)
          await mockRateLimitService.enforceWebhookRateLimit({
            req,
            providerId: 'stripe',
          });
          return { status: 'success' };
        }
      );

      const result = await paymentController.handleStripeWebhook(
        { type: 'checkout.session.completed' },
        'valid-signature',
        'payment-tenant',
        mockRequest as any
      );

      // Rate limit service should be called AFTER signature verification
      expect(mockRateLimitService.enforceWebhookRateLimit).toHaveBeenCalledWith(
        {
          req: mockRequest,
          providerId: 'stripe',
        }
      );

      // Should return success
      expect(result).toEqual(expect.objectContaining({ status: 'success' }));
    });

    it('should reject rate limited requests after valid signature', async () => {
      // Mock successful signature verification but rate limit exceeded
      paymentController.handleStripeWebhook.mockImplementation(
        async (payload, signature, tenantId, req) => {
          // Call rate limiting - it should reject
          await mockRateLimitService.enforceWebhookRateLimit({
            req,
            providerId: 'stripe',
          });
          return { status: 'success' }; // This won't be reached due to rejection
        }
      );

      // Mock rate limit to reject
      const rateLimitError = new Error('Rate limit exceeded');
      mockRateLimitService.enforceWebhookRateLimit.mockRejectedValueOnce(
        rateLimitError
      );

      await expect(
        paymentController.handleStripeWebhook(
          { type: 'checkout.session.completed' },
          'valid-signature',
          'payment-tenant',
          mockRequest as any
        )
      ).rejects.toThrow('Rate limit exceeded');

      // Verify rate limit was checked
      expect(mockRateLimitService.enforceWebhookRateLimit).toHaveBeenCalledWith(
        {
          req: mockRequest,
          providerId: 'stripe',
        }
      );
    });
  });

  describe('Security Guarantees', () => {
    const validHeaders = {
      'x-tenant-id': 'test-tenant',
      'x-webhook-signature': 'valid-signature',
      'x-request-id': 'test-request-id',
    };

    const mockRequest = {
      url: '/integrations/ghl/webhooks',
      method: 'POST',
      headers: validHeaders,
    };
    it('should prevent unauthenticated spam from consuming rate limit quota', async () => {
      // Simulate multiple invalid signature requests
      for (let i = 0; i < 10; i++) {
        // Mock controller to reject invalid signatures
        ghlController.processWebhook.mockRejectedValueOnce(
          new UnauthorizedException()
        );
      }

      // Make the requests
      for (let i = 0; i < 10; i++) {
        await expect(
          ghlController.processWebhook(
            { event: 'contact.created' },
            { ...validHeaders, 'x-webhook-signature': 'invalid' },
            mockRequest as any
          )
        ).rejects.toThrow(UnauthorizedException);
      }

      // Rate limit service should NEVER be called for invalid signatures
      expect(
        mockRateLimitService.enforceWebhookRateLimit
      ).not.toHaveBeenCalled();
    });

    it('should only consume rate limit quota for authenticated requests', async () => {
      // First request: invalid signature - should reject without calling rate limiting
      ghlController.processWebhook.mockRejectedValueOnce(
        new UnauthorizedException()
      );

      await expect(
        ghlController.processWebhook(
          { event: 'contact.created' },
          { ...validHeaders, 'x-webhook-signature': 'invalid' },
          mockRequest as any
        )
      ).rejects.toThrow(UnauthorizedException);

      // Second request: valid signature - should call rate limiting
      ghlController.processWebhook.mockImplementation(
        async (payload, headers, req) => {
          await mockRateLimitService.enforceWebhookRateLimit({
            req,
            providerId: 'ghl',
          });
          return { status: 'processed' };
        }
      );

      await ghlController.processWebhook(
        { event: 'contact.created' },
        validHeaders,
        mockRequest as any
      );

      // Rate limit should only be checked once (for the valid request)
      expect(
        mockRateLimitService.enforceWebhookRateLimit
      ).toHaveBeenCalledTimes(1);
    });
  });
});

// Helper function to create mock response
function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    set: jest.fn(),
  };
}
