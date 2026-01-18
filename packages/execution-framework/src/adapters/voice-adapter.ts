/**
 * Voice Execution Adapter - WI-028: Adapter-First Execution Layer
 *
 * Stateless adapter for voice call execution.
 * No business logic, no state changes, no decisions.
 */

import { BaseExecutionAdapter } from './base-adapter';
import {
  ExecutionCommand,
  ExecutionResult,
  ExecutionActionType,
} from '../types';

export class VoiceAdapter extends BaseExecutionAdapter {
  constructor() {
    super('VoiceAdapter', '1.0.0', [ExecutionActionType.MAKE_CALL]);
  }

  /**
   * Execute voice call command
   *
   * This adapter only performs the side effect of initiating a voice call.
   * All decisions about when/why/how to call are made by NeuronX.
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
      // Extract voice-specific payload
      const { to, script, voiceMode, maxDuration, retryCount } =
        command.payload;

      if (!to) {
        return this.createResult(
          false,
          command.commandId,
          undefined,
          'Missing required voice parameter: to'
        );
      }

      // Simulate voice call initiation (in real implementation, this would call Twilio/etc.)
      const externalId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Log the execution
      const result = this.createResult(
        true,
        command.commandId,
        externalId,
        undefined,
        {
          provider: 'simulated-voice-provider',
          recipient: to,
          scriptLength: script?.length || 0,
          voiceMode: voiceMode || 'scripted',
          maxDuration: maxDuration || 300,
          retryCount: retryCount || 0,
        }
      );

      this.logExecution(command, result);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown voice execution error';

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
