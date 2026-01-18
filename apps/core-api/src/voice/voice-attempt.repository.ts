/**
 * Voice Attempt Repository - WI-013: Voice State Persistence
 *
 * PostgreSQL-backed voice attempt repository with tenant isolation and idempotency.
 * Manages voice attempt lifecycle, provider updates, and retry logic.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface VoiceAttemptData {
  tenantId: string;
  attemptId: string;
  leadId: string;
  intentType: string;
  correlationId: string;
  idempotencyKey?: string;
  provider: string;
  maxRetries?: number;
}

export interface ProviderUpdateData {
  tenantId: string;
  providerCallId: string;
  provider: string;
  providerStatus?: string;
  durationSec?: number;
  recordingUrl?: string;
  transcriptRef?: string;
  correlationId?: string;
}

export interface ExecutionEventData {
  tenantId: string;
  attemptId: string;
  eventType: string;
  payloadJson: any;
  correlationId?: string;
  idempotencyKey?: string;
}

@Injectable()
export class VoiceAttemptRepository {
  private readonly logger = new Logger(VoiceAttemptRepository.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create voice attempt with idempotency
   */
  async createAttempt(attemptData: VoiceAttemptData): Promise<string> {
    try {
      const attempt = await this.prisma.voiceAttempt.create({
        data: {
          tenantId: attemptData.tenantId,
          attemptId: attemptData.attemptId,
          leadId: attemptData.leadId,
          intentType: attemptData.intentType,
          correlationId: attemptData.correlationId,
          idempotencyKey: attemptData.idempotencyKey,
          provider: attemptData.provider,
          maxRetries: attemptData.maxRetries || 3,
        },
      });

      this.logger.debug(`Created voice attempt: ${attempt.attemptId}`, {
        tenantId: attemptData.tenantId,
        leadId: attemptData.leadId,
        correlationId: attemptData.correlationId,
      });

      return attempt.id;
    } catch (error: any) {
      // Handle unique constraint violations (idempotency)
      if (error.code === 'P2002') {
        this.logger.debug(`Duplicate voice attempt creation ignored`, {
          tenantId: attemptData.tenantId,
          attemptId: attemptData.attemptId,
          correlationId: attemptData.correlationId,
        });

        // Return existing attempt ID for idempotency
        const existing = await this.prisma.voiceAttempt.findUnique({
          where: { attemptId: attemptData.attemptId },
        });

        return existing?.id || 'duplicate-ignored';
      }

      throw error;
    }
  }

  /**
   * Authorize voice attempt (NeuronX-owned decision)
   */
  async authorizeAttempt(
    tenantId: string,
    attemptId: string,
    consentRef: string,
    paymentRef: string,
    correlationId: string
  ): Promise<void> {
    await this.prisma.voiceAttempt.updateMany({
      where: {
        tenantId,
        attemptId,
        status: { in: ['INITIATED', 'PENDING'] }, // Only authorize pending attempts
      },
      data: {
        status: 'AUTHORIZED',
        authorizedAt: new Date(),
        consentRef,
        paymentRef,
        updatedAt: new Date(),
      },
    });

    this.logger.debug(`Authorized voice attempt: ${attemptId}`, {
      tenantId,
      consentRef,
      paymentRef,
      correlationId,
    });
  }

  /**
   * Link attempt to case (only after CaseOpened)
   */
  async linkToCase(
    tenantId: string,
    attemptId: string,
    caseRef: string
  ): Promise<void> {
    await this.prisma.voiceAttempt.updateMany({
      where: {
        tenantId,
        attemptId,
        status: 'AUTHORIZED', // Only link authorized attempts
      },
      data: {
        caseRef,
        updatedAt: new Date(),
      },
    });

    this.logger.debug(`Linked voice attempt to case: ${attemptId}`, {
      tenantId,
      caseRef,
    });
  }

  /**
   * Update attempt from provider webhook (idempotent)
   */
  async updateFromProvider(
    updateData: ProviderUpdateData
  ): Promise<string | null> {
    try {
      const attempt = await this.prisma.voiceAttempt.updateMany({
        where: {
          tenantId: updateData.tenantId,
          provider: updateData.provider,
          providerCallId: updateData.providerCallId,
        },
        data: {
          providerStatus: updateData.providerStatus,
          durationSec: updateData.durationSec,
          recordingUrl: updateData.recordingUrl,
          transcriptRef: updateData.transcriptRef,
          status: this.mapProviderStatusToAttemptStatus(
            updateData.providerStatus
          ),
          updatedAt: new Date(),
        },
      });

      if (attempt.count > 0) {
        this.logger.debug(`Updated voice attempt from provider`, {
          tenantId: updateData.tenantId,
          provider: updateData.provider,
          providerCallId: updateData.providerCallId,
          providerStatus: updateData.providerStatus,
        });

        // Get the updated attempt ID for return
        const updatedAttempt = await this.prisma.voiceAttempt.findFirst({
          where: {
            tenantId: updateData.tenantId,
            provider: updateData.provider,
            providerCallId: updateData.providerCallId,
          },
        });

        return updatedAttempt?.attemptId || null;
      }

      return null; // No attempt found to update
    } catch (error: any) {
      this.logger.error(`Failed to update voice attempt from provider`, {
        tenantId: updateData.tenantId,
        provider: updateData.provider,
        providerCallId: updateData.providerCallId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Mark attempt as executing
   */
  async markExecuting(tenantId: string, attemptId: string): Promise<void> {
    await this.prisma.voiceAttempt.updateMany({
      where: {
        tenantId,
        attemptId,
        status: 'AUTHORIZED',
      },
      data: {
        status: 'EXECUTING',
        updatedAt: new Date(),
      },
    });

    this.logger.debug(`Marked voice attempt as executing: ${attemptId}`, {
      tenantId,
    });
  }

  /**
   * Mark attempt as completed
   */
  async markCompleted(tenantId: string, attemptId: string): Promise<void> {
    await this.prisma.voiceAttempt.updateMany({
      where: {
        tenantId,
        attemptId,
        status: 'EXECUTING',
      },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date(),
      },
    });

    this.logger.debug(`Marked voice attempt as completed: ${attemptId}`, {
      tenantId,
    });
  }

  /**
   * Mark attempt as failed
   */
  async markFailed(
    tenantId: string,
    attemptId: string,
    error: string
  ): Promise<void> {
    await this.prisma.voiceAttempt.updateMany({
      where: {
        tenantId,
        attemptId,
        status: { in: ['AUTHORIZED', 'EXECUTING'] },
      },
      data: {
        status: 'FAILED',
        lastError: error,
        nextAttemptAt: new Date(Date.now() + 30 * 1000), // Retry in 30 seconds
        updatedAt: new Date(),
      },
    });

    this.logger.warn(`Marked voice attempt as failed: ${attemptId}`, {
      tenantId,
      error,
    });
  }

  /**
   * Cancel attempt
   */
  async cancelAttempt(
    tenantId: string,
    attemptId: string,
    reason: string
  ): Promise<void> {
    await this.prisma.voiceAttempt.updateMany({
      where: {
        tenantId,
        attemptId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      data: {
        status: 'CANCELLED',
        lastError: reason,
        updatedAt: new Date(),
      },
    });

    this.logger.debug(`Cancelled voice attempt: ${attemptId}`, {
      tenantId,
      reason,
    });
  }

  /**
   * Claim retryable attempts for processing (multi-instance safe)
   */
  async claimRetryableAttempts(limit: number = 50): Promise<any[]> {
    // Use SKIP LOCKED to prevent multiple instances from claiming the same attempts
    const attempts = await this.prisma.$queryRaw<any[]>`
      UPDATE voice_attempts
      SET
        attempts = attempts + 1,
        nextAttemptAt = NOW() + INTERVAL '30 seconds',
        updatedAt = NOW()
      WHERE id IN (
        SELECT id FROM voice_attempts
        WHERE status = 'FAILED'
          AND attempts < maxRetries
          AND nextAttemptAt <= NOW()
        ORDER BY nextAttemptAt ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        id, tenantId, attemptId, leadId, intentType, correlationId,
        provider, providerCallId, attempts, maxRetries
    `;

    if (attempts.length > 0) {
      this.logger.debug(`Claimed ${attempts.length} voice attempts for retry`);
    }

    return attempts;
  }

  /**
   * Create execution event with idempotency
   */
  async createExecutionEvent(eventData: ExecutionEventData): Promise<string> {
    try {
      const event = await this.prisma.voiceExecutionEvent.create({
        data: {
          tenantId: eventData.tenantId,
          attemptId: eventData.attemptId,
          eventType: eventData.eventType,
          occurredAt: new Date(),
          payloadJson: eventData.payloadJson,
          correlationId: eventData.correlationId,
          idempotencyKey: eventData.idempotencyKey,
        },
      });

      this.logger.debug(`Created voice execution event: ${event.id}`, {
        tenantId: eventData.tenantId,
        attemptId: eventData.attemptId,
        eventType: eventData.eventType,
      });

      return event.id;
    } catch (error: any) {
      // Handle unique constraint violations (idempotency)
      if (error.code === 'P2002') {
        this.logger.debug(`Duplicate voice execution event ignored`, {
          tenantId: eventData.tenantId,
          attemptId: eventData.attemptId,
          eventType: eventData.eventType,
        });

        // Return existing event ID for idempotency
        const existing = await this.prisma.voiceExecutionEvent.findFirst({
          where: {
            tenantId: eventData.tenantId,
            idempotencyKey: eventData.idempotencyKey,
          },
        });

        return existing?.id || 'duplicate-ignored';
      }

      throw error;
    }
  }

  /**
   * Query attempts by tenant and lead
   */
  async queryAttemptsByLead(
    tenantId: string,
    leadId: string,
    limit: number = 50
  ): Promise<any[]> {
    const attempts = await this.prisma.voiceAttempt.findMany({
      where: {
        tenantId,
        leadId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return attempts;
  }

  /**
   * Get attempt by ID
   */
  async getAttemptById(
    tenantId: string,
    attemptId: string
  ): Promise<any | null> {
    const attempt = await this.prisma.voiceAttempt.findFirst({
      where: {
        tenantId,
        attemptId,
      },
    });

    return attempt;
  }

  /**
   * Get attempt statistics for monitoring
   */
  async getAttemptStats(tenantId?: string): Promise<{
    initiated: number;
    authorized: number;
    executing: number;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
  }> {
    const where = tenantId ? { tenantId } : {};

    const stats = await this.prisma.voiceAttempt.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
    });

    const result = {
      initiated: 0,
      authorized: 0,
      executing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
    };

    for (const stat of stats) {
      const count = stat._count.status;
      result.total += count;

      switch (stat.status) {
        case 'INITIATED':
          result.initiated = count;
          break;
        case 'AUTHORIZED':
          result.authorized = count;
          break;
        case 'EXECUTING':
          result.executing = count;
          break;
        case 'COMPLETED':
          result.completed = count;
          break;
        case 'FAILED':
          result.failed = count;
          break;
        case 'CANCELLED':
          result.cancelled = count;
          break;
      }
    }

    return result;
  }

  /**
   * Clean up old completed/cancelled attempts (retention policy)
   */
  async cleanupOldAttempts(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.voiceAttempt.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'CANCELLED'] },
        updatedAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old voice attempts`);
    return result.count;
  }

  /**
   * Clean up old execution events
   */
  async cleanupOldExecutionEvents(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.voiceExecutionEvent.deleteMany({
      where: {
        occurredAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old voice execution events`);
    return result.count;
  }

  /**
   * Map provider status to attempt status
   * Provider statuses are informational only - they don't override NeuronX decisions
   */
  private mapProviderStatusToAttemptStatus(
    providerStatus?: string
  ): string | undefined {
    if (!providerStatus) return undefined;

    // Provider status mapping (informational only, doesn't change authorization)
    switch (providerStatus.toLowerCase()) {
      case 'completed':
      case 'answered':
        return 'COMPLETED';
      case 'failed':
      case 'busy':
      case 'no_answer':
        return 'FAILED';
      case 'in_progress':
      case 'ringing':
        return 'EXECUTING';
      default:
        return undefined; // Don't change status for unknown provider statuses
    }
  }
}
