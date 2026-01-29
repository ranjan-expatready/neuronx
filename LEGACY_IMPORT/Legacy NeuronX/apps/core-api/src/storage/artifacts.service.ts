/**
 * Artifacts Service - WI-021: Object Storage & Artifact Management
 *
 * Service for managing artifact metadata with tenant isolation and storage integration.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  ArtifactRecord,
  CreateArtifactRequest,
  ArtifactUploadUrlResponse,
  ArtifactDownloadUrlResponse,
  ListArtifactsResponse,
  StorageProvider,
  ArtifactType,
} from './storage.types';
import { StorageKeys } from './storage-keys';
import { artifactsMetrics } from '../observability/metrics';

@Injectable()
export class ArtifactsService {
  private readonly logger = new Logger(ArtifactsService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly storageProvider: StorageProvider
  ) {}

  /**
   * Create artifact record and generate upload URL
   */
  async createUploadUrl(
    request: CreateArtifactRequest
  ): Promise<ArtifactUploadUrlResponse> {
    const { tenantId, type, contentType, size, metadata } = request;

    // Validate size limits
    if (size > 100 * 1024 * 1024) {
      // 100MB limit
      throw new Error('Artifact size exceeds maximum allowed: 100MB');
    }

    // Generate object key with tenant isolation
    const objectKey = StorageKeys.generateObjectKey(
      tenantId,
      type,
      contentType
    );

    // Generate pre-signed upload URL
    const uploadUrl = await this.storageProvider.generateUploadUrl(
      tenantId,
      objectKey,
      contentType,
      900 // 15 minutes
    );

    // Create artifact record
    const artifact = await this.prisma.artifactRecord.create({
      data: {
        tenantId,
        objectKey,
        type,
        size,
        contentType,
        checksum: '', // Will be set after upload completion
        metadata: metadata || {},
      },
    });

    const expiresAt = new Date(Date.now() + 900 * 1000); // 15 minutes from now

    // Record metrics
    artifactsMetrics.uploadUrlTotal.inc();

    this.logger.log(`Created upload URL for artifact`, {
      tenantId,
      artifactId: artifact.id,
      objectKey,
      type,
      size,
    });

    return {
      artifactId: artifact.id,
      uploadUrl,
      objectKey,
      expiresAt,
    };
  }

  /**
   * Generate download URL for artifact
   */
  async createDownloadUrl(
    tenantId: string,
    artifactId: string
  ): Promise<ArtifactDownloadUrlResponse> {
    // Get artifact record
    const artifact = await this.prisma.artifactRecord.findFirst({
      where: {
        id: artifactId,
        tenantId,
        deletedAt: null, // Not soft deleted
      },
    });

    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    // Check if object exists in storage
    const exists = await this.storageProvider.objectExists(
      tenantId,
      artifact.objectKey
    );
    if (!exists) {
      throw new Error(`Artifact storage object not found: ${artifactId}`);
    }

    // Generate pre-signed download URL
    const downloadUrl = await this.storageProvider.generateDownloadUrl(
      tenantId,
      artifact.objectKey,
      900 // 15 minutes
    );

    const expiresAt = new Date(Date.now() + 900 * 1000); // 15 minutes from now

    // Record metrics
    artifactsMetrics.downloadUrlTotal.inc();

    this.logger.log(`Created download URL for artifact`, {
      tenantId,
      artifactId,
      objectKey: artifact.objectKey,
    });

    return {
      downloadUrl,
      expiresAt,
      metadata: this.mapPrismaToArtifactRecord(artifact),
    };
  }

  /**
   * List artifacts for tenant with optional filtering
   */
  async listArtifacts(
    tenantId: string,
    type?: ArtifactType,
    limit: number = 50,
    offset: number = 0
  ): Promise<ListArtifactsResponse> {
    const where = {
      tenantId,
      deletedAt: null,
      ...(type && { type }),
    };

    const [artifacts, total] = await Promise.all([
      this.prisma.artifactRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.artifactRecord.count({ where }),
    ]);

    const nextToken =
      offset + limit < total ? (offset + limit).toString() : undefined;

    return {
      artifacts: artifacts.map(this.mapPrismaToArtifactRecord),
      total,
      nextToken,
    };
  }

  /**
   * Get artifact by ID
   */
  async getArtifact(
    tenantId: string,
    artifactId: string
  ): Promise<ArtifactRecord | null> {
    const artifact = await this.prisma.artifactRecord.findFirst({
      where: {
        id: artifactId,
        tenantId,
        deletedAt: null,
      },
    });

    return artifact ? this.mapPrismaToArtifactRecord(artifact) : null;
  }

  /**
   * Soft delete artifact
   */
  async deleteArtifact(tenantId: string, artifactId: string): Promise<void> {
    const artifact = await this.prisma.artifactRecord.findFirst({
      where: {
        id: artifactId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    // Soft delete the record
    await this.prisma.artifactRecord.update({
      where: { id: artifactId },
      data: { deletedAt: new Date() },
    });

    // Optionally delete from storage (commented out for audit purposes)
    // await this.storageProvider.deleteObject(tenantId, artifact.objectKey);

    this.logger.log(`Soft deleted artifact`, {
      tenantId,
      artifactId,
      objectKey: artifact.objectKey,
    });
  }

  /**
   * Update artifact checksum after successful upload
   */
  async updateArtifactChecksum(
    tenantId: string,
    artifactId: string,
    checksum: string
  ): Promise<void> {
    await this.prisma.artifactRecord.updateMany({
      where: {
        id: artifactId,
        tenantId,
        deletedAt: null,
      },
      data: { checksum },
    });

    this.logger.debug(`Updated artifact checksum`, {
      tenantId,
      artifactId,
      checksum,
    });
  }

  /**
   * Clean up expired artifacts
   */
  async cleanupExpiredArtifacts(): Promise<number> {
    const expiredArtifacts = await this.prisma.artifactRecord.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        deletedAt: null,
      },
      select: { id: true, tenantId: true, objectKey: true },
    });

    if (expiredArtifacts.length === 0) {
      return 0;
    }

    // Hard delete expired artifacts
    const result = await this.prisma.artifactRecord.deleteMany({
      where: {
        id: { in: expiredArtifacts.map(a => a.id) },
      },
    });

    // Delete from storage
    for (const artifact of expiredArtifacts) {
      try {
        await this.storageProvider.deleteObject(
          artifact.tenantId,
          artifact.objectKey
        );
      } catch (error) {
        this.logger.warn(`Failed to delete expired artifact from storage`, {
          artifactId: artifact.id,
          objectKey: artifact.objectKey,
          error: error.message,
        });
      }
    }

    this.logger.log(`Cleaned up ${result.count} expired artifacts`);
    return result.count;
  }

  /**
   * Get artifact statistics for tenant
   */
  async getArtifactStats(tenantId: string): Promise<{
    total: number;
    byType: Record<ArtifactType, number>;
    totalSize: number;
  }> {
    const artifacts = await this.prisma.artifactRecord.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      select: {
        type: true,
        size: true,
      },
    });

    const stats = {
      total: artifacts.length,
      byType: {} as Record<ArtifactType, number>,
      totalSize: 0,
    };

    for (const artifact of artifacts) {
      stats.byType[artifact.type as ArtifactType] =
        (stats.byType[artifact.type as ArtifactType] || 0) + 1;
      stats.totalSize += artifact.size;
    }

    return stats;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private mapPrismaToArtifactRecord(prismaRecord: any): ArtifactRecord {
    return {
      id: prismaRecord.id,
      tenantId: prismaRecord.tenantId,
      objectKey: prismaRecord.objectKey,
      type: prismaRecord.type as ArtifactType,
      size: prismaRecord.size,
      contentType: prismaRecord.contentType,
      checksum: prismaRecord.checksum,
      metadata: prismaRecord.metadata || {},
      createdAt: prismaRecord.createdAt,
      expiresAt: prismaRecord.expiresAt || undefined,
    };
  }
}
