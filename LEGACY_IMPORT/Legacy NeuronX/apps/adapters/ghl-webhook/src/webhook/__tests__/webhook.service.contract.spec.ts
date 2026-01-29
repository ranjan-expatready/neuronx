import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from '../webhook.service';
import { EventBus } from '@neuronx/eventing';

describe('WebhookService Contract Tests', () => {
  let service: WebhookService;
  let eventBus: jest.Mocked<EventBus>;

  beforeEach(async () => {
    const mockEventBus = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    eventBus = module.get(EventBus);
  });

  it('should transform GHL lead created payload to sales.lead.created event', async () => {
    // Arrange
    const ghlPayload = {
      id: 'ghl-123',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      company: 'Acme Corp',
      source: 'paid',
      createdAt: '2024-01-15T10:30:00Z',
    };
    const tenantId = 'tenant-123';

    // Act
    await service.processLeadCreatedWebhook(ghlPayload, tenantId);

    // Assert
    expect(eventBus.publish).toHaveBeenCalledWith({
      id: expect.any(String),
      tenantId,
      type: 'sales.lead.created',
      data: {
        externalId: 'ghl-123',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Acme Corp',
        source: 'paid',
        createdAt: '2024-01-15T10:30:00Z',
      },
      metadata: {
        timestamp: expect.any(Date),
        correlationId: expect.any(String),
        source: 'ghl-webhook',
        originalId: 'ghl-123',
        idempotencyKey: 'ghl-123',
      },
    });
  });

  it('should handle minimal GHL payload', async () => {
    // Arrange
    const ghlPayload = {
      id: 'ghl-456',
      email: 'jane.smith@example.com',
    };
    const tenantId = 'tenant-456';

    // Act
    await service.processLeadCreatedWebhook(ghlPayload, tenantId);

    // Assert
    expect(eventBus.publish).toHaveBeenCalledWith({
      id: expect.any(String),
      tenantId,
      type: 'sales.lead.created',
      data: {
        externalId: 'ghl-456',
        email: 'jane.smith@example.com',
        source: 'unknown', // Default value
      },
      metadata: {
        timestamp: expect.any(Date),
        correlationId: expect.any(String),
        source: 'ghl-webhook',
        originalId: 'ghl-456',
        idempotencyKey: 'ghl-456',
      },
    });
  });

  it('should accept webhook signatures (stub implementation)', () => {
    // Arrange
    const payload = { id: 'test' };
    const signature = 'test-signature';

    // Act
    const isValid = service.validateWebhookSignature(payload, signature);

    // Assert
    expect(isValid).toBe(true); // Stub always returns true
  });
});
