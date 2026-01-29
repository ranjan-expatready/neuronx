/**
 * Secret Reference Utilities - WI-019: Secrets & Encryption Foundation
 *
 * Utilities for parsing and formatting secret references with tenant isolation.
 */

import { SecretReference, SecretRefParseError } from './secret.types';

export class SecretRef {
  /**
   * Parse secret reference string into components
   * Format: {provider}:{tenantId}:{name}:{version}
   */
  static parse(secretRef: string): SecretReference {
    const parts = secretRef.split(':');

    if (parts.length !== 4) {
      throw new SecretRefParseError(
        `Invalid secret reference format. Expected 4 parts, got ${parts.length}`,
        secretRef
      );
    }

    const [provider, tenantId, name, versionStr] = parts;

    // Validate provider
    const validProviders = ['db', 'aws', 'gcp', 'dev'];
    if (!validProviders.includes(provider)) {
      throw new SecretRefParseError(
        `Invalid provider: ${provider}. Must be one of: ${validProviders.join(', ')}`,
        secretRef
      );
    }

    // Validate tenantId (basic format check)
    if (!tenantId || tenantId.length === 0) {
      throw new SecretRefParseError('Tenant ID cannot be empty', secretRef);
    }

    // Validate name (basic format check)
    if (!name || name.length === 0) {
      throw new SecretRefParseError('Secret name cannot be empty', secretRef);
    }

    // Validate version
    const version = parseInt(versionStr, 10);
    if (isNaN(version) || version < 1) {
      throw new SecretRefParseError(
        `Invalid version: ${versionStr}. Must be a positive integer`,
        secretRef
      );
    }

    return {
      provider: provider as any,
      tenantId,
      name,
      version,
    };
  }

  /**
   * Format secret reference components into string
   */
  static format(ref: SecretReference): string {
    return `${ref.provider}:${ref.tenantId}:${ref.name}:${ref.version}`;
  }

  /**
   * Create secret reference for new secret
   */
  static create(
    provider: string,
    tenantId: string,
    name: string,
    version: number = 1
  ): string {
    return `${provider}:${tenantId}:${name}:${version}`;
  }

  /**
   * Get next version number for rotation
   */
  static nextVersion(currentRef: string): string {
    const parsed = this.parse(currentRef);
    return this.format({
      ...parsed,
      version: parsed.version + 1,
    });
  }

  /**
   * Validate secret reference belongs to tenant
   */
  static validateTenant(secretRef: string, expectedTenantId: string): boolean {
    try {
      const parsed = this.parse(secretRef);
      return parsed.tenantId === expectedTenantId;
    } catch {
      return false;
    }
  }

  /**
   * Extract tenant ID from secret reference
   */
  static getTenantId(secretRef: string): string {
    return this.parse(secretRef).tenantId;
  }

  /**
   * Extract secret name from secret reference
   */
  static getName(secretRef: string): string {
    return this.parse(secretRef).name;
  }

  /**
   * Extract version from secret reference
   */
  static getVersion(secretRef: string): number {
    return this.parse(secretRef).version;
  }
}

