/**
 * Workflow Snapshot Ingestion - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Ingests GHL workflows configuration for read-only mirroring.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { BaseSnapshotIngestion } from './base-snapshot.ingestion';
import { SnapshotType } from '../snapshot-types';

@Injectable()
export class WorkflowSnapshotIngestion extends BaseSnapshotIngestion {
  constructor(prisma: PrismaClient) {
    super(prisma, 'WorkflowSnapshotIngestion');
  }

  /**
   * Ingest GHL workflows snapshot
   */
  async ingest(tenantId: string, ghlAccountId: string, correlationId: string) {
    try {
      this.logger.debug(`Starting workflow snapshot ingestion`, {
        tenantId,
        ghlAccountId,
        correlationId,
      });

      // Fetch workflows from GHL
      const workflows = await this.fetchFromGhl(tenantId, ghlAccountId);

      this.logger.debug(`Fetched ${workflows.length} workflows`, {
        tenantId,
        ghlAccountId,
        correlationId,
      });

      // Create snapshot
      return this.createSnapshot(
        tenantId,
        ghlAccountId,
        SnapshotType.WORKFLOWS,
        workflows,
        correlationId
      );
    } catch (error) {
      return this.handleIngestionError(
        tenantId,
        ghlAccountId,
        SnapshotType.WORKFLOWS,
        error,
        correlationId
      );
    }
  }

  /**
   * Fetch workflows from GHL API
   */
  protected async fetchFromGhl(
    tenantId: string,
    ghlAccountId: string
  ): Promise<any[]> {
    // In a real implementation, this would fetch workflow definitions
    // including triggers, actions, conditions, and metadata

    return [
      {
        id: 'wf_001',
        name: 'Lead Nurture Sequence',
        description: 'Automated email sequence for new leads',
        type: 'automation',
        status: 'active',
        trigger: {
          type: 'contact_created',
          conditions: [
            {
              field: 'source',
              operator: 'equals',
              value: 'website',
            },
          ],
        },
        actions: [
          {
            id: 'action_001',
            type: 'wait',
            config: {
              delay: 1,
              unit: 'days',
            },
          },
          {
            id: 'action_002',
            type: 'send_email',
            config: {
              templateId: 'welcome_email',
              subject: 'Welcome to our service!',
            },
          },
          {
            id: 'action_003',
            type: 'wait',
            config: {
              delay: 3,
              unit: 'days',
            },
          },
          {
            id: 'action_004',
            type: 'send_email',
            config: {
              templateId: 'follow_up_email',
              subject: 'How can we help?',
            },
          },
        ],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isActive: true,
        locationId: 'loc_001',
        // Preserve all GHL workflow fields for forward compatibility
        settings: {
          maxExecutions: 1000,
          retryPolicy: {
            maxRetries: 3,
            backoffMultiplier: 2,
          },
        },
        analytics: {
          totalExecutions: 1250,
          successfulExecutions: 1180,
          failedExecutions: 70,
        },
        tags: ['nurture', 'email', 'automated'],
      },
      {
        id: 'wf_002',
        name: 'High-Value Lead Alert',
        description: 'Notify sales team of high-value leads',
        type: 'notification',
        status: 'active',
        trigger: {
          type: 'contact_updated',
          conditions: [
            {
              field: 'tags',
              operator: 'contains',
              value: 'high_value',
            },
          ],
        },
        actions: [
          {
            id: 'action_101',
            type: 'send_notification',
            config: {
              channel: 'slack',
              message: 'High-value lead detected!',
              recipients: ['sales-team'],
            },
          },
          {
            id: 'action_102',
            type: 'create_task',
            config: {
              assignee: 'sales_manager',
              title: 'Review High-Value Lead',
              priority: 'high',
              dueDate: '+1 hour',
            },
          },
        ],
        createdAt: '2023-02-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isActive: true,
        locationId: 'loc_001',
        settings: {
          maxExecutions: 100,
          retryPolicy: {
            maxRetries: 2,
            backoffMultiplier: 1.5,
          },
        },
        analytics: {
          totalExecutions: 45,
          successfulExecutions: 43,
          failedExecutions: 2,
        },
        tags: ['alert', 'sales', 'high-value'],
      },
      {
        id: 'wf_003',
        name: 'Appointment Follow-Up',
        description: 'Send follow-up after calendar events',
        type: 'post_event',
        status: 'active',
        trigger: {
          type: 'calendar_event_completed',
          conditions: [],
        },
        actions: [
          {
            id: 'action_201',
            type: 'wait',
            config: {
              delay: 1,
              unit: 'hours',
            },
          },
          {
            id: 'action_202',
            type: 'send_sms',
            config: {
              message: 'Thank you for your appointment! How did it go?',
              phoneField: 'primary_phone',
            },
          },
          {
            id: 'action_203',
            type: 'wait',
            config: {
              delay: 24,
              unit: 'hours',
            },
          },
          {
            id: 'action_204',
            type: 'send_email',
            config: {
              templateId: 'satisfaction_survey',
              subject: 'Your feedback matters to us',
            },
          },
        ],
        createdAt: '2023-03-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isActive: true,
        locationId: 'loc_001',
        settings: {
          maxExecutions: 500,
          retryPolicy: {
            maxRetries: 3,
            backoffMultiplier: 2,
          },
        },
        analytics: {
          totalExecutions: 320,
          successfulExecutions: 305,
          failedExecutions: 15,
        },
        tags: ['follow-up', 'calendar', 'satisfaction'],
      },
    ];
  }
}
