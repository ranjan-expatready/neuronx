import { Test, TestingModule } from '@nestjs/testing';
import { GhlWebhookController } from '../ghl-webhook.controller';
import { EventBus } from '../../../eventing';

describe('GhlWebhookController', () => {
  let controller: GhlWebhookController;
  let eventBus: EventBus;

  const mockEventBus = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GhlWebhookController],
      providers: [
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    controller = module.get<GhlWebhookController>(GhlWebhookController);
    eventBus = module.get<EventBus>(EventBus);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should process contact.created webhook', async () => {
      const webhookPayload = {
        id: 'test-webhook-001',
        tenantId: 'test-tenant',
        type: 'contact.created',
        payload: {
          contact: {
            id: 'contact-123',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
          },
        },
      };

      const mockReq = {
        headers: {
          'x-ghl-signature': 'valid_signature',
        },
        body: webhookPayload,
      };

      const result = await controller.handleWebhook(
        mockReq as any,
        'test-tenant'
      );

      expect(result).toEqual({ status: 'processed' });
      expect(mockEventBus.publish).toHaveBeenCalledWith({
        type: 'contact.created',
        tenantId: 'test-tenant',
        correlationId: expect.any(String),
        timestamp: expect.any(Date),
        payload: webhookPayload.payload,
      });
    });

    it('should reject webhook with invalid signature', async () => {
      const webhookPayload = {
        id: 'test-webhook-001',
        type: 'contact.created',
        payload: { contact: { id: 'contact-123' } },
      };

      const mockReq = {
        headers: {
          'x-ghl-signature': 'invalid_signature',
        },
        body: webhookPayload,
      };

      await expect(
        controller.handleWebhook(mockReq as any, 'test-tenant')
      ).rejects.toThrow('Invalid signature');
    });

    it('should handle webhook replay attacks', async () => {
      const webhookPayload = {
        id: 'test-webhook-001',
        tenantId: 'test-tenant',
        type: 'contact.created',
        payload: { contact: { id: 'contact-123' } },
      };

      // Mock the replay detection logic
      const mockReq = {
        headers: {
          'x-ghl-signature': 'valid_signature',
          'x-webhook-id': 'test-webhook-001',
        },
        body: webhookPayload,
      };

      // First call should succeed
      const result1 = await controller.handleWebhook(
        mockReq as any,
        'test-tenant'
      );
      expect(result1).toEqual({ status: 'processed' });

      // Second call with same ID should be rejected (replay)
      await expect(
        controller.handleWebhook(mockReq as any, 'test-tenant')
      ).rejects.toThrow('Webhook replay detected');
    });
  });
});
