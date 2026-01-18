/**
 * Audit Service - WI-022: Access Control & API Key Governance
 *
 * Logs security and access events for compliance and monitoring.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditEvent, AuditLogRecord } from './authz.types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Log an audit event (fire-and-forget)
   */
  async logEvent(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: event.tenantId,
          actorType: event.actor.type,
          actorId: event.actor.id,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          correlationId: event.correlationId,
          ip: event.ip,
          userAgent: event.userAgent,
        },
      });

      this.logger.debug('Audit event logged', {
        tenantId: event.tenantId,
        actorId: event.actor.id,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        correlationId: event.correlationId,
      });
    } catch (error) {
      // Log locally but don't throw - audit logging should never break business operations
      this.logger.error('Failed to log audit event', {
        tenantId: event.tenantId,
        actorId: event.actor?.id,
        action: event.action,
        error: error.message,
      });
    }
  }

  /**
   * Log API key creation
   */
  async logApiKeyCreated(
    actor: any,
    apiKeyId: string,
    apiKeyName: string,
    correlationId?: string
  ): Promise<void> {
    await this.logEvent({
      tenantId: actor.tenantId,
      actor,
      action: 'apikey.create',
      resourceType: 'apikey',
      resourceId: apiKeyId,
      correlationId,
    });
  }

  /**
   * Log API key rotation
   */
  async logApiKeyRotated(
    actor: any,
    apiKeyId: string,
    correlationId?: string
  ): Promise<void> {
    await this.logEvent({
      tenantId: actor.tenantId,
      actor,
      action: 'apikey.rotate',
      resourceType: 'apikey',
      resourceId: apiKeyId,
      correlationId,
    });
  }

  /**
   * Log API key revocation
   */
  async logApiKeyRevoked(
    actor: any,
    apiKeyId: string,
    correlationId?: string
  ): Promise<void> {
    await this.logEvent({
      tenantId: actor.tenantId,
      actor,
      action: 'apikey.revoke',
      resourceType: 'apikey',
      resourceId: apiKeyId,
      correlationId,
    });
  }

  /**
   * Log API key usage
   */
  async logApiKeyUsed(
    actor: any,
    action: string,
    correlationId?: string
  ): Promise<void> {
    await this.logEvent({
      tenantId: actor.tenantId,
      actor,
      action,
      correlationId,
    });
  }

  /**
   * Log permission denied
   */
  async logPermissionDenied(
    actor: any,
    requiredPermissions: string[],
    action: string,
    resourceType?: string,
    resourceId?: string,
    correlationId?: string
  ): Promise<void> {
    await this.logEvent({
      tenantId: actor.tenantId,
      actor,
      action: `denied.${action}`,
      resourceType,
      resourceId,
      correlationId,
    });
  }

  /**
   * Query audit logs for tenant
   */
  async queryLogs(
    tenantId: string,
    filters: {
      actorId?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      correlationId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<AuditLogRecord[]> {
    const where: any = { tenantId };

    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.action) where.action = filters.action;
    if (filters.resourceType) where.resourceType = filters.resourceType;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.correlationId) where.correlationId = filters.correlationId;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
    });

    return logs.map(this.mapPrismaToAuditLog);
  }

  /**
   * Get audit statistics for tenant
   */
  async getAuditStats(
    tenantId: string,
    days: number = 30
  ): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    eventsByActor: Record<string, number>;
    recentFailedAuth: number;
  }> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate },
      },
      select: {
        action: true,
        actorId: true,
      },
    });

    const stats = {
      totalEvents: logs.length,
      eventsByAction: {} as Record<string, number>,
      eventsByActor: {} as Record<string, number>,
      recentFailedAuth: 0,
    };

    for (const log of logs) {
      // Count by action
      stats.eventsByAction[log.action] =
        (stats.eventsByAction[log.action] || 0) + 1;

      // Count by actor
      stats.eventsByActor[log.actorId] =
        (stats.eventsByActor[log.actorId] || 0) + 1;

      // Count failed auth attempts
      if (log.action.startsWith('denied.') || log.action === 'apikey.invalid') {
        stats.recentFailedAuth++;
      }
    }

    return stats;
  }

  /**
   * Clean up old audit logs (retention policy)
   */
  async cleanupOldLogs(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000
    );

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old audit logs`, {
      retentionDays,
      cutoffDate,
    });

    return result.count;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private mapPrismaToAuditLog(prismaLog: any): AuditLogRecord {
    return {
      id: prismaLog.id,
      tenantId: prismaLog.tenantId,
      actorType: prismaLog.actorType,
      actorId: prismaLog.actorId,
      action: prismaLog.action,
      resourceType: prismaLog.resourceType,
      resourceId: prismaLog.resourceId,
      correlationId: prismaLog.correlationId,
      ip: prismaLog.ip,
      userAgent: prismaLog.userAgent,
      createdAt: prismaLog.createdAt,
    };
  }
}
