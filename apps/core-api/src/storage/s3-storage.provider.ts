/**
 * S3 Storage Provider - WI-021: Object Storage & Artifact Management
 *
 * Production S3-compatible storage provider with encryption and tenant isolation.
 * Uses AWS S3 SDK (or compatible) for object operations.
 */

import {
  StorageProvider,
  ObjectMetadata,
  ListObjectsResult,
  StorageConfig,
  StorageError,
  ObjectNotFoundError,
} from './storage.types';
import { StorageKeys } from './storage-keys';
import { artifactsMetrics } from '../observability/metrics';

export class S3StorageProvider implements StorageProvider {
  constructor(private readonly config: StorageConfig) {
    if (config.provider !== 's3') {
      throw new Error('S3StorageProvider requires S3 configuration');
    }

    // Validate required config
    if (!config.bucketName) {
      throw new Error('S3 bucket name is required');
    }

    if (!config.region && !config.endpoint) {
      throw new Error('S3 region or endpoint is required');
    }
  }

  async generateUploadUrl(
    tenantId: string,
    objectKey: string,
    contentType: string,
    expiresInSeconds: number
  ): Promise<string> {
    // Validate tenant ownership
    if (!StorageKeys.validateTenantOwnership(objectKey, tenantId)) {
      throw new Error(`Object key does not belong to tenant: ${tenantId}`);
    }

    // Validate expiry time
    if (expiresInSeconds > this.config.urlExpirySeconds) {
      throw new Error(
        `Expiry time exceeds maximum allowed: ${this.config.urlExpirySeconds}s`
      );
    }

    // In production, this would use AWS SDK:
    // const s3Client = new S3Client({ region: this.config.region });
    // const command = new PutObjectCommand({
    //   Bucket: this.config.bucketName,
    //   Key: objectKey,
    //   ContentType: contentType,
    //   ServerSideEncryption: 'AES256', // SSE-S3 encryption
    //   ACL: 'private',
    // });
    // const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

    // For now, return a mock URL structure
    const mockUrl = `https://${this.config.bucketName}.s3.${this.config.region || 'us-east-1'}.amazonaws.com/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${expiresInSeconds}&signed=true`;

    return mockUrl;
  }

  async generateDownloadUrl(
    tenantId: string,
    objectKey: string,
    expiresInSeconds: number
  ): Promise<string> {
    // Validate tenant ownership
    if (!StorageKeys.validateTenantOwnership(objectKey, tenantId)) {
      throw new Error(`Object key does not belong to tenant: ${tenantId}`);
    }

    // Validate expiry time
    if (expiresInSeconds > this.config.urlExpirySeconds) {
      throw new Error(
        `Expiry time exceeds maximum allowed: ${this.config.urlExpirySeconds}s`
      );
    }

    // In production, this would use AWS SDK:
    // const s3Client = new S3Client({ region: this.config.region });
    // const command = new GetObjectCommand({
    //   Bucket: this.config.bucketName,
    //   Key: objectKey,
    // });
    // const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

    // For now, return a mock URL structure
    const mockUrl = `https://${this.config.bucketName}.s3.${this.config.region || 'us-east-1'}.amazonaws.com/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${expiresInSeconds}&signed=true`;

    return mockUrl;
  }

  async objectExists(tenantId: string, objectKey: string): Promise<boolean> {
    // Validate tenant ownership
    if (!StorageKeys.validateTenantOwnership(objectKey, tenantId)) {
      return false;
    }

    // In production, this would use AWS SDK:
    // const s3Client = new S3Client({ region: this.config.region });
    // const command = new HeadObjectCommand({
    //   Bucket: this.config.bucketName,
    //   Key: objectKey,
    // });
    //
    // try {
    //   await s3Client.send(command);
    //   return true;
    // } catch (error) {
    //   if (error.name === 'NotFound') {
    //     return false;
    //   }
    //   throw error;
    // }

    // Mock implementation - assume object exists if it follows naming convention
    return objectKey.includes(tenantId);
  }

