/**
 * Secret Types - WI-019: Secrets & Encryption Foundation
 *
 * Types for secure secret management with tenant isolation and rotation support.
 */

export interface SecretStore {
  // Store a new secret
  putSecret(tenantId: string, name: string, value: string, metadata?: any): Promise<string>;

  // Retrieve active secret
  getSecret(tenantId: string, secretRef: string): Promise<string>;

  // Rotate secret (creates new version, keeps previous)
  rotateSecret(
    tenantId: string,
    name: string,
    newValue: string,
    actor: string,
    correlationId?: string
  ): Promise<string>;

  // List secret versions for audit
  listSecretVersions(tenantId: string, name: string): Promise<SecretVersion[]>;
}

export interface SecretVersion {
  secretRef: string;
  status: SecretStatus;
  createdAt: Date;
  rotatedAt?: Date;
  retiredAt?: Date;
  provider: SecretProvider;
}

export type SecretStatus = 'ACTIVE' | 'PREVIOUS' | 'RETIRED';
export type SecretProvider = 'db' | 'aws' | 'gcp' | 'dev';

export interface SecretReference {
  provider: SecretProvider;
  tenantId: string;
  name: string;
  version: number;
}

export interface SecretMetadata {
  createdBy?: string;
  correlationId?: string;
  description?: string;
}

export interface SecretRecord {
  id: string;
  tenantId: string;
  name: string;
  version: number;
  ciphertext?: string;
  nonce?: string;
  keyVersion?: string;
  status: SecretStatus;
  createdAt: Date;
  rotatedAt?: Date;
  retiredAt?: Date;
}

export interface EncryptedSecret {
  ciphertext: string;
  nonce: string;
  keyVersion: string;
}

export class SecretRefParseError extends Error {
  constructor(message: string, public readonly secretRef: string) {
    super(message);
    this.name = 'SecretRefParseError';
  }
}

export class SecretAccessError extends Error {
  constructor(
    message: string,
    public readonly tenantId: string,
    public readonly secretRef: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SecretAccessError';
  }
}

export class SecretRotationError extends Error {
  constructor(
    message: string,
    public readonly tenantId: string,
    public readonly name: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SecretRotationError';
  }
}

