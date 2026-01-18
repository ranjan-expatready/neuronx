/**
 * Storage Key Utilities - WI-021: Object Storage & Artifact Management
 *
 * Utilities for generating tenant-isolated object keys and path management.
 */

import { ArtifactType } from './storage.types';

export class StorageKeys {
  /**
   * Generate tenant-prefixed object key
   * Format: {tenantId}/{type}/{timestamp}-{random}.{extension}
   */
  static generateObjectKey(
    tenantId: string,
    type: ArtifactType,
    contentType: string,
    timestamp?: Date
  ): string {
    const ts = timestamp || new Date();
    const date = ts.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = ts.getTime();
    const random = Math.random().toString(36).substr(2, 9);

    // Extract file extension from content type
    const extension = this.getFileExtension(contentType, type);

    return `${tenantId}/${type}/${date}/${time}-${random}.${extension}`;
  }

  /**
   * Generate tenant prefix for listing operations
   */
  static getTenantPrefix(tenantId: string): string {
    return `${tenantId}/`;
  }

  /**
   * Generate type-specific prefix within tenant
   */
  static getTypePrefix(tenantId: string, type: ArtifactType): string {
    return `${tenantId}/${type}/`;
  }

  /**
   * Extract tenant ID from object key
   */
  static extractTenantId(objectKey: string): string {
    const parts = objectKey.split('/');
    if (parts.length < 1) {
      throw new Error(`Invalid object key format: ${objectKey}`);
    }
    return parts[0];
  }

  /**
   * Extract artifact type from object key
   */
  static extractArtifactType(objectKey: string): ArtifactType {
    const parts = objectKey.split('/');
    if (parts.length < 2) {
      throw new Error(`Invalid object key format: ${objectKey}`);
    }

    const type = parts[1];
    const validTypes: ArtifactType[] = [
      'voice-recording',
      'voice-transcript',
      'export-csv',
      'export-pdf',
      'invoice-pdf',
      'document',
    ];

    if (!validTypes.includes(type as ArtifactType)) {
      throw new Error(`Invalid artifact type in key: ${type}`);
    }

    return type as ArtifactType;
  }

  /**
   * Validate that object key belongs to tenant
   */
  static validateTenantOwnership(objectKey: string, tenantId: string): boolean {
    try {
      const extractedTenantId = this.extractTenantId(objectKey);
      return extractedTenantId === tenantId;
    } catch {
      return false;
    }
  }

  /**
   * Get file extension based on content type and artifact type
   */
  private static getFileExtension(
    contentType: string,
    type: ArtifactType
  ): string {
    // Content type based extensions
    if (contentType.includes('audio/')) {
      if (contentType.includes('mp3')) return 'mp3';
      if (contentType.includes('wav')) return 'wav';
      if (contentType.includes('ogg')) return 'ogg';
      if (contentType.includes('webm')) return 'webm';
      return 'audio'; // fallback
    }

    if (contentType.includes('text/')) {
      if (contentType.includes('plain')) return 'txt';
      if (contentType.includes('json')) return 'json';
      return 'txt';
    }

    if (contentType === 'application/pdf') return 'pdf';
    if (contentType === 'text/csv') return 'csv';
    if (contentType.includes('spreadsheet')) return 'xlsx';
    if (contentType.includes('document')) return 'docx';

    // Type-based fallbacks
    switch (type) {
      case 'voice-recording':
        return 'webm';
      case 'voice-transcript':
        return 'txt';
      case 'export-csv':
        return 'csv';
      case 'export-pdf':
      case 'invoice-pdf':
        return 'pdf';
      case 'document':
        return 'pdf';
      default:
        return 'bin';
    }
  }

  /**
   * Generate checksum-based filename for deterministic keys
   */
  static generateDeterministicKey(
    tenantId: string,
    type: ArtifactType,
    checksum: string,
    contentType: string
  ): string {
    const extension = this.getFileExtension(contentType, type);
    const shortChecksum = checksum.substring(0, 16); // First 16 chars

    return `${tenantId}/${type}/checksums/${shortChecksum}.${extension}`;
  }

  /**
   * Check if key represents a temporary/expirable artifact
   */
  static isTemporaryArtifact(objectKey: string): boolean {
    // Temporary artifacts might be in specific folders
    return objectKey.includes('/temp/') || objectKey.includes('/cache/');
  }

  /**
   * Sanitize filename for safe storage
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace unsafe chars with underscore
      .substring(0, 255); // Limit length
  }
}
