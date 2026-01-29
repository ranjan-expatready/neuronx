/**
 * Usage Service - REQ-019: Configuration as IP
 *
 * Usage metering and aggregation service for tracking tenant-level usage
 * across monetized domains. Enables entitlement enforcement and billing observation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '../eventing';
import {
  UsageEvent,
  UsageAggregate,
  UsageThreshold,
  UsageReport,
  UsageQueryOptions,
  UsageServiceConfig,
  UsageProcessingResult,
  UsageEventBatch,
  UsageMetric,
  DEFAULT_USAGE_CONFIG,
} from './usage.types';
import { UsageEventValidator } from './usage.events';
import { UsageRepository } from './usage.repository';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);
  private readonly config: UsageServiceConfig;

  // Processing state (kept for backward compatibility)
  private lastProcessingTime: string = new Date().toISOString();
  private processingInterval?: NodeJS.Timeout;

  constructor(
    private readonly eventBus: EventBus,
    private readonly usageRepository: UsageRepository,
    config: Partial<UsageServiceConfig> = {}
  ) {
    this.config = { ...DEFAULT_USAGE_CONFIG, ...config };

    // Start periodic processing if enabled (legacy - now handled by runner)
    if (this.config.enabled) {
      this.startPeriodicProcessing();
    }
  }

  /**
   * Record a usage event
   * Primary method for tracking usage occurrences
   */
  async recordUsage(event: UsageEvent): Promise<void> {
    try {
      // Validate event (fail fast if invalid)
      const validation = UsageEventValidator.validateUsageEvent(event);
      if (!validation.valid) {
        this.logger.warn(
          `Invalid usage event: ${validation.errors.join(', ')}`,
          {
            eventId: event.eventId,
            tenantId: event.tenantId,
          }
        );
        // Don't throw - usage failures shouldn't break business logic
        return;
      }

      // CRITICAL: Record to database (fire-and-forget)
      // This must not block or fail business operations
      await this.usageRepository.recordEvent(event);

      // Emit event for external processing (non-blocking)
      try {
        await this.eventBus.publish({
          id: event.eventId,
          tenantId: event.tenantId,
          type: 'usage.occurred',
          correlationId: event.correlationId,
          timestamp: new Date(event.timestamp),
          payload: event,
        });
      } catch (eventError) {
        // Event emission failure shouldn't break usage recording
        this.logger.warn(`Failed to emit usage event: ${eventError.message}`, {
          eventId: event.eventId,
          tenantId: event.tenantId,
        });
      }

      this.logger.debug(`Recorded usage event: ${event.metric}`, {
        tenantId: event.tenantId,
        quantity: event.quantity,
        correlationId: event.correlationId,
        sourceService: event.sourceService,
      });
    } catch (error) {
      // CRITICAL: Never let usage recording break business operations
      // Log the error but don't throw - usage is observational only
      this.logger.error(`Failed to record usage event: ${error.message}`, {
        eventId: event.eventId,
        tenantId: event.tenantId,
        metric: event.metric,
        correlationId: event.correlationId,
      });
    }
  }

  /**
   * Record multiple usage events in batch
   * Efficient method for bulk usage tracking
   */
  async recordUsageBatch(
    batch: UsageEventBatch
  ): Promise<UsageProcessingResult> {
    const startTime = Date.now();

    // Validate batch
    const validation = UsageEventValidator.validateUsageEventBatch(batch);
    if (!validation.valid) {
      throw new Error(
        `Invalid usage event batch: ${validation.errors.join(', ')}`
      );
    }

    let eventsProcessed = 0;
    let aggregatesUpdated = 0;
    const errors: string[] = [];

    // Process each event
    for (const event of batch.events) {
      try {
        await this.recordUsage(event);
        eventsProcessed++;
      } catch (error) {
        errors.push(`Event ${event.eventId}: ${error.message}`);
      }
    }

    // Update aggregates for the batch
    try {
      const aggregateResult = await this.updateAggregatesForBatch(batch.events);
      aggregatesUpdated = aggregateResult.aggregatesUpdated;
    } catch (error) {
      errors.push(`Aggregate update failed: ${error.message}`);
    }

    // Mark batch as processed
    batch.status = errors.length > 0 ? 'failed' : 'completed';
    batch.result = {
      eventsProcessed,
      aggregatesUpdated,
      thresholdsEvaluated: 0, // Not implemented in this phase
      violationsDetected: 0, // Not implemented in this phase
      processingDurationMs: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    };

    // Emit batch processed event
    await this.eventBus.publish({
      id: crypto.randomUUID(),
      tenantId: 'system', // System-level event
      type: 'usage.batch.processed',
      correlationId: crypto.randomUUID(),
      timestamp: new Date(),
      payload: {
        batchId: batch.batchId,
        eventsProcessed,
        aggregatesUpdated,
        processingDurationMs: batch.result.processingDurationMs,
        errors: batch.result.errors,
      },
    });

    return batch.result;
  }

  /**
   * Get usage aggregate for a tenant and period
   */
  async getUsageAggregate(
    tenantId: string,
    period: string
  ): Promise<UsageAggregate | null> {
    const key = `${tenantId}:${period}`;
    return this.aggregates.get(key) || null;
  }

  /**
   * Get usage aggregates for a tenant
   */
  async getUsageAggregates(
    tenantId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<UsageAggregate[]> {
    const tenantAggregates = Array.from(this.aggregates.values())
      .filter(agg => agg.tenantId === tenantId)
      .sort((a, b) => b.period.localeCompare(a.period)); // Most recent first

    const { limit = 100, offset = 0 } = options;
    return tenantAggregates.slice(offset, offset + limit);
  }

  /**
   * Query usage data with flexible options
   */
  async queryUsage(options: UsageQueryOptions): Promise<{
    aggregates: UsageAggregate[];
    events: UsageEvent[];
    totalEvents: number;
    totalAggregates: number;
  }> {
    const {
      tenantId,
      metrics,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
      includeEvents = false,
    } = options;

    // Query aggregates from repository
    const aggregatesResult = await this.usageRepository.queryAggregates({
      tenantId,
      metrics,
      startDate,
      endDate,
      limit,
      offset,
    });

    // Query events if requested
    let eventsResult = { events: [] as UsageEvent[], total: 0, hasMore: false };
    if (includeEvents) {
      eventsResult = await this.usageRepository.queryEvents({
        tenantId,
        metrics,
        startDate,
        endDate,
        limit,
        offset,
      });
    }

    return {
      aggregates: aggregatesResult.aggregates,
      events: eventsResult.events,
      totalEvents,
      totalAggregates: aggregates.length,
    };
  }

  /**
   * Get usage summary for a tenant
   */
  async getUsageSummary(
    tenantId: string,
    period: string = this.getCurrentPeriod()
  ): Promise<Record<UsageMetric, number>> {
    const aggregate = await this.getUsageAggregate(tenantId, period);

    if (!aggregate) {
      // Return empty summary
      return {} as Record<UsageMetric, number>;
    }

    return aggregate.metrics;
  }

  /**
   * Generate usage report for a tenant
   */
  async generateUsageReport(
    tenantId: string,
    period: string
  ): Promise<UsageReport> {
    const aggregates = await this.getUsageAggregates(tenantId, { limit: 31 }); // Last 31 days
    const aggregate = aggregates.find(agg => agg.period === period);

    if (!aggregate) {
      throw new Error(
        `No usage data found for tenant ${tenantId} in period ${period}`
      );
    }

    // Generate daily breakdown (simplified - would be more sophisticated in production)
    const dailyBreakdown = [
      {
        date: period,
        metrics: aggregate.metrics,
      },
    ];

    // Find peaks (simplified)
    const peaks = Object.entries(aggregate.metrics)
      .map(([metric, value]) => ({
        metric: metric as UsageMetric,
        value,
        timestamp: aggregate.lastUpdated,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const report: UsageReport = {
      reportId: crypto.randomUUID(),
      tenantId,
      period,
      generatedAt: new Date().toISOString(),
      totals: aggregate.metrics,
      dailyBreakdown,
      peaks,
      violations: [], // Not implemented in this phase
      metadata: {
        totalEvents: aggregate.eventCount,
        completenessPercentage: 100, // Simplified
        generationDurationMs: 0,
      },
    };

    // Store report
    this.reports.push(report);

    // Emit report generated event
    await this.eventBus.publish({
      id: report.reportId,
      tenantId,
      type: 'usage.report.generated',
      correlationId: crypto.randomUUID(),
      timestamp: new Date(),
      payload: {
        reportId: report.reportId,
        period,
        totals: report.totals,
      },
    });

    return report;
  }

  /**
   * Process pending usage events
   * Called periodically to update aggregates
   */
  async processPendingEvents(): Promise<UsageProcessingResult> {
    const startTime = Date.now();

    // Get events since last processing
    const pendingEvents = this.rawEvents.filter(
      event => new Date(event.timestamp) > new Date(this.lastProcessingTime)
    );

    if (pendingEvents.length === 0) {
      return {
        eventsProcessed: 0,
        aggregatesUpdated: 0,
        thresholdsEvaluated: 0,
        violationsDetected: 0,
        processingDurationMs: Date.now() - startTime,
      };
    }

    // Update aggregates
    const aggregateResult = await this.updateAggregatesForBatch(pendingEvents);

    // Update processing timestamp
    this.lastProcessingTime = new Date().toISOString();

    const result: UsageProcessingResult = {
      eventsProcessed: pendingEvents.length,
      aggregatesUpdated: aggregateResult.aggregatesUpdated,
      thresholdsEvaluated: 0, // Not implemented in this phase
      violationsDetected: 0, // Not implemented in this phase
      processingDurationMs: Date.now() - startTime,
    };

    this.logger.log(`Processed ${result.eventsProcessed} usage events`, {
      aggregatesUpdated: result.aggregatesUpdated,
      processingDurationMs: result.processingDurationMs,
    });

    return result;
  }

  /**
   * Start periodic processing of usage events
   */
  private startPeriodicProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(async () => {
      try {
        await this.processPendingEvents();
      } catch (error) {
        this.logger.error('Failed to process pending usage events', error);
      }
    }, this.config.processingIntervalMs);
  }

  /**
   * Stop periodic processing
   */
  stopPeriodicProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * Update aggregates for a batch of events
   */
  private async updateAggregatesForBatch(
    events: UsageEvent[]
  ): Promise<{ aggregatesUpdated: number }> {
    const aggregatesToUpdate = new Map<string, UsageAggregate>();
    let aggregatesUpdated = 0;

    // Group events by tenant and period
    for (const event of events) {
      const period = this.getPeriodForTimestamp(event.timestamp);
      const key = `${event.tenantId}:${period}`;

      let aggregate = aggregatesToUpdate.get(key);
      if (!aggregate) {
        // Get existing aggregate or create new one
        aggregate = this.aggregates.get(key) || {
          tenantId: event.tenantId,
          period,
          periodStart: this.getPeriodStart(period),
          periodEnd: this.getPeriodEnd(period),
          metrics: {} as Record<UsageMetric, number>,
          lastUpdated: new Date().toISOString(),
          eventCount: 0,
        };
        aggregatesToUpdate.set(key, aggregate);
      }

      // Update metrics
      const currentValue = aggregate.metrics[event.metric] || 0;
      aggregate.metrics[event.metric] = currentValue + event.quantity;
      aggregate.eventCount++;
      aggregate.lastUpdated = new Date().toISOString();
    }

    // Save updated aggregates
    for (const [key, aggregate] of aggregatesToUpdate.entries()) {
      this.aggregates.set(key, aggregate);
      aggregatesUpdated++;
    }

    return { aggregatesUpdated };
  }

  /**
   * Clean up old events based on retention policy
   */
  private cleanupOldEvents(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.eventRetentionDays);

    const initialCount = this.rawEvents.length;
    this.rawEvents = this.rawEvents.filter(
      event => new Date(event.timestamp) > cutoffDate
    );

    const removedCount = initialCount - this.rawEvents.length;
    if (removedCount > 0) {
      this.logger.debug(`Cleaned up ${removedCount} old usage events`);
    }
  }

  /**
   * Get current period (YYYY-MM)
   */
  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get period for a timestamp
   */
  private getPeriodForTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Get period start date
   */
  private getPeriodStart(period: string): string {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month - 1, 1).toISOString();
  }

  /**
   * Get period end date
   */
  private getPeriodEnd(period: string): string {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month, 0).toISOString(); // Last day of month
  }

  /**
   * Clear all usage data (for testing)
   */
  clearAllUsageData(): void {
    this.rawEvents = [];
    this.aggregates.clear();
    this.thresholds = [];
    this.reports = [];
    this.lastProcessingTime = new Date().toISOString();
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    totalEvents: number;
    totalAggregates: number;
    totalReports: number;
    oldestEvent?: string;
    newestEvent?: string;
  } {
    const sortedEvents = this.rawEvents.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      totalEvents: this.rawEvents.length,
      totalAggregates: this.aggregates.size,
      totalReports: this.reports.length,
      oldestEvent: sortedEvents[0]?.timestamp,
      newestEvent: sortedEvents[sortedEvents.length - 1]?.timestamp,
    };
  }
}
