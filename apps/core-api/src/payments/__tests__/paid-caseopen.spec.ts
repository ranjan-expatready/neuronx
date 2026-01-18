/**
 * PAID → CaseOpen Gate Tests - REQ-001: Revenue-Critical State Transition
 *
 * Tests the canonical, auditable rule that opportunities may enter CaseOpen
 * ONLY after verified PAID events. This is revenue and compliance critical.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '../../eventing';
import { AuditService } from '../../audit/audit.service';
import { ICRMAdapter } from '../../../packages/adapters/contracts';
import { PaymentService } from '../payment.service';
import { OpportunityService } from '../../sales/opportunity.service';
import {
  PaymentCreationRequest,
  PaymentVerificationRequest,
} from '../payment.types';
import { NeuronxEvent } from '@neuronx/contracts';

describe('PAID → CaseOpen Gate (Revenue Critical)', () => {
  let paymentService: PaymentService;
  let opportunityService: OpportunityService;
  let eventBus: EventBus;
  let crmAdapter: ICRMAdapter;

  // Test data
  const tenantId = 'test-tenant';
  const opportunityId = 'opp-123';
  const correlationId = 'test-correlation-123';

  // Mock CRM adapter
  const mockCRMAdapter = {
    createOpportunity: jest.fn(),
    updateOpportunity: jest.fn(),
    getOpportunity: jest.fn(),
  };

  // Mock audit service
  const mockAuditService = {
    logEvent: jest.fn(),
  };

  // Mock event bus with event tracking
  const mockEventBus = {
    subscribe: jest.fn(),
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        OpportunityService,
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: ICRMAdapter,
          useValue: mockCRMAdapter,
        },
      ],
    }).compile();

    paymentService = module.get<PaymentService>(PaymentService);
    opportunityService = module.get<OpportunityService>(OpportunityService);
    eventBus = module.get<EventBus>(EventBus);
    crmAdapter = module.get<ICRMAdapter>(ICRMAdapter);

    // Clear all mocks and state
    jest.clearAllMocks();
    paymentService.clearAllPayments();

    // Setup default mock responses
    mockCRMAdapter.updateOpportunity.mockResolvedValue({ success: true });
    mockCRMAdapter.getOpportunity.mockResolvedValue({ stage: 'qualification' });
  });

  afterEach(() => {
    paymentService.clearAllPayments();
  });

  describe('Authoritative PAID → CaseOpen Rule', () => {
    it('should ONLY allow CaseOpen transition after verified PAID payment', async () => {
      // Create and verify payment as PAID
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000, // $100.00
        currency: 'USD',
        source: opportunityId,
      };

      const payment = await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      const verificationRequest: PaymentVerificationRequest = {
        paymentId: payment.paymentId,
        tenantId,
      };

      const paidPayment = await paymentService.verifyPayment(
        verificationRequest,
        correlationId,
        'test-system',
        'manual'
      );

      // Verify payment is in PAID status with verification
      expect(paidPayment.status).toBe('PAID');
      expect(paidPayment.verifiedAt).toBeDefined();
      expect(
        paymentService.isPaymentVerifiedPaid(paidPayment.paymentId, tenantId)
      ).toBe(true);

      // Simulate payment.paid event (normally emitted by verifyPayment)
      const paidEvent: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment: paidPayment,
          verifiedAt: paidPayment.verifiedAt!,
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'INITIATED',
        },
        metadata: {
          correlationId,
        },
      };

      // Process the payment.paid event - should trigger CaseOpen
      await opportunityService.handle(paidEvent);

      // Verify opportunity was transitioned to CaseOpen
      expect(mockCRMAdapter.updateOpportunity).toHaveBeenCalledWith(
        opportunityId,
        expect.objectContaining({
          stage: 'case-open',
          metadata: expect.objectContaining({
            caseOpenTrigger: 'payment.paid',
            paymentId: paidPayment.paymentId,
          }),
        }),
        expect.any(Object)
      );

      // Verify CaseOpen event was emitted
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sales.opportunity.caseopened',
          tenantId,
          payload: expect.objectContaining({
            opportunityId,
            triggeredByPaymentId: paidPayment.paymentId,
          }),
        })
      );
    });

    it('should REJECT CaseOpen for INITIATED payments', async () => {
      // Create payment but do NOT verify it (stays INITIATED)
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: opportunityId,
      };

      const payment = await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      // Verify payment is INITIATED, not PAID
      expect(payment.status).toBe('INITIATED');
      expect(
        paymentService.isPaymentVerifiedPaid(payment.paymentId, tenantId)
      ).toBe(false);

      // Simulate fake payment.paid event (this should not happen in real code)
      const fakePaidEvent: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment,
          verifiedAt: new Date().toISOString(), // Fake verification
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'INITIATED',
        },
        metadata: {
          correlationId,
        },
      };

      // Process the fake event - should REJECT the transition
      await expect(opportunityService.handle(fakePaidEvent)).rejects.toThrow(
        `Payment ${payment.paymentId} is not verified as PAID`
      );

      // Verify opportunity was NOT transitioned to CaseOpen
      expect(mockCRMAdapter.updateOpportunity).not.toHaveBeenCalled();

      // Verify no CaseOpen event was emitted
      expect(mockEventBus.publish).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sales.opportunity.caseopened',
        })
      );
    });

    it('should REJECT CaseOpen for FAILED payments', async () => {
      // Create and fail payment
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: opportunityId,
      };

      const payment = await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      const failedPayment = await paymentService.failPayment(
        payment.paymentId,
        tenantId,
        'Card declined',
        correlationId,
        'payment-processor'
      );

      // Verify payment is FAILED
      expect(failedPayment.status).toBe('FAILED');
      expect(
        paymentService.isPaymentVerifiedPaid(failedPayment.paymentId, tenantId)
      ).toBe(false);

      // Simulate fake payment.paid event for failed payment
      const fakePaidEvent: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment: failedPayment,
          verifiedAt: new Date().toISOString(),
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'FAILED',
        },
        metadata: {
          correlationId,
        },
      };

      // Process the fake event - should REJECT
      await expect(opportunityService.handle(fakePaidEvent)).rejects.toThrow(
        `Payment ${failedPayment.paymentId} is not verified as PAID`
      );

      // Verify no CaseOpen transition occurred
      expect(mockCRMAdapter.updateOpportunity).not.toHaveBeenCalled();
    });

    it('should REJECT CaseOpen for REFUNDED payments', async () => {
      // Create, verify as paid, then refund
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: opportunityId,
      };

      const payment = await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      const paidPayment = await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Simulate refund (would be implemented in PaymentService)
      const refundedPayment = {
        ...paidPayment,
        status: 'REFUNDED' as const,
        updatedAt: new Date().toISOString(),
      };

      // Manually set refunded status for test
      paymentService.clearAllPayments();
      (paymentService as any).payments.set(
        refundedPayment.paymentId,
        refundedPayment
      );

      // Verify payment is REFUNDED
      expect(
        paymentService.isPaymentVerifiedPaid(
          refundedPayment.paymentId,
          tenantId
        )
      ).toBe(false);

      // Simulate fake payment.paid event for refunded payment
      const fakePaidEvent: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment: refundedPayment,
          verifiedAt: paidPayment.verifiedAt!,
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'REFUNDED',
        },
        metadata: {
          correlationId,
        },
      };

      // Process the fake event - should REJECT
      await expect(opportunityService.handle(fakePaidEvent)).rejects.toThrow(
        `Payment ${refundedPayment.paymentId} is not verified as PAID`
      );

      // Verify no CaseOpen transition occurred
      expect(mockCRMAdapter.updateOpportunity).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate PAID Event Handling', () => {
    it('should ignore duplicate PAID events (idempotent)', async () => {
      // Create and verify payment as PAID
      const paymentRequest: PaymentCreationRequest = {
        tenantId,
        amount: 10000,
        currency: 'USD',
        source: opportunityId,
      };

      const payment = await paymentService.initiatePayment(
        paymentRequest,
        correlationId,
        'test-user'
      );

      const paidPayment = await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // First payment.paid event - should trigger CaseOpen
      const paidEvent1: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment: paidPayment,
          verifiedAt: paidPayment.verifiedAt!,
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'INITIATED',
        },
        metadata: {
          correlationId: correlationId + '-1',
        },
      };

      await opportunityService.handle(paidEvent1);

      // Verify first CaseOpen transition
      expect(mockCRMAdapter.updateOpportunity).toHaveBeenCalledTimes(1);

      // Reset mock for second call
      mockCRMAdapter.updateOpportunity.mockClear();

      // Second duplicate payment.paid event - should be ignored
      const paidEvent2: NeuronxEvent = {
        ...paidEvent1,
        id: crypto.randomUUID(),
        metadata: {
          correlationId: correlationId + '-2',
        },
      };

      // Second event should not cause another transition
      await opportunityService.handle(paidEvent2);

      // Verify no additional CaseOpen transitions occurred
      expect(mockCRMAdapter.updateOpportunity).not.toHaveBeenCalled();
    });
  });

  describe('Cross-Tenant Isolation', () => {
    it('should enforce tenant isolation in payment-to-opportunity mapping', async () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';
      const opportunityA = 'opp-a';
      const opportunityB = 'opp-b';

      // Create payments for different tenants
      const paymentA = await paymentService.initiatePayment(
        {
          tenantId: tenantA,
          amount: 10000,
          currency: 'USD',
          source: opportunityA,
        },
        correlationId,
        'test-user'
      );

      const paymentB = await paymentService.initiatePayment(
        {
          tenantId: tenantB,
          amount: 10000,
          currency: 'USD',
          source: opportunityB,
        },
        correlationId,
        'test-user'
      );

      // Verify both payments
      const paidPaymentA = await paymentService.verifyPayment(
        { paymentId: paymentA.paymentId, tenantId: tenantA },
        correlationId,
        'test-system'
      );

      const paidPaymentB = await paymentService.verifyPayment(
        { paymentId: paymentB.paymentId, tenantId: tenantB },
        correlationId,
        'test-system'
      );

      // Create payment.paid events
      const paidEventA: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId: tenantA,
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment: paidPaymentA,
          verifiedAt: paidPaymentA.verifiedAt!,
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'INITIATED',
        },
        metadata: { correlationId },
      };

      const paidEventB: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId: tenantB,
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment: paidPaymentB,
          verifiedAt: paidPaymentB.verifiedAt!,
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'INITIATED',
        },
        metadata: { correlationId },
      };

      // Process events
      await opportunityService.handle(paidEventA);
      await opportunityService.handle(paidEventB);

      // Verify tenant A opportunity was updated
      expect(mockCRMAdapter.updateOpportunity).toHaveBeenCalledWith(
        opportunityA,
        expect.any(Object),
        expect.objectContaining({ tenantId: tenantA })
      );

      // Verify tenant B opportunity was updated
      expect(mockCRMAdapter.updateOpportunity).toHaveBeenCalledWith(
        opportunityB,
        expect.any(Object),
        expect.objectContaining({ tenantId: tenantB })
      );

      // Verify exactly 2 calls (one per tenant)
      expect(mockCRMAdapter.updateOpportunity).toHaveBeenCalledTimes(2);
    });

    it('should reject payment events from wrong tenant', async () => {
      // Create payment for tenant A
      const payment = await paymentService.initiatePayment(
        {
          tenantId: 'tenant-a',
          amount: 10000,
          currency: 'USD',
          source: opportunityId,
        },
        correlationId,
        'test-user'
      );

      // Create payment.paid event but claim it belongs to tenant B
      const paidEvent: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId: 'tenant-b', // Wrong tenant!
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment,
          verifiedAt: new Date().toISOString(),
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'INITIATED',
        },
        metadata: { correlationId },
      };

      // Process the event - should reject due to tenant mismatch
      await expect(opportunityService.handle(paidEvent)).rejects.toThrow(
        `Payment ${payment.paymentId} is not verified as PAID`
      );

      // Verify no CaseOpen transition occurred
      expect(mockCRMAdapter.updateOpportunity).not.toHaveBeenCalled();
    });
  });

  describe('Audit Trail Verification', () => {
    it('should emit comprehensive audit events for CaseOpen transitions', async () => {
      // Create and verify payment
      const payment = await paymentService.initiatePayment(
        {
          tenantId,
          amount: 10000,
          currency: 'USD',
          source: opportunityId,
        },
        correlationId,
        'test-user'
      );

      const paidPayment = await paymentService.verifyPayment(
        { paymentId: payment.paymentId, tenantId },
        correlationId,
        'test-system'
      );

      // Process payment.paid event
      const paidEvent: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment: paidPayment,
          verifiedAt: paidPayment.verifiedAt!,
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'INITIATED',
        },
        metadata: { correlationId },
      };

      await opportunityService.handle(paidEvent);

      // Verify audit events were emitted
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        'payment.initiated',
        expect.any(Object)
      );
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        'payment.verified.paid',
        expect.any(Object)
      );

      // Verify CaseOpen event was emitted
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sales.opportunity.caseopened',
          tenantId,
          payload: expect.objectContaining({
            opportunityId,
            triggeredByPaymentId: payment.paymentId,
          }),
        })
      );
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle CRM adapter failures gracefully', async () => {
      // Setup CRM adapter to fail
      mockCRMAdapter.updateOpportunity.mockRejectedValue(
        new Error('CRM update failed')
      );

      // Create and verify payment
      const payment = await paymentService.initiatePayment(
        {
          tenantId,
          amount: 10000,
          currency: 'USD',
          source: opportunityId,
        },
        correlationId,
        'test-user'
      );

      const paidPayment = await paymentService.verifyPayment(
        { paymentId: payment.paymentId, tenantId },
        correlationId,
        'test-system'
      );

      // Process payment.paid event - should handle CRM failure
      const paidEvent: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment: paidPayment,
          verifiedAt: paidPayment.verifiedAt!,
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'INITIATED',
        },
        metadata: { correlationId },
      };

      await expect(opportunityService.handle(paidEvent)).rejects.toThrow(
        'CRM update failed'
      );

      // Verify failure event was emitted
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sales.opportunity.caseopenFailed',
          tenantId,
          payload: expect.objectContaining({
            opportunityId,
            paymentId: payment.paymentId,
            error: 'CRM update failed',
          }),
        })
      );
    });

    it('should handle missing opportunity IDs in payment source', async () => {
      // Create payment with empty source
      const payment = await paymentService.initiatePayment(
        {
          tenantId,
          amount: 10000,
          currency: 'USD',
          source: '', // Empty source
        },
        correlationId,
        'test-user'
      );

      const paidPayment = await paymentService.verifyPayment(
        { paymentId: payment.paymentId, tenantId },
        correlationId,
        'test-system'
      );

      // Process payment.paid event - should reject due to missing opportunity ID
      const paidEvent: NeuronxEvent = {
        id: crypto.randomUUID(),
        type: 'payment.paid',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {},
        payload: {
          payment: paidPayment,
          verifiedAt: paidPayment.verifiedAt!,
          verifiedBy: 'test-system',
          verificationMethod: 'manual' as const,
          previousStatus: 'INITIATED',
        },
        metadata: { correlationId },
      };

      await expect(opportunityService.handle(paidEvent)).rejects.toThrow(
        'No opportunity ID found in payment source'
      );

      // Verify no CaseOpen transition occurred
      expect(mockCRMAdapter.updateOpportunity).not.toHaveBeenCalled();
    });
  });
});
