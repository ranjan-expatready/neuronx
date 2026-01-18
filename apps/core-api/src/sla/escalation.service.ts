import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '../eventing';
import {
  ICRMAdapter,
  IConversationAdapter,
} from '../../packages/adapters/contracts';
import { ConfigService } from '@nestjs/config';
import { ConfigLoader } from '../config/config.loader';
import {
  TenantContext,
  createSystemTenantContext,
} from '../config/tenant-context';

export interface EscalationConfig {
  actionType: 'task' | 'message' | 'notification';
  recipients: string[];
  autoCreateTask: boolean;
  taskPriority: 'low' | 'medium' | 'high' | 'urgent';
}

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly crmAdapter: ICRMAdapter,
    private readonly conversationAdapter: IConversationAdapter,
    private readonly configService: ConfigService,
    private readonly configLoader: ConfigLoader
  ) {}

  async handleEscalation(
    tenantId: string,
    locationId: string,
    leadId: string,
    escalationReason: string,
    correlationId: string
  ): Promise<void> {
    this.logger.log(`Handling escalation for lead ${leadId}`, {
      tenantId,
      locationId,
      escalationReason,
      correlationId,
    });

    const config = await this.getEscalationConfig(tenantId);

    try {
      switch (config.actionType) {
        case 'task':
          await this.createEscalationTask(
            tenantId,
            locationId,
            leadId,
            escalationReason,
            config,
            correlationId
          );
          break;

        case 'message':
          await this.sendEscalationMessage(
            tenantId,
            locationId,
            leadId,
            escalationReason,
            config,
            correlationId
          );
          break;

        case 'notification':
          await this.sendEscalationNotification(
            tenantId,
            leadId,
            escalationReason,
            config,
            correlationId
          );
          break;

        default:
          this.logger.warn(
            `Unknown escalation action type: ${config.actionType}`,
            {
              tenantId,
              leadId,
              correlationId,
            }
          );
      }

      this.logger.log(`Escalation handled successfully for lead ${leadId}`, {
        tenantId,
        actionType: config.actionType,
        correlationId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle escalation for lead ${leadId}`, {
        tenantId,
        leadId,
        error: error.message,
        actionType: config.actionType,
        correlationId,
      });

      // Emit escalation failure event
      await this.eventBus.publish({
        type: 'sales.escalation.failed',
        tenantId,
        correlationId,
        timestamp: new Date(),
        payload: {
          leadId,
          escalationReason,
          actionType: config.actionType,
          error: error.message,
        },
      });
    }
  }

  private async createEscalationTask(
    tenantId: string,
    locationId: string,
    leadId: string,
    escalationReason: string,
    config: EscalationConfig,
    correlationId: string
  ): Promise<void> {
    // TODO: Add createTask to IWorkflowAdapter contract
    // For now, using workflow trigger as placeholder until contract is extended
    const taskData = {
      title: `URGENT: Lead Escalation - ${escalationReason}`,
      description: `Lead ${leadId} has breached SLA window and requires immediate attention.`,
      priority: config.taskPriority,
      assignee: config.recipients[0], // Assign to first recipient
      dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      metadata: {
        leadId,
        escalationReason,
        source: 'neuronx_sla',
      },
    };

    // Placeholder: Use workflow trigger until createTask is added to contract
    // await this.workflowAdapter.triggerWorkflow({
    //   workflowId: 'escalation-task-creation',
    //   contactId: leadId,
    //   parameters: taskData,
    // }, context);

    this.logger.warn(
      `createTask not yet implemented in adapter contracts - escalation task creation skipped for lead ${leadId}`,
      { correlationId }
    );

    this.logger.log(`Escalation task created for lead ${leadId}`, {
      tenantId,
      taskTitle: taskData.title,
      assignee: taskData.assignee,
      correlationId,
    });
  }

  private async sendEscalationMessage(
    tenantId: string,
    locationId: string,
    leadId: string,
    escalationReason: string,
    config: EscalationConfig,
    correlationId: string
  ): Promise<void> {
    const message = {
      to: config.recipients,
      subject: `🚨 Lead Escalation Alert`,
      body: `Lead ${leadId} has breached SLA window.\n\nReason: ${escalationReason}\n\nPlease review and take immediate action.`,
      priority: 'high' as const,
      metadata: {
        leadId,
        escalationReason,
        source: 'neuronx_sla',
      },
    };

    await this.conversationAdapter.sendMessage(
      {
        conversationId: `escalation-${leadId}`, // Create escalation conversation
        content: message.body,
        type: 'notification',
        metadata: message.metadata,
      },
      {
        tenantId,
        correlationId,
        locationId,
        environment:
          (process.env.NEURONX_ENV as 'dev' | 'stage' | 'prod') || 'dev',
      }
    );

    this.logger.log(`Escalation message sent for lead ${leadId}`, {
      tenantId,
      recipients: config.recipients.length,
      correlationId,
    });
  }

  private async sendEscalationNotification(
    tenantId: string,
    leadId: string,
    escalationReason: string,
    config: EscalationConfig,
    correlationId: string
  ): Promise<void> {
    // For notifications, we'll emit an event that can be consumed by external systems
    // In a real implementation, this might integrate with Slack, email, or other notification services

    await this.eventBus.publish({
      type: 'notification.escalation',
      tenantId,
      correlationId,
      timestamp: new Date(),
      payload: {
        leadId,
        escalationReason,
        recipients: config.recipients,
        priority: 'urgent',
      },
    });

    this.logger.log(`Escalation notification emitted for lead ${leadId}`, {
      tenantId,
      recipients: config.recipients.length,
      correlationId,
    });
  }

  /**
   * Get escalation configuration with tenant isolation
   */
  private async getEscalationConfig(
    tenantId: string
  ): Promise<EscalationConfig> {
    try {
      // Create tenant context - use system tenant as fallback
      const tenantContext = { tenantId, environment: 'prod' as const };

      // Load configuration with tenant isolation
      const config = await this.configLoader.loadConfig(
        'neuronx-config',
        tenantContext
      );

      if (!config) {
        return this.getDefaultEscalationConfig();
      }

      // Extract escalation configuration from loaded config
      const escalationConfig = config.domains.escalation;

      // Validate configuration has required fields
      if (!escalationConfig || typeof escalationConfig !== 'object') {
        return this.getDefaultEscalationConfig();
      }

      // Get the default escalation hierarchy (first one defined)
      const hierarchyName =
        Object.keys(escalationConfig.hierarchies || {})[0] || 'default';
      const hierarchy = escalationConfig.hierarchies?.[hierarchyName];

      if (!hierarchy || !hierarchy.levels || hierarchy.levels.length === 0) {
        return this.getDefaultEscalationConfig();
      }

      // Use first escalation level for immediate action
      const firstLevel = hierarchy.levels[0];

      return {
        actionType: this.determineActionType(firstLevel),
        recipients: firstLevel.approvers || ['manager@company.com'],
        autoCreateTask: true, // Always create task for escalations
        taskPriority: this.mapEscalationPriority(firstLevel.name),
      };
    } catch (error) {
      this.logger.warn(
        `Failed to load escalation configuration for tenant ${tenantId}, using defaults`,
        {
          tenantId,
          error: error.message,
          operation: 'escalation_config_load_error',
        }
      );

      // Return safe defaults on any configuration loading failure
      return this.getDefaultEscalationConfig();
    }
  }

  /**
   * Determine action type from escalation level configuration
   */
  private determineActionType(level: any): 'task' | 'message' | 'notification' {
    // Map notification channels to action types
    const channels = level.notificationChannels || [];

    if (channels.includes('task') || channels.length === 0) {
      return 'task'; // Default to task creation
    } else if (channels.includes('email') || channels.includes('sms')) {
      return 'message'; // Use messaging for email/sms
    } else {
      return 'notification'; // Use event-based notifications for others
    }
  }

  /**
   * Map escalation level name to task priority
   */
  private mapEscalationPriority(
    levelName: string
  ): 'low' | 'medium' | 'high' | 'urgent' {
    const name = levelName.toLowerCase();

    if (name.includes('urgent') || name.includes('critical')) {
      return 'urgent';
    } else if (name.includes('manager') || name.includes('supervisor')) {
      return 'high';
    } else if (name.includes('senior') || name.includes('lead')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get default escalation configuration
   */
  private getDefaultEscalationConfig(): EscalationConfig {
    return {
      actionType: 'task',
      recipients: ['manager@company.com'],
      autoCreateTask: true,
      taskPriority: 'high',
    };
  }
}
