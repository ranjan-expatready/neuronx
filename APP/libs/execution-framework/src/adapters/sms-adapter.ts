/**
 * SMS Execution Adapter - WI-028: Adapter-First Execution Layer
 *
 * Stateless adapter for SMS message execution.
 * No business logic, no state changes, no decisions.
 */

import { BaseExecutionAdapter } from './base-adapter';
import {
  ExecutionCommand,
  ExecutionResult,
  ExecutionActionType,
} from '../types';

export class SmsAdapter extends BaseExecutionAdapter {
  constructor() {
    super('SmsAdapter', '1.0.0', [ExecutionActionType.SEND_SMS]);
  }

  /**
   * Execute SMS sending command
   *
   * This adapter only performs the side effect of sending an SMS.
   * All decisions about when/why to send are made by NeuronX.
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
      // Extract SMS-specific payload
      const { to, message, from } = command.payload;

      if (!to || !message) {
        return this.createResult(
          false,
          command.commandId,
          undefined,
          'Missing required SMS parameters: to, message'
        );
      }

      // Simulate SMS sending (in real implementation, this would call Twilio/SMS provider)
      const externalId = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Log the execution
      const result = this.createResult(
        true,
        command.commandId,
        externalId,
        undefined,
        {
          provider: 'simulated-sms-provider',
          recipient: to,
          messageLength: message.length,
          from: from || 'default',
        }
      );

      this.logExecution(command, result);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown SMS execution error';

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
