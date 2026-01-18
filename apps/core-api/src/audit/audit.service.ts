import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly prisma = new PrismaClient();

  async logEvent(
    action: string,
    details: Record<string, any>,
    actorId: string = 'system',
    tenantId?: string
  ): Promise<void> {
    try {
      // Create structured audit log entry
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId,
          actorType: 'system', // webhook, system, user
          action,
          resource: this.extractResourceFromAction(action),
          resourceId: details.resourceId || details.eventId || details.leadId,
          oldValues: details.oldValues,
          newValues: details.newValues,
          changes: details.changes,
          ipAddress: details.ipAddress,
          userAgent: details.userAgent,
          metadata: {
            correlationId: details.correlationId,
            timestamp: new Date().toISOString(),
            ...details.metadata,
          },
        },
      });

      // Structured logging
      this.logger.log(`Audit: ${action}`, {
        actorId,
        tenantId,
        resourceId: details.resourceId || details.eventId || details.leadId,
        correlationId: details.correlationId,
        details: JSON.stringify(details),
      });
    } catch (error) {
      // Don't let audit failures break the main flow
      this.logger.error(`Failed to log audit event: ${action}`, {
        error: error.message,
        details: JSON.stringify(details),
      });
    }
  }

  private extractResourceFromAction(action: string): string {
    if (action.includes('webhook')) return 'webhook';
    if (action.includes('rule')) return 'rule';
    if (action.includes('action')) return 'action';
    if (action.includes('lead')) return 'lead';
    if (action.includes('event')) return 'event';
    if (action.includes('uat')) return 'uat';
    return 'system';
  }

  /**
   * Query audit events with filtering
   */
  async queryEvents(
    tenantId?: string,
    filters: {
      action?: string;
      actorId?: string;
      resource?: string;
      correlationId?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {},
    pagination: { limit?: number; offset?: number } = {}
  ): Promise<{
    events: any[];
    total: number;
  }> {
    try {
      const where: any = {};
      if (tenantId) where.tenantId = tenantId;
      if (filters.action) where.action = { contains: filters.action };
      if (filters.actorId) where.actorId = filters.actorId;
      if (filters.resource) where.resource = filters.resource;
      if (filters.correlationId) {
        where.metadata = {
          path: ['correlationId'],
          equals: filters.correlationId,
        };
      }
      if (filters.fromDate || filters.toDate) {
        where.createdAt = {};
        if (filters.fromDate) where.createdAt.gte = filters.fromDate;
        if (filters.toDate) where.createdAt.lte = filters.toDate;
      }

      const [events, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: pagination.limit || 50,
          skip: pagination.offset || 0,
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return { events, total };
    } catch (error) {
      this.logger.error('Failed to query audit events', error);
      return { events: [], total: 0 };
    }
  }
}
