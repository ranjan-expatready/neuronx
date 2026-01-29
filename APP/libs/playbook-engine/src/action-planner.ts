/**
 * Action Planner - WI-028: Authoritative Playbook Engine
 *
 * Converts playbook stage requirements into canonical execution commands
 * that can be sent to adapters for execution.
 */

// import { Injectable, Logger } from '@nestjs/common';
// Mock Logger
class Logger {
  constructor(private context: string) {}
  log(message: any, ...optionalParams: any[]) { console.log(`[${this.context}]`, message, ...optionalParams); }
  error(message: any, ...optionalParams: any[]) { console.error(`[${this.context}]`, message, ...optionalParams); }
  warn(message: any, ...optionalParams: any[]) { console.warn(`[${this.context}]`, message, ...optionalParams); }
}
const Injectable = () => (target: any) => target; // Mock Injectable

import {
  Playbook,
  PlaybookStage,
  StageAction,
  ExecutionCommand,
  EvidenceType,
} from './types';

export interface ActionPlanner {
  /**
   * Generate execution commands for a stage
   */
  planStageActions(
    playbook: Playbook,
    stageId: string,
    opportunityId: string,
    tenantId: string,
    correlationId: string
  ): ExecutionCommand[];

  /**
   * Generate command for a specific action
   */
  planAction(
    action: StageAction,
    playbook: Playbook,
    stage: PlaybookStage,
    opportunityId: string,
    tenantId: string,
    correlationId: string
  ): ExecutionCommand;
}

@Injectable()
export class ActionPlannerImpl implements ActionPlanner {
  private readonly logger = new Logger(ActionPlannerImpl.name);

  planStageActions(
    playbook: Playbook,
    stageId: string,
    opportunityId: string,
    tenantId: string,
    correlationId: string
  ): ExecutionCommand[] {
    const stage = playbook.stages[stageId];
    if (!stage) {
      this.logger.warn(
        `Stage '${stageId}' not found in playbook '${playbook.playbookId}'`
      );
      return [];
    }

    return stage.mustDo.map(action =>
      this.planAction(
        action,
        playbook,
        stage,
        opportunityId,
        tenantId,
        correlationId
      )
    );
  }

  planAction(
    action: StageAction,
    playbook: Playbook,
    stage: PlaybookStage,
    opportunityId: string,
    tenantId: string,
    correlationId: string
  ): ExecutionCommand {
    const commandId = `${action.actionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Map action type to command type
    let commandType: ExecutionCommand['commandType'];
    switch (action.actionType) {
      case 'contact_attempt':
      case 'qualification_call':
        commandType = 'EXECUTE_CONTACT';
        break;
      case 'send_message':
        commandType = 'SEND_MESSAGE';
        break;
      case 'schedule_meeting':
        commandType = 'SCHEDULE_MEETING';
        break;
      case 'followup':
        commandType = 'FOLLOW_UP';
        break;
      default:
        commandType = 'EXECUTE_CONTACT'; // Default fallback
        this.logger.warn(
          `Unknown action type '${action.actionType}', defaulting to EXECUTE_CONTACT`
        );
    }

    // Build command based on type
    const baseCommand: Omit<
      ExecutionCommand,
      'contactData' | 'messageData' | 'meetingData'
    > = {
      commandId,
      tenantId,
      opportunityId,
      playbookId: playbook.playbookId,
      stageId: stage.stageId,
      actionId: action.actionId,

      commandType,
      channel: action.channel,
      priority: this.calculatePriority(action, stage),

      humanAllowed: action.humanAllowed,
      aiAllowed: action.aiAllowed,
      maxDurationMinutes: action.slaMinutes,

      retryPolicy: action.retryPolicy || playbook.defaultRetryPolicy,

      correlationId,
      requestedAt: new Date(),
      evidenceRequired: action.evidenceRequired,

      scriptId: action.scriptId,
    };

    // Add type-specific data
    switch (commandType) {
      case 'EXECUTE_CONTACT':
        return {
          ...baseCommand,
          contactData: {}, // Would be populated from opportunity data
        };

      case 'SEND_MESSAGE':
        return {
          ...baseCommand,
          messageData: {
            templateId: action.templateId,
            body: '', // Would be populated from template
            variables: {}, // Would be populated from context
          },
        };

      case 'SCHEDULE_MEETING':
        return {
          ...baseCommand,
          meetingData: {
            title: `Meeting for ${stage.displayName}`,
            durationMinutes: 60, // Default 1 hour
          },
        };

      case 'FOLLOW_UP':
        return {
          ...baseCommand,
          messageData: {
            templateId: action.templateId,
            body: '', // Would be populated from template
            subject: `Follow-up: ${stage.displayName}`,
            variables: {},
          },
        };

      default:
        throw new Error(`Unsupported command type: ${commandType}`);
    }
  }

  /**
   * Calculate priority based on action SLA and stage characteristics
   */
  private calculatePriority(
    action: StageAction,
    stage: PlaybookStage
  ): 'low' | 'normal' | 'high' | 'urgent' {
    // Urgent if SLA is very short (< 30 minutes)
    if (action.slaMinutes < 30) {
      return 'urgent';
    }

    // High if SLA is short (< 2 hours)
    if (action.slaMinutes < 120) {
      return 'high';
    }

    // Normal for most actions
    return 'normal';
  }
}
