import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoiceService } from '../voice.service';
import { EventBus } from '../../eventing';
import { DurableEventPublisherService } from '../../eventing/durable-event-publisher';
import { ConfigLoader } from '../../config/config.loader';
import { OpportunityService } from '../../sales/opportunity.service';
import { PaymentService } from '../../payments/payment.service';
import { AuditService } from '../../audit/audit.service';
import { UsageService } from '../../usage/usage.service';
import { VoiceAttemptRepository } from '../voice-attempt.repository';

describe('VoiceService', () => {
  let service: VoiceService;
  let mocks: any;

  beforeEach(() => {
    mocks = {
      eventBus: { publish: vi.fn() },
      durableEventPublisher: { publishAsync: vi.fn() },
      configLoader: { loadConfig: vi.fn() },
      opportunityService: { isOpportunityCaseOpen: vi.fn() },
      paymentService: { isPaymentVerifiedPaid: vi.fn() },
      auditService: { logEvent: vi.fn() },
      usageService: { recordUsage: vi.fn() },
      voiceAttemptRepository: {
        updateFromProvider: vi.fn(),
        createExecutionEvent: vi.fn(),
        linkToCase: vi.fn(),
        queryAttemptsByLead: vi.fn().mockResolvedValue([]),
        createAttempt: vi.fn(),
        authorizeAttempt: vi.fn(),
      },
    };

    service = new VoiceService(
      mocks.eventBus as unknown as EventBus,
      mocks.durableEventPublisher as unknown as DurableEventPublisherService,
      mocks.configLoader as unknown as ConfigLoader,
      mocks.opportunityService as unknown as OpportunityService,
      mocks.paymentService as unknown as PaymentService,
      mocks.auditService as unknown as AuditService,
      mocks.usageService as unknown as UsageService,
      mocks.voiceAttemptRepository as unknown as VoiceAttemptRepository
    );

    // @ts-ignore
    service['voiceAttempts'] = new Map();
  });

  describe('requestVoiceAction', () => {
    it('should allow voice action when opportunity is case-open and paid', async () => {
      const request = {
        tenantId: 't1',
        opportunityId: 'o1',
        actionType: 'outbound_call',
        channel: 'voice',
        correlationId: 'c1',
      };

      mocks.configLoader.loadConfig.mockResolvedValue({
        domains: {
          voice: {
            enabled: true,
            maxAttemptsPerLead: 3,
            maxCallDurationMinutes: 10,
          },
        },
      });
      mocks.opportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
      mocks.paymentService.isPaymentVerifiedPaid.mockReturnValue(true);

      const result = await service.requestVoiceAction(request);

      expect(result.authorized).toBe(true);
      expect(mocks.voiceAttemptRepository.createAttempt).toHaveBeenCalled();
      expect(mocks.durableEventPublisher.publishAsync).toHaveBeenCalled();
    });

    it('should deny voice action when opportunity is not case-open', async () => {
      const request = {
        tenantId: 't1',
        opportunityId: 'o1',
        actionType: 'outbound_call',
        channel: 'voice',
        correlationId: 'c1',
      };

      mocks.configLoader.loadConfig.mockResolvedValue({
        domains: { voice: { enabled: true, maxAttemptsPerLead: 3 } },
      });
      mocks.opportunityService.isOpportunityCaseOpen.mockResolvedValue(false);
      mocks.paymentService.isPaymentVerifiedPaid.mockReturnValue(true);

      const result = await service.requestVoiceAction(request);

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('denied_opportunity_state');
      expect(mocks.voiceAttemptRepository.createAttempt).not.toHaveBeenCalled();
    });

    it('should deny voice action when payment is not verified', async () => {
      const request = {
        tenantId: 't1',
        opportunityId: 'o1',
        actionType: 'outbound_call',
        channel: 'voice',
        correlationId: 'c1',
      };

      mocks.configLoader.loadConfig.mockResolvedValue({
        domains: { voice: { enabled: true, maxAttemptsPerLead: 3 } },
      });
      mocks.opportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
      mocks.paymentService.isPaymentVerifiedPaid.mockReturnValue(false);

      const result = await service.requestVoiceAction(request);

      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('denied_payment_not_verified');
    });
  });

  describe('handleProviderWebhook', () => {
    it('should update attempt and publish event', async () => {
      mocks.voiceAttemptRepository.updateFromProvider.mockResolvedValue(
        'att-1'
      );

      const result = await service.handleProviderWebhook(
        't1',
        'twilio',
        'call-1',
        'completed',
        { duration: 120 }
      );

      expect(result).toBe(true);
      expect(
        mocks.voiceAttemptRepository.updateFromProvider
      ).toHaveBeenCalled();
      expect(
        mocks.voiceAttemptRepository.createExecutionEvent
      ).toHaveBeenCalled();
      expect(mocks.durableEventPublisher.publishAsync).toHaveBeenCalled();
    });

    it('should return false if no attempt found', async () => {
      mocks.voiceAttemptRepository.updateFromProvider.mockResolvedValue(null);
      const result = await service.handleProviderWebhook(
        't1',
        'twilio',
        'call-1',
        'completed'
      );
      expect(result).toBe(false);
    });
  });
});
