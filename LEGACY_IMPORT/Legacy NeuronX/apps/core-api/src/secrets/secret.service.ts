/**
 * Secret Service - WI-019: Secrets & Encryption Foundation
 *
 * High-level service providing caching, fail-closed semantics, and unified interface
 * for secret management across different storage backends.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { SecretStore } from './secret.types';
import { SecretRef } from './secret-ref';

@Injectable()
export class SecretService {
  private readonly logger = new Logger(SecretService.name);
  private readonly cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  constructor(
    @Inject('SECRET_STORE') private readonly secretStore: SecretStore,
  ) {}

  /**
   * Retrieve a secret with caching and fail-closed semantics
   */
  async getSecret(secretRef: string): Promise<string> {
    const cacheKey = secretRef;
    const cached = this.cache.get(cacheKey);

    // Check cache validity
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      // Fetch from store
      const tenantId = SecretRef.getTenantId(secretRef);
      const value = await this.secretStore.getSecret(tenantId, secretRef);

      // Cache the result
      this.cache.set(cacheKey, {
        value,
        expiresAt: Date.now() + this.cacheTtlMs,
      });

      this.logger.debug(`Retrieved secret: ${secretRef}`);
      return value;

    } catch (error) {
      // FAIL-CLOSED: Never return cached value on error
      this.cache.delete(cacheKey);

      this.logger.error(`Failed to retrieve secret: ${secretRef}`, {
        error: error.message,
        secretRef,
      });

      throw error;
    }
  }

  /**
   * Store a new secret
   */
  async putSecret(tenantId: string, name: string, value: string, metadata?: any): Promise<string> {
    try {
      const secretRef = await this.secretStore.putSecret(tenantId, name, value, metadata);

      this.logger.debug(`Stored secret: ${secretRef}`, { tenantId, name });

      return secretRef;
    } catch (error) {
      this.logger.error(`Failed to store secret: ${name}`, {
        tenantId,
        name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Rotate a secret (creates new version, keeps previous for overlap)
   */
  async rotateSecret(
    tenantId: string,
    name: string,
    newValue: string,
    actor: string,
    correlationId?: string
  ): Promise<string> {
    try {
      const newSecretRef = await this.secretStore.rotateSecret(
        tenantId,
        name,
        newValue,
        actor,
        correlationId
      );

      // Clear all cache entries for this secret name to force fresh retrieval
      this.clearSecretCache(tenantId, name);

      this.logger.debug(`Rotated secret: ${name}`, {
        tenantId,
        name,
        newSecretRef,
        actor,
        correlationId,
      });

      return newSecretRef;
    } catch (error) {
      this.logger.error(`Failed to rotate secret: ${name}`, {
        tenantId,
        name,
        actor,
        correlationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List secret versions for audit
   */
  async listSecretVersions(tenantId: string, name: string) {
    try {
      return await this.secretStore.listSecretVersions(tenantId, name);
    } catch (error) {
      this.logger.error(`Failed to list secret versions: ${name}`, {
        tenantId,
        name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Clear cache for a specific secret or all secrets for a tenant
   */
  clearSecretCache(tenantId: string, name?: string): void {
    const keysToDelete: string[] = [];

    for (const [cacheKey] of this.cache.entries()) {
      try {
        const parsed = SecretRef.parse(cacheKey);
        if (parsed.tenantId === tenantId) {
          if (!name || parsed.name === name) {
            keysToDelete.push(cacheKey);
          }
        }
      } catch {
        // Skip invalid cache keys
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    this.logger.debug(`Cleared cache for ${keysToDelete.length} secrets`, {
      tenantId,
      name: name || 'all',
    });
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getCacheStats(): { size: number; hitRate: number; totalRequests: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need request tracking to calculate
      totalRequests: 0, // Would need request tracking to calculate
    };
  }

  /**
   * Health check for secret store
   */
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Simple health check - attempt to list versions for a non-existent secret
      // This should not throw for a healthy store
      await this.secretStore.listSecretVersions('health-check-tenant', 'health-check-secret');
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        message: `Secret store health check failed: ${error.message}`,
      };
    }
  }

  /**
   * Emergency cache clear (for incident response)
   */
  emergencyCacheClear(): void {
    const clearedCount = this.cache.size;
    this.cache.clear();

    this.logger.warn(`Emergency cache clear executed`, {
      clearedSecrets: clearedCount,
    });
  }
}

