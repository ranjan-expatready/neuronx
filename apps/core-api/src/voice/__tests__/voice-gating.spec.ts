/**
 * Voice Gating Tests - REQ-001: PAID → CaseOpen Voice Control Plane
 *
 * Tests that voice actions are ONLY allowed for CaseOpen opportunities with verified PAID payments.
 * External voice systems are treated as execution-only - VoiceService emits intents ONLY.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '../../eventing';
import { ConfigLoader } from '../../config/config.loader';
import { AuditService } from '../../audit/audit.service';
import { OpportunityService } from '../../sales/opportunity.service';
import { PaymentService } from '../../payments/payment.service';
import { VoiceService } from '../voice.service';
import { VoicePolicyEngine, validateVoiceConfiguration } from '../voice.policy';
import { VoiceEventEmitter } from '../voice.events';
import { VoiceActionRequest, VoiceConfiguration } from '../voice.types';
import { NeuronXConfiguration } from '../../config/config.types';

describe('Voice Control Plane - PAID → CaseOpen Gating', () => {
  let voiceService: VoiceService;
  let paymentService: PaymentService;
  let opportunityService: OpportunityService;
  let configLoader: ConfigLoader;
  let eventBus: EventBus;

  // Test data
  const tenantId = 'test-tenant';
  const opportunityId = 'opp-123-paid';
  const correlationId = 'test-correlation-123';

  // Mock services
  const mockAuditService = {
    logEvent: jest.fn(),
  };

  const mockOpportunityService = {
    isOpportunityCaseOpen: jest.fn(),
  };

  const mockEventBus = {
    publish: jest.fn(),
  };

  // Test configurations
  const enabledVoiceConfig = (): VoiceConfiguration => ({
    enabled: true,
    allowedChannels: ['inbound', 'outbound'],
    maxAttemptsPerCase: 5,
    quietHours: {
      enabled: false, // Disabled for testing
      startHour: 22,
      endHour: 8,
      timezone: 'America/New_York',
    },
    maxCallDurationMinutes: 30,
    retryPolicy: {
      maxRetries: 3,
      retryDelayMinutes: 60,
    },
  });

  const disabledVoiceConfig = (): VoiceConfiguration => ({
    ...enabledVoiceConfig(),
    enabled: false,
  });

  const restrictiveVoiceConfig = (): VoiceConfiguration => ({
    ...enabledVoiceConfig(),
    allowedChannels: ['inbound'], // Only inbound allowed
    maxAttemptsPerCase: 1, // Very restrictive
  });

  const createVoiceConfig = (
    voiceConfig: VoiceConfiguration
  ): NeuronXConfiguration => ({
    version: '1.0.0',
    description: 'Voice config for testing',
    timestamp: new Date().toISOString(),
    domains: {
      voice: voiceConfig,
      scoring: {} as any,
      routing: {} as any,
      sla: {} as any,
      escalation: {} as any,
      featureFlags: {} as any,
      deploymentMode: {} as any,
      integrationMappings: {} as any,
    },
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceService,
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
        {
          provide: ConfigLoader,
          useClass: ConfigLoader,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: OpportunityService,
          useValue: mockOpportunityService,
        },
        {
          provide: PaymentService,
          useClass: PaymentService,
        },
      ],
    }).compile();

    voiceService = module.get<VoiceService>(VoiceService);
    paymentService = module.get<PaymentService>(PaymentService);
    opportunityService = module.get<OpportunityService>(OpportunityService);
    configLoader = module.get<ConfigLoader>(ConfigLoader);
    eventBus = module.get<EventBus>(EventBus);

    // Clear all state
    paymentService.clearAllPayments();
    voiceService.clearVoiceAttemptHistory();
    jest.clearAllMocks();

    // Setup default mocks
    mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
  });

  afterEach(() => {
    paymentService.clearAllPayments();
    voiceService.clearVoiceAttemptHistory();
  });

  describe('CRITICAL: PAID → CaseOpen Voice Gating', () => {
    it('should ALLOW voice actions ONLY for CaseOpen opportunities with verified PAID payments', async () => {
      // Setup: CaseOpen opportunity with verified PAID payment
      const voiceConfig = enabledVoiceConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        createVoiceConfig(voiceConfig),
        { tenantId, environment: 'prod' }
      );

      // Mock opportunity as CaseOpen
      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);

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

      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request voice action - should be ALLOWED
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound',
        correlationId,
      };

      const result = await voiceService.requestVoiceAction(request);

      // Verify authorization
      expect(result.authorized).toBe(true);
      expect(result.reason).toBe('authorized_caseopen_paid');
      expect(result.opportunityState?.isCaseOpen).toBe(true);
      expect(result.opportunityState?.paymentVerified).toBe(true);

      // Verify voice intent event was emitted
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice.intent.authorized',
          tenantId,
          payload: expect.objectContaining({
            opportunityId,
            actionType: 'outbound_call',
            channel: 'outbound',
            authorization: expect.objectContaining({
              paymentVerified: true,
              caseOpenVerified: true,
            }),
          }),
        })
      );
    });

    it('should DENY voice actions for opportunities NOT in CaseOpen state', async () => {
      // Setup: Opportunity NOT in CaseOpen state
      const voiceConfig = enabledVoiceConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        createVoiceConfig(voiceConfig),
        { tenantId, environment: 'prod' }
      );

      // Mock opportunity as NOT CaseOpen
      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(false);

      // Create and verify payment (payment is verified, but opportunity is not CaseOpen)
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

      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request voice action - should be DENIED
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound',
        correlationId,
      };

      const result = await voiceService.requestVoiceAction(request);

      // Verify denial
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('denied_not_caseopen');
      expect(result.opportunityState?.isCaseOpen).toBe(false);
      expect(result.opportunityState?.paymentVerified).toBe(true);

      // Verify NO voice intent event was emitted
      const intentEvents = mockEventBus.publish.mock.calls.filter(
        call => call[0].type === 'voice.intent.authorized'
      );
      expect(intentEvents).toHaveLength(0);

      // Verify denial event was emitted
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice.action.denied',
          tenantId,
          opportunityId,
        })
      );
    });

    it('should DENY voice actions when payment is NOT verified as PAID', async () => {
      // Setup: CaseOpen opportunity with INITIATED payment (not verified)
      const voiceConfig = enabledVoiceConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        createVoiceConfig(voiceConfig),
        { tenantId, environment: 'prod' }
      );

      // Mock opportunity as CaseOpen
      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);

      // Create payment but do NOT verify it (stays INITIATED)
      await paymentService.initiatePayment(
        {
          tenantId,
          amount: 10000,
          currency: 'USD',
          source: opportunityId,
        },
        correlationId,
        'test-user'
      );

      // Request voice action - should be DENIED
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound',
        correlationId,
      };

      const result = await voiceService.requestVoiceAction(request);

      // Verify denial
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('denied_payment_not_verified');
      expect(result.opportunityState?.isCaseOpen).toBe(true);
      expect(result.opportunityState?.paymentVerified).toBe(false);

      // Verify NO voice intent event was emitted
      const intentEvents = mockEventBus.publish.mock.calls.filter(
        call => call[0].type === 'voice.intent.authorized'
      );
      expect(intentEvents).toHaveLength(0);
    });
  });

  describe('Configuration-Driven Voice Behavior', () => {
    it('should deny voice actions when voice is disabled for tenant', async () => {
      // Setup: Voice disabled for tenant
      const voiceConfig = disabledVoiceConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        createVoiceConfig(voiceConfig),
        { tenantId, environment: 'prod' }
      );

      // Setup valid CaseOpen + PAID state
      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
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
      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request voice action - should be DENIED
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound',
        correlationId,
      };

      const result = await voiceService.requestVoiceAction(request);

      // Verify denial due to disabled voice
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('denied_voice_disabled');
    });

    it('should respect allowed channels configuration', async () => {
      // Setup: Only inbound channel allowed
      const voiceConfig = restrictiveVoiceConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        createVoiceConfig(voiceConfig),
        { tenantId, environment: 'prod' }
      );

      // Setup valid CaseOpen + PAID state
      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
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
      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request outbound call - should be DENIED
      const outboundRequest: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound', // Not allowed
        correlationId,
      };

      const outboundResult =
        await voiceService.requestVoiceAction(outboundRequest);
      expect(outboundResult.authorized).toBe(false);
      expect(outboundResult.reason).toBe('denied_channel_not_allowed');

      // Request inbound call - should be ALLOWED
      const inboundRequest: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'inbound_response',
        channel: 'inbound', // Allowed
        correlationId,
      };

      const inboundResult =
        await voiceService.requestVoiceAction(inboundRequest);
      expect(inboundResult.authorized).toBe(true);
      expect(inboundResult.reason).toBe('authorized_caseopen_paid');
    });

    it('should enforce maximum attempts per case', async () => {
      // Setup: Maximum 1 attempt per case
      const voiceConfig = restrictiveVoiceConfig(); // maxAttemptsPerCase: 1
      await configLoader.saveConfig(
        'neuronx-config',
        createVoiceConfig(voiceConfig),
        { tenantId, environment: 'prod' }
      );

      // Setup valid CaseOpen + PAID state
      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
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
      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // First voice action - should be ALLOWED
      const firstRequest: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'inbound_response',
        channel: 'inbound',
        correlationId: correlationId + '-1',
      };

      const firstResult = await voiceService.requestVoiceAction(firstRequest);
      expect(firstResult.authorized).toBe(true);

      // Second voice action - should be DENIED (exceeds max attempts)
      const secondRequest: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'follow_up_call',
        channel: 'inbound',
        correlationId: correlationId + '-2',
      };

      const secondResult = await voiceService.requestVoiceAction(secondRequest);
      expect(secondResult.authorized).toBe(false);
      expect(secondResult.reason).toBe('denied_max_attempts_exceeded');
    });
  });

  describe('External Voice System Isolation', () => {
    it('should ONLY emit voice intent events - never direct voice calls', async () => {
      // Setup valid CaseOpen + PAID state
      const voiceConfig = enabledVoiceConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        createVoiceConfig(voiceConfig),
        { tenantId, environment: 'prod' }
      );

      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
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
      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request voice action
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound',
        correlationId,
      };

      await voiceService.requestVoiceAction(request);

      // Verify ONLY voice.intent.authorized event was emitted
      // (External voice systems consume this event to make actual calls)
      const publishedEvents = mockEventBus.publish.mock.calls.map(
        call => call[0]
      );

      const intentEvents = publishedEvents.filter(
        event => event.type === 'voice.intent.authorized'
      );
      expect(intentEvents).toHaveLength(1);

      // Verify NO direct voice call events or external API calls
      const externalCallEvents = publishedEvents.filter(
        event =>
          event.type.includes('call') ||
          (event.type.includes('voice') &&
            event.type !== 'voice.intent.authorized')
      );
      // Should only be the intent event, no actual calling events
      expect(externalCallEvents).toHaveLength(1); // Just the intent event
    });

    it('should emit properly structured intent events for external consumption', async () => {
      // Setup valid state
      const voiceConfig = enabledVoiceConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        createVoiceConfig(voiceConfig),
        { tenantId, environment: 'prod' }
      );

      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
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
      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request voice action
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'escalation_call',
        channel: 'outbound',
        correlationId,
      };

      await voiceService.requestVoiceAction(request);

      // Verify intent event structure
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice.intent.authorized',
          tenantId,
          eventId: expect.any(String),
          timestamp: expect.any(String),
          correlationId,
          payload: expect.objectContaining({
            opportunityId,
            actionType: 'escalation_call',
            channel: 'outbound',
            configuration: voiceConfig,
            authorization: expect.objectContaining({
              authorizedAt: expect.any(String),
              authorizedBy: 'voice-service',
              paymentVerified: true,
              caseOpenVerified: true,
            }),
          }),
        })
      );
    });
  });

  describe('Audit Trail & Compliance', () => {
    it('should emit comprehensive audit events for all authorization decisions', async () => {
      // Setup valid state
      const voiceConfig = enabledVoiceConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        createVoiceConfig(voiceConfig),
        { tenantId, environment: 'prod' }
      );

      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
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
      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request voice action
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound',
        correlationId,
      };

      await voiceService.requestVoiceAction(request);

      // Verify audit events were emitted
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        'voice.authorization.checked',
        expect.any(Object)
      );
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        'voice.intent.emitted',
        expect.any(Object)
      );

      // Verify event bus audit events
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice.authorization.checked',
          tenantId,
          opportunityId,
        })
      );
    });

    it('should audit denial events with reason context', async () => {
      // Setup: Voice disabled
      const voiceConfig = disabledVoiceConfig();
      await configLoader.saveConfig(
        'neuronx-config',
        createVoiceConfig(voiceConfig),
        { tenantId, environment: 'prod' }
      );

      // Setup valid CaseOpen + PAID (but voice disabled)
      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
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
      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request voice action - will be denied
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound',
        correlationId,
      };

      await voiceService.requestVoiceAction(request);

      // Verify denial audit event
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'voice.action.denied',
          tenantId,
          opportunityId,
          actionType: 'outbound_call',
          result: expect.objectContaining({
            authorized: false,
            reason: 'denied_voice_disabled',
          }),
        })
      );
    });
  });

  describe('Configuration Fallback & Safety', () => {
    it('should fall back to secure defaults when configuration is missing', async () => {
      // Don't setup any voice configuration

      // Setup valid CaseOpen + PAID state
      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
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
      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request voice action - should be DENIED (defaults disable voice)
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound',
        correlationId,
      };

      const result = await voiceService.requestVoiceAction(request);

      // Should deny due to secure defaults (voice disabled)
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('denied_voice_disabled');
    });

    it('should handle configuration loading errors gracefully', async () => {
      // Mock config loader to throw error
      jest
        .spyOn(configLoader, 'loadConfig')
        .mockRejectedValue(new Error('Config load failed'));

      // Setup valid CaseOpen + PAID state
      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
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
      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request voice action - should fall back to defaults
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound',
        correlationId,
      };

      const result = await voiceService.requestVoiceAction(request);

      // Should deny due to secure defaults
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('denied_voice_disabled');
    });

    it('should validate voice configuration and fall back on invalid config', async () => {
      // Setup invalid voice configuration
      const invalidConfig: NeuronXConfiguration = {
        version: '1.0.0',
        description: 'Invalid voice config',
        timestamp: new Date().toISOString(),
        domains: {
          voice: {
            enabled: true,
            allowedChannels: ['invalid_channel'], // Invalid channel
            maxAttemptsPerCase: -1, // Invalid negative number
            quietHours: {
              enabled: true,
              startHour: 25, // Invalid hour
              endHour: 8,
              timezone: 'Invalid/Timezone',
            },
            maxCallDurationMinutes: 0, // Invalid zero
            retryPolicy: {
              maxRetries: -5, // Invalid negative
              retryDelayMinutes: 0, // Invalid zero
            },
          } as any,
          scoring: {} as any,
          routing: {} as any,
          sla: {} as any,
          escalation: {} as any,
          featureFlags: {} as any,
          deploymentMode: {} as any,
          integrationMappings: {} as any,
        },
      };

      await configLoader.saveConfig('neuronx-config', invalidConfig, {
        tenantId,
        environment: 'prod',
      });

      // Setup valid CaseOpen + PAID state
      mockOpportunityService.isOpportunityCaseOpen.mockResolvedValue(true);
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
      await paymentService.verifyPayment(
        {
          paymentId: payment.paymentId,
          tenantId,
        },
        correlationId,
        'test-system'
      );

      // Request voice action - should fall back to defaults due to invalid config
      const request: VoiceActionRequest = {
        tenantId,
        opportunityId,
        actionType: 'outbound_call',
        channel: 'outbound',
        correlationId,
      };

      const result = await voiceService.requestVoiceAction(request);

      // Should deny due to secure defaults (invalid config falls back to disabled)
      expect(result.authorized).toBe(false);
      expect(result.reason).toBe('denied_voice_disabled');
    });
  });
});
