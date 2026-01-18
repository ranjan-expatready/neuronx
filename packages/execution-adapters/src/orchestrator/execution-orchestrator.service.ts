/**
 * Execution Orchestrator Service - WI-028: Adapter-First Execution Layer
 *
 * Orchestrates execution commands with validation and audit.
 * Ensures NeuronX decides, adapters only execute.
 */

import { Injectable } from '@nestjs/common';
import { EventPublisher } from '../../../eventing';
import { SalesStateMachine, LeadState } from '../../../domain';
import {
  ExecutionCommand,
  ExecutionResult,
  ExecutionValidation,
  ExecutionEvent,
  ExecutionEventType,
  ExecutionAdapter,
  ExecutionActionType,
} from '../types/execution.types';
import {
  BoundaryViolationError,
  createBoundaryViolationEvent,
} from '../adapters/base-adapter';

@Injectable()
export class ExecutionOrchestratorService {
  private adapters: Map<ExecutionActionType, ExecutionAdapter> = new Map();

  constructor(
    private readonly stateMachine: SalesStateMachine,
    private readonly eventPublisher: EventPublisher
    // TODO: Inject capability resolver and billing guard
    // private readonly capabilityResolver: GhlCapabilityResolver,
    // private readonly billingGuard: BillingGuard
  ) {}

  /**
   * Register an adapter for an action type
   */
  registerAdapter(
    actionType: ExecutionActionType,
    adapter: ExecutionAdapter
  ): void {
    this.adapters.set(actionType, adapter);
  }

  /**
   * Execute a command with full validation and audit
   */
  async executeCommand(command: ExecutionCommand): Promise<ExecutionResult> {
    const startTime = new Date();

    try {
      // Emit execution attempted event
      await this.emitEvent({
        eventType: ExecutionEventType.EXECUTION_ATTEMPTED,
        tenantId: command.tenantId,
        leadId: command.leadId,
        commandId: command.commandId,
        actionType: command.actionType,
        adapterName: 'orchestrator', // Will be updated when adapter is selected
        correlationId: command.correlationId,
        timestamp: startTime,
      });

      // Validate the command
      const validation = await this.validateCommand(command);
      if (!validation.isValid) {
        await this.emitEvent({
          eventType: ExecutionEventType.EXECUTION_FAILED,
          tenantId: command.tenantId,
          leadId: command.leadId,
          commandId: command.commandId,
          actionType: command.actionType,
          adapterName: 'orchestrator',
          correlationId: command.correlationId,
          timestamp: new Date(),
          success: false,
          errorMessage: validation.reason,
        });

        return {
          commandId: command.commandId,
          success: false,
          errorMessage: validation.reason,
          executedAt: new Date(),
        };
      }

      // Get the appropriate adapter
      const adapter = this.adapters.get(command.actionType);
      if (!adapter) {
        const errorMsg = `No adapter registered for action type: ${command.actionType}`;
        await this.emitEvent({
          eventType: ExecutionEventType.EXECUTION_FAILED,
          tenantId: command.tenantId,
          leadId: command.leadId,
          commandId: command.commandId,
          actionType: command.actionType,
          adapterName: 'unknown',
          correlationId: command.correlationId,
          timestamp: new Date(),
          success: false,
          errorMessage: errorMsg,
        });

        return {
          commandId: command.commandId,
          success: false,
          errorMessage: errorMsg,
          executedAt: new Date(),
        };
      }

      // Execute through adapter with boundary enforcement
      const result = await this.executeThroughAdapter(command, adapter);

      // Emit success/failure event
      await this.emitEvent({
        eventType: result.success
          ? ExecutionEventType.EXECUTION_SUCCEEDED
          : ExecutionEventType.EXECUTION_FAILED,
        tenantId: command.tenantId,
        leadId: command.leadId,
        commandId: command.commandId,
        actionType: command.actionType,
        adapterName: adapter.name,
        correlationId: command.correlationId,
        timestamp: new Date(),
        success: result.success,
        errorMessage: result.errorMessage,
        externalId: result.externalId,
        metadata: result.metadata,
      });

      return result;
    } catch (error) {
      // Handle boundary violations specially
      if (error instanceof BoundaryViolationError) {
        await this.emitBoundaryViolationEvent(error, command);
        throw error; // Re-throw boundary violations
      }

      // Handle other errors
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown execution error';
      await this.emitEvent({
        eventType: ExecutionEventType.EXECUTION_FAILED,
        tenantId: command.tenantId,
        leadId: command.leadId,
        commandId: command.commandId,
        actionType: command.actionType,
        adapterName: 'orchestrator',
        correlationId: command.correlationId,
        timestamp: new Date(),
        success: false,
        errorMessage: errorMsg,
      });

      return {
        commandId: command.commandId,
        success: false,
        errorMessage: errorMsg,
        executedAt: new Date(),
      };
    }
  }

