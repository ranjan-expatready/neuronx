import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookSigner } from '../webhook.signer';

describe('WebhookSigner', () => {
  let signer: WebhookSigner;
  let mockSecretService: any;

  beforeEach(() => {
    mockSecretService = {
      getSecret: vi.fn(),
    };
    signer = new WebhookSigner(mockSecretService);
  });

  const payload: any = {
    eventType: 'payment.paid',
    tenantId: 'tenant_1',
    eventId: 'evt_1',
    occurredAt: '2024-01-01T00:00:00Z',
    payload: { amount: 100 },
  };
  const secretRef = 'secret-123';
  const secretValue = 'super-secret-key';
  const timestamp = '1704067200'; // 2024-01-01 00:00:00

  describe('signPayload', () => {
    it('should generate a deterministic SHA256 HMAC signature', async () => {
      mockSecretService.getSecret.mockResolvedValue(secretValue);

      const signature = await signer.signPayload(payload, secretRef, timestamp);

      expect(signature).toMatch(/^sha256=/);
      expect(signature).toBe(
        'sha256=24f9b394ce7e9de912ec477e9eeb3a9443473f0d80582b3586df72ed20e1a0cb'
      );
    });

    it('should sort payload keys before signing to ensure determinism', async () => {
      mockSecretService.getSecret.mockResolvedValue(secretValue);

      const payloadUnsorted: any = {
        z: 1,
        a: 2,
        m: 3,
      };

      const sig1 = await signer.signPayload(
        payloadUnsorted,
        secretRef,
        timestamp
      );
      const sig2 = await signer.signPayload(
        { a: 2, m: 3, z: 1 },
        secretRef,
        timestamp
      );

      expect(sig1).toBe(sig2);
    });
  });

  describe('verifySignature', () => {
    it('should return true for a valid signature', async () => {
      mockSecretService.getSecret.mockResolvedValue(secretValue);
      const signature = await signer.signPayload(payload, secretRef, timestamp);

      const isValid = await signer.verifySignature(
        payload,
        secretRef,
        timestamp,
        signature
      );

      expect(isValid).toBe(true);
    });

    it('should return false for a wrong secret', async () => {
      mockSecretService.getSecret
        .mockResolvedValueOnce(secretValue) // for signing
        .mockResolvedValueOnce('wrong-key'); // for verification

      const signature = await signer.signPayload(payload, secretRef, timestamp);
      const isValid = await signer.verifySignature(
        payload,
        secretRef,
        timestamp,
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should return false for a modified payload', async () => {
      mockSecretService.getSecret.mockResolvedValue(secretValue);
      const signature = await signer.signPayload(payload, secretRef, timestamp);

      const modifiedPayload = { ...payload, tenantId: 'tenant_X' };
      const isValid = await signer.verifySignature(
        modifiedPayload,
        secretRef,
        timestamp,
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should return false for a different signature length (constant-time check)', async () => {
      mockSecretService.getSecret.mockResolvedValue(secretValue);
      const isValid = await signer.verifySignature(
        payload,
        secretRef,
        timestamp,
        'short'
      );
      expect(isValid).toBe(false);
    });
  });

  describe('createSignedHeaders', () => {
    it('should create all required webhook headers', async () => {
      mockSecretService.getSecret.mockResolvedValue(secretValue);
      const deliveryId = 'del_123';

      const result = await signer.createSignedHeaders(
        payload,
        secretRef,
        deliveryId
      );

      expect(result.headers).toMatchObject({
        'X-Webhook-Event': payload.eventType,
        'X-Webhook-Delivery-Id': deliveryId,
        'X-Tenant-Id': payload.tenantId,
        'Content-Type': 'application/json',
      });
      expect(result.headers['X-Webhook-Signature']).toMatch(/^sha256=/);
      expect(result.headers['X-Webhook-Timestamp']).toBe(result.timestamp);
    });

    it('should include correlation ID header if present in payload', async () => {
      mockSecretService.getSecret.mockResolvedValue(secretValue);
      const payloadWithCorr = { ...payload, correlationId: 'corr_abc' };

      const result = await signer.createSignedHeaders(
        payloadWithCorr,
        secretRef,
        'del_1'
      );

      expect(result.headers['X-Correlation-Id']).toBe('corr_abc');
    });
  });
});
