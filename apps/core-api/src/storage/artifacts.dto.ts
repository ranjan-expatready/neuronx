/**
 * Artifacts API DTOs - WI-021: Object Storage & Artifact Management
 *
 * Request/response DTOs for artifact management APIs.
 */

import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ArtifactType, SUPPORTED_WEBHOOK_EVENTS } from './storage.types';

// Re-export for convenience
export { SUPPORTED_WEBHOOK_EVENTS };

// ============================================================================
// REQUEST DTOs
// ============================================================================

export class CreateUploadUrlRequest {
  @IsEnum([
    'voice-recording',
    'voice-transcript',
    'export-csv',
    'export-pdf',
    'invoice-pdf',
    'document',
  ])
  type: ArtifactType;

  @IsString()
  @MaxLength(100)
  contentType: string;

  @IsNumber()
  @Min(1)
  @Max(100 * 1024 * 1024) // 100MB max
  @Type(() => Number)
  size: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class ListArtifactsQuery {
  @IsOptional()
  @IsEnum([
    'voice-recording',
    'voice-transcript',
    'export-csv',
    'export-pdf',
    'invoice-pdf',
    'document',
  ])
  type?: ArtifactType;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  nextToken?: string;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

export class ArtifactSummary {
  id: string;
  type: ArtifactType;
  size: number;
  contentType: string;
  checksum: string;
  createdAt: Date;
  expiresAt?: Date;
}

export class ArtifactDetail {
  id: string;
  objectKey: string;
  type: ArtifactType;
  size: number;
  contentType: string;
  checksum: string;
  metadata: Record<string, string>;
  createdAt: Date;
  expiresAt?: Date;
}

export class UploadUrlResponse {
  artifactId: string;
  uploadUrl: string;
  objectKey: string;
  expiresAt: Date;
  maxSize: number;
}

export class DownloadUrlResponse {
  downloadUrl: string;
  expiresAt: Date;
  artifact: ArtifactDetail;
}

export class ListArtifactsResponse {
  artifacts: ArtifactSummary[];
  total: number;
  nextToken?: string;
  limit: number;
}

export class ArtifactStatsResponse {
  total: number;
  byType: Record<ArtifactType, number>;
  totalSize: number;
  totalSizeHuman: string; // Human-readable size
}

// ============================================================================
// ERROR RESPONSES
// ============================================================================

export class ArtifactApiError {
  error: string;
  message: string;
  tenantId?: string;
  artifactId?: string;
  correlationId?: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

export class ArtifactValidation {
  /**
   * Convert bytes to human-readable format
   */
  static formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Validate content type for artifact type
   */
  static validateContentType(type: ArtifactType, contentType: string): boolean {
    const typeValidations: Record<ArtifactType, (ct: string) => boolean> = {
      'voice-recording': ct =>
        ct.startsWith('audio/') || ct.startsWith('video/'),
      'voice-transcript': ct =>
        ct.startsWith('text/') || ct === 'application/json',
      'export-csv': ct => ct === 'text/csv',
      'export-pdf': ct => ct === 'application/pdf',
      'invoice-pdf': ct => ct === 'application/pdf',
      document: ct => ct.includes('document') || ct === 'application/pdf',
    };

    return typeValidations[type]?.(contentType) ?? false;
  }

  /**
   * Generate correlation ID for API operations
   */
  static generateCorrelationId(operation: string, tenantId: string): string {
    return `artifacts-api-${operation}-${tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
