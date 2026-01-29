/**
 * Outbox Repository - WI-014: Durable Event Streaming
 *
 * PostgreSQL-backed outbox repository with tenant isolation and idempotency.
 * Manages durable event publishing with multi-instance safety.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface OutboxEventData {
  tenantId: string;
  eventId: string;
  eventType: string;
  payload: any;
  correlationId?: string;
  idempotencyKey?: string;
  sourceService: string;
}

export interface PendingOutboxEvent {
  id: string;
  tenantId: string;
  eventId: string;
  eventType: string;
  payload: any;
  correlationId?: string;
  attempts: number;
  nextAttemptAt: Date;
  sourceService: string;
}

@Injectable()
export class OutboxRepository {
  private readonly logger = new Logger(OutboxRepository.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Store event in outbox (called within business transaction)
   */
  async storeEvent(eventData: OutboxEventData): Promise<string> {
    try {
      const event = await this.prisma.outboxEvent.create({
        data: {
          tenantId: eventData.tenantId,
          eventId: eventData.eventId,
          eventType: eventData.eventType,
          payload: eventData.payload,
          correlationId: eventData.correlationId,
          idempotencyKey: eventData.idempotencyKey,
          sourceService: eventData.sourceService,
        },
      });

      this.logger.debug(`Stored outbox event: ${eventData.eventType}`, {
        eventId: eventData.eventId,
        tenantId: eventData.tenantId,
        correlationId: eventData.correlationId,
      });

      return event.id;
    } catch (error: any) {
      // Handle unique constraint violations (idempotency)
      if (
        error.code === 'P2002' &&
        error.meta?.target?.includes('idempotencyKey')
      ) {
        this.logger.debug(
          `Duplicate outbox event ignored: ${eventData.eventId}`,
          {
            tenantId: eventData.tenantId,
            correlationId: eventData.correlationId,
          }
        );
        return 'duplicate-ignored'; // Idempotent - duplicate ignored
      }

      if (error.code === 'P2002' && error.meta?.target?.includes('eventId')) {
        this.logger.debug(
          `Business duplicate outbox event ignored: ${eventData.eventId}`,
          {
            tenantId: eventData.tenantId,
            eventType: eventData.eventType,
          }
        );
        return 'duplicate-ignored'; // Business uniqueness constraint
      }

      throw error;
    }
  }

  /**
   * Claim pending events for processing (multi-instance safe)
   */
  async claimPendingEvents(limit: number = 50): Promise<PendingOutboxEvent[]> {
    // Use SKIP LOCKED to prevent multiple instances from claiming the same events
    const events = await this.prisma.$queryRaw<PendingOutboxEvent[]>`
      UPDATE outbox_events
      SET
        status = 'PROCESSING',
        attempts = attempts + 1,
        nextAttemptAt = NOW() + INTERVAL '30 seconds' -- Backoff for retries
      WHERE id IN (
        SELECT id FROM outbox_events
        WHERE status = 'PENDING'
          AND nextAttemptAt <= NOW()
          AND attempts < 5 -- Max retry attempts
        ORDER BY createdAt ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id, tenantId, eventId, eventType, payload, correlationId,
        attempts, nextAttemptAt, sourceService
    `;

    if (events.length > 0) {
      this.logger.debug(
        `Claimed ${events.length} outbox events for processing`
      );
    }

    return events;
  }

  /**
   * Mark event as successfully published
   */
  async markPublished(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    this.logger.debug(`Marked outbox event published: ${eventId}`);
  }

  /**
   * Mark event as failed (will be retried)
   */
  async markFailed(eventId: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'FAILED',
        lastError: error,
        nextAttemptAt: new Date(Date.now() + 30 * 1000), // Retry in 30 seconds
      },
    });

    this.logger.warn(`Marked outbox event failed: ${eventId}`, { error });
  }

  /**
   * Mark event as dead-letter (max retries exceeded)
   */
  async markDeadLetter(eventId: string, finalError: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'DEAD_LETTER',
        lastError: finalError,
      },
    });

    this.logger.error(`Marked outbox event as dead letter: ${eventId}`, {
      finalError,
    });
  }

  /**
   * Get failed events for monitoring
   */
  async getFailedEvents(limit: number = 100): Promise<any[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'FAILED',
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return events;
  }

  /**
   * Get dead letter events for investigation
   */
  async getDeadLetterEvents(limit: number = 100): Promise<any[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        status: 'DEAD_LETTER',
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return events;
  }

  /**
   * Get event statistics for monitoring
   */
  async getEventStats(): Promise<{
    pending: number;
    processing: number;
    published: number;
    failed: number;
    deadLetter: number;
    total: number;
  }> {
    const stats = await this.prisma.outboxEvent.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const result = {
      pending: 0,
      processing: 0,
      published: 0,
      failed: 0,
      deadLetter: 0,
      total: 0,
    };

    for (const stat of stats) {
      const count = stat._count.status;
      result.total += count;

      switch (stat.status) {
        case 'PENDING':
          result.pending = count;
          break;
        case 'PROCESSING':
          result.processing = count;
          break;
        case 'PUBLISHED':
          result.published = count;
          break;
        case 'FAILED':
          result.failed = count;
          break;
        case 'DEAD_LETTER':
          result.deadLetter = count;
          break;
      }
    }

    return result;
  }

  /**
   * Query events by tenant and correlation ID
   */
  async queryEventsByCorrelation(
    tenantId: string,
    correlationId: string
  ): Promise<any[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        tenantId,
        correlationId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return events;
  }

  /**
   * Clean up old published events (retention policy)
   */
  async cleanupOldEvents(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.outboxEvent.deleteMany({
      where: {
        status: 'PUBLISHED',
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old published outbox events`);
    return result.count;
  }
}
