/**
 * API Key Service - WI-022: Access Control & API Key Governance
 *
 * Manages API key lifecycle with SecretService integration for secure storage.
 */

import {
  Injectable,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import {
  ApiKeyCreateRequest,
  ApiKeyCreateResponse,
  ApiKeyRotateResponse,
  ApiKeyRecord,
  ApiKeyActor,
  API_KEY_PREFIXES,
  API_KEY_MIN_LENGTH,
  InvalidApiKeyError,
  RevokedApiKeyError,
  PERMISSIONS,
  Permission,
} from './authz.types';
import { SecretService } from '../secrets/secret.service';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @Inject('PrismaClient')
    private readonly prisma: PrismaClient,
    @Inject(SecretService)
    private readonly secretService: SecretService
  ) {}

  /**
   * Create a new API key
   */
  async createApiKey(
    tenantId: string,
    request: ApiKeyCreateRequest
  ): Promise<ApiKeyCreateResponse> {
    const { name, roleIds = [], permissions = [] } = request;

    // Validate input
    if (!name || name.trim().length === 0) {
      throw new BadRequestException('API key name is required');
    }

    if (roleIds.length === 0 && permissions.length === 0) {
      throw new BadRequestException(
        'Either roleIds or permissions must be specified'
      );
    }

    // Generate API key
    const rawKey = this.generateApiKey();
    const digest = this.computeDigest(rawKey);
    const fingerprint = this.computeFingerprint(rawKey);

    // Store key material in SecretService
    const secretRef = await this.secretService.putSecret(
      tenantId,
      `api-key:${crypto.randomUUID()}`,
      rawKey
    );

    // Create database record
    const apiKeyRecord = await this.prisma.apiKeyRecord.create({
      data: {
        tenantId,
        name: name.trim(),
        digest,
        fingerprint,
        status: 'ACTIVE',
        roleIds,
        permissions: permissions as any, // Schema might store as string[], cast for now
        secretRef,
      },
    });

    // Expand permissions from roles (if any)
    const expandedPermissions = await this.expandPermissions(
      roleIds,
      permissions
    );

    this.logger.log('API key created', {
      tenantId,
      apiKeyId: apiKeyRecord.id,
      name,
      fingerprint,
      roleIds,
      permissions: expandedPermissions,
    });

    return {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      key: rawKey, // RETURN RAW KEY ONLY ONCE
      fingerprint: apiKeyRecord.fingerprint,
      roleIds,
      permissions: expandedPermissions,
      createdAt: apiKeyRecord.createdAt,
    };
  }

  /**
   * Rotate an API key (generate new key, keep old for overlap window)
   */
  async rotateApiKey(
    tenantId: string,
    apiKeyId: string
  ): Promise<ApiKeyRotateResponse> {
    // Get current API key record
    const currentRecord = await this.prisma.apiKeyRecord.findFirst({
      where: {
        id: apiKeyId,
        tenantId,
        status: 'ACTIVE',
      },
    });

    if (!currentRecord) {
      throw new BadRequestException('API key not found or not active');
    }

    // Generate new API key
    const newRawKey = this.generateApiKey();
    const newDigest = this.computeDigest(newRawKey);
    const newFingerprint = this.computeFingerprint(newRawKey);

    // Store new key material in SecretService
    const newSecretRef = await this.secretService.putSecret(
      tenantId,
      `api-key:${crypto.randomUUID()}`,
      newRawKey
    );

    // Set overlap window (24 hours)
    const overlapExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update record with new key and previous key for overlap
    await this.prisma.apiKeyRecord.update({
      where: { id: apiKeyId },
      data: {
        digest: newDigest,
        fingerprint: newFingerprint,
        secretRef: newSecretRef,
        previousDigest: currentRecord.digest,
        previousDigestExpiresAt: overlapExpiry,
        updatedAt: new Date(),
      },
    });

    // Expand permissions from roles
    const expandedPermissions = await this.expandPermissions(
      currentRecord.roleIds,
      currentRecord.permissions as Permission[]
    );

    this.logger.log('API key rotated', {
      tenantId,
      apiKeyId,
      newFingerprint,
      previousFingerprint: currentRecord.fingerprint,
      overlapExpiry,
    });

    return {
      id: apiKeyId,
      name: currentRecord.name,
      newKey: newRawKey, // RETURN NEW RAW KEY ONLY ONCE
      fingerprint: newFingerprint,
      roleIds: currentRecord.roleIds,
      permissions: expandedPermissions,
      rotatedAt: new Date(),
    };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(tenantId: string, apiKeyId: string): Promise<void> {
    const result = await this.prisma.apiKeyRecord.updateMany({
      where: {
        id: apiKeyId,
        tenantId,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new BadRequestException('API key not found or already revoked');
    }

    this.logger.log('API key revoked', {
      tenantId,
      apiKeyId,
    });
  }

  /**
   * Validate API key and return actor context
   */
  async validateApiKey(rawKey: string): Promise<ApiKeyActor> {
    // Compute digest
    const digest = this.computeDigest(rawKey);

    // Find API key record by digest
    const record = await this.prisma.apiKeyRecord.findFirst({
      where: {
        OR: [
          { digest }, // Current digest
          {
            previousDigest: digest,
            previousDigestExpiresAt: {
              gt: new Date(), // Within overlap window
            },
          },
        ],
        status: 'ACTIVE',
      },
    });

    if (!record) {
      throw new InvalidApiKeyError();
    }

    // Check if revoked
    if (record.status === 'REVOKED') {
      throw new RevokedApiKeyError();
    }

    // Expand permissions from roles
    const permissions = await this.expandPermissions(
      record.roleIds,
      record.permissions as Permission[]
    );

    const actor: ApiKeyActor = {
      type: 'apikey',
      id: record.id,
      tenantId: record.tenantId,
      roleIds: record.roleIds,
      permissions,
      correlationId: `apikey-${record.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      apiKeyId: record.id,
      apiKeyName: record.name,
      fingerprint: record.fingerprint,
    };

    return actor;
  }

  /**
   * Update last used timestamp (fire-and-forget)
   */
  async updateLastUsed(apiKeyId: string): Promise<void> {
    try {
      await this.prisma.apiKeyRecord.update({
        where: { id: apiKeyId },
        data: { lastUsedAt: new Date() },
      });
    } catch (error) {
      // Log but don't throw - this is fire-and-forget
      this.logger.warn('Failed to update API key last used timestamp', {
        apiKeyId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * List API keys for tenant
   */
  async listApiKeys(tenantId: string): Promise<ApiKeyRecord[]> {
    const records = await this.prisma.apiKeyRecord.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Remove sensitive fields from response
    return records.map(record => ({
      ...record,
      digest: undefined as any,
      previousDigest: undefined as any,
      secretRef: undefined as any,
    })) as ApiKeyRecord[];
  }

  /**
   * Get API key details
   */
  async getApiKey(
    tenantId: string,
    apiKeyId: string
  ): Promise<ApiKeyRecord | null> {
    const record = await this.prisma.apiKeyRecord.findFirst({
      where: {
        id: apiKeyId,
        tenantId,
      },
    });

    if (!record) return null;

    // Remove sensitive fields
    return {
      ...record,
      digest: undefined as any,
      previousDigest: undefined as any,
      secretRef: undefined as any,
    } as ApiKeyRecord;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private generateApiKey(): string {
    const prefix = API_KEY_PREFIXES.LIVE; // TODO: Support test keys
    const randomBytes = crypto.randomBytes(32); // 256 bits
    const randomString = randomBytes.toString('hex');

    const key = prefix + randomString;

    if (key.length < API_KEY_MIN_LENGTH) {
      throw new Error('Generated API key too short');
    }

    return key;
  }

  private computeDigest(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  private computeFingerprint(rawKey: string): string {
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    return hash.substring(0, 8); // First 8 chars
  }

  private async expandPermissions(
    roleIds: string[],
    explicitPermissions: Permission[]
  ): Promise<Permission[]> {
    const permissions = new Set<Permission>(explicitPermissions);

    // Add permissions from roles
    for (const roleId of roleIds) {
      const rolePermissions = await this.getRolePermissions(roleId);
      rolePermissions.forEach(perm => permissions.add(perm));
    }

    return Array.from(permissions);
  }

  private async getRolePermissions(roleId: string): Promise<Permission[]> {
    // TODO: Implement role lookup from database
    // For now, use hardcoded canonical roles
    switch (roleId) {
      case 'TenantAdmin':
        return [PERMISSIONS.ADMIN_ALL];
      case 'Operator':
        return [
          PERMISSIONS.WEBHOOKS_MANAGE,
          PERMISSIONS.ARTIFACTS_MANAGE,
          PERMISSIONS.USAGE_READ,
          PERMISSIONS.EVENTS_READ,
          PERMISSIONS.PAYMENTS_READ,
        ];
      case 'ReadOnly':
        return [
          PERMISSIONS.WEBHOOKS_READ,
          PERMISSIONS.ARTIFACTS_READ,
          PERMISSIONS.USAGE_READ,
          PERMISSIONS.EVENTS_READ,
          PERMISSIONS.PAYMENTS_READ,
        ];
      case 'IntegrationBot':
        return [
          PERMISSIONS.WEBHOOKS_READ,
          PERMISSIONS.EVENTS_READ,
          PERMISSIONS.USAGE_READ,
          PERMISSIONS.ARTIFACTS_WRITE,
        ];
      default:
        return [];
    }
  }
}
