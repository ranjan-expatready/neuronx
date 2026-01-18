/**
 * Base Adapter - WI-028: Adapter-First Execution Layer
 *
 * Base implementation for execution adapters with hard boundary enforcement.
 * Adapters can only execute side effects, never make decisions or access state.
 */

import {
  ExecutionAdapter,
  ExecutionCommand,
  ExecutionResult,
  ExecutionActionType,
  AdapterCapability,
  BoundaryViolationType,
  BoundaryViolationEvent,
} from '../types/execution.types';

/**
 * Base adapter class that enforces execution boundaries.
 *
 * All adapters must extend this class and implement the executeCommand method.
 * This base class prevents adapters from:
 * - Accessing business state
 * - Making business decisions
 * - Having business logic
 * - Depending on external business rules
 */
export abstract class BaseExecutionAdapter implements ExecutionAdapter {
  abstract name: string;
  abstract supportedActionTypes: ExecutionActionType[];

  /**
   * Check if this adapter supports the action type
   */
  supports(actionType: ExecutionActionType): boolean {
    return this.supportedActionTypes.includes(actionType);
  }

  /**
   * Get adapter capabilities
   */
  getCapabilities(): AdapterCapability[] {
    return this.supportedActionTypes.map(actionType => ({
      actionType,
      supported: true,
      rateLimits: {
        requestsPerMinute: 60, // Default rate limit
        burstLimit: 10,
      },
    }));
  }

  /**
   * Execute the command - enforces boundaries
   */
  async execute(command: ExecutionCommand): Promise<ExecutionResult> {
    const startTime = new Date();

    try {
      // Boundary check: Ensure no state access in payload
      this.enforceExecutionBoundaries(command);

      // Execute the command (implemented by subclasses)
      const result = await this.executeCommand(command);

      return {
        commandId: command.commandId,
        success: result.success,
        externalId: result.externalId,
        errorMessage: result.errorMessage,
        metadata: result.metadata,
        executedAt: new Date(),
      };
    } catch (error) {
      // If it's a boundary violation, re-throw it
      if (error instanceof BoundaryViolationError) {
        throw error;
      }

      // Otherwise, wrap in execution result
      return {
        commandId: command.commandId,
        success: false,
        errorMessage:
          error instanceof Error ? error.message : 'Unknown execution error',
        executedAt: new Date(),
      };
    }
  }

  /**
   * Abstract method that subclasses must implement
   * This is where the actual side effect execution happens
   */
  protected abstract executeCommand(command: ExecutionCommand): Promise<{
    success: boolean;
    externalId?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }>;

  /**
   * Get adapter health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    lastChecked: Date;
  }> {
    // Default implementation - subclasses can override
    return {
      status: 'healthy',
      lastChecked: new Date(),
    };
  }

  /**
   * Hard boundary enforcement
   * Prevents adapters from violating the execution-only contract
   */
  private enforceExecutionBoundaries(command: ExecutionCommand): void {
    // Check for forbidden patterns in payload
    const forbiddenKeys = [
      'state',
      'status',
      'stage',
      'next_action',
      'decision',
      'qualification_score',
      'policy',
      'rule',
      'condition',
    ];

    const payloadKeys = Object.keys(command.payload);
    const forbiddenFound = payloadKeys.filter(key =>
      forbiddenKeys.some(forbidden => key.toLowerCase().includes(forbidden))
    );

    if (forbiddenFound.length > 0) {
      throw new BoundaryViolationError(
        BoundaryViolationType.BUSINESS_LOGIC_IN_ADAPTER,
        `Adapter payload contains business logic keys: ${forbiddenFound.join(', ')}`
      );
    }

    // Check for decision-making patterns
    if (
      command.payload.conditions ||
      command.payload.rules ||
      command.payload.logic
    ) {
      throw new BoundaryViolationError(
        BoundaryViolationType.DECISION_MAKING_IN_ADAPTER,
        'Adapter payload contains decision-making constructs'
      );
    }

    // Check payload size (prevent large business data)
    const payloadSize = JSON.stringify(command.payload).length;
    if (payloadSize > 10000) {
      // 10KB limit
      throw new BoundaryViolationError(
        BoundaryViolationType.EXTERNAL_DEPENDENCY_IN_ADAPTER,
        `Adapter payload too large (${payloadSize} bytes), may contain business data`
      );
    }
  }
}

/**
 * Boundary violation error
 */
export class BoundaryViolationError extends Error {
  constructor(
    public violationType: BoundaryViolationType,
    message: string,
    public commandId?: string,
    public adapterName?: string
  ) {
    super(message);
    this.name = 'BoundaryViolationError';
  }
}

/**
 * Creates a boundary violation event from an error
 */
export function createBoundaryViolationEvent(
  error: BoundaryViolationError,
  command: ExecutionCommand
): BoundaryViolationEvent {
  return {
    eventType: 'adapter_boundary_violation',
    tenantId: command.tenantId,
    leadId: command.leadId,
    commandId: command.commandId,
    adapterName: error.adapterName || 'unknown',
    violationType: error.violationType,
    details: error.message,
    correlationId: command.correlationId,
    timestamp: new Date(),
  };
}
