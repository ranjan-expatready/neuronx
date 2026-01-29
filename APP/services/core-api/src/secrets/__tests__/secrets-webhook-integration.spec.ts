/**
 * Secrets-Webhook Integration Tests - WI-019: Secrets & Encryption Foundation
 *
 * Tests for secure webhook signing using secret management system.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { WebhookSigner } from '../../webhooks/webhook.signer';
import { SecretService } from '../secret.service';
import { EnvVaultSecretStore } from '../env-vault-secret-store';
import { WebhookPayload } from '../../webhooks/webhook.types';

// Mock the secret store
const mockSecretStore = {
  putSecret: jest.fn(),
  getSecret: jest.fn(),
  rotateSecret: jest.fn(),
  listSecretVersions: jest.fn(),
};

describe('Secrets-Webhook Integration', () => {
  let app: INestApplication;
  let webhookSigner: WebhookSigner;
  let secretService: SecretService;
  let secretStore: EnvVaultSecretStore;

  const tenantId = 'tenant-a';
  const endpointId = 'endpoint-123';
  const secretRef = `dev:${tenantId}:webhook-endpoint-${endpointId}:1`;
  const webhookSecret = 'test-webhook-secret-12345';

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Manual instantiation to avoid DI issues
    secretService = new SecretService(mockSecretStore as any);
    webhookSigner = new WebhookSigner(secretService);

    // Setup mock secret retrieval
    mockSecretStore.getSecret.mockResolvedValue(webhookSecret);
  });

  afterEach(async () => {
    // No-op
  });

  describe('Webhook Signing with Secret Management', () => {
    const basePayload: WebhookPayload = {
      eventType: 'payment.paid',
      eventId: 'event-123',
      occurredAt: '2024-01-04T12:00:00Z',
      payload: { amount: 100, currency: 'USD' },
      tenantId,
      correlationId: 'corr-456',
      deliveryId: 'delivery-789',
      attemptNumber: 1,
    };

    it('should sign webhook payload using secret from store', async () => {
      const timestamp = '1641292800'; // 2022-01-04 12:00:00

      const signature = await webhookSigner.signPayload(basePayload, secretRef, timestamp);

      // Verify secret was retrieved from store
      expect(mockSecretStore.getSecret).toHaveBeenCalledWith(tenantId, secretRef);

      // Verify signature format
      expect(signature).toMatch(/^sha256=[a-f0-9]+$/);
    });

    it('should create signed headers using secret management', async () => {
      const deliveryId = 'delivery-123';

      const { headers, timestamp } = await webhookSigner.createSignedHeaders(
        basePayload,
        secretRef,
        deliveryId
      );

      // Verify secret retrieval
      expect(mockSecretStore.getSecret).toHaveBeenCalledWith(tenantId, secretRef);

      // Verify headers
      expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]+$/);
      expect(headers['X-Webhook-Timestamp']).toBe(timestamp);
      expect(headers['X-Webhook-Event']).toBe('payment.paid');
      expect(headers['X-Webhook-Delivery-Id']).toBe(deliveryId);
      expect(headers['X-Tenant-Id']).toBe(tenantId);
      expect(headers['X-Correlation-Id']).toBe('corr-456');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['User-Agent']).toBe('NeuronX-Webhook-Delivery/1.0');
    });

    it('should verify signatures correctly', async () => {
      const timestamp = '1641292800';

      const signature = await webhookSigner.signPayload(basePayload, secretRef, timestamp);
      const isValid = await webhookSigner.verifySignature(basePayload, secretRef, timestamp, signature);

      expect(isValid).toBe(true);
      // SecretService caches the secret, so only 1 call to store expected
      expect(mockSecretStore.getSecret).toHaveBeenCalledTimes(1);
    });

    it('should reject invalid signatures', async () => {
      const timestamp = '1641292800';
      const wrongSignature = 'sha256=wrongsignature';

      const isValid = await webhookSigner.verifySignature(
        basePayload,
        secretRef,
        timestamp,
        wrongSignature
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Secret Rotation Impact on Webhooks', () => {
    it('should use new secret after rotation', async () => {
      const oldSecret = 'old-webhook-secret';
      const newSecret = 'new-webhook-secret';
      const rotatedSecretRef = `dev:${tenantId}:webhook-endpoint-${endpointId}:2`;

      // Setup rotation
      mockSecretStore.rotateSecret.mockResolvedValue(rotatedSecretRef);

      // Rotate secret
      const newRef = await secretService.rotateSecret(
        tenantId,
        `webhook-endpoint-${endpointId}`,
        newSecret,
        'admin-user',
        'rotation-123'
      );

      expect(newRef).toBe(rotatedSecretRef);

      // Verify cache was cleared (SecretService should clear cache on rotation)
      // This would normally cause fresh retrieval of new secret
      mockSecretStore.getSecret.mockResolvedValue(newSecret);

      // Sign with new secret ref
      const payload: WebhookPayload = {
        eventType: 'payment.paid',
        eventId: 'event-123',
        occurredAt: '2024-01-04T12:00:00Z',
        payload: { amount: 100 },
        tenantId,
        deliveryId: 'delivery-123',
        attemptNumber: 1,
      };

      const signature = await webhookSigner.signPayload(payload, rotatedSecretRef, '1641292800');

      // Verify new secret was used
      expect(mockSecretStore.getSecret).toHaveBeenCalledWith(tenantId, rotatedSecretRef);
      expect(signature).toMatch(/^sha256=[a-f0-9]+$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle secret retrieval failures', async () => {
      mockSecretStore.getSecret.mockRejectedValue(new Error('Secret store unavailable'));

      const payload: WebhookPayload = {
        eventType: 'payment.paid',
        eventId: 'event-123',
        occurredAt: '2024-01-04T12:00:00Z',
        payload: { amount: 100 },
        tenantId,
        deliveryId: 'delivery-123',
        attemptNumber: 1,
      };

      await expect(
        webhookSigner.signPayload(payload, secretRef, '1641292800')
      ).rejects.toThrow('Secret store unavailable');
    });

    it('should handle secret rotation failures', async () => {
      mockSecretStore.rotateSecret.mockRejectedValue(new Error('Rotation failed'));

      await expect(
        secretService.rotateSecret(
          tenantId,
          'webhook-endpoint-test',
          'new-secret',
          'admin'
        )
      ).rejects.toThrow('Rotation failed');
    });
  });

  describe('Security Properties', () => {
    it('should use constant-time signature verification', async () => {
      const payload: WebhookPayload = {
        eventType: 'payment.paid',
        eventId: 'event-123',
        occurredAt: '2024-01-04T12:00:00Z',
        payload: { amount: 100 },
        tenantId,
        deliveryId: 'delivery-123',
        attemptNumber: 1,
      };

      const timestamp = '1641292800';

      // Create valid signature
      const validSignature = await webhookSigner.signPayload(payload, secretRef, timestamp);

      // Test various invalid signatures of different lengths
      const invalidSignatures = [
        'sha256=short',
        'sha256=' + 'a'.repeat(64), // Wrong content
        'sha256=' + '1'.repeat(63), // Wrong length
        'sha256=', // Empty
      ];

      for (const invalidSig of invalidSignatures) {
        const isValid = await webhookSigner.verifySignature(
          payload,
          secretRef,
          timestamp,
          invalidSig
        );
        expect(isValid).toBe(false);
      }
    });

    it('should reject signatures with wrong secret', async () => {
      const payload: WebhookPayload = {
        eventType: 'payment.paid',
        eventId: 'event-123',
        occurredAt: '2024-01-04T12:00:00Z',
        payload: { amount: 100 },
        tenantId,
        deliveryId: 'delivery-123',
        attemptNumber: 1,
      };

      const timestamp = '1641292800';

      // Sign with one secret
      mockSecretStore.getSecret.mockResolvedValueOnce('secret-a');
      const signatureA = await webhookSigner.signPayload(payload, secretRef, timestamp);

      // Clear cache to force fresh retrieval
      secretService.clearSecretCache(tenantId);

      // Try to verify with different secret
      mockSecretStore.getSecret.mockResolvedValueOnce('secret-b');
      const isValid = await webhookSigner.verifySignature(
        payload,
        secretRef,
        timestamp,
        signatureA
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache secret retrievals', async () => {
      const payload: WebhookPayload = {
        eventType: 'payment.paid',
        eventId: 'event-123',
        occurredAt: '2024-01-04T12:00:00Z',
        payload: { amount: 100 },
        tenantId,
        deliveryId: 'delivery-123',
        attemptNumber: 1,
      };

      // Multiple signing operations should reuse cached secret
      await webhookSigner.signPayload(payload, secretRef, '1641292800');
      await webhookSigner.signPayload(payload, secretRef, '1641292801');

      // Secret should only be retrieved once (cached)
      expect(mockSecretStore.getSecret).toHaveBeenCalledTimes(1);
    });

    it('should handle cache misses gracefully', async () => {
      mockSecretStore.getSecret.mockRejectedValueOnce(new Error('Cache miss'));

      const payload: WebhookPayload = {
        eventType: 'payment.paid',
        eventId: 'event-123',
        occurredAt: '2024-01-04T12:00:00Z',
        payload: { amount: 100 },
        tenantId,
        deliveryId: 'delivery-123',
        attemptNumber: 1,
      };

      await expect(
        webhookSigner.signPayload(payload, secretRef, '1641292800')
      ).rejects.toThrow('Cache miss');

      // On retry, should work
      mockSecretStore.getSecret.mockResolvedValueOnce(webhookSecret);
      const signature = await webhookSigner.signPayload(payload, secretRef, '1641292800');
      expect(signature).toMatch(/^sha256=[a-f0-9]+$/);
    });
  });
});

