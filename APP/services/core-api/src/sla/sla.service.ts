import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventBus, EventHandler } from '@neuronx/eventing';
import { NeuronxEvent } from '@neuronx/contracts';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';
import { ConfigLoader } from '../config/config.loader';
import {
  TenantContext,
  createSystemTenantContext,
} from '../config/tenant-context';
import { UsageService } from '../usage/usage.service';
import { UsageEventEmitter } from '../usage/usage.events';
import { SlaTimerRepository } from './sla-timer.repository';

@Injectable()
export class SlaService implements OnModuleInit, OnModuleDestroy, EventHandler {
  private readonly logger = new Logger(SlaService.name);
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly eventBus: EventBus,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly configLoader: ConfigLoader,
    private readonly usageService: UsageService,
    private readonly slaTimerRepository: SlaTimerRepository
  ) {}

  async onModuleInit() {
    // Subscribe to qualified lead events
    await this.eventBus.subscribe(['sales.lead.qualified'], this);

    // Also subscribe to follow-up events that cancel SLA timers
    await this.eventBus.subscribe(
      [
        'sales.lead.contacted',
        'sales.lead.responded',
        'sales.lead.qualified', // Re-qualification cancels previous SLA
      ],
      this
    );
  }

  async onModuleDestroy() {
    // No cleanup needed - timers are now persisted in database
  }

  async handle(event: NeuronxEvent): Promise<void> {
    const correlationId = event.metadata.correlationId;

    try {
      if (event.type === 'sales.lead.qualified') {
        await this.startSlaTimer(event, correlationId);
      } else if (
        [
          'sales.lead.contacted',
          'sales.lead.responded',
          'sales.lead.qualified',
        ].includes(event.type)
      ) {
        await this.cancelSlaTimer(event, correlationId);
      }
    } catch (error) {
      this.logger.error(`Failed to handle SLA event: ${event.id}`, {
        error: error.message,
        correlationId,
      });
    }
  }

  private async startSlaTimer(
    event: NeuronxEvent,
    correlationId: string
  ): Promise<void> {
    const leadId = event.data.leadId;
    const tenantId = event.tenantId;

    // Cancel any existing timer for this lead
    await this.slaTimerRepository.cancelTimerForLead(
      tenantId,
      leadId,
      correlationId
    );

    // Get SLA configuration with tenant isolation
    const slaConfig = await this.getSlaConfig(tenantId);

    // Use tenant-configured response time or default to 30 minutes
    // For now, we use a default channel 'default' - in future this could be lead-specific
    const responseTimeConfig =
      slaConfig.responseTimes?.default || slaConfig.responseTimes?.email;
    const slaWindowMinutes = responseTimeConfig?.initialHours
      ? responseTimeConfig.initialHours * 60 // Convert hours to minutes
      : 30; // Fallback default

    this.logger.log(`Starting SLA timer for lead: ${leadId}`, {
      tenantId,
      slaWindowMinutes,
      correlationId,
    });

    // Calculate due time
    const startedAt = new Date();
    const dueAt = new Date(startedAt.getTime() + slaWindowMinutes * 60 * 1000);

    // Prepare escalation steps from SLA config
    const escalationSteps = this.buildEscalationSteps(slaConfig, tenantId);

    // Create durable SLA timer in database
    await this.slaTimerRepository.createTimer({
      tenantId,
      leadId,
      slaContractId: 'default-sla', // Could be made configurable per lead type
      startedAt,
      dueAt,
      slaWindowMinutes,
      escalationSteps,
      correlationId,
      idempotencyKey: `${correlationId}-${leadId}`,
    });

    // Emit usage events for metering
    try {
      const slaEvent = UsageEventEmitter.emitSLATimerStarted(
        tenantId,
        leadId,
        responseTimeConfig?.initialHours || 0.5, // Default to 30 minutes
        correlationId,
        'sla'
      );
      await this.usageService.recordUsage(slaEvent);
    } catch (error) {
      // Log but don't fail the SLA timer operation
      this.logger.warn(
        `Failed to emit SLA timer usage event for lead ${leadId}`,
        {
          tenantId,
          error: error.message,
          correlationId,
        }
      );
    }
  }

  /**
   * Build escalation steps from SLA configuration
   */
  private buildEscalationSteps(slaConfig: any, tenantId: string): any[] {
    const steps = [];

    // Build escalation steps based on SLA config
    if (slaConfig.escalationRules?.automaticEscalation) {
      const escalationDelays = slaConfig.escalationRules.escalationDelays || [
        24, 48, 72,
      ];

      for (let i = 0; i < escalationDelays.length; i++) {
        steps.push({
          step: i + 1,
          delayHours: escalationDelays[i],
          actionType: slaConfig.notifications?.immediateChannels?.includes(
            'email'
          )
            ? 'email'
            : 'task',
          locationId: 'default', // Could be made tenant-specific
          tenantId,
        });
      }
    }

    return steps;
  }

  private async cancelSlaTimer(
    event: NeuronxEvent,
    correlationId: string
  ): Promise<void> {
    const leadId = event.data.leadId || event.data.externalId;
    const tenantId = event.tenantId;

    // Cancel timer using repository
    await this.slaTimerRepository.cancelTimerForLead(
      tenantId,
      leadId,
      correlationId
    );

    this.logger.log(`Cancelled SLA timer for lead: ${leadId}`, {
      tenantId,
      reason: event.type,
      correlationId,
    });
  }

  private async escalateLead(
    leadId: string,
    tenantId: string,
    correlationId: string
  ): Promise<void> {
    this.logger.log(`Escalating lead due to SLA breach: ${leadId}`, {
      tenantId,
      correlationId,
    });

    // Emit escalation event
    const escalationEvent: NeuronxEvent = {
      id: crypto.randomUUID(),
      tenantId,
      type: 'sales.lead.escalated',
      data: {
        leadId,
        escalationReason: 'sla_breach',
        escalatedAt: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date(),
        correlationId,
        source: 'sla-service',
      },
    };

    await this.eventBus.publish(escalationEvent);

    // Update SLA state
    await this.prisma.slaTimer.updateMany({
      where: {
        tenantId,
        leadId,
        status: 'active',
      },
      data: {
        status: 'escalated',
        escalatedAt: new Date(),
      },
    });

    // Audit: escalation triggered
    await this.auditService.logEvent('escalation.triggered', {
      leadId,
      escalationReason: 'sla_breach',
      tenantId,
      correlationId,
    });
  }

  /**
   * Get SLA configuration with tenant isolation
   */
  private async getSlaConfig(tenantId: string): Promise<any> {
    try {
      // Create tenant context - use system tenant as fallback
      const tenantContext = { tenantId, environment: 'prod' as const };

      // Load configuration with tenant isolation
      const config = await this.configLoader.loadConfig(
        'neuronx-config',
        tenantContext
      );

      if (!config) {
        return this.getDefaultSlaConfig();
      }

      // Extract SLA configuration from loaded config
      const slaConfig = config.domains.sla;

      // Validate configuration has required fields
      if (!slaConfig || typeof slaConfig !== 'object') {
        return this.getDefaultSlaConfig();
      }

      // Build tenant-specific SLA configuration
      return {
        responseTimes: slaConfig.responseTimes || {},
        notifications: slaConfig.notifications || {
          immediateChannels: ['email'],
          escalationChannels: ['email', 'sms'],
          managerNotificationDelay: 60,
        },
        escalationRules: slaConfig.escalationRules || {
          enabled: true,
          maxAutomaticEscalations: 2,
          requireManagerApproval: true,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Failed to load SLA configuration for tenant ${tenantId}, using defaults`,
        {
          tenantId,
          error: error.message,
          operation: 'sla_config_load_error',
        }
      );

      // Return safe defaults on any configuration loading failure
      return this.getDefaultSlaConfig();
    }
  }

  /**
   * Get default SLA configuration
   */
  private getDefaultSlaConfig(): any {
    return {
      responseTimes: {
        default: {
          initialHours: 0.5, // 30 minutes
          followUpHours: 2,
          maxEscalations: 3,
        },
        email: {
          initialHours: 0.5, // 30 minutes
          followUpHours: 2,
          maxEscalations: 3,
        },
        sms: {
          initialHours: 0.25, // 15 minutes
          followUpHours: 1,
          maxEscalations: 2,
        },
      },
      notifications: {
        immediateChannels: ['email'],
        escalationChannels: ['email', 'sms'],
        managerNotificationDelay: 60,
      },
      escalationRules: {
        enabled: true,
        maxAutomaticEscalations: 2,
        requireManagerApproval: true,
      },
    };
  }

  // Method to recover timers after restart (would be called during startup)
  async recoverActiveTimers(): Promise<void> {
    const activeTimers = await this.prisma.slaTimer.findMany({
      where: { status: 'active' },
    });

    for (const timerRecord of activeTimers) {
      const timeElapsed = Date.now() - timerRecord.qualifiedAt.getTime();
      const remainingTime =
        timerRecord.slaWindowMinutes * 60 * 1000 - timeElapsed;

      if (remainingTime > 0) {
        const timer = setTimeout(async () => {
          await this.escalateLead(
            timerRecord.leadId,
            timerRecord.tenantId,
            'recovery'
          );
          this.activeTimers.delete(timerRecord.leadId);
        }, remainingTime);

        this.activeTimers.set(timerRecord.leadId, {
          leadId: timerRecord.leadId,
          tenantId: timerRecord.tenantId,
          qualifiedAt: timerRecord.qualifiedAt,
          slaWindowMinutes: timerRecord.slaWindowMinutes,
          timer,
        });
      } else {
        // SLA already breached, escalate immediately
        await this.escalateLead(
          timerRecord.leadId,
          timerRecord.tenantId,
          'recovery'
        );
      }
    }
  }
}
