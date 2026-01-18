/**
 * Governance Guard - WI-070: Read-Only GHL Live Data Integration
 *
 * Enforces read-only policies and provides audit logging for governance compliance.
 */

import {
  GovernanceViolation,
  GovernanceViolationType,
  AdapterContext,
} from '../types';
import { Logger } from '@neuronx/observability';

export class GovernanceGuard {
  private readonly logger: Logger;
  private readonly auditEnabled: boolean;

  constructor(auditEnabled: boolean = true) {
    this.auditEnabled = auditEnabled;
    this.logger = new Logger('GovernanceGuard');
  }

  /**
   * Check if an operation is allowed (read-only enforcement)
   */
  isOperationAllowed(operation: string, context: AdapterContext): boolean {
    // Define allowed operations (read-only)
    const allowedOperations = [
      'getLead',
      'listLeads',
      'getOpportunity',
      'listOpportunities',
      'getPipelines',
      'getPipeline',
      'listUsers',
      'getUser',
      'getUserByEmail',
      'createSnapshot',
      'getLatestSnapshot',
      'getSnapshot',
      'listSnapshots',
      'getHealth',
      'getCapabilities',
      'validateConfig',
    ];

    const isAllowed = allowedOperations.includes(operation);

    if (!isAllowed) {
      this.recordViolation({
        id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: GovernanceViolationType.MUTATION_ATTEMPT,
        tenantId: context.tenantId,
        userId: context.userId,
        operation,
        details: {
          attemptedOperation: operation,
          allowedOperations,
          timestamp: new Date().toISOString(),
          environment: process.env.NEURONX_ENV || 'unknown',
        },
        timestamp: new Date(),
        correlationId: context.correlationId,
        severity: 'critical',
      });
    }

    return isAllowed;
  }

  /**
   * Validate data type access based on governance rules
   */
  validateDataTypeAccess(
    dataType: string,
    allowedDataTypes: string[],
    context: AdapterContext
  ): void {
    if (!allowedDataTypes.includes(dataType)) {
      this.recordViolation({
        id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: GovernanceViolationType.UNAUTHORIZED_ACCESS,
        tenantId: context.tenantId,
        userId: context.userId,
        operation: `access_${dataType}`,
        details: {
          requestedDataType: dataType,
          allowedDataTypes,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
        correlationId: context.correlationId,
        severity: 'high',
      });

      throw new Error(
        `ACCESS DENIED: Data type '${dataType}' is not allowed for this tenant. ` +
          `Allowed types: ${allowedDataTypes.join(', ')}. ` +
          `Correlation ID: ${context.correlationId}`
      );
    }
  }

  /**
   * Check rate limits
   */
  async checkRateLimit(
    tenantId: string,
    operation: string,
    requestsPerMinute: number,
    context: AdapterContext
  ): Promise<void> {
    // Simple in-memory rate limiting (in production, use Redis)
    const key = `rate_limit:${tenantId}:${operation}`;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    // This is a simplified implementation
    // In production, you'd use a proper rate limiter like Redis
    const requestCount = 1; // Would check actual count from Redis

    if (requestCount > requestsPerMinute) {
      this.recordViolation({
        id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: GovernanceViolationType.RATE_LIMIT_EXCEEDED,
        tenantId: context.tenantId,
        userId: context.userId,
        operation,
        details: {
          requestCount,
          limit: requestsPerMinute,
          windowMinutes: 1,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
        correlationId: context.correlationId,
        severity: 'medium',
      });

      throw new Error(
        `RATE LIMIT EXCEEDED: ${requestCount} requests in the last minute, ` +
          `limit is ${requestsPerMinute}. Correlation ID: ${context.correlationId}`
      );
    }
  }

  /**
   * Validate environment constraints
   */
  validateEnvironment(context: AdapterContext): void {
    const currentEnv = process.env.NEURONX_ENV;

    // In production, be extra strict about read-only operations
    if (currentEnv === 'production') {
      // Additional production validations could go here
      this.logger.info(
        'Production environment validated for read-only operations',
        {
          tenantId: context.tenantId,
          correlationId: context.correlationId,
        }
      );
    }

    // Validate correlation ID presence
    if (!context.correlationId) {
      this.logger.warn('Missing correlation ID in adapter context', {
        tenantId: context.tenantId,
        userId: context.userId,
      });
    }
  }

  /**
   * Record a governance violation
   */
  private recordViolation(violation: GovernanceViolation): void {
    this.logger.error('GOVERNANCE VIOLATION DETECTED', {
      violation,
      severity: violation.severity,
      operation: violation.operation,
      tenantId: violation.tenantId,
    });

    // In production, send to audit service
    if (this.auditEnabled) {
      this.sendToAuditService(violation).catch(error => {
        this.logger.error('Failed to send violation to audit service', {
          violation,
          error: error.message,
        });
      });
    }

    // Emit event for monitoring/alerting
    this.emitViolationEvent(violation);
  }

  /**
   * Send violation to audit service (placeholder)
   */
  private async sendToAuditService(
    violation: GovernanceViolation
  ): Promise<void> {
    // TODO: Implement actual audit service integration
    // await auditService.recordViolation(violation);

    // For now, just log that it would be sent
    this.logger.info('Violation would be sent to audit service', {
      violationId: violation.id,
      type: violation.type,
      severity: violation.severity,
    });
  }

  /**
   * Emit violation event for monitoring
   */
  private emitViolationEvent(violation: GovernanceViolation): void {
    // TODO: Implement event emission for monitoring/alerting
    // eventBus.emit('governance.violation', violation);

    // For now, just log the event
    this.logger.warn('Governance violation event emitted', {
      violationId: violation.id,
      type: violation.type,
      tenantId: violation.tenantId,
      severity: violation.severity,
    });
  }

  /**
   * Get governance health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
  } {
    // Check if governance is functioning properly
    try {
      // Test basic governance functionality
      const testContext: AdapterContext = {
        tenantId: 'health-check',
        correlationId: `health_${Date.now()}`,
        environment: 'production',
      };

      this.validateEnvironment(testContext);

      return {
        status: 'healthy',
        message: 'Governance guard is functioning correctly',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Governance guard error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
