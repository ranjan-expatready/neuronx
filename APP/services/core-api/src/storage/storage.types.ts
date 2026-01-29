/**
 * Storage Types - WI-021: Object Storage & Artifact Management
 *
 * Types for tenant-isolated object storage with encryption and governance.
 */

export interface StorageProvider {
  /**
   * Generate pre-signed upload URL for an object
   */
  generateUploadUrl(
    tenantId: string,
    objectKey: string,
    contentType: string,
    expiresInSeconds: number
  ): Promise<string>;

  /**
   * Generate pre-signed download URL for an object
   */
  generateDownloadUrl(
    tenantId: string,
    objectKey: string,
    expiresInSeconds: number
  ): Promise<string>;

  /**
   * Check if an object exists
   */
  objectExists(tenantId: string, objectKey: string): Promise<boolean>;

  /**
   * Delete an object
   */
  deleteObject(tenantId: string, objectKey: string): Promise<void>;

  /**
   * Get object metadata
   */
  getObjectMetadata(
    tenantId: string,
    objectKey: string
  ): Promise<ObjectMetadata | null>;

  /**
   * List objects with prefix
   */
  listObjects(
    tenantId: string,
    prefix?: string,
    maxKeys?: number
  ): Promise<ListObjectsResult>;
}

export interface ObjectMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
  storageClass?: string;
}

export interface ListObjectsResult {
  objects: ObjectMetadata[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

export type ArtifactType =
  | 'voice-recording'
  | 'voice-transcript'
  | 'export-csv'
  | 'export-pdf'
  | 'invoice-pdf'
  | 'document';

export interface ArtifactRecord {
  id: string;
  tenantId: string;
  objectKey: string; // Full S3 key including tenant prefix
  type: ArtifactType;
  size: number;
  contentType: string;
  checksum: string; // SHA256 hash
  metadata: Record<string, string>; // Additional metadata (no PII)
  createdAt: Date;
  expiresAt?: Date; // For temporary artifacts
}

export interface CreateArtifactRequest {
  tenantId: string;
  type: ArtifactType;
  contentType: string;
  size: number; // Estimated size in bytes
  metadata?: Record<string, string>;
}

export interface ArtifactUploadUrlResponse {
  artifactId: string;
  uploadUrl: string;
  objectKey: string;
  expiresAt: Date;
}

export interface ArtifactDownloadUrlResponse {
  downloadUrl: string;
  expiresAt: Date;
  metadata: ArtifactRecord;
}

export interface ListArtifactsResponse {
  artifacts: ArtifactRecord[];
  total: number;
  nextToken?: string;
}

export interface StorageConfig {
  provider: 's3' | 'local';
  bucketName: string;
  region?: string;
  endpoint?: string; // For local development
  accessKeyId?: string;
  secretAccessKey?: string;
  maxUploadSizeBytes: number; // 100MB default
  urlExpirySeconds: number; // 900 (15 minutes) default
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly tenantId?: string,
    public readonly objectKey?: string
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class AccessDeniedError extends StorageError {
  constructor(tenantId: string, objectKey: string) {
    super(
      `Access denied to object: ${objectKey}`,
      'ACCESS_DENIED',
      tenantId,
      objectKey
    );
  }
}

export class ObjectNotFoundError extends StorageError {
  constructor(tenantId: string, objectKey: string) {
    super(
      `Object not found: ${objectKey}`,
      'OBJECT_NOT_FOUND',
      tenantId,
      objectKey
    );
  }
}

export class TenantIsolationError extends StorageError {
  constructor(tenantId: string, attemptedTenantId: string) {
    super(
      `Tenant isolation violation: ${attemptedTenantId} attempted access to ${tenantId} resources`,
      'TENANT_ISOLATION_ERROR',
      tenantId
    );
  }
}
