/**
 * Snapshot Service - WI-070: Read-Only GHL Live Data Integration
 *
 * Controlled snapshot strategy for storing GHL data in NeuronX database.
 * Never trusts webhooks - only on-demand or scheduled pulls.
 */

import {
  GhlSnapshotData,
  SnapshotMetadata,
  ContactSnapshot,
  OpportunitySnapshot,
  PipelineSnapshot,
  ExtendedGhlReadAdapterConfig as GhlReadAdapterConfig,
  AdapterContext,
} from '../types';
import { GhlReadAdapter } from '../adapters/ghl-read-adapter';
import { createLogger, Logger } from '@neuronx/observability';
import { PrismaClient } from '@prisma/client';

export class GhlSnapshotService {
  private readonly logger: Logger;
  private readonly prisma: PrismaClient;
  private readonly adapter: GhlReadAdapter;
  private readonly config: GhlReadAdapterConfig;

  constructor(
    adapter: GhlReadAdapter,
    config: GhlReadAdapterConfig,
    prisma: PrismaClient
  ) {
    this.adapter = adapter;
    this.config = config;
    this.prisma = prisma;
    this.logger = createLogger({ component: `GhlSnapshotService:${config.tenantId}` });
  }

  /**
   * Create a snapshot of GHL data (on-demand)
   */
  async createSnapshot(context: AdapterContext): Promise<GhlSnapshotData> {
    const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info('Starting GHL data snapshot', {
      snapshotId,
      tenantId: context.tenantId,
      correlationId: context.correlationId,
    });

    const startTime = Date.now();
    const snapshotData: GhlSnapshotData = {
      metadata: {
        snapshotId,
        source: 'GHL',
        pulledAt: new Date(),
        tenantId: context.tenantId,
        correlationId: context.correlationId,
        recordCount: 0,
        dataTypes: [],
        status: 'success',
      },
      contacts: [],
      opportunities: [],
      pipelines: [],
      users: [],
    };

    try {
      // Pull contacts if allowed
      if (this.config.governance?.allowedDataTypes?.includes('contacts')) {
        snapshotData.contacts = await this.pullContacts(context);
        snapshotData.metadata.dataTypes.push('contacts');
      }

      // Pull opportunities if allowed
      if (this.config.governance?.allowedDataTypes?.includes('opportunities')) {
        snapshotData.opportunities = await this.pullOpportunities(context);
        snapshotData.metadata.dataTypes.push('opportunities');
      }

      // Pull pipelines if allowed
      if (this.config.governance?.allowedDataTypes?.includes('pipelines')) {
        snapshotData.pipelines = await this.pullPipelines(context);
        snapshotData.metadata.dataTypes.push('pipelines');
      }

      // Pull users if allowed
      if (this.config.governance?.allowedDataTypes?.includes('users')) {
        snapshotData.users = await this.pullUsers(context);
        snapshotData.metadata.dataTypes.push('users');
      }

      // Calculate total record count
      snapshotData.metadata.recordCount =
        snapshotData.contacts.length +
        snapshotData.opportunities.length +
        snapshotData.pipelines.length +
        snapshotData.users.length;

      // Store snapshot in database
      await this.storeSnapshot(snapshotData);

      const duration = Date.now() - startTime;
      this.logger.info('GHL snapshot completed successfully', {
        snapshotId,
        recordCount: snapshotData.metadata.recordCount,
        dataTypes: snapshotData.metadata.dataTypes,
        duration,
        correlationId: context.correlationId,
      });

      return snapshotData;
    } catch (error) {
      snapshotData.metadata.status = 'failed';
      snapshotData.metadata.errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error('GHL snapshot failed', {
        snapshotId,
        error: error instanceof Error ? error : new Error(String(error)),
        correlationId: context.correlationId,
      });

      // Store failed snapshot for audit purposes
      await this.storeSnapshot(snapshotData);

      throw error;
    }
  }

  /**
   * Get latest snapshot for tenant
   */
  async getLatestSnapshot(tenantId: string): Promise<GhlSnapshotData | null> {
    const snapshot = await (this.prisma as any).ghlSnapshot.findFirst({
      where: { tenantId },
      orderBy: { pulledAt: 'desc' },
      include: {
        contacts: true,
        opportunities: true,
        pipelines: true,
        users: true,
      },
    });

    if (!snapshot) return null;

    return this.mapDbSnapshotToData(snapshot);
  }

