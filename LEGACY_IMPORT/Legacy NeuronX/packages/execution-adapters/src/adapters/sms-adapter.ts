/**
 * SMS Adapter - WI-028: Adapter-First Execution Layer
 *
 * Skeleton SMS execution adapter.
 * EXECUTION ONLY - no business logic, no decisions, no state access.
 */

import {
  ExecutionCommand,
  ExecutionActionType,
} from '../types/execution.types';
import { BaseExecutionAdapter } from './base-adapter';

export class SmsAdapter extends BaseExecutionAdapter {
  name = 'sms-adapter';
  supportedActionTypes = [ExecutionActionType.SEND_SMS];

  protected async executeCommand(command: ExecutionCommand): Promise<{
    success: boolean;
    externalId?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }> {
    // Validate command is for SMS
    if (command.actionType !== ExecutionActionType.SEND_SMS) {
      return {
        success: false,
        errorMessage: `SMS adapter cannot handle action type: ${command.actionType}`,
      };
    }

    // Validate required payload fields
    const { to, message } = command.payload;
    if (!to || !message) {
      return {
        success: false,
        errorMessage: 'Missing required fields: to, message',
      };
    }

    try {
      // SKELETON IMPLEMENTATION - Replace with actual SMS provider
      // This is where you would integrate with Twilio, AWS SNS, etc.

      console.log(`[SMS Adapter] Sending SMS to ${to}: ${message}`);

      // Simulate external API call
      const externalId = `sms_${command.commandId}_${Date.now()}`;

      // Simulate success/failure randomly for testing
      const shouldSucceed = Math.random() > 0.1; // 90% success rate

      if (shouldSucceed) {
        return {
          success: true,
          externalId,
          metadata: {
            provider: 'twilio', // example
            messageId: externalId,
            status: 'sent',
          },
        };
      } else {
        return {
          success: false,
          errorMessage: 'SMS delivery failed',
          metadata: {
            provider: 'twilio',
            errorCode: 'DELIVERY_FAILED',
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : 'Unknown SMS error',
      };
    }
  }
}
