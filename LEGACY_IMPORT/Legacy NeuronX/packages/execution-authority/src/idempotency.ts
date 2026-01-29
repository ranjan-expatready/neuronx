/**
 * Idempotency Handler - WI-034: Multi-Channel Execution Authority
 *
 * Idempotent execution handling (REQ-016).
 */

import { IdempotencyRecord } from './types';

/**
 * Idempotency repository interface
 */
export interface IdempotencyRepository {
  get(key: string): Promise<IdempotencyRecord | null>;
  set(record: IdempotencyRecord): Promise<void>;
  delete(key: string): Promise<void>;
  cleanup(): Promise<number>;
}

/**
 * Idempotency handler
 */
export class IdempotencyHandler {
  private repository: IdempotencyRepository;
  private defaultExpirySeconds: number;

  constructor(repository: IdempotencyRepository, defaultExpirySeconds = 86400) {
    // 24 hours
    this.repository = repository;
    this.defaultExpirySeconds = defaultExpirySeconds;
  }

  /**
   * Check if request is idempotent
   */
  async checkIdempotency(
    idempotencyKey: string,
    endpoint: string,
    tenantId: string
  ): Promise<{ isDuplicate: boolean; record?: IdempotencyRecord }> {
    const key = `${tenantId}:${endpoint}:${idempotencyKey}`;
    const record = await this.repository.get(key);

    if (!record) {
      return { isDuplicate: false };
    }

    // Check if expired
    if (record.expiresAt < new Date()) {
      await this.repository.delete(key);
      return { isDuplicate: false };
    }

    return { isDuplicate: true, record };
  }

  /**
   * Store idempotency result
   */
  async storeResult(
    idempotencyKey: string,
    endpoint: string,
    tenantId: string,
    response: any,
    statusCode: number
  ): Promise<void> {
    const key = `${tenantId}:${endpoint}:${idempotencyKey}`;
    const record: IdempotencyRecord = {
      idempotencyKey: key,
      tenantId,
      endpoint,
      response,
      statusCode,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.defaultExpirySeconds * 1000),
    };

    await this.repository.set(record);
  }

  /**
   * Generate idempotency key from request
   */
  generateKey(requestData: any): string {
    // Create deterministic key from request data
    const crypto = require('crypto');
    const data = JSON.stringify(requestData);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Clean up expired records
   */
  async cleanup(): Promise<number> {
    return this.repository.cleanup();
  }
}
