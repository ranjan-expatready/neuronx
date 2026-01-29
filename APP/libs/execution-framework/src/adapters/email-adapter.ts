/**
 * Email Execution Adapter - WI-028: Adapter-First Execution Layer
 *
 * Stateless adapter for email message execution.
 * No business logic, no state changes, no decisions.
 */

import { BaseExecutionAdapter } from './base-adapter';
import {
  ExecutionCommand,
  ExecutionResult,
  ExecutionActionType,
} from '../types';

export class EmailAdapter extends BaseExecutionAdapter {
  constructor() {
    super('EmailAdapter', '1.0.0', [ExecutionActionType.SEND_EMAIL]);
  }

  /**
   * Execute email sending command
   *
   * This adapter only performs the side effect of sending an email.
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
      // Extract email-specific payload
      const { to, subject, body, from, cc, bcc, attachments } = command.payload;

      if (!to || !subject || !body) {
        return this.createResult(
          false,
          command.commandId,
          undefined,
          'Missing required email parameters: to, subject, body'
        );
      }

      // Simulate email sending (in real implementation, this would call SendGrid/Mailgun/etc.)
      const externalId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Log the execution
      const result = this.createResult(
        true,
        command.commandId,
        externalId,
        undefined,
        {
          provider: 'simulated-email-provider',
          recipient: to,
          cc: cc || [],
          bcc: bcc || [],
          attachmentCount: attachments?.length || 0,
          from: from || 'default@neuronx.com',
        }
      );

      this.logExecution(command, result);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown email execution error';

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
