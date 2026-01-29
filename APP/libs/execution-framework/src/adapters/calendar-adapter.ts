/**
 * Calendar Execution Adapter - WI-028: Adapter-First Execution Layer
 *
 * Stateless adapter for calendar event execution.
 * No business logic, no state changes, no decisions.
 */

import { BaseExecutionAdapter } from './base-adapter';
import {
  ExecutionCommand,
  ExecutionResult,
  ExecutionActionType,
} from '../types';

export class CalendarAdapter extends BaseExecutionAdapter {
  constructor() {
    super('CalendarAdapter', '1.0.0', [ExecutionActionType.BOOK_CALENDAR]);
  }

  /**
   * Execute calendar booking command
   *
   * This adapter only performs the side effect of booking a calendar event.
   * All decisions about when/what to book are made by NeuronX.
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
      // Extract calendar-specific payload
      const { title, startTime, endTime, attendees, location, description } =
        command.payload;

      if (!title || !startTime || !endTime) {
        return this.createResult(
          false,
          command.commandId,
          undefined,
          'Missing required calendar parameters: title, startTime, endTime'
        );
      }

      // Simulate calendar booking (in real implementation, this would call Google Calendar/Outlook/etc.)
      const externalId = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Log the execution
      const result = this.createResult(
        true,
        command.commandId,
        externalId,
        undefined,
        {
          provider: 'simulated-calendar-provider',
          title,
          startTime,
          endTime,
          attendeeCount: attendees?.length || 0,
          location: location || 'virtual',
          hasDescription: !!description,
        }
      );

      this.logExecution(command, result);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown calendar execution error';

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
