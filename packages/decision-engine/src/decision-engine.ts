/**
 * Decision Engine - WI-029: Decision Engine & Actor Orchestration
 *
 * Main orchestration engine that coordinates risk assessment,
 * actor selection, and voice mode determination to make
 * authoritative decisions about command execution.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  DecisionContext,
  DecisionResult,
  DecisionEnforcementMode,
  ExecutionMode,
  DecisionAuditEvent,
  DecisionEngineConfig,
  DEFAULT_DECISION_CONFIG,
} from './types';
import { DecisionContextBuilder } from './decision-context';
import { RiskGate } from './risk-gate';
import { ActorSelector } from './actor-selector';
import { VoiceModeSelector } from './voice-mode-selector';
import { DecisionPolicyResolver } from './policy/decision-policy.resolver';

export interface DecisionEngine {
  /**
   * Make a decision about how to execute a command
   */
  makeDecision(context: DecisionContext): Promise<DecisionResult>;

  /**
   * Set enforcement mode
   */
  setEnforcementMode(mode: DecisionEnforcementMode): void;

  /**
   * Get current enforcement mode
   */
  getEnforcementMode(): DecisionEnforcementMode;

  /**
   * Validate that a decision result is properly formed
   */
  validateDecisionResult(result: DecisionResult): {
    valid: boolean;
    errors: string[];
  };
}

@Injectable()
export class DecisionEngineImpl implements DecisionEngine {
  private readonly logger = new Logger(DecisionEngineImpl.name);

  constructor(
    private readonly contextBuilder: DecisionContextBuilder,
    private readonly riskGate: RiskGate,
    private readonly actorSelector: ActorSelector,
    private readonly voiceModeSelector: VoiceModeSelector,
    private readonly policyResolver: DecisionPolicyResolver
  ) {}

