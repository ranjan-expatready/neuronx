/**
 * Envelope Encryption Tests - WI-019: Secrets & Encryption Foundation
 *
 * Tests for AES-256-GCM encryption/decryption with tamper detection.
 */

import { EnvelopeEncryptedDbSecretStore } from '../envelope-encrypted-db-secret-store';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

// Mock Prisma
const mockPrisma = {
  secretRecord: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]), // Default to empty array
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrisma)),
};

describe('EnvelopeEncryptedDbSecretStore', () => {
  let store: EnvelopeEncryptedDbSecretStore;
  const masterKeyBase64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; // 32 bytes of zeros base64 encoded
  const tenantId = 'tenant-a';

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create store with test master key
    store = new EnvelopeEncryptedDbSecretStore(mockPrisma as any, masterKeyBase64);
    await store.onModuleInit(); // Initialize the store
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt secrets correctly', async () => {
      const secret = 'my-webhook-secret-12345';
      const name = 'test-secret';

      // Encrypt
      const secretRef = await store.putSecret(tenantId, name, secret);

      // Verify the secret was stored
      expect(mockPrisma.secretRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name,
          version: 1,
          status: 'ACTIVE',
          ciphertext: expect.any(String),
          nonce: expect.any(String),
          keyVersion: 'v1',
        }),
      });

      // Mock the stored record for retrieval
      const storedRecord = {
        tenantId,
        name,
        version: 1,
        ciphertext: (mockPrisma.secretRecord.create as jest.Mock).mock.calls[0][0].data.ciphertext,
        nonce: (mockPrisma.secretRecord.create as jest.Mock).mock.calls[0][0].data.nonce,
      };

      mockPrisma.secretRecord.findFirst.mockResolvedValue(storedRecord);

      // Decrypt
      const retrievedSecret = await store.getSecret(tenantId, secretRef);

      expect(retrievedSecret).toBe(secret);
    });

    it('should produce different ciphertexts for same secret (nonce uniqueness)', async () => {
      const secret = 'same-secret';

      // Encrypt twice
      await store.putSecret(tenantId, 'secret-1', secret);
      await store.putSecret(tenantId, 'secret-2', secret);

      const call1 = (mockPrisma.secretRecord.create as jest.Mock).mock.calls[0][0].data;
      const call2 = (mockPrisma.secretRecord.create as jest.Mock).mock.calls[1][0].data;

      // Ciphertexts should be different due to different nonces
      expect(call1.ciphertext).not.toBe(call2.ciphertext);
      expect(call1.nonce).not.toBe(call2.nonce);
    });

    it('should detect tampered ciphertext', async () => {
      const secret = 'original-secret';

      // Encrypt
      await store.putSecret(tenantId, 'test-secret', secret);

      // Get the stored data
      const storedData = (mockPrisma.secretRecord.create as jest.Mock).mock.calls[0][0].data;

      // Tamper with ciphertext
      const tamperedCiphertext = storedData.ciphertext.replace('A', 'B');

      // Mock tampered record
      mockPrisma.secretRecord.findFirst.mockResolvedValue({
        ...storedData,
        ciphertext: tamperedCiphertext,
      });

      const secretRef = `db:${tenantId}:test-secret:1`;

      // Attempt to decrypt should fail
      await expect(store.getSecret(tenantId, secretRef)).rejects.toThrow();
    });

    it('should reject tampered nonce', async () => {
      const secret = 'original-secret';

      // Encrypt
      await store.putSecret(tenantId, 'test-secret', secret);

      // Get the stored data
      const storedData = (mockPrisma.secretRecord.create as jest.Mock).mock.calls[0][0].data;

      // Tamper with nonce (use a different valid base64 string of same length)
      // 12 bytes = 16 chars base64. 'nonce-old' is not valid base64 for 12 bytes? 
      // The mock returns whatever create was called with.
      // In putSecret, nonce is randomBytes(12).toString('base64') -> 16 chars.
      // Let's just reverse the string or replace chars.
      const tamperedNonce = Buffer.from(crypto.randomBytes(12)).toString('base64');

      // Mock tampered record
      mockPrisma.secretRecord.findFirst.mockResolvedValue({
        ...storedData,
        nonce: tamperedNonce,
      });

      const secretRef = `db:${tenantId}:test-secret:1`;

      // Attempt to decrypt should fail
      await expect(store.getSecret(tenantId, secretRef)).rejects.toThrow();
    });
  });

  describe('Secret Rotation', () => {
    it('should rotate secrets atomically', async () => {
      const name = 'webhook-secret';
      const oldSecret = 'old-secret';
      const newSecret = 'new-secret';
      const actor = 'admin-user';
      const correlationId = 'rotation-123';

      // Mock existing active secret
      mockPrisma.secretRecord.findFirst.mockResolvedValue({
        id: 'record-1',
        tenantId,
        name,
        version: 1,
        status: 'ACTIVE',
        ciphertext: 'encrypted-old',
        nonce: 'nonce-old',
        createdAt: new Date(),
      });

      const newSecretRef = await store.rotateSecret(
        tenantId,
        name,
        newSecret,
        actor,
        correlationId
      );

      expect(newSecretRef).toBe(`db:${tenantId}:${name}:2`);

      // Verify transaction calls
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Verify old secret marked as previous
      expect(mockPrisma.secretRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: expect.objectContaining({
          status: 'PREVIOUS',
          rotatedAt: expect.any(Date),
        }),
      });

      // Verify new secret created
      expect(mockPrisma.secretRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          name,
          version: 2,
          status: 'ACTIVE',
          ciphertext: expect.any(String),
          nonce: expect.any(String),
        }),
      });
    });

    it('should fail rotation if no active secret exists', async () => {
      mockPrisma.secretRecord.findFirst.mockResolvedValue(null);

      await expect(
        store.rotateSecret(tenantId, 'nonexistent', 'new-secret', 'admin')
      ).rejects.toThrow('No active secret found');
    });
  });

  describe('Version Management', () => {
    it('should list secret versions with correct status', async () => {
      const name = 'test-secret';

      mockPrisma.secretRecord.findMany.mockResolvedValue([
        {
          id: 'record-1',
          tenantId,
          name,
          version: 1,
          status: 'PREVIOUS',
          ciphertext: 'cipher1',
          nonce: 'nonce1',
          createdAt: new Date('2024-01-01'),
          rotatedAt: new Date('2024-01-02'),
          retiredAt: null,
        },
        {
          id: 'record-2',
          tenantId,
          name,
          version: 2,
          status: 'ACTIVE',
          ciphertext: 'cipher2',
          nonce: 'nonce2',
          createdAt: new Date('2024-01-02'),
          rotatedAt: null,
          retiredAt: null,
        },
      ]);

      const versions = await store.listSecretVersions(tenantId, name);

      expect(versions).toHaveLength(2);
      expect(versions[0]).toEqual({
        secretRef: `db:${tenantId}:${name}:1`,
        status: 'PREVIOUS',
        createdAt: expect.any(Date),
        rotatedAt: expect.any(Date),
        retiredAt: undefined,
        provider: 'db',
      });
      expect(versions[1]).toEqual({
        secretRef: `db:${tenantId}:${name}:2`,
        status: 'ACTIVE',
        createdAt: expect.any(Date),
        rotatedAt: undefined,
        retiredAt: undefined,
        provider: 'db',
      });
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid master key on initialization', () => {
      expect(() => {
        const invalidStore = new EnvelopeEncryptedDbSecretStore(mockPrisma as any, 'invalid-key');
        invalidStore.onModuleInit();
      }).toThrow('Invalid master key configuration');
    });

    it('should handle decryption of non-existent secrets', async () => {
      mockPrisma.secretRecord.findFirst.mockResolvedValue(null);

      await expect(
        store.getSecret(tenantId, `db:${tenantId}:nonexistent:1`)
      ).rejects.toThrow('Secret not found');
    });

    it('should handle secrets without encryption data', async () => {
      mockPrisma.secretRecord.findFirst.mockResolvedValue({
        tenantId,
        name: 'test',
        version: 1,
        ciphertext: null,
        nonce: null,
      });

      await expect(
        store.getSecret(tenantId, `db:${tenantId}:test:1`)
      ).rejects.toThrow('Secret record is missing encryption data');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup retired secrets older than specified days', async () => {
      mockPrisma.secretRecord.deleteMany.mockResolvedValue({ count: 5 });

      const deletedCount = await store.cleanupRetiredSecrets(90);

      expect(deletedCount).toBe(5);
      expect(mockPrisma.secretRecord.deleteMany).toHaveBeenCalledWith({
        where: {
          status: 'RETIRED',
          retiredAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});

