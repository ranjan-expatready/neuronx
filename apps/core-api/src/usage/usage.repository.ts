/**
 * Usage Repository - WI-009: Usage Persistence
 *
 * PostgreSQL-backed usage repository with tenant isolation and idempotency.
 * Handles high-volume usage event recording and aggregate computation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { UsageEvent, UsageAggregate, UsageQueryOptions } from './usage.types';

@Injectable()
export class UsageRepository {
  private readonly logger = new Logger(UsageRepository.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Record a usage event with idempotency and tenant isolation
   */
  async recordEvent(event: UsageEvent): Promise<void> {
    try {
      await this.prisma.usageEvent.create({
        data: {
          tenantId: event.tenantId,
          eventId: event.eventId,
          metric: event.metric,
          quantity: event.quantity,
          occurredAt: new Date(event.timestamp),
          actorId: event.actorId,
          sourceService: event.sourceService,
          correlationId: event.correlationId,
          classification: this.determineClassification(event.metric),
          idempotencyKey: event.idempotencyKey,
          metadata: event.metadata,
        },
      });

      this.logger.debug(`Recorded usage event: ${event.metric}`, {
        tenantId: event.tenantId,
        quantity: event.quantity,
        correlationId: event.correlationId,
      });
    } catch (error: any) {
      // Handle unique constraint violations (idempotency)
      if (
        error.code === 'P2002' &&
        error.meta?.target?.includes('idempotencyKey')
      ) {
        this.logger.debug(`Duplicate usage event ignored: ${event.eventId}`, {
          tenantId: event.tenantId,
          correlationId: event.correlationId,
        });
        return; // Idempotent - duplicate ignored
      }

      if (
        error.code === 'P2002' &&
        error.meta?.target?.includes('occurredAt')
      ) {
        this.logger.debug(
          `Business duplicate usage event ignored: ${event.eventId}`,
          {
            tenantId: event.tenantId,
            metric: event.metric,
            correlationId: event.correlationId,
          }
        );
        return; // Business uniqueness constraint
      }

      throw error;
    }
  }

  /**
   * Query usage events with tenant isolation
   */
  async queryEvents(options: UsageQueryOptions): Promise<{
    events: UsageEvent[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      tenantId,
      metrics,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
      correlationId,
    } = options;

    const where: any = {
      tenantId, // Tenant isolation enforced
    };

    if (metrics && metrics.length > 0) {
      where.metric = { in: metrics };
    }

    if (startDate || endDate) {
      where.occurredAt = {};
      if (startDate) where.occurredAt.gte = new Date(startDate);
      if (endDate) where.occurredAt.lte = new Date(endDate);
    }

    if (correlationId) {
      where.correlationId = correlationId;
    }

    const [events, total] = await Promise.all([
      this.prisma.usageEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: limit + 1, // +1 to check for hasMore
        skip: offset,
      }),
      this.prisma.usageEvent.count({ where }),
    ]);

    const hasMore = events.length > limit;
    const resultEvents = hasMore ? events.slice(0, limit) : events;

    return {
      events: resultEvents.map(this.mapEventToDomain),
      total,
      hasMore,
    };
  }

  /**
   * Upsert usage aggregate (idempotent operation)
   */
  async upsertAggregate(
    aggregate: Omit<UsageAggregate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    const {
      tenantId,
      periodType,
      periodStart,
      periodEnd,
      metric,
      totalQuantity,
      eventCount,
      computedAt,
      sourceHash,
    } = aggregate;

    await this.prisma.usageAggregate.upsert({
      where: {
        tenantId_periodType_periodStart_metric: {
          tenantId,
          periodType,
          periodStart: new Date(periodStart),
          metric,
        },
      },
      update: {
        periodEnd: new Date(periodEnd),
        totalQuantity,
        eventCount,
        computedAt: new Date(computedAt),
        sourceHash,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        periodType,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        metric,
        totalQuantity,
        eventCount,
        computedAt: new Date(computedAt),
        sourceHash,
      },
    });

    this.logger.debug(`Upserted usage aggregate: ${metric}`, {
      tenantId,
      periodType,
      periodStart,
      totalQuantity,
      eventCount,
    });
  }

  /**
   * Query usage aggregates with tenant isolation
   */
  async queryAggregates(options: {
    tenantId: string;
    metrics?: string[];
    periodType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    aggregates: UsageAggregate[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      tenantId,
      metrics,
      periodType,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = options;

    const where: any = {
      tenantId, // Tenant isolation enforced
    };

    if (metrics && metrics.length > 0) {
      where.metric = { in: metrics };
    }

    if (periodType) {
      where.periodType = periodType;
    }

    if (startDate || endDate) {
      where.periodStart = {};
      if (startDate) where.periodStart.gte = new Date(startDate);
      if (endDate) where.periodStart.lte = new Date(endDate);
    }

    const [aggregates, total] = await Promise.all([
      this.prisma.usageAggregate.findMany({
        where,
        orderBy: { periodStart: 'desc' },
        take: limit + 1, // +1 to check for hasMore
        skip: offset,
      }),
      this.prisma.usageAggregate.count({ where }),
    ]);

    const hasMore = aggregates.length > limit;
    const resultAggregates = hasMore ? aggregates.slice(0, limit) : aggregates;

    return {
      aggregates: resultAggregates.map(this.mapAggregateToDomain),
      total,
      hasMore,
    };
  }

  /**
   * Generate rollups for a specific tenant and date range
   */
  async generateRollups(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    periodTypes: ('daily' | 'weekly' | 'monthly')[] = ['daily', 'monthly']
  ): Promise<number> {
    let rollupCount = 0;

    for (const periodType of periodTypes) {
      const periods = this.generatePeriods(startDate, endDate, periodType);

      for (const period of periods) {
        const aggregates = await this.computePeriodAggregates(
          tenantId,
          period.start,
          period.end
        );

        for (const aggregate of aggregates) {
          await this.upsertAggregate({
            ...aggregate,
            periodType,
            periodStart: period.start.toISOString(),
            periodEnd: period.end.toISOString(),
            computedAt: new Date().toISOString(),
          });
          rollupCount++;
        }
      }
    }

    this.logger.log(
      `Generated ${rollupCount} usage rollups for tenant ${tenantId}`
    );
    return rollupCount;
  }

  /**
   * Compute aggregates for a specific period
   */
  private async computePeriodAggregates(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Omit<
      UsageAggregate,
      | 'id'
      | 'periodType'
      | 'periodStart'
      | 'periodEnd'
      | 'createdAt'
      | 'updatedAt'
    >[]
  > {
    const result = await this.prisma.usageEvent.groupBy({
      by: ['metric'],
      where: {
        tenantId,
        occurredAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      _sum: {
        quantity: true,
      },
      _count: {
        eventId: true,
      },
    });

    // Generate source hash for change detection
    const sourceHash = await this.computeSourceHash(
      tenantId,
      startDate,
      endDate
    );

    return result.map(row => ({
      tenantId,
      metric: row.metric,
      totalQuantity: row._sum.quantity || 0,
      eventCount: row._count.eventId,
      computedAt: new Date().toISOString(),
      sourceHash,
    }));
  }

  /**
   * Generate period ranges for rollups
   */
  private generatePeriods(
    startDate: Date,
    endDate: Date,
    periodType: 'daily' | 'weekly' | 'monthly'
  ): { start: Date; end: Date }[] {
    const periods: { start: Date; end: Date }[] = [];
    let current = new Date(startDate);

    while (current < endDate) {
      let periodStart = new Date(current);
      let periodEnd: Date;

      switch (periodType) {
        case 'daily':
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 1);
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          // Start of week (Monday)
          const dayOfWeek = periodStart.getDay();
          const diff =
            periodStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          periodStart.setDate(diff);
          periodStart.setHours(0, 0, 0, 0);

          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 7);
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          periodStart = new Date(
            periodStart.getFullYear(),
            periodStart.getMonth(),
            1
          );
          periodEnd = new Date(
            periodStart.getFullYear(),
            periodStart.getMonth() + 1,
            1
          );
          current.setMonth(current.getMonth() + 1);
          break;
      }

      if (periodStart < endDate) {
        periods.push({
          start: periodStart,
          end: periodEnd > endDate ? endDate : periodEnd,
        });
      }
    }

    return periods;
  }

  /**
   * Compute hash of source events for change detection
   */
  private async computeSourceHash(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<string> {
    const events = await this.prisma.usageEvent.findMany({
      where: {
        tenantId,
        occurredAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      select: {
        eventId: true,
        quantity: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: 'asc' },
    });

    // Create deterministic string representation
    const eventString = events
      .map(e => `${e.eventId}:${e.quantity}:${e.occurredAt.getTime()}`)
      .join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < eventString.length; i++) {
      const char = eventString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Determine classification based on metric (from USAGE_CONTRACTS.md)
   */
  private determineClassification(
    metric: string
  ): 'BILLABLE' | 'NON_BILLABLE' | 'INFO' {
    // Billable metrics
    const billableMetrics = [
      'leads.processed',
      'leads.qualified',
      'leads.routed',
      'routing.decisions',
      'routing.capacity_used',
      'voice.minutes.authorized',
      'voice.calls.initiated',
      'voice.calls.completed',
      'api.requests',
      'api.requests.successful',
      'scoring.requests',
      'scoring.models.used',
      'integrations.api.calls',
      'storage.data_volume_gb',
      'team.users.active',
    ];

    // Non-billable but tracked
    const nonBillableMetrics = [
      'sla.timers.started',
      'sla.timers.violated',
      'sla.escalations.triggered',
      'api.requests.failed',
      'integrations.webhooks.received',
      'storage.retention_days_used',
      'team.concurrent_sessions',
    ];

    if (billableMetrics.includes(metric)) {
      return 'BILLABLE';
    }

    if (nonBillableMetrics.includes(metric)) {
      return 'NON_BILLABLE';
    }

    return 'INFO'; // Default to informational
  }

  /**
   * Domain mapping functions
   */
  private mapEventToDomain(event: any): UsageEvent {
    return {
      eventId: event.eventId,
      tenantId: event.tenantId,
      metric: event.metric as any,
      quantity: event.quantity,
      timestamp: event.occurredAt.toISOString(),
      correlationId: event.correlationId,
      metadata: event.metadata || {},
      sourceService: event.sourceService,
      sourceVersion: event.sourceVersion,
      actorId: event.actorId,
      idempotencyKey: event.idempotencyKey,
    };
  }

  private mapAggregateToDomain(aggregate: any): UsageAggregate {
    return {
      id: aggregate.id,
      tenantId: aggregate.tenantId,
      period: `${aggregate.periodStart.getFullYear()}-${String(aggregate.periodStart.getMonth() + 1).padStart(2, '0')}`,
      periodType: aggregate.periodType,
      periodStart: aggregate.periodStart.toISOString(),
      periodEnd: aggregate.periodEnd.toISOString(),
      metric: aggregate.metric as any,
      totalQuantity: aggregate.totalQuantity,
      eventCount: aggregate.eventCount,
      computedAt: aggregate.computedAt.toISOString(),
      lastUpdated: aggregate.updatedAt.toISOString(),
      dailyBreakdown: aggregate.dailyBreakdown,
      peakUsage: aggregate.peakUsage,
      metadata: aggregate.metadata,
    };
  }
}
