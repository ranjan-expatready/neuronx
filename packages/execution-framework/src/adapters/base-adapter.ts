/**
 * Base Execution Adapter - WI-028: Adapter-First Execution Layer
 *
 * Abstract base class for all execution adapters.
 * Enforces stateless execution and boundary discipline.
 */

import {
  ExecutionAdapter,
  ExecutionCommand,
  ExecutionResult,
  ExecutionActionType,
  AdapterCapabilities,
  BoundaryViolation,
  ExecutionCommandSchema,
} from '../types';

/**
 * Abstract base adapter providing common functionality
 *
 * All adapters must extend this class and implement the execute method.
 * This ensures consistent behavior and boundary enforcement.
 */
export abstract class BaseExecutionAdapter implements ExecutionAdapter {
  protected readonly name: string;
  protected readonly version: string;
  protected readonly supportedActions: ExecutionActionType[];

  constructor(
    name: string,
    version: string,
    supportedActions: ExecutionActionType[]
  ) {
    this.name = name;
    this.version = version;
    this.supportedActions = supportedActions;
  }

  /**
   * Get adapter capabilities
   */
  getCapabilities(): AdapterCapabilities {
    return {
      name: this.name,
      version: this.version,
      supportedActionTypes: [...this.supportedActions],
      rateLimits: {
        requestsPerMinute: 100, // Default rate limit
        burstLimit: 10,
      },
    };
  }

  /**
   * Check if adapter supports the given action type
   */
  supports(actionType: ExecutionActionType): boolean {
    return this.supportedActions.includes(actionType);
  }

  /**
   * Execute the command - must be implemented by subclasses
   */
  abstract execute(command: ExecutionCommand): Promise<ExecutionResult>;

  /**
   * Validate command before execution
   * Subclasses can override for action-specific validation
   */
  protected validateCommand(command: ExecutionCommand): {
    isValid: boolean;
    error?: string;
  } {
    try {
      ExecutionCommandSchema.parse(command);
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error:
          error instanceof Error ? error.message : 'Invalid command format',
      };
    }
  }

  /**
   * Create a standardized execution result
   */
  protected createResult(
    success: boolean,
    commandId: string,
    externalId?: string,
    error?: string,
    metadata?: Record<string, any>
  ): ExecutionResult {
    return {
      success,
      commandId,
      externalId,
      error,
      metadata,
      timestamp: new Date(),
    };
  }

  /**
   * Detect boundary violations - adapters must not:
   * - Read or modify business state
   * - Make decisions or apply logic
   * - Call external APIs beyond their execution scope
   * - Branch based on conditions
   */
  protected detectBoundaryViolations(
    command: ExecutionCommand
  ): BoundaryViolation[] {
    const violations: BoundaryViolation[] = [];

    // Check for state-related keywords in payload (indicates state reading)
    const payloadString = JSON.stringify(command.payload).toLowerCase();
    const stateKeywords = [
      'state',
      'status',
      'stage',
      'phase',
      'current',
      'previous',
    ];

    for (const keyword of stateKeywords) {
      if (payloadString.includes(keyword)) {
        violations.push({
          type: 'state_read',
          details: `Payload contains state-related keyword: ${keyword}`,
          severity: 'high',
          adapterName: this.name,
          commandId: command.commandId,
        });
      }
    }

    // Check for decision logic keywords
    const decisionKeywords = [
      'if',
      'then',
      'else',
      'when',
      'unless',
      'condition',
    ];
    for (const keyword of decisionKeywords) {
      if (payloadString.includes(keyword)) {
        violations.push({
          type: 'decision_logic',
          details: `Payload contains decision logic keyword: ${keyword}`,
          severity: 'critical',
          adapterName: this.name,
          commandId: command.commandId,
        });
      }
    }

    // Check for branching constructs
    if (payloadString.includes('branch') || payloadString.includes('route')) {
      violations.push({
        type: 'conditional_branching',
        details: 'Payload contains branching logic',
        severity: 'critical',
        adapterName: this.name,
        commandId: command.commandId,
      });
    }

    return violations;
  }

  /**
   * Log execution attempt for audit purposes
   */
  protected logExecution(
    command: ExecutionCommand,
    result: ExecutionResult
  ): void {
    const logEntry = {
      adapter: this.name,
      commandId: command.commandId,
      actionType: command.actionType,
      tenantId: command.tenantId,
      leadId: command.leadId,
      correlationId: command.correlationId,
      success: result.success,
      externalId: result.externalId,
      error: result.error,
      timestamp: result.timestamp,
    };

    // In production, this would go to structured logging
    console.log(`[ExecutionAdapter:${this.name}]`, JSON.stringify(logEntry));
  }

  /**
   * Ensure adapter idempotency based on commandId
   * Subclasses should implement their own idempotency tracking
   */
  protected async ensureIdempotency(commandId: string): Promise<boolean> {
    // Basic in-memory idempotency for skeleton implementation
    // In production, this would use Redis or database
    const executedCommands = (global as any).__executedCommands || new Set();
    if (executedCommands.has(commandId)) {
      return true; // Already executed
    }
    executedCommands.add(commandId);
    (global as any).__executedCommands = executedCommands;
    return false; // First execution
  }
}