  /**
   * Get snapshot by ID
   */
  async getSnapshot(snapshotId: string): Promise<GhlSnapshotData | null> {
    const snapshot = await (this.prisma as any).ghlSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        contacts: true,
        opportunities: true,
        pipelines: true,
        users: true,
      },
    });

    if (!snapshot) return null;

    return this.mapDbSnapshotToData(snapshot);
  }

  /**
   * List snapshots for tenant
   */
  async listSnapshots(
    tenantId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ snapshots: SnapshotMetadata[]; total: number }> {
    const [snapshots, total] = await Promise.all([
      (this.prisma as any).ghlSnapshot.findMany({
        where: { tenantId },
        orderBy: { pulledAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          source: true,
          pulledAt: true,
          tenantId: true,
          correlationId: true,
          recordCount: true,
          dataTypes: true,
          status: true,
          errorMessage: true,
        },
      }),
      (this.prisma as any).ghlSnapshot.count({ where: { tenantId } }),
    ]);

    return {
      snapshots: snapshots.map((s: any) => ({
        snapshotId: s.id,
        source: s.source,
        pulledAt: s.pulledAt,
        tenantId: s.tenantId,
        correlationId: s.correlationId,
        recordCount: s.recordCount,
        dataTypes: s.dataTypes,
        status: s.status as any,
        errorMessage: s.errorMessage || undefined,
      })),
      total,
    };
  }

  /**
   * Clean up old snapshots based on retention policy
   */
  async cleanupOldSnapshots(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - (this.config.snapshot?.retentionDays || 30)
    );

    const result = await (this.prisma as any).ghlSnapshot.deleteMany({
      where: {
        pulledAt: { lt: cutoffDate },
      },
    });

    this.logger.info('Cleaned up old GHL snapshots', {
      deletedCount: result.count,
      retentionDays: this.config.snapshot?.retentionDays,
    });

    return result.count;
  }

  // ===== PRIVATE METHODS =====

  private async pullContacts(
    context: AdapterContext
  ): Promise<ContactSnapshot[]> {
    const { leads } = await this.adapter.listLeads(context, {
      limit: this.config.snapshot?.maxRecordsPerSnapshot,
    });

    return leads.map(lead => ({
      id: lead.id,
      email: lead.email || '',
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      tags: lead.tags || [],
      source: lead.source || 'GHL',
      createdAt: lead.createdAt || new Date(),
      updatedAt: lead.updatedAt || new Date(),
      // lastActivityAt: lead.lastActivityAt, // Not in Lead interface
    }));
  }

  private async pullOpportunities(
    context: AdapterContext
  ): Promise<OpportunitySnapshot[]> {
    const { opportunities } = await this.adapter.listOpportunities(context, {
      limit: this.config.snapshot?.maxRecordsPerSnapshot,
    });

    return opportunities.map(opp => ({
      id: opp.id,
      title: opp.name, // Mapped from name
      value: opp.value,
      currency: opp.currency,
      stage: opp.stage || '',
      pipelineId: opp.pipelineId || '',
      contactId: opp.leadId, // Mapped from leadId
      assignedTo: opp.assignedTo,
      createdAt: opp.createdAt || new Date(),
      updatedAt: opp.updatedAt || new Date(),
      // lastActivityAt: opp.lastActivityAt, // Not in Opportunity interface
    }));
  }

  private async pullPipelines(
    context: AdapterContext
  ): Promise<PipelineSnapshot[]> {
    const pipelines = await this.adapter.getPipelines(context);

    return pipelines.map(pipeline => ({
      id: pipeline.id,
      name: pipeline.name || '',
      stages: pipeline.stages || [],
      createdAt: pipeline.createdAt || new Date(),
      updatedAt: pipeline.updatedAt || new Date(),
    }));
  }

  private async pullUsers(context: AdapterContext): Promise<any[]> {
    const { users } = await this.adapter.listUsers(context, {
      limit: 1000, // Users are typically fewer
    });

    return users;
  }

  private async storeSnapshot(snapshotData: GhlSnapshotData): Promise<void> {
    await (this.prisma as any).ghlSnapshot.create({
      data: {
        id: snapshotData.metadata.snapshotId,
        source: snapshotData.metadata.source,
        pulledAt: snapshotData.metadata.pulledAt,
        tenantId: snapshotData.metadata.tenantId,
        correlationId: snapshotData.metadata.correlationId,
        recordCount: snapshotData.metadata.recordCount,
        dataTypes: snapshotData.metadata.dataTypes,
        status: snapshotData.metadata.status,
        errorMessage: snapshotData.metadata.errorMessage,
        contacts: {
          create: snapshotData.contacts,
        },
        opportunities: {
          create: snapshotData.opportunities,
        },
        pipelines: {
          create: snapshotData.pipelines,
        },
        users: {
          create: snapshotData.users,
        },
      },
    });
  }

  private mapDbSnapshotToData(dbSnapshot: any): GhlSnapshotData {
    return {
      metadata: {
        snapshotId: dbSnapshot.id,
        source: dbSnapshot.source,
        pulledAt: dbSnapshot.pulledAt,
        tenantId: dbSnapshot.tenantId,
        correlationId: dbSnapshot.correlationId,
        recordCount: dbSnapshot.recordCount,
        dataTypes: dbSnapshot.dataTypes,
        status: dbSnapshot.status,
        errorMessage: dbSnapshot.errorMessage,
      },
      contacts: dbSnapshot.contacts,
      opportunities: dbSnapshot.opportunities,
      pipelines: dbSnapshot.pipelines,
      users: dbSnapshot.users,
    };
  }
}
