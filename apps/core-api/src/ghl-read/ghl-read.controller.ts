/**
 * GHL Read Controller - WI-070C: Read-Only GHL Live Data Integration (Truth Lock)
 *
 * API endpoints for read-only GHL data access and snapshot management.
 * Provides trust validation by surfacing real GHL data without write capabilities.
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Headers,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GhlReadService } from './ghl-read.service';

@Controller('ghl-read')
export class GhlReadController {
  private readonly logger = new Logger(GhlReadController.name);

  constructor(private readonly ghlReadService: GhlReadService) {}

  /**
   * Get GHL contacts (read-only)
   */
  @Get('contacts')
  async getContacts(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('email') email?: string,
    @Query('tags') tags?: string
  ) {
    this.logger.log(`Getting GHL contacts for tenant ${tenantId}`);

    try {
      const result = await this.ghlReadService.getContacts(
        tenantId,
        correlationId,
        {
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined,
          email,
          tags: tags ? tags.split(',') : undefined,
        }
      );

      return {
        success: true,
        data: result,
        source: 'GHL',
        lastUpdated: new Date().toISOString(),
        correlationId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get GHL contacts: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve GHL contacts',
          correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get GHL opportunities (read-only)
   */
  @Get('opportunities')
  async getOpportunities(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('pipelineId') pipelineId?: string,
    @Query('stage') stage?: string
  ) {
    this.logger.log(`Getting GHL opportunities for tenant ${tenantId}`);

    try {
      const result = await this.ghlReadService.getOpportunities(
        tenantId,
        correlationId,
        {
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined,
          pipelineId,
          stage,
        }
      );

      return {
        success: true,
        data: result,
        source: 'GHL',
        lastUpdated: new Date().toISOString(),
        correlationId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get GHL opportunities: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve GHL opportunities',
          correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get GHL pipelines (read-only)
   */
  @Get('pipelines')
  async getPipelines(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId: string
  ) {
    this.logger.log(`Getting GHL pipelines for tenant ${tenantId}`);

    try {
      const result = await this.ghlReadService.getPipelines(
        tenantId,
        correlationId
      );

      return {
        success: true,
        data: result,
        source: 'GHL',
        lastUpdated: new Date().toISOString(),
        correlationId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get GHL pipelines: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve GHL pipelines',
          correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Create GHL data snapshot (on-demand)
   */
  @Post('snapshot')
  async createSnapshot(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId: string,
    @Body() body?: { dataTypes?: string[] }
  ) {
    this.logger.log(`Creating GHL snapshot for tenant ${tenantId}`);

    try {
      const result = await this.ghlReadService.createSnapshot(
        tenantId,
        correlationId,
        body?.dataTypes
      );

      return {
        success: true,
        snapshotId: result.metadata.snapshotId,
        recordCount: result.metadata.recordCount,
        dataTypes: result.metadata.dataTypes,
        source: 'GHL',
        createdAt: result.metadata.pulledAt.toISOString(),
        correlationId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create GHL snapshot: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        {
          success: false,
          error: 'Failed to create GHL data snapshot',
          correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get latest GHL snapshot
   */
  @Get('snapshot/latest')
  async getLatestSnapshot(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId: string
  ) {
    this.logger.log(`Getting latest GHL snapshot for tenant ${tenantId}`);

    try {
      const result = await this.ghlReadService.getLatestSnapshot(tenantId);

      if (!result) {
        return {
          success: true,
          data: null,
          message: 'No snapshots available',
          correlationId,
        };
      }

      return {
        success: true,
        snapshotId: result.metadata.snapshotId,
        recordCount: result.metadata.recordCount,
        dataTypes: result.metadata.dataTypes,
        pulledAt: result.metadata.pulledAt.toISOString(),
        data: result,
        correlationId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get latest GHL snapshot: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve latest GHL snapshot',
          correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get specific GHL snapshot
   */
  @Get('snapshot/:snapshotId')
  async getSnapshot(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId: string,
    @Param('snapshotId') snapshotId: string
  ) {
    this.logger.log(
      `Getting GHL snapshot ${snapshotId} for tenant ${tenantId}`
    );

    try {
      const result = await this.ghlReadService.getSnapshot(snapshotId);

      if (!result) {
        throw new HttpException(
          {
            success: false,
            error: 'Snapshot not found',
            correlationId,
          },
          HttpStatus.NOT_FOUND
        );
      }

      // Verify snapshot belongs to tenant
      if (result.metadata.tenantId !== tenantId) {
        throw new HttpException(
          {
            success: false,
            error: 'Snapshot access denied',
            correlationId,
          },
          HttpStatus.FORBIDDEN
        );
      }

      return {
        success: true,
        snapshotId: result.metadata.snapshotId,
        recordCount: result.metadata.recordCount,
        dataTypes: result.metadata.dataTypes,
        pulledAt: result.metadata.pulledAt.toISOString(),
        data: result,
        correlationId,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Failed to get GHL snapshot: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve GHL snapshot',
          correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * List GHL snapshots for tenant
   */
  @Get('snapshots')
  async listSnapshots(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    this.logger.log(`Listing GHL snapshots for tenant ${tenantId}`);

    try {
      const result = await this.ghlReadService.listSnapshots(
        tenantId,
        limit ? parseInt(limit) : 10,
        offset ? parseInt(offset) : 0
      );

      return {
        success: true,
        snapshots: result.snapshots,
        total: result.total,
        correlationId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to list GHL snapshots: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve GHL snapshots',
          correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get GHL data freshness information
   */
  @Get('freshness')
  async getDataFreshness(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId: string
  ) {
    this.logger.log(`Getting GHL data freshness for tenant ${tenantId}`);

    try {
      const freshness = await this.ghlReadService.getDataFreshness(tenantId);

      return {
        success: true,
        freshness,
        correlationId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get GHL data freshness: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve GHL data freshness',
          correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get data alignment between NeuronX and GHL
   */
  @Get('alignment')
  async getDataAlignment(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId: string
  ) {
    this.logger.log(`Getting data alignment for tenant ${tenantId}`);

    try {
      const alignment = await this.ghlReadService.getDataAlignment(tenantId);

      return {
        success: true,
        alignment,
        correlationId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get data alignment: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve data alignment',
          correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get GHL read adapter health status
   */
  @Get('health')
  async getHealth(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-correlation-id') correlationId: string
  ) {
    this.logger.log(`Getting GHL read adapter health for tenant ${tenantId}`);

    try {
      const health = await this.ghlReadService.getHealth(tenantId);

      return {
        success: true,
        health: {
          ...health,
          readOnlyMode: true,
          governanceLevel: 'strict',
        },
        correlationId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get GHL read adapter health: ${error.message}`,
        error.stack
      );
      throw new HttpException(
        {
          success: false,
          error: 'Failed to retrieve GHL read adapter health',
          correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
