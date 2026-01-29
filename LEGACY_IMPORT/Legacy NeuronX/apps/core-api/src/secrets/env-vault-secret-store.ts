/**
 * Environment Vault Secret Store - WI-019: Secrets & Encryption Foundation
 *
 * DEVELOPMENT-ONLY secret store using in-memory storage.
 * WARNING: This provides NO security and should NEVER be used in production.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SecretStore, SecretVersion, SecretStatus } from './secret.types';
import { SecretRef } from './secret-ref';

@Injectable()
export class EnvVaultSecretStore implements SecretStore {
  private readonly logger = new Logger(EnvVaultSecretStore.name);
  private readonly secrets = new Map<string, string>();
  private readonly metadata = new Map<string, any>();

  constructor() {
    this.logger.warn('⚠️  USING DEVELOPMENT SECRET STORE - NO ENCRYPTION ⚠️');
    this.logger.warn('This store provides NO security and should NEVER be used in production');
  }

  async putSecret(tenantId: string, name: string, value: string, metadata?: any): Promise<string> {
    // Find existing versions to determine next version
    const existingVersions = Array.from(this.secrets.keys())
      .filter(key => {
        try {
          const parsed = SecretRef.parse(key);
          return parsed.tenantId === tenantId && parsed.name === name;
        } catch {
          return false;
        }
      })
      .map(key => SecretRef.getVersion(key))
      .sort((a, b) => b - a); // Descending

    const nextVersion = existingVersions.length > 0 ? existingVersions[0] + 1 : 1;
    const secretRef = SecretRef.create('dev', tenantId, name, nextVersion);

    // Store the secret
    this.secrets.set(secretRef, value);
    this.metadata.set(secretRef, {
      ...metadata,
      createdAt: new Date(),
      status: 'ACTIVE' as SecretStatus,
    });

    this.logger.debug(`Stored secret: ${secretRef}`, { tenantId });

    return secretRef;
  }

  async getSecret(tenantId: string, secretRef: string): Promise<string> {
    // Validate tenant isolation
    if (!SecretRef.validateTenant(secretRef, tenantId)) {
      throw new Error(`Secret ${secretRef} does not belong to tenant ${tenantId}`);
    }

    const value = this.secrets.get(secretRef);
    if (!value) {
      throw new Error(`Secret not found: ${secretRef}`);
    }

    return value;
  }

  async rotateSecret(
    tenantId: string,
    name: string,
    newValue: string,
    actor: string,
    correlationId?: string
  ): Promise<string> {
    // Find current active secret
    const activeRef = Array.from(this.secrets.keys()).find(key => {
      try {
        const parsed = SecretRef.parse(key);
        return parsed.tenantId === tenantId &&
               parsed.name === name &&
               this.metadata.get(key)?.status === 'ACTIVE';
      } catch {
        return false;
      }
    });

    if (!activeRef) {
      throw new Error(`No active secret found for ${name} in tenant ${tenantId}`);
    }

    // Mark current as previous
    const currentMeta = this.metadata.get(activeRef);
    if (currentMeta) {
      currentMeta.status = 'PREVIOUS';
      currentMeta.rotatedAt = new Date();
    }

    // Create new active secret
    const newSecretRef = await this.putSecret(tenantId, name, newValue, {
      rotatedBy: actor,
      correlationId,
      previousRef: activeRef,
    });

    this.logger.debug(`Rotated secret ${name} for tenant ${tenantId}`, {
      previousRef: activeRef,
      newRef: newSecretRef,
      actor,
      correlationId,
    });

    return newSecretRef;
  }

  async listSecretVersions(tenantId: string, name: string): Promise<SecretVersion[]> {
    const versions: SecretVersion[] = [];

    for (const [secretRef, value] of this.secrets.entries()) {
      try {
        const parsed = SecretRef.parse(secretRef);
        if (parsed.tenantId === tenantId && parsed.name === name) {
          const meta = this.metadata.get(secretRef);
          versions.push({
            secretRef,
            status: meta?.status || 'ACTIVE',
            createdAt: meta?.createdAt || new Date(),
            rotatedAt: meta?.rotatedAt,
            retiredAt: meta?.retiredAt,
            provider: 'dev',
          });
        }
      } catch {
        // Skip invalid references
      }
    }

    return versions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Clear all secrets (for testing)
   */
  clear(): void {
    this.secrets.clear();
    this.metadata.clear();
    this.logger.debug('Cleared all secrets from development store');
  }

  /**
   * Get store statistics (for debugging)
   */
  getStats(): { totalSecrets: number; tenants: string[] } {
    const tenants = new Set<string>();

    for (const secretRef of this.secrets.keys()) {
      try {
        tenants.add(SecretRef.getTenantId(secretRef));
      } catch {
        // Skip invalid references
      }
    }

    return {
      totalSecrets: this.secrets.size,
      tenants: Array.from(tenants),
    };
  }
}

