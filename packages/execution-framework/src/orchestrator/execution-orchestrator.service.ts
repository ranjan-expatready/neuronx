/**
 * Execution Orchestrator Service - WI-028: Adapter-First Execution Layer
 *
 * Central orchestrator that validates commands and routes them to adapters.
 * Ensures NeuronX authority over all execution while maintaining auditability.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventPublisher } from '../../../eventing';
import { SalesStateMachine } from '../../../domain';
import { UatGuardService, UatExecutionMode } from '@neuronx/uat-harness';
import {
  ExecutionCommand,
  ExecutionResult,
  ExecutionAdapter,
  ExecutionActionType,
  ExecutionContext,
  CommandValidation,
  OrchestratorResult,
  ExecutionEvent,
  ExecutionEventType,
  ExecutionCommandSchema,
} from '../types';

/**
 * Service that orchestrates execution across all adapters
 *
 * This is the single entry point for all external execution in NeuronX.
 * It validates commands against business rules before routing to adapters.
 */
@Injectable()
export class ExecutionOrchestratorService {
  private readonly logger = new Logger(ExecutionOrchestratorService.name);
  private readonly adapters: Map<ExecutionActionType, ExecutionAdapter> =
    new Map();
  private readonly uatGuardService: UatGuardService;

  constructor(
    private readonly eventPublisher: EventPublisher,
    private readonly salesStateMachine: SalesStateMachine
  ) {
    this.uatGuardService = new UatGuardService();
  }

  /**
   * Register an adapter for specific action types
   */
  registerAdapter(adapter: ExecutionAdapter): void {
    const capabilities = adapter.getCapabilities();
    capabilities.supportedActionTypes.forEach(actionType => {
      this.adapters.set(actionType, adapter);
    });
  }

