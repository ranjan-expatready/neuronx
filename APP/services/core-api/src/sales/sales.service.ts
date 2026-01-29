import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBus, EventHandler } from '@neuronx/eventing';
import { NeuronxEvent, ExecutionCommand } from '@neuronx/contracts';
import { PrismaClient } from '@prisma/client';
import { LeadScorerService } from './lead-scorer.service';
import { LeadRouterService } from './lead-router.service';
import { ConfigService } from '../config/config.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SalesService implements OnModuleInit, EventHandler {
  private readonly logger = new Logger(SalesService.name);
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly eventBus: EventBus,
    private readonly leadScorer: LeadScorerService,
    private readonly leadRouter: LeadRouterService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService
  ) {}

  async onModuleInit() {
    // Subscribe to lead created events
    await this.eventBus.subscribe(['sales.lead.created'], this);
  }

  async handle(event: NeuronxEvent): Promise<void> {
    const correlationId = event.metadata.correlationId;

    try {
      this.logger.log(`Processing lead created event: ${event.id}`, {
        correlationId,
      });

      // Audit: webhook received
      await this.auditService.logEvent('webhook.received', {
        eventId: event.id,
        eventType: event.type,
        tenantId: event.tenantId,
        correlationId,
      });

      // Persist event with tenant isolation and idempotency
      const existingEvent = await this.prisma.event.findFirst({
        where: {
          tenantId: event.tenantId,
          OR: [
            { id: event.id },
            {
              metadata: {
                path: 'idempotencyKey',
                equals: event.metadata.idempotencyKey,
              },
            },
          ],
        },
      });

      if (existingEvent) {
        this.logger.log(`Duplicate event detected: ${event.id}, skipping`, {
          correlationId,
        });
        return;
      }

      // Persist the event
      await this.prisma.event.create({
        data: {
          id: event.id,
          tenantId: event.tenantId,
          workspaceId: event.workspaceId,
          type: event.type,
          data: event.data,
          metadata: event.metadata,
        },
      });

      this.logger.log(`Event persisted: ${event.id}`, { correlationId });

      // Evaluate rules and score the lead
      const scoringResult = await this.leadScorer.evaluateLead(event);

      // Audit: rule evaluated
      await this.auditService.logEvent('rule.evaluated', {
        eventId: event.id,
        leadId: event.data.externalId,
        score: scoringResult.score,
        routingThreshold: scoringResult.routingThreshold,
        tenantId: event.tenantId,
        correlationId,
      });

      // Execute actions based on scoring
      if (scoringResult.shouldRoute) {
        await this.executeQualificationAction(
          event,
          scoringResult,
          correlationId
        );

        // Always route the lead (country-based routing) IF qualified
        await this.executeCountryRouting(event, correlationId);
      }
    } catch (error) {
      this.logger.error(`Failed to process lead created event: ${event.id}`, {
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

  private async executeQualificationAction(
    event: NeuronxEvent,
    scoringResult: any,
    correlationId: string
  ): Promise<void> {
    // Emit qualified lead event
    const qualifiedEvent: NeuronxEvent = {
      id: crypto.randomUUID(),
      tenantId: event.tenantId,
      workspaceId: event.workspaceId,
      type: 'sales.lead.qualified',
      data: {
        leadId: event.data.externalId,
        score: scoringResult.score,
        routingReason: 'high_score',
      },
      metadata: {
        timestamp: new Date(),
        correlationId,
        causationId: event.id,
        source: 'sales-service',
      },
    };

    await this.eventBus.publish(qualifiedEvent);

    // TODO: Call outbound adapter for actual routing action
    // This would be a command to move the lead in GHL or assign an owner
    const routingCommand: ExecutionCommand = {
      id: crypto.randomUUID(),
      tenantId: event.tenantId,
      type: 'ghl.lead.assign_owner',
      data: {
        leadId: event.data.externalId,
        ownerId: 'high-priority-queue', // Would come from config
      },
      metadata: {
        correlationId,
        priority: 'normal',
      },
    };

    // Stub: In real implementation, this would call the outbound adapter
    this.logger.log(`Would execute routing command: ${routingCommand.type}`, {
      leadId: event.data.externalId,
      correlationId,
    });

    // Audit: action triggered
    await this.auditService.logEvent('action.triggered', {
      eventId: event.id,
      leadId: event.data.externalId,
      action: routingCommand.type,
      tenantId: event.tenantId,
      correlationId,
    });
  }

  private async executeCountryRouting(
    event: NeuronxEvent,
    correlationId: string
  ): Promise<void> {
    // Evaluate country-based routing
    const routingResult = await this.leadRouter.routeLead(event);

    if (routingResult) {
      // Emit routed event
      const routedEvent: NeuronxEvent = {
        id: crypto.randomUUID(),
        tenantId: event.tenantId,
        workspaceId: event.workspaceId,
        type: 'sales.lead.routed',
        data: {
          leadId: event.data.externalId,
          routedTo: routingResult.routedTo,
          routingReason: routingResult.routingReason,
          country: event.data.country,
        },
        metadata: {
          timestamp: new Date(),
          correlationId,
          causationId: event.id,
          source: 'sales-service',
        },
      };

      await this.eventBus.publish(routedEvent);

      // TODO: Call outbound adapter for actual routing assignment
      const routingCommand: ExecutionCommand = {
        id: crypto.randomUUID(),
        tenantId: event.tenantId,
        type: 'ghl.lead.assign_owner',
        data: {
          leadId: event.data.externalId,
          ownerId: routingResult.routedTo,
        },
        metadata: {
          correlationId,
          priority: 'normal',
        },
      };

      // Stub: In real implementation, this would call the outbound adapter
      this.logger.log(
        `Would execute country routing command: ${routingCommand.type}`,
        {
          leadId: event.data.externalId,
          routedTo: routingResult.routedTo,
          correlationId,
        }
      );

      // Audit: routing action triggered
      await this.auditService.logEvent('routing.triggered', {
        eventId: event.id,
        leadId: event.data.externalId,
        action: routingCommand.type,
        routedTo: routingResult.routedTo,
        routingReason: routingResult.routingReason,
        tenantId: event.tenantId,
        correlationId,
      });
    }
  }
}