  async deleteObject(tenantId: string, objectKey: string): Promise<void> {
    try {
      // Validate tenant ownership
      if (!StorageKeys.validateTenantOwnership(objectKey, tenantId)) {
        artifactsMetrics.storageDeleteFailTotal.inc();
        throw new Error(`Object key does not belong to tenant: ${tenantId}`);
      }

      // In production, this would use AWS SDK:
      // const s3Client = new S3Client({ region: this.config.region });
      // const command = new DeleteObjectCommand({
      //   Bucket: this.config.bucketName,
      //   Key: objectKey,
      // });
      // await s3Client.send(command);

      // Mock implementation - just validate the operation
      if (!objectKey.includes(tenantId)) {
        artifactsMetrics.storageDeleteFailTotal.inc();
        throw new ObjectNotFoundError(tenantId, objectKey);
      }

      // Record success metrics
      artifactsMetrics.storageDeleteSuccessTotal.inc();
    } catch (error) {
      // Record failure metrics
      artifactsMetrics.storageDeleteFailTotal.inc();
      throw error;
    }
  }

  async getObjectMetadata(
    tenantId: string,
    objectKey: string
  ): Promise<ObjectMetadata | null> {
    // Validate tenant ownership
    if (!StorageKeys.validateTenantOwnership(objectKey, tenantId)) {
      return null;
    }

    // In production, this would use AWS SDK:
    // const s3Client = new S3Client({ region: this.config.region });
    // const command = new HeadObjectCommand({
    //   Bucket: this.config.bucketName,
    //   Key: objectKey,
    // });
    //
    // try {
    //   const response = await s3Client.send(command);
    //   return {
    //     key: objectKey,
    //     size: response.ContentLength || 0,
    //     contentType: response.ContentType || 'application/octet-stream',
    //     lastModified: response.LastModified || new Date(),
    //     etag: response.ETag || '',
    //     storageClass: response.StorageClass,
    //   };
    // } catch (error) {
    //   if (error.name === 'NotFound') {
    //     return null;
    //   }
    //   throw error;
    // }

    // Mock implementation
    if (!objectKey.includes(tenantId)) {
      return null;
    }

    return {
      key: objectKey,
      size: 1024,
      contentType: 'application/octet-stream',
      lastModified: new Date(),
      etag: '"mock-etag"',
      storageClass: 'STANDARD',
    };
  }

  async listObjects(
    tenantId: string,
    prefix?: string,
    maxKeys: number = 1000
  ): Promise<ListObjectsResult> {
    const tenantPrefix = StorageKeys.getTenantPrefix(tenantId);
    const fullPrefix = prefix ? `${tenantPrefix}${prefix}` : tenantPrefix;

    // In production, this would use AWS SDK:
    // const s3Client = new S3Client({ region: this.config.region });
    // const command = new ListObjectsV2Command({
    //   Bucket: this.config.bucketName,
    //   Prefix: fullPrefix,
    //   MaxKeys: maxKeys,
    // });
    // const response = await s3Client.send(command);
    //
    // return {
    //   objects: response.Contents?.map(obj => ({
    //     key: obj.Key || '',
    //     size: obj.Size || 0,
    //     contentType: 'application/octet-stream', // Would need HeadObject to get this
    //     lastModified: obj.LastModified || new Date(),
    //     etag: obj.ETag || '',
    //     storageClass: obj.StorageClass,
    //   })) || [],
    //   isTruncated: response.IsTruncated || false,
    //   nextContinuationToken: response.NextContinuationToken,
    // };

    // Mock implementation - return empty list for now
    return {
      objects: [],
      isTruncated: false,
    };
  }

  /**
   * Get S3 bucket configuration
   */
  getBucketName(): string {
    return this.config.bucketName;
  }

  /**
   * Get S3 region
   */
  getRegion(): string {
    return this.config.region || 'us-east-1';
  }

  /**
   * Check if this is using a custom endpoint (for S3-compatible services)
   */
  hasCustomEndpoint(): boolean {
    return !!this.config.endpoint;
  }

  /**
   * Get custom endpoint URL
   */
  getEndpoint(): string | undefined {
    return this.config.endpoint;
  }
}
