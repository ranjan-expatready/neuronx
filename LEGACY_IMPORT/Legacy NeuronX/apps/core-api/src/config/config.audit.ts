/**
 * Configuration Audit Stub - REQ-019: Configuration as IP
 *
 * Audit hook for configuration changes. Currently emits events only.
 * TODO: Implement persistence layer for audit trails.
 */

import { ConfigAuditEvent } from './config.types';

/**
 * Configuration audit service stub
 * Emits audit events but does not persist them yet.
 */
export class ConfigAuditService {
  private events: ConfigAuditEvent[] = [];

  /**
   * Emit audit event for configuration operation
   * Includes tenant isolation for multi-tenant audit trails
   */
  async emitAuditEvent(event: ConfigAuditEvent): Promise<void> {
    // Validate tenantId is present
    if (!event.tenantId || typeof event.tenantId !== 'string') {
      throw new Error('tenantId is required for audit events');
    }

    // Store in memory for now (TODO: persist to database)
    this.events.push(event);

    // TODO: Integrate with EventBus for proper event emission
    console.log('CONFIG AUDIT EVENT:', {
      type: event.eventType,
      configId: event.configId,
      tenantId: event.tenantId,
      version: event.version,
      timestamp: event.timestamp,
      changes: event.changes?.length || 0,
    });

    // In future: await this.eventBus.emit('config.audit', event);
  }

  /**
   * Get recent audit events (for testing only)
   * TODO: Remove this method when persistence is implemented
   */
  getRecentEvents(limit = 10): ConfigAuditEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Clear audit events (for testing only)
   * TODO: Remove this method when persistence is implemented
   */
  clearEvents(): void {
    this.events = [];
  }
}

/**
 * Global audit service instance
 * TODO: Replace with dependency injection
 */
export const configAuditService = new ConfigAuditService();
