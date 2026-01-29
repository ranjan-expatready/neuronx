/**
 * Usage Aggregator - WI-040: Billing & Entitlements Authority
 *
 * Records usage events and maintains aggregated usage meters.
 */

import { PrismaClient } from '@prisma/client';
import { UsageEvent, UsageType, UsageAggregationRequest } from './types';

export class UsageAggregator {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Record a usage event (idempotent)
   */
  async recordUsage(event: UsageEvent): Promise<void> {
    const {
      eventId,
      tenantId,
      type,
      quantity,
      correlationId,
      metadata,
      occurredAt,
    } = event;

    // Record the raw event (idempotent)
    await this.prisma.usageEvent.upsert({
      where: { eventId },
      update: {}, // No updates if exists
      create: {
        eventId,
        tenantId,
        // type, // REMOVED: 'type' does not exist in Prisma UsageEvent model
        quantity,
        correlationId,
        metadata,
        occurredAt,
        metric: type, // Mapped to 'metric' field based on typical Prisma schema for usage
        sourceService: 'billing-guard', // Required field
        classification: 'usage', // Required field
      },
    });

    // Update the aggregated meter
    await this.updateUsageMeter(tenantId, type, quantity, occurredAt);
  }

  /**
   * Update usage meter for a tenant/type/period
   */
  private async updateUsageMeter(
    tenantId: string,
    type: UsageType,
    quantity: number,
    occurredAt: Date
  ): Promise<void> {
    const period = this.getPeriodForDate(occurredAt);

    await this.prisma.usageMeter.upsert({
      where: {
        tenantId_period_type: {
          tenantId,
          period,
          type,
        },
      },
      update: {
        totalQuantity: {
          increment: quantity,
        },
        lastUpdated: new Date(),
      },
      create: {
        tenantId,
        period,
        type,
        totalQuantity: quantity,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Get usage summary for a tenant
   */
  async getUsageSummary(request: UsageAggregationRequest): Promise<{
    period: string;
    usage: Record<UsageType, number>;
    limits: any; // TODO: Get from plan
  }> {
    const { tenantId, period = this.getCurrentPeriod() } = request;

    const meters = await this.prisma.usageMeter.findMany({
      where: {
        tenantId,
        period,
      },
    });

    const usage: Record<UsageType, number> = {
      [UsageType.EXECUTION]: 0,
      [UsageType.VOICE_MINUTE]: 0,
      [UsageType.EXPERIMENT]: 0,
    };

    meters.forEach(meter => {
      // Cast meter.type to UsageType to avoid TS errors, assuming DB stores valid enum values
      usage[meter.type as UsageType] = meter.totalQuantity;
    });

    // TODO: Get actual plan limits
    const limits = {
      executionsPerMonth: 100,
      voiceMinutesPerMonth: 10,
      experimentsPerMonth: 1,
    };

    return {
      period,
      usage,
      limits,
    };
  }

  /**
   * Get usage events for auditing
   */
  async getUsageEvents(
    tenantId: string,
    type?: UsageType,
    limit: number = 100,
    offset: number = 0
  ): Promise<UsageEvent[]> {
    const where: any = { tenantId };
    if (type) {
      where.type = type;
    }

    const events = await this.prisma.usageEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return events.map(event => ({
      eventId: event.eventId,
      tenantId: event.tenantId,
      type: event.metric as UsageType, // Mapped from 'metric' field
      quantity: event.quantity,
      correlationId: event.correlationId,
      metadata: event.metadata as any,
      occurredAt: event.occurredAt,
    }));
  }

  /**
   * Reset usage meters for a new period (maintenance job)
   */
  async resetMetersForNewPeriod(): Promise<void> {
    // This would be called by a scheduled job
    // For now, meters are maintained incrementally
    // Future: Archive old periods, reset counters
  }

  /**
   * Get period string for a date (YYYY-MM)
   */
  private getPeriodForDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get current period
   */
  private getCurrentPeriod(): string {
    return this.getPeriodForDate(new Date());
  }
}
