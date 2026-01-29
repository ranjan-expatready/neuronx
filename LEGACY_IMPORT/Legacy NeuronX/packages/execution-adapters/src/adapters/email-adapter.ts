/**
 * Email Adapter - WI-028: Adapter-First Execution Layer
 *
 * Skeleton email execution adapter.
 * EXECUTION ONLY - no business logic, no decisions, no state access.
 */

import {
  ExecutionCommand,
  ExecutionActionType,
} from '../types/execution.types';
import { BaseExecutionAdapter } from './base-adapter';

export class EmailAdapter extends BaseExecutionAdapter {
  name = 'email-adapter';
  supportedActionTypes = [ExecutionActionType.SEND_EMAIL];

  protected async executeCommand(command: ExecutionCommand): Promise<{
    success: boolean;
    externalId?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }> {
    // Validate command is for email
    if (command.actionType !== ExecutionActionType.SEND_EMAIL) {
      return {
        success: false,
        errorMessage: `Email adapter cannot handle action type: ${command.actionType}`,
      };
    }

    // Validate required payload fields
    const { to, subject, body } = command.payload;
    if (!to || !subject || !body) {
      return {
        success: false,
        errorMessage: 'Missing required fields: to, subject, body',
      };
    }

    try {
      // SKELETON IMPLEMENTATION - Replace with actual email provider
      // This is where you would integrate with SendGrid, AWS SES, etc.

      console.log(`[Email Adapter] Sending email to ${to}: ${subject}`);

      // Simulate external API call
      const externalId = `email_${command.commandId}_${Date.now()}`;

      // Simulate success/failure randomly for testing
      const shouldSucceed = Math.random() > 0.05; // 95% success rate

      if (shouldSucceed) {
        return {
          success: true,
          externalId,
          metadata: {
            provider: 'sendgrid', // example
            messageId: externalId,
            status: 'sent',
          },
        };
      } else {
        return {
          success: false,
          errorMessage: 'Email delivery failed',
          metadata: {
            provider: 'sendgrid',
            errorCode: 'DELIVERY_FAILED',
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : 'Unknown email error',
      };
    }
  }
}
