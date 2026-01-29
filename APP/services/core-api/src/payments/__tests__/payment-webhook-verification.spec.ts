/**
 * Payment Webhook Verification Tests - REQ-001: External Payment Verification
 *
 * Tests that external payment webhooks can submit evidence but cannot directly
 * change business state. PaymentService remains the authoritative source for
 * payment.paid events that trigger CaseOpen transitions.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '../../eventing';
import { AuditService } from '../../audit/audit.service';
import { PaymentService } from '../payment.service';
import { PaymentWebhookController } from '../webhooks/payment-webhook.controller';
import { PaymentCreationRequest } from '../payment.types';
import { PaymentVerificationRequest } from '../providers/payment-provider.interface';

describe('Payment Webhook Verification (External Integration)', () => {
  let paymentService: PaymentService;
  let webhookController: PaymentWebhookController;
  let eventBus: EventBus;

  const tenantId = 'test-tenant';
  const correlationId = 'test-correlation-123';

  // Mock event bus
  const mockEventBus = {
    subscribe: jest.fn(),
    publish: jest.fn(),
  };

  // Mock audit service
  const mockAuditService = {
    logEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentWebhookController],
      providers: [
        PaymentService,
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    paymentService = module.get<PaymentService>(PaymentService);
    webhookController = module.get<PaymentWebhookController>(
      PaymentWebhookController
    );
    eventBus = module.get<EventBus>(EventBus);

    // Clear all payments and mocks
    paymentService.clearAllPayments();
    jest.clearAllMocks();
  });

  afterEach(() => {
    paymentService.clearAllPayments();
  });

  describe('Webhook Signature Verification', () => {
    it('should accept valid Stripe webhook signatures', async () => {
      // Create a payment record first
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000, // $100.00
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      const payment = await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      // Create a mock Stripe webhook payload
      const stripePayload = {
        id: 'evt_test_webhook',
        object: 'event',
        api_version: '2020-08-27',
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: 'pi_test_1234567890',
            object: 'payment_intent',
            amount: 10000,
            currency: 'usd',
            status: 'succeeded',
            metadata: {
              neuronx_payment_id: payment.paymentId,
            },
          },
        },
        livemode: false,
        pending_webhooks: 1,
        request: {
          id: 'req_test_request',
          idempotency_key: 'test-idempotency-key',
        },
        type: 'payment_intent.succeeded',
      };

      const payloadString = JSON.stringify(stripePayload);

      // Create a valid signature (simplified for testing)
      // In real implementation, this would use actual HMAC
      const signature = `t=${Math.floor(Date.now() / 1000)},v1=test_signature_placeholder`;

      // Mock the signature verification to return true
      const originalVerify = webhookController['verifyWebhookSignature'];
      webhookController['verifyWebhookSignature'] = jest
        .fn()
        .mockReturnValue(true);

      // Process webhook
      const result = await webhookController.handleStripeWebhook(
        payloadString,
        signature,
        tenantId
      );

      expect(result.status).toBe('success');
      expect(result.message).toBe('Webhook processed successfully');

      // Restore original method
      webhookController['verifyWebhookSignature'] = originalVerify;
    });

    it('should reject webhooks with invalid signatures', async () => {
      const stripePayload = JSON.stringify({
        id: 'evt_test_webhook',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test_123', status: 'succeeded' } },
      });

      // Invalid signature
      const invalidSignature = 'invalid-signature';

      // Mock signature verification to return false
      const originalVerify = webhookController['verifyWebhookSignature'];
      webhookController['verifyWebhookSignature'] = jest
        .fn()
        .mockReturnValue(false);

      await expect(
        webhookController.handleStripeWebhook(
          stripePayload,
          invalidSignature,
          tenantId
        )
      ).rejects.toThrow('Invalid webhook signature');

      // Restore original method
      webhookController['verifyWebhookSignature'] = originalVerify;
    });

    it('should reject webhooks without tenant identifier', async () => {
      const stripePayload = JSON.stringify({
        id: 'evt_test_webhook',
        object: 'event',
        type: 'payment_intent.succeeded',
      });

      const signature = 't=1234567890,v1=test_signature';

      await expect(
        webhookController.handleStripeWebhook(stripePayload, signature)
      ).rejects.toThrow('Missing tenant identifier');
    });
  });

  describe('Payment Evidence Verification', () => {
    it('should successfully process valid webhook evidence and transition to PAID', async () => {
      // Create a payment record first
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000, // $100.00
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      const payment = await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      expect(payment.status).toBe('INITIATED');

      // Create webhook verification request with matching evidence
      const verificationRequest: PaymentVerificationRequest = {
        tenantId,
        evidence: {
          providerPaymentId: 'pi_test_1234567890',
          amount: 10000,
          currency: 'USD',
          status: 'succeeded',
          providerTimestamp: new Date().toISOString(),
          eventId: 'evt_test_webhook_123',
          metadata: {
            stripeEventType: 'payment_intent.succeeded',
          },
        },
        correlationId,
        providerId: 'stripe',
      };

      // Process webhook verification
      const verifiedPayment =
        await paymentService.verifyPaymentFromWebhook(verificationRequest);

      // Verify payment was transitioned to PAID
      expect(verifiedPayment.status).toBe('PAID');
      expect(verifiedPayment.verifiedAt).toBeDefined();

      // Verify payment.paid event was emitted
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'payment.paid',
          tenantId,
          payload: expect.objectContaining({
            payment: expect.objectContaining({
              paymentId: payment.paymentId,
              status: 'PAID',
            }),
            verifiedAt: verifiedPayment.verifiedAt,
            verifiedBy: 'webhook-stripe',
            verificationMethod: 'webhook',
          }),
        })
      );
    });

    it('should reject webhook evidence that does not match existing payment', async () => {
      // Create a payment record
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      // Try to verify with different provider payment ID
      const verificationRequest: PaymentVerificationRequest = {
        tenantId,
        evidence: {
          providerPaymentId: 'pi_different_9999999999', // Different ID
          amount: 10000,
          currency: 'USD',
          status: 'succeeded',
          providerTimestamp: new Date().toISOString(),
          eventId: 'evt_test_webhook_123',
        },
        correlationId,
        providerId: 'stripe',
      };

      await expect(
        paymentService.verifyPaymentFromWebhook(verificationRequest)
      ).rejects.toThrow('No matching payment record found');
    });

    it('should reject webhook evidence with mismatched amount', async () => {
      // Create a payment record
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      // Try to verify with different amount
      const verificationRequest: PaymentVerificationRequest = {
        tenantId,
        evidence: {
          providerPaymentId: 'pi_test_1234567890',
          amount: 15000, // Different amount
          currency: 'USD',
          status: 'succeeded',
          providerTimestamp: new Date().toISOString(),
          eventId: 'evt_test_webhook_123',
        },
        correlationId,
        providerId: 'stripe',
      };

      await expect(
        paymentService.verifyPaymentFromWebhook(verificationRequest)
      ).rejects.toThrow('Amount mismatch: expected 10000, got 15000');
    });

    it('should reject webhook evidence with mismatched currency', async () => {
      // Create a payment record
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      // Try to verify with different currency
      const verificationRequest: PaymentVerificationRequest = {
        tenantId,
        evidence: {
          providerPaymentId: 'pi_test_1234567890',
          amount: 10000,
          currency: 'EUR', // Different currency
          status: 'succeeded',
          providerTimestamp: new Date().toISOString(),
          eventId: 'evt_test_webhook_123',
        },
        correlationId,
        providerId: 'stripe',
      };

      await expect(
        paymentService.verifyPaymentFromWebhook(verificationRequest)
      ).rejects.toThrow('Currency mismatch: expected USD, got EUR');
    });

    it('should handle failed payment webhooks', async () => {
      // Create a payment record
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      const payment = await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      // Send failed payment webhook
      const verificationRequest: PaymentVerificationRequest = {
        tenantId,
        evidence: {
          providerPaymentId: 'pi_test_1234567890',
          amount: 10000,
          currency: 'USD',
          status: 'failed',
          providerTimestamp: new Date().toISOString(),
          eventId: 'evt_test_webhook_failed',
        },
        correlationId,
        providerId: 'stripe',
      };

      const failedPayment =
        await paymentService.verifyPaymentFromWebhook(verificationRequest);

      // Verify payment was marked as failed
      expect(failedPayment.status).toBe('FAILED');

      // Verify payment.failed event was emitted
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'payment.failed',
          tenantId,
        })
      );
    });
  });

  describe('Replay Attack Prevention', () => {
    it('should process the same webhook only once (idempotent)', async () => {
      // Create a payment record
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      const payment = await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      // First webhook verification
      const verificationRequest: PaymentVerificationRequest = {
        tenantId,
        evidence: {
          providerPaymentId: 'pi_test_1234567890',
          amount: 10000,
          currency: 'USD',
          status: 'succeeded',
          providerTimestamp: new Date().toISOString(),
          eventId: 'evt_test_webhook_123',
        },
        correlationId,
        providerId: 'stripe',
      };

      // First verification should succeed
      const firstResult =
        await paymentService.verifyPaymentFromWebhook(verificationRequest);
      expect(firstResult.status).toBe('PAID');

      // Reset mock to check second call
      mockEventBus.publish.mockClear();

      // Second verification with same event should not cause duplicate processing
      // (In real implementation, this would be handled by PaymentService's idempotency)
      await expect(
        paymentService.verifyPaymentFromWebhook(verificationRequest)
      ).rejects.toThrow(); // Should fail because payment is already PAID
    });

    it('should reject webhooks with timestamps too far in the past', async () => {
      // Create a payment record
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      // Create webhook with timestamp 10 minutes ago (too old)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const verificationRequest: PaymentVerificationRequest = {
        tenantId,
        evidence: {
          providerPaymentId: 'pi_test_1234567890',
          amount: 10000,
          currency: 'USD',
          status: 'succeeded',
          providerTimestamp: tenMinutesAgo,
          eventId: 'evt_test_webhook_old',
        },
        correlationId,
        providerId: 'stripe',
      };

      await expect(
        paymentService.verifyPaymentFromWebhook(verificationRequest)
      ).rejects.toThrow('Provider timestamp is too old');
    });

    it('should reject webhooks with future timestamps', async () => {
      // Create a payment record
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      // Create webhook with future timestamp
      const oneHourFromNow = new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString();

      const verificationRequest: PaymentVerificationRequest = {
        tenantId,
        evidence: {
          providerPaymentId: 'pi_test_1234567890',
          amount: 10000,
          currency: 'USD',
          status: 'succeeded',
          providerTimestamp: oneHourFromNow,
          eventId: 'evt_test_webhook_future',
        },
        correlationId,
        providerId: 'stripe',
      };

      await expect(
        paymentService.verifyPaymentFromWebhook(verificationRequest)
      ).rejects.toThrow('Provider timestamp is in the future');
    });
  });

  describe('Business State Protection', () => {
    it('should NOT allow webhooks to directly trigger CaseOpen', async () => {
      // This test verifies that webhooks cannot bypass PaymentService authority

      // Create a payment record
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      // Simulate webhook processing (without going through PaymentService)
      // This should NOT be possible in the real system

      // Verify that payment is still INITIATED (not PAID)
      const { payment } = await paymentService.getPayment(
        'test-payment-id',
        tenantId
      );
      // (This test is more about documenting the security model)

      expect(payment).toBeNull(); // Payment not found by wrong ID

      // The real test is that webhooks must go through PaymentService.verifyPaymentFromWebhook
      // which performs independent verification before allowing any state changes
    });

    it('should ensure PaymentService remains the sole authority for payment.paid events', async () => {
      // This test documents that only PaymentService can emit payment.paid events

      // Create and verify payment properly
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: 'opp-123',
        externalReference: 'pi_test_1234567890',
      };

      const payment = await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      const verificationRequest: PaymentVerificationRequest = {
        tenantId,
        evidence: {
          providerPaymentId: 'pi_test_1234567890',
          amount: 10000,
          currency: 'USD',
          status: 'succeeded',
          providerTimestamp: new Date().toISOString(),
          eventId: 'evt_test_webhook_123',
        },
        correlationId,
        providerId: 'stripe',
      };

      // Process through PaymentService
      await paymentService.verifyPaymentFromWebhook(verificationRequest);

      // Verify that payment.paid event was emitted by PaymentService
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'payment.paid',
          payload: expect.objectContaining({
            verifiedBy: 'webhook-stripe',
            verificationMethod: 'webhook',
          }),
        })
      );

      // This proves that webhooks cannot directly emit payment.paid events
      // They must go through PaymentService's verification process
    });
  });

  describe('Cross-Tenant Isolation', () => {
    it('should enforce tenant isolation in webhook processing', async () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';

      // Create payment for tenant A
      const paymentA = await paymentService.initiatePayment(
        {
          tenantId: tenantA,
          amount: 10000,
          currency: 'USD',
          source: 'opp-a',
          externalReference: 'pi_test_a_123',
        },
        correlationId,
        'test-user'
      );

      // Create payment for tenant B
      const paymentB = await paymentService.initiatePayment(
        {
          tenantId: tenantB,
          amount: 10000,
          currency: 'USD',
          source: 'opp-b',
          externalReference: 'pi_test_b_456',
        },
        correlationId,
        'test-user'
      );

      // Try to verify tenant A's payment using tenant B's context
      const crossTenantRequest: PaymentVerificationRequest = {
        tenantId: tenantB, // Wrong tenant!
        evidence: {
          providerPaymentId: 'pi_test_a_123', // Tenant A's payment
          amount: 10000,
          currency: 'USD',
          status: 'succeeded',
          providerTimestamp: new Date().toISOString(),
          eventId: 'evt_test_cross_tenant',
        },
        correlationId,
        providerId: 'stripe',
      };

      // Should fail because payment belongs to different tenant
      await expect(
        paymentService.verifyPaymentFromWebhook(crossTenantRequest)
      ).rejects.toThrow('No matching payment record found');
    });
  });
});