  /**
   * Validate a command before execution
   */
  private async validateCommand(
    command: ExecutionCommand
  ): Promise<ExecutionValidation> {
    // TODO: Get current lead state - for now assume we have it
    // This would come from a lead repository or cache
    const currentState = LeadState.CONTACTED; // Placeholder

    // 1. Validate FSM state allows this action
    if (!this.isActionAllowedInState(command.actionType, currentState)) {
      return {
        isValid: false,
        reason: `Action ${command.actionType} not allowed in state ${currentState}`,
        blockedBy: 'fsm_state',
      };
    }

    // 2. Validate capability (placeholder - would check GHL capability policy)
    // TODO: Integrate with GhlCapabilityResolver
    // const hasCapability = await this.capabilityResolver.hasCapability(
    //   command.tenantId,
    //   this.mapActionToCapability(command.actionType)
    // );
    // if (!hasCapability) {
    //   return {
    //     isValid: false,
    //     reason: 'Capability not allowed for this tenant/plan',
    //     blockedBy: 'capability'
    //   };
    // }

    // 3. Validate billing entitlement (placeholder - would check usage limits)
    // TODO: Integrate with BillingGuard
    // const billingAllowed = await this.billingGuard.checkExecutionAllowed(
    //   command.tenantId,
    //   command.actionType
    // );
    // if (!billingAllowed.allowed) {
    //   return {
    //     isValid: false,
    //     reason: billingAllowed.reason,
    //     blockedBy: 'billing'
    //   };
    // }

    // 4. Validate adapter availability
    const adapter = this.adapters.get(command.actionType);
    if (!adapter) {
      return {
        isValid: false,
        reason: `No adapter available for action type: ${command.actionType}`,
        blockedBy: 'policy',
      };
    }

    return {
      isValid: true,
      reason: 'Command is valid for execution',
    };
  }

  /**
   * Check if an action is allowed in the current FSM state
   */
  private isActionAllowedInState(
    actionType: ExecutionActionType,
    currentState: LeadState
  ): boolean {
    // Map action types to required state conditions
    // This is a simplified mapping - in reality would be more sophisticated
    switch (actionType) {
      case ExecutionActionType.SEND_SMS:
      case ExecutionActionType.SEND_EMAIL:
      case ExecutionActionType.MAKE_CALL:
        // Communication actions allowed in most active states
        return [
          LeadState.NEW,
          LeadState.ACK_SENT,
          LeadState.CONTACT_ATTEMPTING,
          LeadState.CONTACTED,
          LeadState.QUALIFIED,
          LeadState.BOOKING_PENDING,
          LeadState.BOOKED,
        ].includes(currentState);

      case ExecutionActionType.UPDATE_CRM:
        // CRM updates allowed in all states
        return true;

      case ExecutionActionType.BOOK_CALENDAR:
        // Calendar booking typically for qualified leads
        return [
          LeadState.QUALIFIED,
          LeadState.BOOKING_PENDING,
          LeadState.BOOKED,
        ].includes(currentState);

      default:
        return false;
    }
  }

  /**
   * Execute command through adapter with boundary enforcement
   */
  private async executeThroughAdapter(
    command: ExecutionCommand,
    adapter: ExecutionAdapter
  ): Promise<ExecutionResult> {
    try {
      return await adapter.execute(command);
    } catch (error) {
      // If it's a boundary violation, emit special event
      if (error instanceof BoundaryViolationError) {
        await this.emitBoundaryViolationEvent(error, command);
      }
      throw error;
    }
  }

  /**
   * Emit execution event
   */
  private async emitEvent(event: ExecutionEvent): Promise<void> {
    try {
      const neuronxEvent = {
        id: `execution_${event.commandId}_${Date.now()}`,
        type: event.eventType,
        tenantId: event.tenantId,
        correlationId: event.correlationId,
        timestamp: event.timestamp,
        payload: {
          leadId: event.leadId,
          commandId: event.commandId,
          actionType: event.actionType,
          adapterName: event.adapterName,
          success: event.success,
          errorMessage: event.errorMessage,
          externalId: event.externalId,
          metadata: event.metadata,
        },
        metadata: {
          source: 'execution-orchestrator-service',
          version: '1.0.0',
        },
      };

      await this.eventPublisher.publish(neuronxEvent);
    } catch (error) {
      // Log but don't fail execution
      console.error('Failed to emit execution event:', error);
    }
  }

  /**
   * Emit boundary violation event
   */
  private async emitBoundaryViolationEvent(
    error: BoundaryViolationError,
    command: ExecutionCommand
  ): Promise<void> {
    try {
      const violationEvent = createBoundaryViolationEvent(error, command);
      const neuronxEvent = {
        id: `violation_${command.commandId}_${Date.now()}`,
        type: violationEvent.eventType,
        tenantId: violationEvent.tenantId,
        correlationId: violationEvent.correlationId,
        timestamp: violationEvent.timestamp,
        payload: {
          leadId: violationEvent.leadId,
          commandId: violationEvent.commandId,
          adapterName: violationEvent.adapterName,
          violationType: violationEvent.violationType,
          details: violationEvent.details,
        },
        metadata: {
          source: 'execution-orchestrator-service',
          version: '1.0.0',
          severity: 'high',
        },
      };

      await this.eventPublisher.publish(neuronxEvent);
    } catch (emitError) {
      // Last resort logging
      console.error('Failed to emit boundary violation event:', emitError);
    }
  }

  /**
   * Get registered adapters (for testing/debugging)
   */
  getRegisteredAdapters(): Map<ExecutionActionType, ExecutionAdapter> {
    return new Map(this.adapters);
  }

  /**
   * Map action type to capability (placeholder)
   */
  private mapActionToCapability(actionType: ExecutionActionType): string {
    // Placeholder mapping - would be part of capability policy
    switch (actionType) {
      case ExecutionActionType.SEND_SMS:
        return 'SMS_SEND';
      case ExecutionActionType.SEND_EMAIL:
        return 'EMAIL_SEND';
      case ExecutionActionType.MAKE_CALL:
        return 'VOICE_CALL';
      case ExecutionActionType.BOOK_CALENDAR:
        return 'CALENDAR_BOOK';
      case ExecutionActionType.UPDATE_CRM:
        return 'CRM_UPDATE';
      default:
        return 'UNKNOWN';
    }
  }
}
