/**
 * Actor Selector - WI-029: Decision Engine & Actor Orchestration
 *
 * Determines which actor type (AI, Human, Hybrid) should execute a command
 * based on risk assessment, command requirements, and system capabilities.
 */

import {
  DecisionContext,
  ActorType,
  ActorCapability,
  RiskAssessment,
} from './types';
import { DecisionPolicyResolver } from './policy/decision-policy.resolver';

export interface ActorSelector {
  /**
   * Select the most appropriate actor for a command
   */
  selectActor(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): ActorCapability;

  /**
   * Assess capabilities of each actor type for a given context
   */
  assessActorCapabilities(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): Record<ActorType, ActorCapability>;
}

export class ActorSelectorImpl implements ActorSelector {
  selectActor(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): ActorCapability {
    const capabilities = this.assessActorCapabilities(
      context,
      riskAssessment,
      policyResolver
    );

    // Priority order: Human (most trustworthy) -> Hybrid (balanced) -> AI (fastest)
    const priorityOrder: ActorType[] = ['HUMAN', 'HYBRID', 'AI'];

    for (const actorType of priorityOrder) {
      const capability = capabilities[actorType];
      if (capability.canExecute) {
        return capability;
      }
    }

    // Fallback to human if no actor can execute (should not happen in practice)
    return capabilities.HUMAN;
  }

  assessActorCapabilities(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): Record<ActorType, ActorCapability> {
    const command = context.executionCommand;

    // AI capability assessment
    const aiCapability = this.assessAiCapability(
      context,
      riskAssessment,
      policyResolver
    );

    // Human capability assessment
    const humanCapability = this.assessHumanCapability(
      context,
      riskAssessment,
      policyResolver
    );

    // Hybrid capability assessment (AI-assisted human)
    const hybridCapability = this.assessHybridCapability(
      context,
      riskAssessment,
      policyResolver,
      aiCapability,
      humanCapability
    );

    return {
      AI: aiCapability,
      HUMAN: humanCapability,
      HYBRID: hybridCapability,
    };
  }

  private assessAiCapability(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): ActorCapability {
    const constraints: string[] = [];
    const riskFactors: string[] = [];

    let canExecute = true;
    let confidence = 1.0;

    // Check if AI is allowed by the command
    if (!context.executionCommand.aiAllowed) {
      canExecute = false;
      constraints.push('AI execution not allowed by command');
      confidence = 0.0;
    }

    // Check risk-based AI restrictions
    if (
      !policyResolver.isRiskLevelAtOrBelow(
        riskAssessment.overallRisk,
        policyResolver.getAiAllowedRiskThreshold()
      )
    ) {
      canExecute = false;
      constraints.push(
        `AI not allowed for ${riskAssessment.overallRisk} risk level`
      );
      riskFactors.push(
        `Risk level ${riskAssessment.overallRisk} exceeds AI threshold`
      );
      confidence = 0.0;
    }

    // Voice commands have additional AI restrictions
    if (context.executionCommand.channel === 'voice') {
      if (
        context.executionCommand.voiceMode === 'CONVERSATIONAL' &&
        riskAssessment.overallRisk === 'HIGH'
      ) {
        canExecute = false;
        constraints.push(
          'Conversational AI voice not allowed for high-risk situations'
        );
        riskFactors.push('High-risk conversational voice interaction');
        confidence = 0.3;
      }
    }

    // Reduce confidence based on retry count
    if (context.retryCount > 0) {
      confidence *= Math.max(0.5, 1.0 - context.retryCount * 0.1);
      if (context.retryCount >= config.retryLimits.beforeEscalation) {
        riskFactors.push('Multiple retry attempts reduce AI confidence');
      }
    }

    // Reduce confidence for high-value deals
    if (
      context.dealValue &&
      context.dealValue >= config.dealValueThresholds.high
    ) {
      confidence *= 0.7;
      riskFactors.push('High-value deal reduces AI confidence');
    }

    return {
      actorType: 'AI',
      canExecute,
      confidence,
      constraints,
      riskFactors,
    };
  }

  private assessHumanCapability(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): ActorCapability {
    const constraints: string[] = [];
    const riskFactors: string[] = [];

    let canExecute = true;
    let confidence = 0.9; // Humans are generally reliable but slower

    // Check if human execution is allowed by the command
    if (!context.executionCommand.humanAllowed) {
      canExecute = false;
      constraints.push('Human execution not allowed by command');
      confidence = 0.0;
    }

    // Humans can handle any risk level (they're the safety net)
    // But high-risk situations might require specific training/skills
    if (riskAssessment.overallRisk === 'CRITICAL') {
      constraints.push(
        'Requires trained human operator for critical situations'
      );
      confidence = 0.95; // Humans excel in high-stakes situations
    }

    // Humans are always available for urgent situations
    if (context.slaUrgency === 'critical') {
      constraints.push('Immediate human attention required for critical SLA');
      confidence = 0.98;
    }

    return {
      actorType: 'HUMAN',
      canExecute,
      confidence,
      constraints,
      riskFactors,
    };
  }

  private assessHybridCapability(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver,
    aiCapability: ActorCapability,
    humanCapability: ActorCapability
  ): ActorCapability {
    const constraints: string[] = [];
    const riskFactors: string[] = [];

    // Hybrid requires both AI and human to be capable
    const canExecute = aiCapability.canExecute && humanCapability.canExecute;

    if (!canExecute) {
      constraints.push(
        'Hybrid execution requires both AI and human capabilities'
      );
      if (!aiCapability.canExecute) {
        constraints.push('AI component not available');
      }
      if (!humanCapability.canExecute) {
        constraints.push('Human component not available');
      }
    }

    // Hybrid confidence is the minimum of AI and human confidence
    const confidence = Math.min(
      aiCapability.confidence,
      humanCapability.confidence
    );

    // Combine constraints and risk factors
    constraints.push(
      ...aiCapability.constraints,
      ...humanCapability.constraints
    );
    riskFactors.push(
      ...aiCapability.riskFactors,
      ...humanCapability.riskFactors
    );

    // Hybrid is good for medium-risk situations
    if (riskAssessment.overallRisk === 'MEDIUM') {
      constraints.push('Ideal for medium-risk situations requiring oversight');
    }

    // Hybrid reduces risk for voice interactions
    if (context.executionCommand.channel === 'voice') {
      constraints.push('Provides human oversight for voice interactions');
      riskFactors.push('Voice channel benefits from human supervision');
    }

    return {
      actorType: 'HYBRID',
      canExecute,
      confidence,
      constraints,
      riskFactors,
    };
  }

  private isAiAllowed(
    riskLevel: string,
    config: DecisionEngineConfig
  ): boolean {
    const riskHierarchy: string[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const aiAllowedThreshold = riskHierarchy.indexOf(
      config.riskThresholds.aiAllowed
    );
    const currentRiskIndex = riskHierarchy.indexOf(riskLevel);

    return currentRiskIndex <= aiAllowedThreshold;
  }
}
