/**
 * Local File System Storage Provider - WI-021: Object Storage & Artifact Management
 *
 * Development-only local filesystem storage provider.
 * WARNING: This provides NO security and should NEVER be used in production.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  StorageProvider,
  ObjectMetadata,
  ListObjectsResult,
  StorageConfig,
  ObjectNotFoundError,
} from './storage.types';
import { StorageKeys } from './storage-keys';
import { artifactsMetrics } from '../observability/metrics';

export class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string;

  constructor(private readonly config: StorageConfig) {
    if (config.provider !== 'local') {
      throw new Error('LocalStorageProvider requires local configuration');
    }

    // Use provided bucket name as directory name
    this.basePath = path.resolve(
      process.cwd(),
      'storage',
      config.bucketName || 'local-bucket'
    );

    // Ensure directory exists
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }

    console.warn('⚠️  USING LOCAL FILESYSTEM STORAGE - NO ENCRYPTION ⚠️');
    console.warn(
      'This provides NO security and should NEVER be used in production'
    );
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

    // For local development, return a special URL format that the test client can handle
    // In a real implementation, this might return a local server URL
    return `file://upload/${objectKey}?contentType=${encodeURIComponent(contentType)}&expires=${expiresInSeconds}`;
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

    // Check if file exists
    const filePath = this.getFilePath(objectKey);
    if (!fs.existsSync(filePath)) {
      throw new ObjectNotFoundError(tenantId, objectKey);
    }

    // For local development, return a special URL format
    return `file://download/${objectKey}?expires=${expiresInSeconds}`;
  }

  async objectExists(tenantId: string, objectKey: string): Promise<boolean> {
    // Validate tenant ownership
    if (!StorageKeys.validateTenantOwnership(objectKey, tenantId)) {
      return false;
    }

    const filePath = this.getFilePath(objectKey);
    return fs.existsSync(filePath);
  }

  async deleteObject(tenantId: string, objectKey: string): Promise<void> {
    try {
      // Validate tenant ownership
      if (!StorageKeys.validateTenantOwnership(objectKey, tenantId)) {
        artifactsMetrics.storageDeleteFailTotal.inc();
        throw new Error(`Object key does not belong to tenant: ${tenantId}`);
      }

      const filePath = this.getFilePath(objectKey);

      if (!fs.existsSync(filePath)) {
        artifactsMetrics.storageDeleteFailTotal.inc();
        throw new ObjectNotFoundError(tenantId, objectKey);
      }

      fs.unlinkSync(filePath);

      // Record success metrics
      artifactsMetrics.storageDeleteSuccessTotal.inc();

      // Clean up empty directories
      this.cleanupEmptyDirectories(path.dirname(filePath));
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

    const filePath = this.getFilePath(objectKey);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    const contentType = this.inferContentType(objectKey);

    return {
      key: objectKey,
      size: stats.size,
      contentType,
      lastModified: stats.mtime,
      etag: `"${stats.mtime.getTime()}"`, // Mock etag
      storageClass: 'LOCAL',
    };
  }

  async listObjects(
    tenantId: string,
    prefix?: string,
    maxKeys: number = 1000
  ): Promise<ListObjectsResult> {
    const tenantPrefix = StorageKeys.getTenantPrefix(tenantId);
    const fullPrefix = prefix ? `${tenantPrefix}${prefix}` : tenantPrefix;

    const tenantDir = path.join(this.basePath, tenantId);

    if (!fs.existsSync(tenantDir)) {
      return { objects: [], isTruncated: false };
    }

    const objects: ObjectMetadata[] = [];
    const walkDir = (dir: string, currentPrefix: string) => {
      if (objects.length >= maxKeys) return;

      const items = fs.readdirSync(dir);

      for (const item of items) {
        if (objects.length >= maxKeys) break;

        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          walkDir(itemPath, path.join(currentPrefix, item));
        } else {
          const objectKey = path.join(currentPrefix, item).replace(/\\/g, '/');
          if (objectKey.startsWith(fullPrefix)) {
            objects.push({
              key: objectKey,
              size: stat.size,
              contentType: this.inferContentType(objectKey),
              lastModified: stat.mtime,
              etag: `"${stat.mtime.getTime()}"`,
              storageClass: 'LOCAL',
            });
          }
        }
      }
    };

    walkDir(tenantDir, tenantPrefix);

    return {
      objects,
      isTruncated: false, // Local FS doesn't have continuation tokens
    };
  }

  /**
   * Get full file system path for object key
   */
  private getFilePath(objectKey: string): string {
    // Ensure path is safe and within base directory
    const normalizedKey = path
      .normalize(objectKey)
      .replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.basePath, normalizedKey);
  }

  /**
   * Infer content type from file extension
   */
  private inferContentType(objectKey: string): string {
    const ext = path.extname(objectKey).toLowerCase();

    const contentTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm',
      '.mp4': 'video/mp4',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.csv': 'text/csv',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Clean up empty directories after file deletion
   */
  private cleanupEmptyDirectories(dirPath: string): void {
    let currentPath = dirPath;

    while (currentPath !== this.basePath) {
      try {
        const items = fs.readdirSync(currentPath);
        if (items.length === 0) {
          fs.rmdirSync(currentPath);
          currentPath = path.dirname(currentPath);
        } else {
          break;
        }
      } catch {
        break;
      }
    }
  }

  /**
   * Get base storage path
   */
  getBasePath(): string {
    return this.basePath;
  }
}
