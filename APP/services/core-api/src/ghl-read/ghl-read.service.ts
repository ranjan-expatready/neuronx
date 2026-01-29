/**
 * GHL Read Service - WI-070C: Read-Only GHL Live Data Integration (Truth Lock)
 *
 * Service for read-only GHL data access, snapshot management, and trust validation.
 * Provides real GHL data without write capabilities for user confidence.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  GhlReadAdapter,
  GhlSnapshotService,
  GovernanceGuard,
  GhlReadAdapterConfig,
  GhlSnapshotData,
  SnapshotMetadata,
  DataFreshness,
  DataAlignment,
} from '@neuronx/ghl-read-adapter';

@Injectable()
export class GhlReadService {
  private readonly logger = new Logger(GhlReadService.name);
  private readonly adapters: Map<string, GhlReadAdapter> = new Map();
  private readonly snapshotServices: Map<string, GhlSnapshotService> =
    new Map();
  private readonly governanceGuards: Map<string, GovernanceGuard> = new Map();

  constructor(@Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient) {}

  /**
   * Get or create GHL read adapter for tenant
   */
  private getAdapter(tenantId: string): GhlReadAdapter {
    if (!this.adapters.has(tenantId)) {
      const config: GhlReadAdapterConfig = {
        tenantId,
        environment:
          (process.env.NEURONX_ENV as 'dev' | 'stage' | 'prod') || 'dev',
        baseUrl: process.env.GHL_BASE_URL,
        snapshot: {
          enabled: true,
          retentionDays: parseInt(
            process.env.GHL_SNAPSHOT_RETENTION_DAYS || '30'
          ),
          maxRecordsPerSnapshot: parseInt(
            process.env.GHL_MAX_RECORDS_PER_SNAPSHOT || '10000'
          ),
        },
        governance: {
          auditMutations: true,
          rateLimitRequestsPerMinute: parseInt(
            process.env.GHL_RATE_LIMIT_RPM || '100'
          ),
          allowedDataTypes: ['contacts', 'opportunities', 'pipelines', 'users'],
        },
      };

      const adapter = new GhlReadAdapter(config);
      this.adapters.set(tenantId, adapter);

      // Create corresponding services
      const snapshotService = new GhlSnapshotService(
        adapter,
        config,
        this.prisma
      );
      this.snapshotServices.set(tenantId, snapshotService);

      const governanceGuard = new GovernanceGuard(true);
      this.governanceGuards.set(tenantId, governanceGuard);

      this.logger.log(`Created GHL read adapter for tenant ${tenantId}`);
    }

    return this.adapters.get(tenantId)!;
  }

  /**
   * Get GHL contacts (read-only)
   */
  async getContacts(
    tenantId: string,
    correlationId: string,
    filters?: {
      limit?: number;
      offset?: number;
      email?: string;
      tags?: string[];
    }
  ) {
    const adapter = this.getAdapter(tenantId);
    const governanceGuard = this.governanceGuards.get(tenantId)!;

    // Validate operation is allowed
    governanceGuard.isOperationAllowed('listLeads', {
      tenantId,
      correlationId,
      environment: process.env.NEURONX_ENV || 'dev',
    });

    // Check rate limits
    await governanceGuard.checkRateLimit(
      tenantId,
      'listLeads',
      100, // requests per minute
      { tenantId, correlationId }
    );

    const context = {
      tenantId,
      correlationId,
      environment: process.env.NEURONX_ENV || 'dev',
    };

    const result = await adapter.listLeads(filters, context);

    this.logger.log(
      `Retrieved ${result.leads.length} GHL contacts for tenant ${tenantId}`,
      {
        correlationId,
        total: result.total,
      }
    );

    return result;
  }

  /**
   * Get GHL opportunities (read-only)
   */
  async getOpportunities(
    tenantId: string,
    correlationId: string,
    filters?: {
      limit?: number;
      offset?: number;
      pipelineId?: string;
      stage?: string;
    }
  ) {
    const adapter = this.getAdapter(tenantId);
    const governanceGuard = this.governanceGuards.get(tenantId)!;

    governanceGuard.isOperationAllowed('listOpportunities', {
      tenantId,
      correlationId,
      environment: process.env.NEURONX_ENV || 'dev',
    });

    await governanceGuard.checkRateLimit(tenantId, 'listOpportunities', 100, {
      tenantId,
      correlationId,
    });

    const context = {
      tenantId,
      correlationId,
      environment: process.env.NEURONX_ENV || 'dev',
    };

    const result = await adapter.listOpportunities(filters, context);

    this.logger.log(
      `Retrieved ${result.opportunities.length} GHL opportunities for tenant ${tenantId}`,
      {
        correlationId,
        total: result.total,
      }
    );

    return result;
  }

  /**
   * Get GHL pipelines (read-only)
   */
  async getPipelines(tenantId: string, correlationId: string) {
    const adapter = this.getAdapter(tenantId);
    const governanceGuard = this.governanceGuards.get(tenantId)!;

    governanceGuard.isOperationAllowed('getPipelines', {
      tenantId,
      correlationId,
      environment: process.env.NEURONX_ENV || 'dev',
    });

    const context = {
      tenantId,
      correlationId,
      environment: process.env.NEURONX_ENV || 'dev',
    };

    const result = await adapter.getPipelines(context);

    this.logger.log(
      `Retrieved ${result.length} GHL pipelines for tenant ${tenantId}`,
      {
        correlationId,
      }
    );

    return result;
  }

  /**
   * Create GHL data snapshot
   */
  async createSnapshot(
    tenantId: string,
    correlationId: string,
    dataTypes?: string[]
  ): Promise<GhlSnapshotData> {
    const snapshotService = this.snapshotServices.get(tenantId)!;
    const governanceGuard = this.governanceGuards.get(tenantId)!;

    governanceGuard.isOperationAllowed('createSnapshot', {
      tenantId,
      correlationId,
      environment: process.env.NEURONX_ENV || 'dev',
    });

    const context = {
      tenantId,
      correlationId,
      environment: process.env.NEURONX_ENV || 'dev',
    };

    this.logger.log(`Creating GHL snapshot for tenant ${tenantId}`, {
      correlationId,
      dataTypes: dataTypes || 'all',
    });

    const result = await snapshotService.createSnapshot(context);

    this.logger.log(
      `Created GHL snapshot ${result.metadata.snapshotId} with ${result.metadata.recordCount} records`,
      {
        correlationId,
        snapshotId: result.metadata.snapshotId,
        recordCount: result.metadata.recordCount,
        dataTypes: result.metadata.dataTypes,
      }
    );

    return result;
  }

  /**
   * Get latest GHL snapshot
   */
  async getLatestSnapshot(tenantId: string): Promise<GhlSnapshotData | null> {
    const snapshotService = this.snapshotServices.get(tenantId)!;

    const result = await snapshotService.getLatestSnapshot(tenantId);

    if (result) {
      this.logger.log(
        `Retrieved latest GHL snapshot ${result.metadata.snapshotId} for tenant ${tenantId}`,
        {
          snapshotId: result.metadata.snapshotId,
          recordCount: result.metadata.recordCount,
          pulledAt: result.metadata.pulledAt.toISOString(),
        }
      );
    } else {
      this.logger.log(`No GHL snapshots found for tenant ${tenantId}`);
    }

    return result;
  }

  /**
   * Get specific GHL snapshot
   */
  async getSnapshot(snapshotId: string): Promise<GhlSnapshotData | null> {
    // Find snapshot service by iterating through all (inefficient but works for now)
    for (const [tenantId, snapshotService] of this.snapshotServices.entries()) {
      const result = await snapshotService.getSnapshot(snapshotId);
      if (result) {
        this.logger.log(
          `Retrieved GHL snapshot ${snapshotId} for tenant ${tenantId}`,
          {
            snapshotId,
            recordCount: result.metadata.recordCount,
          }
        );
        return result;
      }
    }

    this.logger.log(`GHL snapshot ${snapshotId} not found`);
    return null;
  }

  /**
   * List GHL snapshots for tenant
   */
  async listSnapshots(
    tenantId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ snapshots: SnapshotMetadata[]; total: number }> {
    const snapshotService = this.snapshotServices.get(tenantId)!;

    const result = await snapshotService.listSnapshots(tenantId, limit, offset);

    this.logger.log(
      `Listed ${result.snapshots.length} GHL snapshots for tenant ${tenantId}`,
      {
        total: result.total,
        limit,
        offset,
      }
    );

    return result;
  }

  /**
   * Get data freshness information
   */
  async getDataFreshness(tenantId: string): Promise<DataFreshness> {
    const latestSnapshot = await this.getLatestSnapshot(tenantId);

    if (!latestSnapshot) {
      return {
        source: 'GHL',
        lastUpdated: new Date(0), // Never updated
        ageInMinutes: Infinity,
        isStale: true,
      };
    }

    const now = new Date();
    const lastUpdated = latestSnapshot.metadata.pulledAt;
    const ageInMinutes = Math.floor(
      (now.getTime() - lastUpdated.getTime()) / (1000 * 60)
    );
    const isStale = ageInMinutes > 60; // Consider stale after 1 hour

    return {
      source: 'GHL',
      lastUpdated,
      ageInMinutes,
      isStale,
      snapshotId: latestSnapshot.metadata.snapshotId,
    };
  }

  /**
   * Get data alignment between NeuronX and GHL
   */
  async getDataAlignment(tenantId: string): Promise<DataAlignment> {
    // This is a simplified implementation
    // In production, you'd compare NeuronX data with GHL snapshot data
    const latestSnapshot = await this.getLatestSnapshot(tenantId);

    if (!latestSnapshot) {
      return {
        totalRecords: 0,
        alignedRecords: 0,
        misalignedRecords: 0,
        alignmentPercentage: null, // UNKNOWN - insufficient evidence
        driftReasons: [],
      };
    }

    // Alignment calculation not implemented yet - insufficient evidence
    const totalRecords = latestSnapshot.metadata.recordCount;

    return {
      totalRecords,
      alignedRecords: null, // UNKNOWN
      misalignedRecords: null, // UNKNOWN
      alignmentPercentage: null, // UNKNOWN - insufficient evidence
      driftReasons: [
        // Example drift reasons
        {
          recordId: 'example-contact-1',
          field: 'lastActivityAt',
          neuronxValue: new Date().toISOString(),
          ghlValue: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          severity: 'low',
        },
      ],
    };
  }

  /**
   * Get health status of GHL read adapter
   */
  async getHealth(tenantId: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    lastChecked: Date;
  }> {
    try {
      const adapter = this.getAdapter(tenantId);
      const health = await adapter.getHealth();

      // Additional checks for read-only mode
      const governanceGuard = this.governanceGuards.get(tenantId)!;
      const governanceHealth = governanceGuard.getHealthStatus();

      if (governanceHealth.status !== 'healthy') {
        return {
          status: 'degraded',
          message: `Governance issues: ${governanceHealth.message}`,
          lastChecked: new Date(),
        };
      }

      return {
        ...health,
        message: health.message
          ? `${health.message} (Read-Only Mode)`
          : 'Read-Only Mode Active',
      };
    } catch (error) {
      this.logger.error(
        `GHL read adapter health check failed for tenant ${tenantId}: ${error.message}`
      );
      return {
        status: 'unhealthy',
        message: `Health check failed: ${error.message}`,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Clean up old snapshots (maintenance operation)
   */
  async cleanupOldSnapshots(): Promise<number> {
    let totalDeleted = 0;

    for (const [tenantId, snapshotService] of this.snapshotServices.entries()) {
      try {
        const deleted = await snapshotService.cleanupOldSnapshots();
        totalDeleted += deleted;

        if (deleted > 0) {
          this.logger.log(
            `Cleaned up ${deleted} old snapshots for tenant ${tenantId}`
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to cleanup snapshots for tenant ${tenantId}: ${error.message}`
        );
      }
    }

    this.logger.log(
      `Completed cleanup of old GHL snapshots, deleted ${totalDeleted} total`
    );
    return totalDeleted;
  }
}
