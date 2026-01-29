/**
 * Stage Transition Validator - WI-027: Authoritative Stage Gate
 *
 * Validates stage transitions from external systems before allowing
 * them to update NeuronX opportunity state.
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
  CanonicalOpportunityStage,
  StageValidationResult,
  StageEnforcementMode,
  StageTransitionEvent,
} from './types';
import type { PipelineStageRegistry } from './pipeline-stage-registry';

export interface StageTransitionValidator {
  /**
   * Validate a stage transition request
   */
  validate(
    tenantId: string,
    pipelineId: string,
    currentStage: CanonicalOpportunityStage | null,
    requestedGhlStageId: string,
    source: 'api' | 'ghl_webhook' | 'manual'
  ): Promise<StageValidationResult>;

  /**
   * Check if enforcement is enabled
   */
  shouldEnforce(): boolean;

  /**
   * Get current enforcement mode
   */
  getEnforcementMode(): StageEnforcementMode;

  /**
   * Log a stage transition event for audit
   */
  logTransitionEvent(
    event: Omit<StageTransitionEvent, 'timestamp'>
  ): Promise<void>;
}

@Injectable()
export class StageTransitionValidatorImpl implements StageTransitionValidator {
  private readonly logger = new Logger(StageTransitionValidatorImpl.name);
  private enforcementMode: StageEnforcementMode = 'monitor_only';

  constructor(private readonly pipelineRegistry: PipelineStageRegistry) {}

  /**
   * Set enforcement mode from configuration
   */
  setEnforcementMode(mode: StageEnforcementMode): void {
    this.enforcementMode = mode;
    this.logger.log(`Stage enforcement mode set to: ${mode}`);
  }

  async validate(
    tenantId: string,
    pipelineId: string,
    currentStage: CanonicalOpportunityStage | null,
    requestedGhlStageId: string,
    source: 'api' | 'ghl_webhook' | 'manual'
  ): Promise<StageValidationResult> {
    try {
      // Step 1: Map GHL stage ID to canonical stage
      const canonicalStage = await this.pipelineRegistry.mapGhlStageToCanonical(
        tenantId,
        pipelineId,
        requestedGhlStageId
      );

      if (!canonicalStage) {
        // Unknown stage ID - this is a validation failure
        const result: StageValidationResult = {
          allowed: false,
          reason: `Unknown GHL stage ID: ${requestedGhlStageId} for pipeline ${pipelineId}`,
          suggestedAction:
            this.enforcementMode === 'monitor_only' ? 'log' : 'block',
        };

        await this.logTransitionEvent({
          tenantId,
          opportunityId: 'unknown', // Will be set by caller
          pipelineId,
          fromStage: currentStage ?? undefined,
          toStage:
            currentStage ?? CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
          requestedByGhlStageId: requestedGhlStageId,
          source,
          validationResult: result,
          enforced: this.shouldEnforce(),
          correlationId: 'unknown', // Will be set by caller
        });

        return result;

        return result;
      }

      // Step 2: If no current stage, this is initial assignment - always allow
      if (!currentStage) {
        return {
          allowed: true,
          canonicalStage: canonicalStage || undefined,
        };
      }

      // Step 3: Check if transition is allowed
      const allowedTransitions =
        await this.pipelineRegistry.getAllowedTransitions(tenantId, pipelineId);
      const allowedToStages = allowedTransitions[currentStage] || [];

      const isAllowedTransition = canonicalStage
        ? allowedToStages.includes(canonicalStage)
        : false;

      const result: StageValidationResult = {
        allowed: isAllowedTransition,
        canonicalStage: canonicalStage || undefined,
        reason: isAllowedTransition
          ? undefined
          : `Invalid transition from ${currentStage} to ${canonicalStage || 'unknown'}`,
        suggestedAction: isAllowedTransition
          ? 'allow'
          : this.enforcementMode === 'monitor_only'
            ? 'log'
            : 'block',
      };

      await this.logTransitionEvent({
        tenantId,
        opportunityId: 'unknown', // Will be set by caller
        pipelineId,
        fromStage: currentStage,
        toStage: (canonicalStage || currentStage) ?? undefined,
        requestedByGhlStageId: requestedGhlStageId,
        source,
        validationResult: result,
        enforced: this.shouldEnforce(),
        correlationId: 'unknown', // Will be set by caller
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Stage validation error for tenant ${tenantId}:`,
        errorMessage
      );

      // On error, default to blocking for safety
      return {
        allowed: false,
        reason: `Validation error: ${errorMessage}`,
        suggestedAction: 'block',
      };
    }
  }

  shouldEnforce(): boolean {
    return this.enforcementMode !== 'monitor_only';
  }

  getEnforcementMode(): StageEnforcementMode {
    return this.enforcementMode;
  }

  async logTransitionEvent(
    event: Omit<StageTransitionEvent, 'timestamp'>
  ): Promise<void> {
    // Log to structured logger for audit
    const logLevel = event.validationResult.allowed ? 'log' : 'warn';

    this.logger[logLevel]({
      message: 'Stage transition validation',
      tenantId: event.tenantId,
      opportunityId: event.opportunityId,
      pipelineId: event.pipelineId,
      fromStage: event.fromStage,
      toStage: event.toStage,
      requestedByGhlStageId: event.requestedByGhlStageId,
      source: event.source,
      allowed: event.validationResult.allowed,
      reason: event.validationResult.reason,
      enforced: event.enforced,
      correlationId: event.correlationId,
    });
  }
}
