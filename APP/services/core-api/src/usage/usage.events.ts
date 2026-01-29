/**
 * Usage Events - REQ-019: Configuration as IP
 *
 * Usage event definitions for tracking tenant-level usage across monetized domains.
 * Services emit usage events to enable metering and entitlement enforcement.
 */

import { UsageEvent, UsageMetric, UsageEventBatch } from './usage.types';

/**
 * Usage event types
 * These are the authorized usage event types in the system
 */
export type UsageEventType =
  | 'usage.occurred' // Individual usage event
  | 'usage.batch.processed' // Batch of usage events processed
  | 'usage.threshold.exceeded' // Usage threshold exceeded
  | 'usage.report.generated' // Usage report generated
  | 'usage.aggregate.updated'; // Usage aggregate updated

/**
 * Usage event emitter
 * Ensures consistent event structure for usage tracking
 */
export class UsageEventEmitter {
  /**
   * Emit usage occurred event
   * This is the primary event for tracking individual usage occurrences
   */
  static emitUsageOccurred(
    tenantId: string,
    metric: UsageMetric,
    quantity: number = 1,
    correlationId: string,
    sourceService: string,
    metadata?: Record<string, any>
  ): UsageEvent {
    return {
      eventId: crypto.randomUUID(),
      tenantId,
      metric,
      quantity,
      timestamp: new Date().toISOString(),
      correlationId,
      metadata,
      sourceService,
    };
  }

  /**
   * Emit lead processed usage event
   * Convenience method for lead processing tracking
   */
  static emitLeadProcessed(
    tenantId: string,
    leadId: string,
    correlationId: string,
    sourceService: string,
    metadata?: Record<string, any>
  ): UsageEvent {
    return this.emitUsageOccurred(
      tenantId,
      'leads.processed',
      1,
      correlationId,
      sourceService,
      {
        leadId,
        ...metadata,
      }
    );
  }

  /**
   * Emit routing decision usage event
   * Convenience method for routing decision tracking
   */
  static emitRoutingDecision(
    tenantId: string,
    leadId: string,
    teamId: string,
    correlationId: string,
    sourceService: string,
    metadata?: Record<string, any>
  ): UsageEvent {
    return this.emitUsageOccurred(
      tenantId,
      'routing.decisions',
      1,
      correlationId,
      sourceService,
      {
        leadId,
        teamId,
        ...metadata,
      }
    );
  }

  /**
   * Emit SLA timer started usage event
   * Convenience method for SLA timer tracking
   */
  static emitSLATimerStarted(
    tenantId: string,
    leadId: string,
    slaHours: number,
    correlationId: string,
    sourceService: string,
    metadata?: Record<string, any>
  ): UsageEvent {
    return this.emitUsageOccurred(
      tenantId,
      'sla.timers.started',
      1,
      correlationId,
      sourceService,
      {
        leadId,
        slaHours,
        ...metadata,
      }
    );
  }

  /**
   * Emit voice minutes authorized usage event
   * Convenience method for voice usage tracking
   */
  static emitVoiceMinutesAuthorized(
    tenantId: string,
    minutes: number,
    callId: string,
    correlationId: string,
    sourceService: string,
    metadata?: Record<string, any>
  ): UsageEvent {
    return this.emitUsageOccurred(
      tenantId,
      'voice.minutes.authorized',
      minutes,
      correlationId,
      sourceService,
      {
        callId,
        minutes,
        ...metadata,
      }
    );
  }

  /**
   * Emit API request usage event
   * Convenience method for API usage tracking
   */
  static emitAPIRequest(
    tenantId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    correlationId: string,
    sourceService: string,
    metadata?: Record<string, any>
  ): UsageEvent {
    const metric: UsageMetric =
      statusCode >= 200 && statusCode < 300
        ? 'api.requests.successful'
        : 'api.requests.failed';

    return this.emitUsageOccurred(
      tenantId,
      metric,
      1,
      correlationId,
      sourceService,
      {
        endpoint,
        method,
        statusCode,
        ...metadata,
      }
    );
  }

  /**
   * Emit scoring request usage event
   * Convenience method for scoring usage tracking
   */
  static emitScoringRequest(
    tenantId: string,
    leadId: string,
    modelUsed: string,
    correlationId: string,
    sourceService: string,
    metadata?: Record<string, any>
  ): UsageEvent {
    return this.emitUsageOccurred(
      tenantId,
      'scoring.requests',
      1,
      correlationId,
      sourceService,
      {
        leadId,
        modelUsed,
        ...metadata,
      }
    );
  }
}

/**
 * Usage event validation helpers
 * Ensure events conform to security and business requirements
 */
export class UsageEventValidator {
  /**
   * Validate usage event before emission
   * Ensures events contain required information and are well-formed
   */
  static validateUsageEvent(event: UsageEvent): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required fields
    if (!event.eventId || typeof event.eventId !== 'string') {
      errors.push('eventId is required and must be a string');
    }

    if (!event.tenantId || typeof event.tenantId !== 'string') {
      errors.push('tenantId is required and must be a string');
    }

    if (!event.metric || typeof event.metric !== 'string') {
      errors.push('metric is required and must be a string');
    }

    if (typeof event.quantity !== 'number' || event.quantity < 0) {
      errors.push('quantity must be a non-negative number');
    }

    if (!event.timestamp || typeof event.timestamp !== 'string') {
      errors.push('timestamp is required and must be a string');
    }

    if (!event.correlationId || typeof event.correlationId !== 'string') {
      errors.push('correlationId is required and must be a string');
    }

    if (!event.sourceService || typeof event.sourceService !== 'string') {
      errors.push('sourceService is required and must be a string');
    }

    // Validate timestamp format
    try {
      new Date(event.timestamp);
    } catch {
      errors.push('timestamp must be a valid ISO date string');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate usage event batch
   * Ensures batch contains valid events and is well-formed
   */
  static validateUsageEventBatch(batch: UsageEventBatch): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required fields
    if (!batch.batchId || typeof batch.batchId !== 'string') {
      errors.push('batchId is required and must be a string');
    }

    if (!Array.isArray(batch.events)) {
      errors.push('events must be an array');
    } else {
      // Validate each event in the batch
      batch.events.forEach((event, index) => {
        const eventValidation = this.validateUsageEvent(event);
        if (!eventValidation.valid) {
          errors.push(`Event ${index}: ${eventValidation.errors.join(', ')}`);
        }
      });
    }

    if (!batch.createdAt || typeof batch.createdAt !== 'string') {
      errors.push('createdAt is required and must be a string');
    }

    // Validate createdAt format
    try {
      new Date(batch.createdAt);
    } catch {
      errors.push('createdAt must be a valid ISO date string');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Usage event batch builder
 * Helps construct batches of usage events for efficient processing
 */
export class UsageEventBatchBuilder {
  private events: UsageEvent[] = [];
  private batchId: string;

  constructor() {
    this.batchId = crypto.randomUUID();
  }

  /**
   * Add an event to the batch
   */
  addEvent(event: UsageEvent): UsageEventBatchBuilder {
    this.events.push(event);
    return this;
  }

  /**
   * Add multiple events to the batch
   */
  addEvents(events: UsageEvent[]): UsageEventBatchBuilder {
    this.events.push(...events);
    return this;
  }

  /**
   * Build the event batch
   */
  build(): UsageEventBatch {
    return {
      batchId: this.batchId,
      events: [...this.events],
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
  }

  /**
   * Get current batch size
   */
  size(): number {
    return this.events.length;
  }

  /**
   * Clear the batch
   */
  clear(): void {
    this.events = [];
    this.batchId = crypto.randomUUID();
  }
}
