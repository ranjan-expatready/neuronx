/**
 * CRM Execution Adapter - WI-028: Adapter-First Execution Layer
 *
 * Stateless adapter for CRM update execution.
 * No business logic, no state changes, no decisions.
 */

import { BaseExecutionAdapter } from './base-adapter';
import {
  ExecutionCommand,
  ExecutionResult,
  ExecutionActionType,
} from '../types';

export class CrmAdapter extends BaseExecutionAdapter {
  constructor() {
    super('CrmAdapter', '1.0.0', [ExecutionActionType.UPDATE_CRM]);
  }

  /**
   * Execute CRM update command
   *
   * This adapter only performs the side effect of updating CRM data.
   * All decisions about what/when to update are made by NeuronX.
   */
  async execute(command: ExecutionCommand): Promise<ExecutionResult> {
    // Boundary enforcement - detect violations
    const violations = this.detectBoundaryViolations(command);
    if (violations.length > 0) {
      return this.createResult(
        false,
        command.commandId,
        undefined,
        `Adapter boundary violation: ${violations[0].details}`,
        { violations }
      );
    }

    // Validate command structure
    const validation = this.validateCommand(command);
    if (!validation.isValid) {
      return this.createResult(
        false,
        command.commandId,
        undefined,
        validation.error
      );
    }

    // Check idempotency
    const alreadyExecuted = await this.ensureIdempotency(command.commandId);
    if (alreadyExecuted) {
      return this.createResult(
        true,
        command.commandId,
        `idempotent-${command.commandId}`,
        undefined,
        { idempotent: true }
      );
    }

    try {
      // Extract CRM-specific payload
      const { operation, entityType, entityId, data } = command.payload;

      if (!operation || !entityType || !data) {
        return this.createResult(
          false,
          command.commandId,
          undefined,
          'Missing required CRM parameters: operation, entityType, data'
        );
      }

      // Simulate CRM update (in real implementation, this would call GHL/Salesforce/etc.)
      const externalId = `crm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Log the execution
      const result = this.createResult(
        true,
        command.commandId,
        externalId,
        undefined,
        {
          provider: 'simulated-crm-provider',
          operation,
          entityType,
          entityId,
          fieldCount: Object.keys(data).length,
        }
      );

      this.logExecution(command, result);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown CRM execution error';

      const result = this.createResult(
        false,
        command.commandId,
        undefined,
        errorMessage
      );
      this.logExecution(command, result);
      return result;
    }
  }
}
