/**
 * Voice Mode Selector - WI-029: Decision Engine & Actor Orchestration
 *
 * Determines whether voice interactions should use scripted AI,
 * conversational AI, or require human intervention.
 */

import { DecisionContext, VoiceMode, RiskAssessment } from './types';
import { DecisionPolicyResolver } from './policy/decision-policy.resolver';

export interface VoiceModeSelector {
  /**
   * Select the appropriate voice mode for a command
   */
  selectVoiceMode(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): VoiceMode | null;

  /**
   * Determine if voice interaction is allowed at all
   */
  isVoiceAllowed(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): { allowed: boolean; reason: string };
}

export class VoiceModeSelectorImpl implements VoiceModeSelector {
  selectVoiceMode(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): VoiceMode | null {
    // Only applies to voice channel commands
    if (context.executionCommand.channel !== 'voice') {
      return null;
    }

    // Check if voice is allowed at all
    const voiceCheck = this.isVoiceAllowed(
      context,
      riskAssessment,
      policyResolver
    );
    if (!voiceCheck.allowed) {
      return null; // Voice not allowed, will fall back to other channels or human
    }

    // Determine mode based on risk and requirements
    return this.determineVoiceMode(context, riskAssessment, policyResolver);
  }

  isVoiceAllowed(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): { allowed: boolean; reason: string } {
    // Only check for voice channel commands
    if (context.executionCommand.channel !== 'voice') {
      return { allowed: true, reason: 'Not a voice command' };
    }

    // Critical risk situations never allow AI voice
    if (riskAssessment.overallRisk === 'CRITICAL') {
      return {
        allowed: false,
        reason: 'Voice interactions not allowed for critical risk situations',
      };
    }

    // High deal values require human voice
    if (
      context.dealValue &&
      context.dealValue >= policyResolver.getHighDealValueThreshold()
    ) {
      return {
        allowed: false,
        reason: `High-value deals ($${context.dealValue.toLocaleString()}) require human voice interaction`,
      };
    }

    // High-risk customers require human voice
    if (context.customerRiskScore && context.customerRiskScore >= 0.8) {
      return {
        allowed: false,
        reason: `High-risk customers (${(context.customerRiskScore * 100).toFixed(0)}% risk score) require human voice interaction`,
      };
    }

    // Multiple retry attempts suggest human intervention
    if (context.retryCount >= policyResolver.getRetryLimitBeforeEscalation()) {
      return {
        allowed: false,
        reason: `Multiple retry attempts (${context.retryCount}) suggest human voice intervention needed`,
      };
    }

    // Check for negative evidence that suggests human is needed
    const negativeEvidence = context.evidenceSoFar.filter(
      e =>
        e.includes('failed') ||
        e.includes('disqualified') ||
        e.includes('angry') ||
        e.includes('complaint')
    );

    if (negativeEvidence.length > 0) {
      return {
        allowed: false,
        reason: `Negative evidence (${negativeEvidence.join(', ')}) suggests human voice intervention required`,
      };
    }

    return { allowed: true, reason: 'Voice interaction allowed' };
  }

  private determineVoiceMode(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): VoiceMode {
    // Scripted mode required for high-risk situations
    if (this.requiresScriptedMode(context, riskAssessment, policyResolver)) {
      return 'SCRIPTED';
    }

    // Conversational mode allowed for low-risk situations
    if (
      this.allowsConversationalMode(context, riskAssessment, policyResolver)
    ) {
      return 'CONVERSATIONAL';
    }

    // Default to scripted for safety
    return 'SCRIPTED';
  }

  private requiresScriptedMode(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): boolean {
    // Policy-driven: Scripted mode required for high-risk situations
    if (
      policyResolver.isRiskLevelAtOrAbove(
        riskAssessment.overallRisk,
        policyResolver.getScriptedRequiredRiskThreshold()
      )
    ) {
      return true;
    }

    // Medium risk with specific conditions
    if (riskAssessment.overallRisk === 'MEDIUM') {
      // Medium deal values require scripted
      if (
        context.dealValue &&
        context.dealValue >= policyResolver.getMediumDealValueThreshold()
      ) {
        return true;
      }

      // Medium customer risk requires scripted
      if (context.customerRiskScore && context.customerRiskScore >= 0.6) {
        return true;
      }

      // Any retry attempts require scripted
      if (context.retryCount > 0) {
        return true;
      }
    }

    // Critical SLA situations require scripted
    if (context.slaUrgency === 'critical') {
      return true;
    }

    // Specific stages may require scripted
    if (
      ['qualification_call', 'negotiation'].includes(
        context.executionCommand.actionType
      )
    ) {
      return true;
    }

    // Evidence suggesting caution
    const cautionEvidence = context.evidenceSoFar.filter(
      e =>
        e.includes('hesitant') ||
        e.includes('uncertain') ||
        e.includes('followup')
    );

    if (cautionEvidence.length > 0) {
      return true;
    }

    return false;
  }

  private allowsConversationalMode(
    context: DecisionContext,
    riskAssessment: RiskAssessment,
    policyResolver: DecisionPolicyResolver
  ): boolean {
    // Policy-driven: Only allow conversational for low-risk situations
    if (
      !policyResolver.isRiskLevelAtOrBelow(
        riskAssessment.overallRisk,
        policyResolver.getConversationalAllowedRiskThreshold()
      )
    ) {
      return false;
    }

    // Low deal values allow conversational
    if (
      context.dealValue &&
      context.dealValue < policyResolver.getLowDealValueThreshold()
    ) {
      return true;
    }

    // Low customer risk allows conversational
    if (context.customerRiskScore && context.customerRiskScore < 0.4) {
      return true;
    }

    // First attempts allow conversational
    if (context.retryCount === 0) {
      return true;
    }

    // Simple, routine actions allow conversational
    if (
      context.executionCommand.actionType === 'followup' ||
      context.executionCommand.actionType === 'contact_attempt'
    ) {
      return true;
    }

    // Positive evidence suggests conversational is fine
    const positiveEvidence = context.evidenceSoFar.filter(
      e =>
        e.includes('engaged') ||
        e.includes('interested') ||
        e.includes('responsive')
    );

    if (positiveEvidence.length > 0) {
      return true;
    }

    return false;
  }
}
