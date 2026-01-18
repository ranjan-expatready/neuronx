import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookService } from '../webhook.service';
import { WebhookRepository } from '../webhook.repository';
import { SecretService } from '../../secrets/secret.service';

describe('WebhookService', () => {
  let service: WebhookService;
  let mocks: any;

  beforeEach(() => {
    mocks = {
      webhookRepository: {
        createEndpoint: vi.fn(),
        getEndpointById: vi.fn(),
        listActiveEndpoints: vi.fn(),
        updateEndpoint: vi.fn(),
        createDelivery: vi.fn(),
      },
      secretService: {
        putSecret: vi.fn(),
        rotateSecret: vi.fn(),
      },
    };

    service = new WebhookService(
      mocks.webhookRepository as unknown as WebhookRepository,
      mocks.secretService as unknown as SecretService
    );
  });

  describe('createEndpoint', () => {
    it('should create endpoint with secret', async () => {
      const request = {
        name: 'Test Endpoint',
        url: 'https://example.com/webhook',
        eventTypes: ['payment.paid'],
      };

      mocks.secretService.putSecret.mockResolvedValue('secret-ref-1');
      mocks.webhookRepository.createEndpoint.mockResolvedValue('end-1');
      mocks.webhookRepository.getEndpointById.mockResolvedValue({
        id: 'end-1',
        tenantId: 't1',
        ...request,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createEndpoint('t1', request);

      expect(result.id).toBe('end-1');
      expect(mocks.secretService.putSecret).toHaveBeenCalled();
      expect(mocks.webhookRepository.createEndpoint).toHaveBeenCalled();
    });

    it('should throw if URL is not HTTPS', async () => {
      const request = {
        name: 'Test',
        url: 'http://insecure.com',
        eventTypes: ['payment.paid'],
      };

      await expect(service.createEndpoint('t1', request)).rejects.toThrow(
        'must use HTTPS'
      );
    });
  });

  describe('testEndpointDelivery', () => {
    it('should create a test delivery', async () => {
      mocks.webhookRepository.getEndpointById.mockResolvedValue({
        id: 'end-1',
      });
      mocks.webhookRepository.createDelivery.mockResolvedValue('del-1');

      const result = await service.testEndpointDelivery('t1', 'end-1', 'admin');

      expect(result.deliveryId).toBe('del-1');
      expect(mocks.webhookRepository.createDelivery).toHaveBeenCalled();
    });

    it('should respect rate limits', async () => {
      mocks.webhookRepository.getEndpointById.mockResolvedValue({
        id: 'end-1',
      });

      // Consume limit
      for (let i = 0; i < 10; i++) {
        await service.testEndpointDelivery('t1', 'end-1', 'admin');
      }

      await expect(
        service.testEndpointDelivery('t1', 'end-1', 'admin')
      ).rejects.toThrow('rate limit exceeded');
    });
  });
});