  /**
   * Execute a command through the appropriate adapter
   *
   * This is the main entry point for all execution in NeuronX.
   * Validates the command and routes it to the correct adapter.
   */
  async executeCommand(
    command: ExecutionCommand,
    context?: ExecutionContext
  ): Promise<OrchestratorResult> {
    const auditReferenceId = `exec_${command.commandId}_${Date.now()}`;
    const timestamp = new Date();

    try {
      // Validate command schema
      const validation = ExecutionCommandSchema.safeParse(command);
      if (!validation.success) {
        return this.createFailureResult(
          command,
          `Invalid command schema: ${validation.error.message}`,
          auditReferenceId,
          timestamp
        );
      }

      // Emit execution attempted event
      await this.emitEvent({
        eventType: ExecutionEventType.EXECUTION_ATTEMPTED,
        tenantId: command.tenantId,
        leadId: command.leadId,
        commandId: command.commandId,
        actionType: command.actionType,
        adapterName: 'orchestrator', // Will be updated when adapter is selected
        correlationId: command.correlationId,
        timestamp,
      });

      // Validate command against business rules
      const businessValidation = await this.validateCommand(command, context);
      if (!businessValidation.isValid) {
        return this.createValidationFailureResult(
          command,
          businessValidation,
          auditReferenceId,
          timestamp
        );
      }

      // Find appropriate adapter
      const adapter = this.adapters.get(command.actionType);
      if (!adapter) {
        return this.createFailureResult(
          command,
          `No adapter registered for action type: ${command.actionType}`,
          auditReferenceId,
          timestamp
        );
      }

      // WI-066: Check UAT execution mode and safety boundaries
      const uatResult = await this.validateUatExecutionMode(command, context);
      if (!uatResult.allowed) {
        // Emit UAT boundary violation event
        await this.emitEvent({
          eventType: ExecutionEventType.UAT_BOUNDARY_VIOLATION,
          tenantId: command.tenantId,
          leadId: command.leadId,
          commandId: command.commandId,
          actionType: command.actionType,
          adapterName: adapter.getCapabilities().name,
          correlationId: command.correlationId,
          timestamp,
          uatMode: command.uatMode,
          uatCorrelationId: context?.uatCorrelationId,
          uatBoundaryViolation: uatResult.reason,
        });

        return this.createFailureResult(
          command,
          `UAT Safety Violation: ${uatResult.reason}`,
          auditReferenceId,
          timestamp
        );
      }

      // Execute through adapter (may be intercepted for DRY_RUN mode)
      const executionResult = await this.executeWithUatMode(
        command,
        adapter,
        uatResult.mode
      );

      // Emit success/failure event
      const eventType = executionResult.success
        ? ExecutionEventType.EXECUTION_SUCCEEDED
        : ExecutionEventType.EXECUTION_FAILED;

      await this.emitEvent({
        eventType,
        tenantId: command.tenantId,
        leadId: command.leadId,
        commandId: command.commandId,
        actionType: command.actionType,
        adapterName: adapter.getCapabilities().name,
        correlationId: command.correlationId,
        timestamp: executionResult.timestamp,
        success: executionResult.success,
        error: executionResult.error,
        externalId: executionResult.externalId,
      });

      return {
        success: executionResult.success,
        commandId: command.commandId,
        actionType: command.actionType,
        adapterUsed: adapter.getCapabilities().name,
        executionResult,
        correlationId: command.correlationId,
        timestamp,
        auditReferenceId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown execution error';

      // Emit failure event
      await this.emitEvent({
        eventType: ExecutionEventType.EXECUTION_FAILED,
        tenantId: command.tenantId,
        leadId: command.leadId,
        commandId: command.commandId,
        actionType: command.actionType,
        adapterName: 'orchestrator',
        correlationId: command.correlationId,
        timestamp,
        success: false,
        error: errorMessage,
      });

      return this.createFailureResult(
        command,
        errorMessage,
        auditReferenceId,
        timestamp
      );
    }
  }

  /**
   * Validate command against business rules
   *
   * Checks FSM state, billing entitlements, capability grants, etc.
   */
  private async validateCommand(
    command: ExecutionCommand,
    context?: ExecutionContext
  ): Promise<CommandValidation> {
    const blockingFactors: string[] = [];

    // Check if lead exists and is in valid state
    if (context?.currentLeadState) {
      const validTransitions = this.salesStateMachine.getNextStates(
        context.currentLeadState as any
      );
      // Note: In a real implementation, we'd validate that the action is appropriate
      // for the current lead state, but this is a simplified version
    }

    // Check billing/entitlement status
    if (
      context?.billingStatus === 'suspended' ||
      context?.billingStatus === 'cancelled'
    ) {
      blockingFactors.push('billing_suspended');
    }

    // Check capability grants
    if (context?.capabilityGrants) {
      const requiredCapability = this.getRequiredCapability(command.actionType);
      if (
        requiredCapability &&
        !context.capabilityGrants.includes(requiredCapability)
      ) {
        blockingFactors.push('capability_denied');
      }
    }

    // Additional business rule validations could go here
    // - Rate limiting checks
    // - Time-of-day restrictions
    // - Lead-specific rules

    if (blockingFactors.length > 0) {
      return {
        isValid: false,
        reason: `Command blocked by business rules: ${blockingFactors.join(', ')}`,
        blockingFactors,
      };
    }

    return {
      isValid: true,
      reason: 'Command validated successfully',
    };
  }

  /**
   * Get the capability required for an action type
   */
  private getRequiredCapability(
    actionType: ExecutionActionType
  ): string | null {
    switch (actionType) {
      case ExecutionActionType.SEND_SMS:
        return 'SMS_EXECUTION';
      case ExecutionActionType.SEND_EMAIL:
        return 'EMAIL_EXECUTION';
      case ExecutionActionType.MAKE_CALL:
        return 'VOICE_EXECUTION';
      case ExecutionActionType.BOOK_CALENDAR:
        return 'CALENDAR_EXECUTION';
      case ExecutionActionType.UPDATE_CRM:
        return 'CRM_EXECUTION';
      default:
        return null;
    }
  }

  /**
   * Check if an action type is supported
   */
  isActionSupported(actionType: ExecutionActionType): boolean {
    return this.adapters.has(actionType);
  }

  /**
   * Get registered adapters info
   */
  getRegisteredAdapters(): Array<{
    actionType: ExecutionActionType;
    adapterName: string;
  }> {
    return Array.from(this.adapters.entries()).map(([actionType, adapter]) => ({
      actionType,
      adapterName: adapter.getCapabilities().name,
    }));
  }

  /**
   * WI-066: Validate UAT execution mode and safety boundaries
   */
  private async validateUatExecutionMode(
    command: ExecutionCommand,
    context?: ExecutionContext
  ): Promise<{ allowed: boolean; reason?: string; mode: UatExecutionMode }> {
    // Extract UAT mode from command or context
    const uatMode =
      command.uatMode || context?.uatMode || UatExecutionMode.DRY_RUN;

    // Create UAT context for guard service
    const uatContext = {
      config: undefined, // Will be loaded by UatGuardService
      tenantId: command.tenantId,
      correlationId: context?.uatCorrelationId || command.correlationId,
      timestamp: new Date(),
    };

    // Check basic operation allowance
    const guardResult = this.uatGuardService.checkOperationAllowed(uatContext);

    if (!guardResult.allowed) {
      return {
        allowed: false,
        reason: guardResult.reason,
        mode: UatExecutionMode.DRY_RUN,
      };
    }

    // If kill switch is active, force DRY_RUN
    if (guardResult.killSwitchActive) {
      return {
        allowed: true,
        mode: UatExecutionMode.DRY_RUN,
      };
    }

    // Return the determined mode
    return {
      allowed: true,
      mode:
        guardResult.mode === 'live_uat'
          ? UatExecutionMode.LIVE_UAT
          : UatExecutionMode.DRY_RUN,
    };
  }

  /**
   * WI-066: Execute command with UAT mode handling
   */
  private async executeWithUatMode(
    command: ExecutionCommand,
    adapter: ExecutionAdapter,
    uatMode: UatExecutionMode
  ): Promise<ExecutionResult> {
    if (uatMode === UatExecutionMode.DRY_RUN) {
      // DRY_RUN mode: Simulate execution without external calls
      this.logger.log(
        `UAT DRY_RUN: Simulating ${command.actionType} for command ${command.commandId}`
      );

      // Emit dry run event
      await this.emitEvent({
        eventType: ExecutionEventType.UAT_DRY_RUN_EXECUTED,
        tenantId: command.tenantId,
        leadId: command.leadId,
        commandId: command.commandId,
        actionType: command.actionType,
        adapterName: adapter.getCapabilities().name,
        correlationId: command.correlationId,
        timestamp: new Date(),
        success: true,
        uatMode: UatExecutionMode.DRY_RUN,
      });

      // Return deterministic simulated result
      return this.createSimulatedResult(command, adapter);
    }

    // LIVE_UAT mode: Check provider-specific allowlists before executing
    const providerCheck = this.checkProviderAllowlist(command, adapter);
    if (!providerCheck.allowed) {
      // Emit blocked execution event
      await this.emitEvent({
        eventType: ExecutionEventType.UAT_LIVE_EXECUTION_BLOCKED,
        tenantId: command.tenantId,
        leadId: command.leadId,
        commandId: command.commandId,
        actionType: command.actionType,
        adapterName: adapter.getCapabilities().name,
        correlationId: command.correlationId,
        timestamp: new Date(),
        success: false,
        error: providerCheck.reason,
        uatMode: UatExecutionMode.LIVE_UAT,
        uatBoundaryViolation: providerCheck.reason,
      });

      return {
        success: false,
        commandId: command.commandId,
        error: `UAT Provider Safety: ${providerCheck.reason}`,
        timestamp: new Date(),
      };
    }

    // Execute normally for LIVE_UAT with allowlist validation passed
    return adapter.execute(command);
  }

  /**
   * WI-066: Check provider-specific allowlists for LIVE_UAT mode
   */
  private checkProviderAllowlist(
    command: ExecutionCommand,
    adapter: ExecutionAdapter
  ): { allowed: boolean; reason?: string } {
    const adapterName = adapter.getCapabilities().name.toLowerCase();

    // Create UAT context for provider checks
    const uatContext = {
      config: undefined, // Will be loaded by UatGuardService
      tenantId: command.tenantId,
      correlationId: command.correlationId,
      timestamp: new Date(),
    };

    // Check based on action type and payload content
    switch (command.actionType) {
      case ExecutionActionType.SEND_SMS:
        const phoneNumber = this.extractPhoneNumber(command.payload);
        return this.uatGuardService.checkProviderExecutionAllowed(
          uatContext,
          'sms',
          phoneNumber
        );

      case ExecutionActionType.SEND_EMAIL:
        const email = this.extractEmail(command.payload);
        return this.uatGuardService.checkProviderExecutionAllowed(
          uatContext,
          'email',
          email
        );

      case ExecutionActionType.BOOK_CALENDAR:
        const calendarId = this.extractCalendarId(command.payload);
        return this.uatGuardService.checkProviderExecutionAllowed(
          uatContext,
          'calendar',
          calendarId
        );

      case ExecutionActionType.UPDATE_CRM:
        // For GHL updates, check location ID if present
        if (adapterName.includes('ghl')) {
          const locationId = this.extractGhlLocationId(command.payload);
          return this.uatGuardService.checkProviderExecutionAllowed(
            uatContext,
            'ghl',
            locationId
          );
        }
        return { allowed: true }; // Allow other CRM updates

      case ExecutionActionType.MAKE_CALL:
        // Voice calls may have phone number validation
        const voicePhone = this.extractPhoneNumber(command.payload);
        return this.uatGuardService.checkProviderExecutionAllowed(
          uatContext,
          'sms',
          voicePhone
        ); // Reuse SMS allowlist for voice

      default:
        return { allowed: true }; // Allow unknown action types (fail open for future extensions)
    }
  }

  /**
   * WI-066: Create deterministic simulated result for DRY_RUN mode
   */
  private createSimulatedResult(
    command: ExecutionCommand,
    adapter: ExecutionAdapter
  ): ExecutionResult {
    const adapterName = adapter.getCapabilities().name;

    // Create deterministic external ID based on command
    const simulatedExternalId = `uat_dry_run_${command.commandId}_${adapterName.toLowerCase()}`;

    return {
      success: true,
      commandId: command.commandId,
      externalId: simulatedExternalId,
      metadata: {
        uatMode: 'dry_run',
        simulated: true,
        adapter: adapterName,
        simulationTimestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
    };
  }

  /**
   * Extract phone number from payload for validation
   */
  private extractPhoneNumber(payload: Record<string, any>): string | undefined {
    return payload.phoneNumber || payload.to || payload.recipient;
  }

  /**
   * Extract email from payload for validation
   */
  private extractEmail(payload: Record<string, any>): string | undefined {
    return payload.email || payload.to || payload.recipient;
  }

  /**
   * Extract calendar ID from payload for validation
   */
  private extractCalendarId(payload: Record<string, any>): string | undefined {
    return payload.calendarId || payload.calendar_id;
  }

  /**
   * Extract GHL location ID from payload for validation
   */
  private extractGhlLocationId(
    payload: Record<string, any>
  ): string | undefined {
    return payload.locationId || payload.location_id || payload.ghlLocationId;
  }

  /**
   * Emit execution event
   */
  private async emitEvent(event: ExecutionEvent): Promise<void> {
    try {
      // Convert to NeuronxEvent format
      const neuronxEvent = {
        id: `${event.eventType}_${event.commandId}_${Date.now()}`,
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
          error: event.error,
          externalId: event.externalId,
          // WI-066: UAT event fields
          uatMode: event.uatMode,
          uatCorrelationId: event.uatCorrelationId,
          uatBoundaryViolation: event.uatBoundaryViolation,
        },
        metadata: {
          source: 'execution-orchestrator',
          version: '1.0.0',
        },
      };

      await this.eventPublisher.publish(neuronxEvent);
    } catch (error) {
      // Log event emission failure but don't fail the execution
      console.error('Failed to emit execution event:', error);
    }
  }

  /**
   * Create a failure result
   */
  private createFailureResult(
    command: ExecutionCommand,
    reason: string,
    auditReferenceId: string,
    timestamp: Date
  ): OrchestratorResult {
    return {
      success: false,
      commandId: command.commandId,
      actionType: command.actionType,
      adapterUsed: 'none',
      correlationId: command.correlationId,
      timestamp,
      auditReferenceId,
    };
  }

  /**
   * Create a validation failure result
   */
  private createValidationFailureResult(
    command: ExecutionCommand,
    validation: CommandValidation,
    auditReferenceId: string,
    timestamp: Date
  ): OrchestratorResult {
    return {
      success: false,
      commandId: command.commandId,
      actionType: command.actionType,
      adapterUsed: 'none',
      correlationId: command.correlationId,
      timestamp,
      auditReferenceId,
    };
  }
}
