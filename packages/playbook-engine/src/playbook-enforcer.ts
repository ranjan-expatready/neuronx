/**
 * Playbook Enforcer - WI-028: Authoritative Playbook Engine
 *
 * Main entry point for playbook enforcement. Coordinates registry,
 * evaluator, and planner to enforce playbook rules.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  PlaybookRegistry,
  StageEvaluator,
  ActionPlanner,
  Playbook,
  ActionEvidence,
  PlaybookEnforcementResult,
  PlaybookEnforcementMode,
  ExecutionCommand,
  PlaybookTransitionEvent,
} from './types';

export interface PlaybookEnforcer {
  /**
   * Evaluate if a stage transition is allowed by playbook rules
   */
  evaluateTransition(
    tenantId: string,
    opportunityId: string,
    currentStageId: string,
    requestedStageId: string,
    playbookId: string,
    evidence: ActionEvidence[]
  ): Promise<PlaybookEnforcementResult>;

  /**
   * Get required actions for a stage
   */
  getRequiredActions(
    tenantId: string,
    opportunityId: string,
    stageId: string,
    playbookId: string
  ): Promise<ExecutionCommand[]>;

  /**
   * Set enforcement mode
   */
  setEnforcementMode(mode: PlaybookEnforcementMode): void;

  /**
   * Get current enforcement mode
   */
  getEnforcementMode(): PlaybookEnforcementMode;
}

@Injectable()
export class PlaybookEnforcerImpl implements PlaybookEnforcer {
  private readonly logger = new Logger(PlaybookEnforcerImpl.name);
  private enforcementMode: PlaybookEnforcementMode = 'monitor_only';

  constructor(
    private readonly playbookRegistry: PlaybookRegistry,
    private readonly stageEvaluator: StageEvaluator,
    private readonly actionPlanner: ActionPlanner
  ) {}

  async evaluateTransition(
    tenantId: string,
    opportunityId: string,
    currentStageId: string,
    requestedStageId: string,
    playbookId: string,
    evidence: ActionEvidence[]
  ): Promise<PlaybookEnforcementResult> {
    try {
      // Get the playbook
      const playbook = await this.playbookRegistry.getPlaybook(
        tenantId,
        playbookId
      );
      if (!playbook) {
        const result: PlaybookEnforcementResult = {
          allowed: this.enforcementMode === 'monitor_only',
          reason: `Playbook '${playbookId}' not found for tenant '${tenantId}'`,
          enforced: false,
          logged: true,
        };

        await this.logTransition(
          tenantId,
          opportunityId,
          currentStageId,
          requestedStageId,
          playbookId,
          result,
          evidence
        );

        return result;
      }

      // Evaluate current stage
      const evaluation = this.stageEvaluator.evaluateStage(
        playbook,
        currentStageId,
        evidence
      );

      // Check if requested transition matches playbook rules
      const allowed =
        !evaluation.canAdvance ||
        evaluation.nextStage === requestedStageId ||
        this.enforcementMode === 'monitor_only';

      const result: PlaybookEnforcementResult = {
        allowed,
        reason: allowed
          ? 'Transition allowed by playbook rules'
          : `Transition violates playbook: ${evaluation.reason}. Expected next stage: ${evaluation.nextStage}`,
        stageEvaluation: evaluation,
        enforced: this.shouldEnforce(),
        logged: true,
      };

      // Generate execution commands if transition is to a new stage with requirements
      if (allowed && evaluation.nextStage === requestedStageId) {
        const nextStage = playbook.stages[requestedStageId];
        if (nextStage && nextStage.mustDo.length > 0) {
          result.executionCommands = this.actionPlanner.planStageActions(
            playbook,
            requestedStageId,
            opportunityId,
            tenantId,
            `transition_${Date.now()}`
          );
        }
      }

      await this.logTransition(
        tenantId,
        opportunityId,
        currentStageId,
        requestedStageId,
        playbookId,
        result,
        evidence
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Playbook enforcement error for ${tenantId}/${opportunityId}:`,
        errorMessage
      );

      // On error, default to allowing but log
      const result: PlaybookEnforcementResult = {
        allowed: this.enforcementMode === 'monitor_only',
        reason: `Enforcement error: ${errorMessage}`,
        enforced: false,
        logged: true,
      };

      await this.logTransition(
        tenantId,
        opportunityId,
        currentStageId,
        requestedStageId,
        playbookId,
        result,
        evidence
      );

      return result;
    }
  }

  async getRequiredActions(
    tenantId: string,
    opportunityId: string,
    stageId: string,
    playbookId: string
  ): Promise<ExecutionCommand[]> {
    const playbook = await this.playbookRegistry.getPlaybook(
      tenantId,
      playbookId
    );
    if (!playbook) {
      this.logger.warn(
        `Playbook '${playbookId}' not found for tenant '${tenantId}'`
      );
      return [];
    }

    const correlationId = `actions_${stageId}_${Date.now()}`;
    return this.actionPlanner.planStageActions(
      playbook,
      stageId,
      opportunityId,
      tenantId,
      correlationId
    );
  }

  setEnforcementMode(mode: PlaybookEnforcementMode): void {
    this.enforcementMode = mode;
    this.logger.log(`Playbook enforcement mode set to: ${mode}`);
  }

  getEnforcementMode(): PlaybookEnforcementMode {
    return this.enforcementMode;
  }

  private shouldEnforce(): boolean {
    return this.enforcementMode !== 'monitor_only';
  }

  private async logTransition(
    tenantId: string,
    opportunityId: string,
    fromStageId: string,
    toStageId: string,
    playbookId: string,
    result: PlaybookEnforcementResult,
    evidence: ActionEvidence[]
  ): Promise<void> {
    const event: Omit<PlaybookTransitionEvent, 'eventId' | 'timestamp'> = {
      tenantId,
      opportunityId,
      playbookId,
      fromStage: fromStageId,
      toStage: toStageId,
      trigger: 'evidence', // Could be enhanced to detect trigger type
      evidence: evidence.slice(-5), // Last 5 evidence items for context
      enforced: result.enforced,
      enforcementMode: this.enforcementMode,
      correlationId: `transition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Log structured event for audit
    this.logger.log({
      message: 'Playbook transition evaluation',
      level: result.allowed ? 'info' : 'warn',
      tenantId: event.tenantId,
      opportunityId: event.opportunityId,
      playbookId: event.playbookId,
      fromStage: event.fromStage,
      toStage: event.toStage,
      allowed: result.allowed,
      reason: result.reason,
      enforced: event.enforced,
      enforcementMode: event.enforcementMode,
      correlationId: event.correlationId,
      evidenceCount: evidence.length,
      executionCommandsCount: result.executionCommands?.length || 0,
    });
  }
}
