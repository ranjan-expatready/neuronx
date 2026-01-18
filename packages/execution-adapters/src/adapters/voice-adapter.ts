/**
 * Voice Adapter - WI-028: Adapter-First Execution Layer
 *
 * Skeleton voice execution adapter.
 * EXECUTION ONLY - no business logic, no decisions, no state access.
 */

import {
  ExecutionCommand,
  ExecutionActionType,
} from '../types/execution.types';
import { BaseExecutionAdapter } from './base-adapter';

export class VoiceAdapter extends BaseExecutionAdapter {
  name = 'voice-adapter';
  supportedActionTypes = [ExecutionActionType.MAKE_CALL];

  protected async executeCommand(command: ExecutionCommand): Promise<{
    success: boolean;
    externalId?: string;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }> {
    // Validate command is for voice
    if (command.actionType !== ExecutionActionType.MAKE_CALL) {
      return {
        success: false,
        errorMessage: `Voice adapter cannot handle action type: ${command.actionType}`,
      };
    }

    // Validate required payload fields
    const { to, script, voiceMode } = command.payload;
    if (!to || !script) {
      return {
        success: false,
        errorMessage: 'Missing required fields: to, script',
      };
    }

    try {
      // SKELETON IMPLEMENTATION - Replace with actual voice provider
      // This is where you would integrate with Twilio, etc.

      console.log(
        `[Voice Adapter] Making call to ${to} with script: ${script}`
      );

      // Simulate external API call
      const externalId = `call_${command.commandId}_${Date.now()}`;

      // Simulate success/failure randomly for testing
      const shouldSucceed = Math.random() > 0.15; // 85% success rate

      if (shouldSucceed) {
        return {
          success: true,
          externalId,
          metadata: {
            provider: 'twilio', // example
            callSid: externalId,
            status: 'initiated',
            voiceMode: voiceMode || 'scripted',
          },
        };
      } else {
        return {
          success: false,
          errorMessage: 'Voice call failed to initiate',
          metadata: {
            provider: 'twilio',
            errorCode: 'INITIATION_FAILED',
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : 'Unknown voice error',
      };
    }
  }
}
