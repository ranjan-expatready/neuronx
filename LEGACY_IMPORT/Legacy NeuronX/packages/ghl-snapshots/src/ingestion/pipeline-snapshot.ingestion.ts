/**
 * Pipeline Snapshot Ingestion - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Ingests GHL pipelines and stages configuration for read-only mirroring.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BaseSnapshotIngestion } from './base-snapshot.ingestion';
import { SnapshotType } from '../snapshot-types';

@Injectable()
export class PipelineSnapshotIngestion extends BaseSnapshotIngestion {
  constructor(prisma: PrismaClient) {
    super(prisma, 'PipelineSnapshotIngestion');
  }

  /**
   * Ingest GHL pipelines snapshot
   */
  async ingest(tenantId: string, ghlAccountId: string, correlationId: string) {
    try {
      this.logger.debug(`Starting pipeline snapshot ingestion`, {
        tenantId,
        ghlAccountId,
        correlationId,
      });

      // Fetch pipelines from GHL
      const pipelines = await this.fetchFromGhl(tenantId, ghlAccountId);

      this.logger.debug(`Fetched ${pipelines.length} pipelines`, {
        tenantId,
        ghlAccountId,
        correlationId,
      });

      // Create snapshot
      return this.createSnapshot(
        tenantId,
        ghlAccountId,
        SnapshotType.PIPELINES,
        pipelines,
        correlationId
      );
    } catch (error) {
      return this.handleIngestionError(
        tenantId,
        ghlAccountId,
        SnapshotType.PIPELINES,
        error,
        correlationId
      );
    }
  }

  /**
   * Fetch pipelines and stages from GHL API
   */
  protected async fetchFromGhl(
    _tenantId: string,
    _ghlAccountId: string
  ): Promise<any[]> {
    // In a real implementation, this would fetch both pipelines and their stages
    // For now, return mock data representing comprehensive pipeline configuration

    return [
      {
        id: 'pipe_001',
        name: 'Sales Pipeline',
        description: 'Main sales funnel',
        isActive: true,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        stages: [
          {
            id: 'stage_001',
            name: 'Lead',
            description: 'Initial contact',
            order: 1,
            color: '#FF6B6B',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          {
            id: 'stage_002',
            name: 'Qualified',
            description: 'Lead meets criteria',
            order: 2,
            color: '#4ECDC4',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          {
            id: 'stage_003',
            name: 'Proposal',
            description: 'Proposal sent',
            order: 3,
            color: '#45B7D1',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          {
            id: 'stage_004',
            name: 'Negotiation',
            description: 'Terms discussion',
            order: 4,
            color: '#FFA07A',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          {
            id: 'stage_005',
            name: 'Closed Won',
            description: 'Deal closed successfully',
            order: 5,
            color: '#98D8C8',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          {
            id: 'stage_006',
            name: 'Closed Lost',
            description: 'Deal lost',
            order: 6,
            color: '#F7DC6F',
            isActive: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
        ],
        // Preserve any additional GHL fields for forward compatibility
        customFields: {},
        automationRules: [],
        reportingSettings: {},
      },
      {
        id: 'pipe_002',
        name: 'Support Pipeline',
        description: 'Customer support ticket pipeline',
        isActive: true,
        createdAt: '2023-03-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        stages: [
          {
            id: 'stage_101',
            name: 'New Ticket',
            description: 'Ticket created',
            order: 1,
            color: '#FF6B6B',
            isActive: true,
            createdAt: '2023-03-01T00:00:00Z',
            updatedAt: '2023-03-01T00:00:00Z',
          },
          {
            id: 'stage_102',
            name: 'In Progress',
            description: 'Being worked on',
            order: 2,
            color: '#4ECDC4',
            isActive: true,
            createdAt: '2023-03-01T00:00:00Z',
            updatedAt: '2023-03-01T00:00:00Z',
          },
          {
            id: 'stage_103',
            name: 'Resolved',
            description: 'Issue resolved',
            order: 3,
            color: '#98D8C8',
            isActive: true,
            createdAt: '2023-03-01T00:00:00Z',
            updatedAt: '2023-03-01T00:00:00Z',
          },
          {
            id: 'stage_104',
            name: 'Closed',
            description: 'Ticket closed',
            order: 4,
            color: '#95A5A6',
            isActive: true,
            createdAt: '2023-03-01T00:00:00Z',
            updatedAt: '2023-03-01T00:00:00Z',
          },
        ],
        customFields: {},
        automationRules: [],
        reportingSettings: {},
      },
    ];
  }
}
