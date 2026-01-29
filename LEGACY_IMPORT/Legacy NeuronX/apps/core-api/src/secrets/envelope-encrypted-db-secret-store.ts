/**
 * Envelope Encrypted DB Secret Store - WI-019: Secrets & Encryption Foundation
 *
 * Database-backed secret store with AES-256-GCM envelope encryption.
 * Uses per-secret nonce and configurable master key.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { SecretStore, SecretVersion, SecretStatus, EncryptedSecret } from './secret.types';
import { SecretRef } from './secret-ref';

@Injectable()
export class EnvelopeEncryptedDbSecretStore implements SecretStore, OnModuleInit {
  private readonly logger = new Logger(EnvelopeEncryptedDbSecretStore.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly nonceLength = 12; // 96 bits for GCM

  private masterKey!: Buffer;
  private keyVersion = 'v1'; // For future key rotation support

  constructor(
    private readonly prisma: PrismaClient,
    private readonly masterKeyBase64: string,
  ) {}

  onModuleInit() {
    // Validate and decode master key
    try {
      this.masterKey = Buffer.from(this.masterKeyBase64, 'base64');
      if (this.masterKey.length !== this.keyLength) {
        throw new Error(`Master key must be ${this.keyLength} bytes (256 bits), got ${this.masterKey.length}`);
      }
    } catch (error) {
      throw new Error(`Invalid master key configuration: ${error}`);
    }

    this.logger.log('Initialized envelope encrypted DB secret store');
  }

  async putSecret(tenantId: string, name: string, value: string, metadata?: any): Promise<string> {
    // Encrypt the secret
    const encrypted = await this.encryptSecret(value);

    // Find existing versions to determine next version
    const existingVersions = await this.prisma.secretRecord.findMany({
      where: { tenantId, name },
      select: { version: true },
      orderBy: { version: 'desc' },
      take: 1,
    });

    const nextVersion = existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;
    const secretRef = SecretRef.create('db', tenantId, name, nextVersion);

    // Store in database
    await this.prisma.secretRecord.create({
      data: {
        tenantId,
        name,
        version: nextVersion,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        keyVersion: this.keyVersion,
        status: 'ACTIVE',
      },
    });

    this.logger.debug(`Stored encrypted secret: ${secretRef}`, { tenantId });

    return secretRef;
  }

  async getSecret(tenantId: string, secretRef: string): Promise<string> {
    // Validate tenant isolation
    if (!SecretRef.validateTenant(secretRef, tenantId)) {
      throw new Error(`Secret ${secretRef} does not belong to tenant ${tenantId}`);
    }

    // Find the secret record
    const record = await this.prisma.secretRecord.findFirst({
      where: {
        tenantId,
        name: SecretRef.getName(secretRef),
        version: SecretRef.getVersion(secretRef),
      },
    });

    if (!record) {
      throw new Error(`Secret not found: ${secretRef}`);
    }

    if (!record.ciphertext || !record.nonce) {
      throw new Error(`Secret record is missing encryption data: ${secretRef}`);
    }

    // Decrypt the secret
    return await this.decryptSecret(record.ciphertext, record.nonce);
  }

  async rotateSecret(
    tenantId: string,
    name: string,
    newValue: string,
    actor: string,
    correlationId?: string
  ): Promise<string> {
    // Find current active secret
    const currentRecord = await this.prisma.secretRecord.findFirst({
      where: {
        tenantId,
        name,
        status: 'ACTIVE',
      },
    });

    if (!currentRecord) {
      throw new Error(`No active secret found for ${name} in tenant ${tenantId}`);
    }

    // Start transaction for atomic rotation
    return await this.prisma.$transaction(async (tx) => {
      // Mark current as previous
      await tx.secretRecord.update({
        where: { id: currentRecord.id },
        data: {
          status: 'PREVIOUS',
          rotatedAt: new Date(),
        },
      });

      // Create new active secret
      const encrypted = await this.encryptSecret(newValue);
      const nextVersion = currentRecord.version + 1;
      const newSecretRef = SecretRef.create('db', tenantId, name, nextVersion);

      await tx.secretRecord.create({
        data: {
          tenantId,
          name,
          version: nextVersion,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          keyVersion: this.keyVersion,
          status: 'ACTIVE',
        },
      });

      this.logger.debug(`Rotated secret ${name} for tenant ${tenantId}`, {
        previousVersion: currentRecord.version,
        newVersion: nextVersion,
        actor,
        correlationId,
      });

      return newSecretRef;
    });
  }

  async listSecretVersions(tenantId: string, name: string): Promise<SecretVersion[]> {
    const records = await this.prisma.secretRecord.findMany({
      where: { tenantId, name },
      orderBy: { version: 'desc' },
    });

    return records.map(record => ({
      secretRef: SecretRef.create('db', tenantId, name, record.version),
      status: record.status as SecretStatus,
      createdAt: record.createdAt,
      rotatedAt: record.rotatedAt || undefined,
      retiredAt: record.retiredAt || undefined,
      provider: 'db',
    }));
  }

  /**
   * Encrypt a secret using AES-256-GCM
   */
  private async encryptSecret(value: string): Promise<EncryptedSecret> {
    const nonce = randomBytes(this.nonceLength);
    const cipher = createCipheriv(this.algorithm, this.masterKey, nonce);

    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Combine encrypted data + auth tag
    const ciphertext = Buffer.concat([encrypted, authTag]);

    return {
      ciphertext: ciphertext.toString('base64'),
      nonce: nonce.toString('base64'),
      keyVersion: this.keyVersion,
    };
  }

  /**
   * Decrypt a secret using AES-256-GCM
   */
  private async decryptSecret(ciphertextBase64: string, nonceBase64: string): Promise<string> {
    const ciphertext = Buffer.from(ciphertextBase64, 'base64');
    const nonce = Buffer.from(nonceBase64, 'base64');

    // Extract auth tag (last 16 bytes for GCM)
    const authTag = ciphertext.subarray(-16);
    const encrypted = ciphertext.subarray(0, -16);

    const decipher = createDecipheriv(this.algorithm, this.masterKey, nonce);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Clean up retired secrets older than retention period
   */
  async cleanupRetiredSecrets(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.secretRecord.deleteMany({
      where: {
        status: 'RETIRED',
        retiredAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} retired secrets`);
    return result.count;
  }
}

