/**
 * Artifacts Controller - WI-021: Object Storage & Artifact Management
 *
 * REST API for tenant-scoped artifact management with pre-signed URLs.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateUploadUrlRequest,
  ListArtifactsQuery,
  UploadUrlResponse,
  DownloadUrlResponse,
  ListArtifactsResponse,
  ArtifactDetail,
  ArtifactStatsResponse,
  ArtifactValidation,
} from './artifacts.dto';
import { ArtifactsService } from './artifacts.service';
import { ArtifactType } from './storage.types';
import { AuthGuard } from '../authz/auth.guard';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/permissions.decorator';

@Controller('api/artifacts')
@UseGuards(AuthGuard, PermissionsGuard)
export class ArtifactsController {
  private readonly logger = new Logger(ArtifactsController.name);

  constructor(private readonly artifactsService: ArtifactsService) {}

  // ============================================================================
  // UPLOAD/DOWNLOAD URLS
  // ============================================================================

  /**
   * Generate pre-signed upload URL for new artifact
   */
  @Post('upload-url')
  @RequirePermissions('artifacts:write')
  async createUploadUrl(
    @Body() request: CreateUploadUrlRequest,
    @Request() req: any
  ): Promise<UploadUrlResponse> {
    const tenantId = req.tenantId;
    const correlationId = ArtifactValidation.generateCorrelationId(
      'upload-url',
      tenantId
    );

    this.logger.log(`Creating upload URL`, {
      tenantId,
      type: request.type,
      size: request.size,
      correlationId,
    });

    try {
      // Validate content type matches artifact type
      if (
        !ArtifactValidation.validateContentType(
          request.type,
          request.contentType
        )
      ) {
        throw new BadRequestException(
          `Content type ${request.contentType} is not valid for artifact type ${request.type}`
        );
      }

      const result = await this.artifactsService.createUploadUrl({
        tenantId,
        type: request.type,
        contentType: request.contentType,
        size: request.size,
        metadata: request.metadata,
      });

      this.logger.log(`Created upload URL`, {
        tenantId,
        artifactId: result.artifactId,
        objectKey: result.objectKey,
        correlationId,
      });

      return {
        ...result,
        maxSize: 100 * 1024 * 1024, // 100MB
      };
    } catch (error: any) {
      this.logger.error(`Failed to create upload URL`, {
        tenantId,
        type: request.type,
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Generate pre-signed download URL for artifact
   */
  @Post(':id/download-url')
  @RequirePermissions('artifacts:read')
  async createDownloadUrl(
    @Param('id') artifactId: string,
    @Request() req: any
  ): Promise<DownloadUrlResponse> {
    const tenantId = req.tenantId;
    const correlationId = ArtifactValidation.generateCorrelationId(
      'download-url',
      tenantId
    );

    this.logger.log(`Creating download URL`, {
      tenantId,
      artifactId,
      correlationId,
    });

    try {
      const result = await this.artifactsService.createDownloadUrl(
        tenantId,
        artifactId
      );

      this.logger.log(`Created download URL`, {
        tenantId,
        artifactId,
        correlationId,
      });

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to create download URL`, {
        tenantId,
        artifactId,
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

  // ============================================================================
  // ARTIFACT MANAGEMENT
  // ============================================================================

  /**
   * List artifacts for tenant
   */
  @Get()
  @RequirePermissions('artifacts:read')
  async listArtifacts(
    @Query() query: ListArtifactsQuery,
    @Request() req: any
  ): Promise<ListArtifactsResponse> {
    const tenantId = req.tenantId;
    const limit = query.limit || 50;
    const offset = query.nextToken ? parseInt(query.nextToken, 10) : 0;

    this.logger.debug(`Listing artifacts`, {
      tenantId,
      type: query.type,
      limit,
      offset,
    });

    const result = await this.artifactsService.listArtifacts(
      tenantId,
      query.type,
      limit,
      offset
    );

    return {
      ...result,
      limit,
    };
  }

  /**
   * Get artifact details
   */
  @Get(':id')
  @RequirePermissions('artifacts:read')
  async getArtifact(
    @Param('id') artifactId: string,
    @Request() req: any
  ): Promise<ArtifactDetail> {
    const tenantId = req.tenantId;

    this.logger.debug(`Getting artifact`, {
      tenantId,
      artifactId,
    });

    const artifact = await this.artifactsService.getArtifact(
      tenantId,
      artifactId
    );

    if (!artifact) {
      throw new NotFoundException(`Artifact ${artifactId} not found`);
    }

    return artifact as ArtifactDetail;
  }

  /**
   * Delete artifact (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('artifacts:manage')
  async deleteArtifact(
    @Param('id') artifactId: string,
    @Request() req: any
  ): Promise<void> {
    const tenantId = req.tenantId;
    const correlationId = ArtifactValidation.generateCorrelationId(
      'delete',
      tenantId
    );

    this.logger.log(`Deleting artifact`, {
      tenantId,
      artifactId,
      correlationId,
    });

    try {
      await this.artifactsService.deleteArtifact(tenantId, artifactId);

      this.logger.log(`Deleted artifact`, {
        tenantId,
        artifactId,
        correlationId,
      });
    } catch (error: any) {
      this.logger.error(`Failed to delete artifact`, {
        tenantId,
        artifactId,
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

  // ============================================================================
  // MONITORING & STATISTICS
  // ============================================================================

  /**
   * Get artifact statistics for tenant
   */
  @Get('stats/overview')
  @RequirePermissions('artifacts:read')
  async getStats(@Request() req: any): Promise<ArtifactStatsResponse> {
    const tenantId = req.tenantId;

    this.logger.debug(`Getting artifact stats`, { tenantId });

    const stats = await this.artifactsService.getArtifactStats(tenantId);

    return {
      ...stats,
      totalSizeHuman: ArtifactValidation.formatBytes(stats.totalSize),
    };
  }
}
