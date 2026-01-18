/**
 * SLA Timer Repository - WI-017: SLA Timer Persistence
 *
 * PostgreSQL-backed SLA timer repository with tenant isolation and idempotency.
 * Manages timer creation, status updates, and escalation tracking.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface SlaTimerData {
  tenantId: string;
  leadId: string;
  slaContractId: string;
  startedAt: Date;
  dueAt: Date;
  slaWindowMinutes: number;
  escalationSteps: any[];
  correlationId: string;
  idempotencyKey?: string;
}

export interface EscalationEventData {
  tenantId: string;
  leadId: string;
  timerId: string;
  escalationStep: number;
  escalationConfig: any;
  correlationId: string;
}

@Injectable()
export class SlaTimerRepository {
  private readonly logger = new Logger(SlaTimerRepository.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create SLA timer with idempotency
   */
  async createTimer(timerData: SlaTimerData): Promise<string> {
    try {
      const timer = await this.prisma.slaTimer.create({
        data: {
          tenantId: timerData.tenantId,
          leadId: timerData.leadId,
          slaContractId: timerData.slaContractId,
          startedAt: timerData.startedAt,
          dueAt: timerData.dueAt,
          slaWindowMinutes: timerData.slaWindowMinutes,
          escalationSteps: timerData.escalationSteps,
          correlationId: timerData.correlationId,
          idempotencyKey: timerData.idempotencyKey,
        },
      });

      this.logger.debug(`Created SLA timer: ${timer.id}`, {
        tenantId: timerData.tenantId,
        leadId: timerData.leadId,
        correlationId: timerData.correlationId,
      });

      return timer.id;
    } catch (error: any) {
      // Handle unique constraint violations (idempotency)
      if (error.code === 'P2002') {
        this.logger.debug(`Duplicate SLA timer creation ignored`, {
          tenantId: timerData.tenantId,
          leadId: timerData.leadId,
          correlationId: timerData.correlationId,
        });

        // Return existing timer ID for idempotency
        const existing = await this.prisma.slaTimer.findFirst({
          where: {
            tenantId: timerData.tenantId,
            leadId: timerData.leadId,
            slaContractId: timerData.slaContractId,
            startedAt: timerData.startedAt,
          },
        });

        return existing?.id || 'duplicate-ignored';
      }

      throw error;
    }
  }

  /**
   * Cancel SLA timer for a lead
   */
  async cancelTimerForLead(
    tenantId: string,
    leadId: string,
    correlationId?: string
  ): Promise<number> {
    const result = await this.prisma.slaTimer.updateMany({
      where: {
        tenantId,
        leadId,
        status: { in: ['ACTIVE', 'PENDING'] }, // Only cancel active/pending timers
      },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.debug(
        `Cancelled ${result.count} SLA timers for lead ${leadId}`,
        {
          tenantId,
          correlationId,
        }
      );
    }

    return result.count;
  }

  /**
   * Claim due timers for processing (multi-instance safe)
   */
  async claimDueTimers(limit: number = 50): Promise<any[]> {
    // Use SKIP LOCKED to prevent multiple instances from claiming the same timers
    const timers = await this.prisma.$queryRaw<any[]>`
      UPDATE sla_timers
      SET
        processingStatus = 'PROCESSING',
        attempts = attempts + 1,
        nextAttemptAt = NOW() + INTERVAL '30 seconds', -- Backoff for retries
        lastAttemptAt = NOW(),
        updatedAt = NOW()
      WHERE id IN (
        SELECT id FROM sla_timers
        WHERE status = 'ACTIVE'
          AND dueAt <= NOW()
          AND processingStatus = 'PENDING'
          AND nextAttemptAt <= NOW()
          AND attempts < 3 -- Max retry attempts
        ORDER BY dueAt ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id, tenantId, leadId, slaContractId, startedAt, dueAt,
        slaWindowMinutes, escalationSteps, correlationId,
        attempts, nextAttemptAt
    `;

    if (timers.length > 0) {
      this.logger.debug(
        `Claimed ${timers.length} due SLA timers for processing`
      );
    }

    return timers;
  }

  /**
   * Mark timer as completed
   */
  async markTimerCompleted(timerId: string): Promise<void> {
    await this.prisma.slaTimer.update({
      where: { id: timerId },
      data: {
        status: 'COMPLETED',
        processingStatus: 'COMPLETED',
        updatedAt: new Date(),
      },
    });

    this.logger.debug(`Marked SLA timer completed: ${timerId}`);
  }

  /**
   * Mark timer as escalated
   */
  async markTimerEscalated(timerId: string): Promise<void> {
    await this.prisma.slaTimer.update({
      where: { id: timerId },
      data: {
        status: 'ESCALATED',
        processingStatus: 'COMPLETED',
        updatedAt: new Date(),
      },
    });

    this.logger.debug(`Marked SLA timer escalated: ${timerId}`);
  }

  /**
   * Mark timer processing as failed (will be retried)
   */
  async markTimerFailed(timerId: string, error: string): Promise<void> {
    await this.prisma.slaTimer.update({
      where: { id: timerId },
      data: {
        processingStatus: 'FAILED',
        lastError: error,
        nextAttemptAt: new Date(Date.now() + 30 * 1000), // Retry in 30 seconds
        updatedAt: new Date(),
      },
    });

    this.logger.warn(`Marked SLA timer processing failed: ${timerId}`, {
      error,
    });
  }

  /**
   * Create escalation event with idempotency
   */
  async createEscalationEvent(eventData: EscalationEventData): Promise<string> {
    try {
      const event = await this.prisma.slaEscalationEvent.create({
        data: {
          tenantId: eventData.tenantId,
          leadId: eventData.leadId,
          timerId: eventData.timerId,
          escalationStep: eventData.escalationStep,
          executedAt: new Date(),
          outcome: 'SUCCESS', // Will be updated if execution fails
          escalationConfig: eventData.escalationConfig,
          correlationId: eventData.correlationId,
          idempotencyKey: `${eventData.timerId}-${eventData.escalationStep}`,
        },
      });

      this.logger.debug(`Created SLA escalation event: ${event.id}`, {
        tenantId: eventData.tenantId,
        leadId: eventData.leadId,
        escalationStep: eventData.escalationStep,
      });

      return event.id;
    } catch (error: any) {
      // Handle unique constraint violations (idempotency)
      if (error.code === 'P2002') {
        this.logger.debug(`Duplicate SLA escalation event ignored`, {
          tenantId: eventData.tenantId,
          leadId: eventData.leadId,
          timerId: eventData.timerId,
          escalationStep: eventData.escalationStep,
        });

        // Return existing event ID for idempotency
        const existing = await this.prisma.slaEscalationEvent.findFirst({
          where: {
            tenantId: eventData.tenantId,
            timerId: eventData.timerId,
            escalationStep: eventData.escalationStep,
          },
        });

        return existing?.id || 'duplicate-ignored';
      }

      throw error;
    }
  }

  /**
   * Mark escalation event as failed
   */
  async markEscalationFailed(
    eventId: string,
    errorMessage: string
  ): Promise<void> {
    await this.prisma.slaEscalationEvent.update({
      where: { id: eventId },
      data: {
        outcome: 'FAILED',
        errorMessage,
      },
    });

    this.logger.warn(`Marked SLA escalation failed: ${eventId}`, {
      errorMessage,
    });
  }

  /**
   * Query active timers for a tenant
   */
  async queryActiveTimers(
    tenantId: string,
    limit: number = 100
  ): Promise<any[]> {
    const timers = await this.prisma.slaTimer.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
      orderBy: { dueAt: 'asc' },
      take: limit,
    });

    return timers;
  }

  /**
   * Get timer statistics for monitoring
   */
  async getTimerStats(tenantId?: string): Promise<{
    active: number;
    due: number;
    escalated: number;
    cancelled: number;
    completed: number;
    total: number;
  }> {
    const where = tenantId ? { tenantId } : {};

    const stats = await this.prisma.slaTimer.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
    });

    const result = {
      active: 0,
      due: 0,
      escalated: 0,
      cancelled: 0,
      completed: 0,
      total: 0,
    };

    for (const stat of stats) {
      const count = stat._count.status;
      result.total += count;

      switch (stat.status) {
        case 'ACTIVE':
          result.active = count;
          break;
        case 'DUE':
          result.due = count;
          break;
        case 'ESCALATED':
          result.escalated = count;
          break;
        case 'CANCELLED':
          result.cancelled = count;
          break;
        case 'COMPLETED':
          result.completed = count;
          break;
      }
    }

    return result;
  }

  /**
   * Get escalation statistics
   */
  async getEscalationStats(tenantId?: string): Promise<{
    successful: number;
    failed: number;
    skipped: number;
    total: number;
  }> {
    const where = tenantId ? { tenantId } : {};

    const stats = await this.prisma.slaEscalationEvent.groupBy({
      by: ['outcome'],
      where,
      _count: {
        outcome: true,
      },
    });

    const result = {
      successful: 0,
      failed: 0,
      skipped: 0,
      total: 0,
    };

    for (const stat of stats) {
      const count = stat._count.outcome;
      result.total += count;

      switch (stat.outcome) {
        case 'SUCCESS':
          result.successful = count;
          break;
        case 'FAILED':
          result.failed = count;
          break;
        case 'SKIPPED':
          result.skipped = count;
          break;
      }
    }

    return result;
  }

  /**
   * Clean up old completed/cancelled timers (retention policy)
   */
  async cleanupOldTimers(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.slaTimer.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'CANCELLED'] },
        updatedAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old SLA timers`);
    return result.count;
  }

  /**
   * Clean up old escalation events
   */
  async cleanupOldEscalationEvents(
    olderThanDays: number = 90
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.slaEscalationEvent.deleteMany({
      where: {
        executedAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old SLA escalation events`);
    return result.count;
  }
}