  async makeDecision(partialContext: any): Promise<DecisionResult> {
    const startTime = Date.now();

    try {
      // Build and validate complete context
      const context = this.contextBuilder.buildContext(partialContext);
      const validation = this.contextBuilder.validateContext(context);

      if (!validation.valid) {
        throw new Error(
          `Invalid decision context: ${validation.errors.join(', ')}`
        );
      }

      // Assess risk
      const riskAssessment = this.riskGate.assessRisk(
        context,
        this.policyResolver
      );

      // Select actor
      const actorCapability = this.actorSelector.selectActor(
        context,
        riskAssessment,
        this.policyResolver
      );

      // Determine execution mode
      const executionMode = this.determineExecutionMode(
        context,
        riskAssessment,
        actorCapability
      );

      // Select voice mode if applicable
      const voiceMode = this.voiceModeSelector.selectVoiceMode(
        context,
        riskAssessment,
        this.policyResolver
      );

      // Check if voice is allowed
      const voiceCheck = this.voiceModeSelector.isVoiceAllowed(
        context,
        riskAssessment,
        this.policyResolver
      );

      // Determine escalation requirements
      const escalationRequired = this.determineEscalationRequired(
        context,
        riskAssessment,
        executionMode
      );

      // Build execution constraints
      const executionConstraints = this.buildExecutionConstraints(
        context,
        riskAssessment,
        actorCapability,
        voiceCheck
      );

      // Determine if execution is allowed
      const allowed = this.determineExecutionAllowed(
        context,
        riskAssessment,
        actorCapability,
        voiceCheck,
        executionMode
      );

      // Build decision result
      const result: DecisionResult = {
        allowed,
        reason: this.buildDecisionReason(
          context,
          riskAssessment,
          actorCapability,
          allowed
        ),
        actor: actorCapability.actorType,
        mode: executionMode,
        voiceMode: voiceMode || undefined,
        escalationRequired,
        executionConstraints,
        riskLevel: riskAssessment.overallRisk,
        decidedAt: new Date(),
        correlationId: context.correlationId,
        decisionEngineVersion: '1.0.0',
      };

      // Validate result
      const resultValidation = this.validateDecisionResult(result);
      if (!resultValidation.valid) {
        throw new Error(
          `Invalid decision result: ${resultValidation.errors.join(', ')}`
        );
      }

      // Log decision for audit
      this.logDecision(context, result, riskAssessment);

      const processingTime = Date.now() - startTime;
      this.logger.debug(`Decision made in ${processingTime}ms`, {
        correlationId: context.correlationId,
        opportunityId: context.opportunityId,
        allowed: result.allowed,
        actor: result.actor,
        riskLevel: result.riskLevel,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Decision engine error after ${processingTime}ms`, {
        correlationId: partialContext.correlationId || 'unknown',
        opportunityId: partialContext.opportunityId || 'unknown',
        error: errorMessage,
      });

      // Fail-safe: return human-only decision on error
      return this.createFailSafeDecision(partialContext);
    }
  }

  setEnforcementMode(mode: DecisionEnforcementMode): void {
    // Note: Enforcement mode is now read from policy configuration
    // This method is kept for compatibility but enforcement mode comes from policy
    this.logger.warn(
      `Enforcement mode is now configured in decision-policy.yaml. Ignoring runtime override to: ${mode}`
    );
  }

  getEnforcementMode(): DecisionEnforcementMode {
    return this.policyResolver.getEnforcementMode();
  }

  validateDecisionResult(result: DecisionResult): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (typeof result.allowed !== 'boolean') {
      errors.push('allowed must be a boolean');
    }

    if (!result.reason || typeof result.reason !== 'string') {
      errors.push('reason is required and must be a string');
    }

    if (!['AI', 'HUMAN', 'HYBRID'].includes(result.actor)) {
      errors.push('actor must be AI, HUMAN, or HYBRID');
    }

    if (
      !['AUTONOMOUS', 'ASSISTED', 'APPROVAL_REQUIRED'].includes(result.mode)
    ) {
      errors.push('mode must be AUTONOMOUS, ASSISTED, or APPROVAL_REQUIRED');
    }

    if (
      result.voiceMode &&
      !['SCRIPTED', 'CONVERSATIONAL'].includes(result.voiceMode)
    ) {
      errors.push('voiceMode must be SCRIPTED or CONVERSATIONAL if specified');
    }

    if (typeof result.escalationRequired !== 'boolean') {
      errors.push('escalationRequired must be a boolean');
    }

    if (!Array.isArray(result.executionConstraints)) {
      errors.push('executionConstraints must be an array');
    }

    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(result.riskLevel)) {
      errors.push('riskLevel must be LOW, MEDIUM, HIGH, or CRITICAL');
    }

    if (!(result.decidedAt instanceof Date)) {
      errors.push('decidedAt must be a Date');
    }

    if (!result.correlationId || typeof result.correlationId !== 'string') {
      errors.push('correlationId is required and must be a string');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private determineExecutionMode(
    context: DecisionContext,
    riskAssessment: any,
    actorCapability: any
  ): ExecutionMode {
    // Policy-driven: Approval required for high-risk situations
    if (
      this.policyResolver.isRiskLevelAtOrAbove(
        riskAssessment.overallRisk,
        this.policyResolver.getApprovalRequiredRiskThreshold()
      )
    ) {
      return 'APPROVAL_REQUIRED';
    }

    // Policy-driven: Assisted mode for medium-risk or when using hybrid actors
    if (
      this.policyResolver.isRiskLevelAtOrAbove(
        riskAssessment.overallRisk,
        this.policyResolver.getAssistedMinRisk()
      ) ||
      (actorCapability.actorType === 'HYBRID' &&
        this.policyResolver.shouldHybridAlwaysBeAssisted())
    ) {
      return 'ASSISTED';
    }

    // Policy-driven: Critical SLA situations may require assistance
    if (
      context.slaUrgency === 'critical' &&
      actorCapability.actorType === 'AI' &&
      this.policyResolver.shouldSlaCriticalAlwaysEscalate()
    ) {
      return 'ASSISTED';
    }

    // Policy-driven: Multiple retries suggest need for assistance
    if (
      context.retryCount > 0 &&
      context.retryCount < this.policyResolver.getRetryLimitBeforeEscalation()
    ) {
      return 'ASSISTED';
    }

    // Policy-driven: Default to autonomous for low-risk situations
    if (
      this.policyResolver.isRiskLevelAtOrBelow(
        riskAssessment.overallRisk,
        this.policyResolver.getAutonomousMaxRisk()
      )
    ) {
      return 'AUTONOMOUS';
    }

    // Fallback to assisted for anything else
    return 'ASSISTED';
  }

  private determineEscalationRequired(
    context: DecisionContext,
    riskAssessment: any,
    executionMode: ExecutionMode
  ): boolean {
    // Policy-driven: Always escalate critical situations
    if (
      riskAssessment.overallRisk === 'CRITICAL' &&
      this.policyResolver.shouldCriticalRiskAlwaysEscalate()
    ) {
      return true;
    }

    // Policy-driven: Escalate approval-required executions
    if (
      executionMode === 'APPROVAL_REQUIRED' &&
      this.policyResolver.isEscalationWorkflowEnabled()
    ) {
      return true;
    }

    // Policy-driven: Escalate after too many retries
    if (
      context.retryCount >=
      this.policyResolver.getRetryCountEscalationThreshold()
    ) {
      return true;
    }

    // Policy-driven: Escalate high-value deals with AI execution
    if (
      this.policyResolver.shouldEscalateBasedOnDealValue(
        context.dealValue,
        context.executionCommand.aiAllowed ? 'AI' : 'HUMAN'
      )
    ) {
      return true;
    }

    // Policy-driven: Critical SLA always escalates
    if (
      context.slaUrgency === 'critical' &&
      this.policyResolver.shouldSlaCriticalAlwaysEscalate()
    ) {
      return true;
    }

    return false;
  }

  private buildExecutionConstraints(
    context: DecisionContext,
    riskAssessment: any,
    actorCapability: any,
    voiceCheck: any
  ): string[] {
    const constraints: string[] = [];

    // Add actor-specific constraints
    constraints.push(...actorCapability.constraints);

    // Add risk-based constraints
    if (riskAssessment.mitigationRequired) {
      constraints.push(...riskAssessment.recommendedActions);
    }

    // Add voice-specific constraints
    if (context.executionCommand.channel === 'voice') {
      if (!voiceCheck.allowed) {
        constraints.push(voiceCheck.reason);
      } else {
        constraints.push(
          'Voice interaction requires clear communication protocols'
        );
      }
    }

    // Add SLA constraints
    if (context.slaUrgency === 'critical') {
      constraints.push('Critical SLA: Execute immediately or escalate');
    }

    // Add deal value constraints
    if (context.dealValue && context.dealValue > 10000) {
      constraints.push(
        `High-value opportunity: $${context.dealValue.toLocaleString()} deal requires careful handling`
      );
    }

    return [...new Set(constraints)]; // Remove duplicates
  }

  private determineExecutionAllowed(
    context: DecisionContext,
    riskAssessment: any,
    actorCapability: any,
    voiceCheck: any,
    executionMode: ExecutionMode
  ): boolean {
    // Check if actor can execute
    if (!actorCapability.canExecute) {
      return false;
    }

    // Check voice constraints
    if (context.executionCommand.channel === 'voice' && !voiceCheck.allowed) {
      return false;
    }

    // Policy-driven: In monitor mode, allow everything but log
    if (this.policyResolver.getEnforcementMode() === 'monitor_only') {
      return true;
    }

    // Policy-driven: In enforcement modes, apply strict rules
    if (
      riskAssessment.overallRisk === 'CRITICAL' &&
      executionMode !== 'APPROVAL_REQUIRED' &&
      this.policyResolver.shouldCriticalRiskAlwaysEscalate()
    ) {
      return false;
    }

    // Policy-driven: High-risk AI execution requires approval
    if (
      this.policyResolver.isRiskLevelAtOrAbove(
        riskAssessment.overallRisk,
        this.policyResolver.getApprovalMinRisk()
      ) &&
      actorCapability.actorType === 'AI' &&
      executionMode !== 'APPROVAL_REQUIRED'
    ) {
      return false;
    }

    return true;
  }

  private buildDecisionReason(
    context: DecisionContext,
    riskAssessment: any,
    actorCapability: any,
    allowed: boolean
  ): string {
    const parts: string[] = [];

    parts.push(`Risk level: ${riskAssessment.overallRisk}`);
    parts.push(`Selected actor: ${actorCapability.actorType}`);
    parts.push(
      `Actor confidence: ${(actorCapability.confidence * 100).toFixed(0)}%`
    );

    if (riskAssessment.riskFactors.length > 0) {
      parts.push(`Risk factors: ${riskAssessment.riskFactors.join(', ')}`);
    }

    if (!allowed) {
      parts.push('EXECUTION BLOCKED');
    } else {
      parts.push('EXECUTION ALLOWED');
    }

    return parts.join(' | ');
  }

  private logDecision(
    context: DecisionContext,
    result: DecisionResult,
    riskAssessment: any
  ): void {
    const auditEvent: Omit<DecisionAuditEvent, 'eventId' | 'timestamp'> = {
      tenantId: context.tenantId,
      opportunityId: context.opportunityId,
      decisionContext: context,
      decisionResult: result,
      enforcementMode: this.policyResolver.getEnforcementMode(),
      enforced: result.allowed,
      correlationId: context.correlationId,
    };

    // Log at appropriate level
    const logLevel = result.allowed ? 'info' : 'warn';
    const message = result.allowed
      ? 'Decision: execution allowed'
      : 'Decision: execution blocked/restricted';

    this.logger[logLevel](message, {
      tenantId: context.tenantId,
      opportunityId: context.opportunityId,
      stageId: context.stageId,
      commandType: context.executionCommand.commandType,
      actor: result.actor,
      mode: result.mode,
      riskLevel: result.riskLevel,
      allowed: result.allowed,
      reason: result.reason,
      escalationRequired: result.escalationRequired,
      correlationId: context.correlationId,
    });
  }

  private createFailSafeDecision(partialContext: any): DecisionResult {
    return {
      allowed: true, // Allow execution but force human involvement
      reason:
        'FAILSAFE: Error in decision engine, defaulting to human execution',
      actor: 'HUMAN',
      mode: 'ASSISTED',
      escalationRequired: true,
      executionConstraints: [
        'FAILSAFE MODE: Human supervision required',
        'Review decision engine logs for root cause',
        'Consider manual override if appropriate',
      ],
      riskLevel: 'CRITICAL',
      decidedAt: new Date(),
      correlationId: partialContext.correlationId || `failsafe_${Date.now()}`,
      decisionEngineVersion: '1.0.0',
    };
  }
}
