/**
 * Durable Event Publisher - WI-014: Durable Event Streaming
 *
 * Outbox-based event publisher that ensures events are durable and replayable.
 * Integrates with business transactions to maintain consistency.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { OutboxRepository, OutboxEventData } from './outbox.repository';

export interface DurableEventPublisher {
  publishInTransaction(
    eventData: OutboxEventData,
    transaction: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
    >
  ): Promise<void>;
}

@Injectable()
export class DurableEventPublisherService implements DurableEventPublisher {
  private readonly logger = new Logger(DurableEventPublisherService.name);

  constructor(private readonly outboxRepository: OutboxRepository) {}

  /**
   * Publish event durably within a database transaction
   * This ensures the event is stored atomically with the business state change
   */
  async publishInTransaction(
    eventData: OutboxEventData,
    transaction: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
    >
  ): Promise<void> {
    try {
      // Store event in outbox within the same transaction
      await transaction.outboxEvent.create({
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

      this.logger.debug(`Stored durable event: ${eventData.eventType}`, {
        eventId: eventData.eventId,
        tenantId: eventData.tenantId,
        correlationId: eventData.correlationId,
      });
    } catch (error: any) {
      // Handle unique constraint violations gracefully
      if (error.code === 'P2002') {
        this.logger.debug(
          `Duplicate durable event ignored: ${eventData.eventId}`,
          {
            tenantId: eventData.tenantId,
            correlationId: eventData.correlationId,
          }
        );
        return; // Idempotent within transaction
      }

      this.logger.error(
        `Failed to store durable event: ${eventData.eventType}`,
        {
          eventId: eventData.eventId,
          tenantId: eventData.tenantId,
          error: error.message,
        }
      );

      // Re-throw to fail the business transaction if event storage fails
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility
   * Stores event asynchronously (not in transaction)
   */
  async publishAsync(eventData: OutboxEventData): Promise<void> {
    try {
      await this.outboxRepository.storeEvent(eventData);
    } catch (error) {
      // For async publishing, we don't fail the business operation
      this.logger.warn(`Failed to store async event: ${eventData.eventType}`, {
        eventId: eventData.eventId,
        tenantId: eventData.tenantId,
        error: error.message,
      });
    }
  }
}
