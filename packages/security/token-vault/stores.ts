// Token Vault Storage Implementations

import {
  TokenRecord,
  TokenVaultStore,
  TokenUpdateRequest,
  TokenQuery,
} from './types';

import { PrismaClient } from '@prisma/client';

// PostgreSQL Store Implementation
export class PostgresTokenStore implements TokenVaultStore {
  constructor(private prisma: PrismaClient) {}

  async save(record: TokenRecord): Promise<void> {
    await this.prisma.tokenCredential.upsert({
      where: { id: record.id },
      update: {
        encryptedAccessToken: record.encryptedAccessToken,
        encryptedRefreshToken: record.encryptedRefreshToken,
        encryptedDek: record.encryptedDek,
        scope: record.scope,
        expiresAt: record.expiresAt,
        lastRefreshed: record.lastRefreshed,
        keyId: record.keyId,
        updatedAt: new Date(),
        lastRotatedBy: record.lastRotatedBy,
      },
      create: {
        id: record.id,
        tenantId: record.tenantId,
        provider: record.provider,
        environment: record.environment,
        locationId: record.locationId,
        encryptedAccessToken: record.encryptedAccessToken,
        encryptedRefreshToken: record.encryptedRefreshToken,
        encryptedDek: record.encryptedDek,
        scope: record.scope,
        expiresAt: record.expiresAt,
        lastRefreshed: record.lastRefreshed,
        keyId: record.keyId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        createdBy: record.createdBy,
      },
    });
  }

  async find(query: TokenQuery): Promise<TokenRecord | null> {
    const record = await this.prisma.tokenCredential.findFirst({
      where: {
        tenantId: query.tenantId,
        provider: query.provider,
        environment: query.environment,
        locationId: query.locationId,
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      tenantId: record.tenantId,
      provider: record.provider,
      environment: record.environment as 'dev' | 'stage' | 'prod',
      locationId: record.locationId || undefined,
      encryptedAccessToken: record.encryptedAccessToken,
      encryptedRefreshToken: record.encryptedRefreshToken,
      encryptedDek: record.encryptedDek,
      scope: record.scope,
      expiresAt: record.expiresAt,
      lastRefreshed: record.lastRefreshed,
      keyId: record.keyId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy || undefined,
      lastRotatedBy: record.lastRotatedBy || undefined,
    };
  }

  async findAll(tenantId: string): Promise<TokenRecord[]> {
    const records = await this.prisma.tokenCredential.findMany({
      where: { tenantId },
    });

    return records.map(record => ({
      id: record.id,
      tenantId: record.tenantId,
      provider: record.provider,
      environment: record.environment as 'dev' | 'stage' | 'prod',
      locationId: record.locationId || undefined,
      encryptedAccessToken: record.encryptedAccessToken,
      encryptedRefreshToken: record.encryptedRefreshToken,
      encryptedDek: record.encryptedDek,
      scope: record.scope,
      expiresAt: record.expiresAt,
      lastRefreshed: record.lastRefreshed,
      keyId: record.keyId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy || undefined,
      lastRotatedBy: record.lastRotatedBy || undefined,
    }));
  }

  async update(id: string, updates: TokenUpdateRequest): Promise<TokenRecord> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.accessToken !== undefined)
      updateData.encryptedAccessToken = updates.accessToken;
    if (updates.refreshToken !== undefined)
      updateData.encryptedRefreshToken = updates.refreshToken;
    if (updates.scope !== undefined) updateData.scope = updates.scope;
    if (updates.expiresAt !== undefined)
      updateData.expiresAt = updates.expiresAt;
    if (updates.lastRotatedBy !== undefined)
      updateData.lastRotatedBy = updates.lastRotatedBy;

    const record = await this.prisma.tokenCredential.update({
      where: { id },
      data: updateData,
    });

    return {
      id: record.id,
      tenantId: record.tenantId,
      provider: record.provider,
      environment: record.environment as 'dev' | 'stage' | 'prod',
      locationId: record.locationId || undefined,
      encryptedAccessToken: record.encryptedAccessToken,
      encryptedRefreshToken: record.encryptedRefreshToken,
      encryptedDek: record.encryptedDek,
      scope: record.scope,
      expiresAt: record.expiresAt,
      lastRefreshed: record.lastRefreshed,
      keyId: record.keyId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy || undefined,
      lastRotatedBy: record.lastRotatedBy || undefined,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tokenCredential.delete({
      where: { id },
    });
  }

  async rotateKey(oldKeyId: string, newKeyId: string): Promise<number> {
    const result = await this.prisma.tokenCredential.updateMany({
      where: { keyId: oldKeyId },
      data: { keyId: newKeyId },
    });

    return result.count;
  }
}

// Memory Store for Development/Testing
export class MemoryTokenStore implements TokenVaultStore {
  private records = new Map<string, TokenRecord>();

  private getKey(record: TokenRecord): string {
    return `${record.tenantId}:${record.provider}:${record.environment}:${record.locationId || 'company'}`;
  }

  async save(record: TokenRecord): Promise<void> {
    const key = this.getKey(record);
    this.records.set(key, { ...record });
  }

  async find(query: TokenQuery): Promise<TokenRecord | null> {
    const key = `${query.tenantId}:${query.provider}:${query.environment}:${query.locationId || 'company'}`;
    return this.records.get(key) || null;
  }

  async findAll(tenantId: string): Promise<TokenRecord[]> {
    const tenantRecords: TokenRecord[] = [];
    for (const [key, record] of this.records) {
      if (key.startsWith(`${tenantId}:`)) {
        tenantRecords.push(record);
      }
    }
    return tenantRecords;
  }

  async update(id: string, updates: TokenUpdateRequest): Promise<TokenRecord> {
    // Find the record by ID
    for (const [key, record] of this.records) {
      if (record.id === id) {
        const updatedRecord = { ...record, ...updates, updatedAt: new Date() };
        this.records.set(key, updatedRecord);
        return updatedRecord;
      }
    }
    throw new Error(`Token record not found: ${id}`);
  }

  async delete(id: string): Promise<void> {
    for (const [key, record] of this.records) {
      if (record.id === id) {
        this.records.delete(key);
        return;
      }
    }
  }

  async rotateKey(oldKeyId: string, newKeyId: string): Promise<number> {
    let rotatedCount = 0;
    for (const [key, record] of this.records) {
      if (record.keyId === oldKeyId) {
        const updatedRecord = {
          ...record,
          keyId: newKeyId,
          updatedAt: new Date(),
        };
        this.records.set(key, updatedRecord);
        rotatedCount++;
      }
    }
    return rotatedCount;
  }
}

// Factory functions
export function createPostgresTokenStore(
  databaseUrl?: string
): PostgresTokenStore {
  const prisma = new PrismaClient({
    datasourceUrl: databaseUrl,
  });
  return new PostgresTokenStore(prisma);
}

export function createMemoryTokenStore(): MemoryTokenStore {
  return new MemoryTokenStore();
}
