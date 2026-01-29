/**
 * Risk Gate - WI-029: Decision Engine & Actor Orchestration
 *
 * Assesses risk levels for decision making based on deal value,
 * customer risk score, SLA urgency, and other factors.
 */

import { DecisionContext, RiskAssessment, RiskLevel } from './types';
import { DecisionPolicyResolver } from './policy/decision-policy.resolver';

export interface RiskGate {
  /**
   * Assess overall risk for a decision context
   */
  assessRisk(
    context: DecisionContext,
    policyResolver: DecisionPolicyResolver
  ): RiskAssessment;

  /**
   * Determine if AI execution is allowed based on risk
   */
  isAiAllowed(
    riskLevel: RiskLevel,
    policyResolver: DecisionPolicyResolver
  ): boolean;

  /**
   * Determine if human execution is required based on risk
   */
  isHumanRequired(
    riskLevel: RiskLevel,
    policyResolver: DecisionPolicyResolver
  ): boolean;

  /**
   * Determine if approval is required based on risk
   */
  isApprovalRequired(
    riskLevel: RiskLevel,
    policyResolver: DecisionPolicyResolver
  ): boolean;
}

export class RiskGateImpl implements RiskGate {
  assessRisk(
    context: DecisionContext,
    policyResolver: DecisionPolicyResolver
  ): RiskAssessment {
    const riskFactors: string[] = [];
    let maxRiskLevel: RiskLevel = 'LOW';

    // Assess deal value risk
    const dealValueRisk = this.assessDealValueRisk(
      context.dealValue,
      policyResolver
    );
    if (dealValueRisk.level !== 'LOW') {
      riskFactors.push(`Deal value risk: ${dealValueRisk.reason}`);
      maxRiskLevel = this.maxRiskLevel(maxRiskLevel, dealValueRisk.level);
    }

    // Assess customer risk score
    const customerRisk = this.assessCustomerRisk(context.customerRiskScore);
    if (customerRisk.level !== 'LOW') {
      riskFactors.push(`Customer risk: ${customerRisk.reason}`);
      maxRiskLevel = this.maxRiskLevel(maxRiskLevel, customerRisk.level);
    }

    // Assess SLA urgency
    const slaRisk = this.assessSlaRisk(context.slaUrgency, policyResolver);
    if (slaRisk.level !== 'LOW') {
      riskFactors.push(`SLA urgency: ${slaRisk.reason}`);
      maxRiskLevel = this.maxRiskLevel(maxRiskLevel, slaRisk.level);
    }

    // Assess retry risk
    const retryRisk = this.assessRetryRisk(context.retryCount, policyResolver);
    if (retryRisk.level !== 'LOW') {
      riskFactors.push(`Retry attempts: ${retryRisk.reason}`);
      maxRiskLevel = this.maxRiskLevel(maxRiskLevel, retryRisk.level);
    }

    // Assess command-specific risk
    const commandRisk = this.assessCommandRisk(context.executionCommand);
    if (commandRisk.level !== 'LOW') {
      riskFactors.push(`Command type: ${commandRisk.reason}`);
      maxRiskLevel = this.maxRiskLevel(maxRiskLevel, commandRisk.level);
    }

    // Assess evidence risk (lack of positive evidence increases risk)
    const evidenceRisk = this.assessEvidenceRisk(
      context.evidenceSoFar,
      context.stageId
    );
    if (evidenceRisk.level !== 'LOW') {
      riskFactors.push(`Evidence assessment: ${evidenceRisk.reason}`);
      maxRiskLevel = this.maxRiskLevel(maxRiskLevel, evidenceRisk.level);
    }

    // Determine mitigation requirements
    const mitigationRequired =
      maxRiskLevel === 'HIGH' || maxRiskLevel === 'CRITICAL';
    const recommendedActions = this.getRecommendedActions(
      maxRiskLevel,
      riskFactors
    );

    return {
      overallRisk: maxRiskLevel,
      riskFactors,
      mitigationRequired,
      recommendedActions,
    };
  }

  isAiAllowed(
    riskLevel: RiskLevel,
    policyResolver: DecisionPolicyResolver
  ): boolean {
    const aiAllowedThreshold = policyResolver.getAiAllowedRiskThreshold();
    return policyResolver.isRiskLevelAtOrBelow(riskLevel, aiAllowedThreshold);
  }

  isHumanRequired(
    riskLevel: RiskLevel,
    policyResolver: DecisionPolicyResolver
  ): boolean {
    const humanRequiredThreshold =
      policyResolver.getHumanRequiredRiskThreshold();
    return policyResolver.isRiskLevelAtOrAbove(
      riskLevel,
      humanRequiredThreshold
    );
  }

  isApprovalRequired(
    riskLevel: RiskLevel,
    policyResolver: DecisionPolicyResolver
  ): boolean {
    const approvalRequiredThreshold =
      policyResolver.getApprovalRequiredRiskThreshold();
    return policyResolver.isRiskLevelAtOrAbove(
      riskLevel,
      approvalRequiredThreshold
    );
  }

  private assessDealValueRisk(
    dealValue: number | undefined,
    policyResolver: DecisionPolicyResolver
  ): { level: RiskLevel; reason: string } {
    if (!dealValue || dealValue <= 0) {
      return { level: 'LOW', reason: 'No deal value specified' };
    }

    if (dealValue >= policyResolver.getHighDealValueThreshold()) {
      return {
        level: 'CRITICAL',
        reason: `High-value deal ($${dealValue.toLocaleString()})`,
      };
    }

    if (dealValue >= policyResolver.getMediumDealValueThreshold()) {
      return {
        level: 'HIGH',
        reason: `Medium-value deal ($${dealValue.toLocaleString()})`,
      };
    }

    if (dealValue >= policyResolver.getLowDealValueThreshold()) {
      return {
        level: 'MEDIUM',
        reason: `Low-value deal ($${dealValue.toLocaleString()})`,
      };
    }

    return {
      level: 'LOW',
      reason: `Micro deal ($${dealValue.toLocaleString()})`,
    };
  }

  private assessCustomerRisk(customerRiskScore: number | undefined): {
    level: RiskLevel;
    reason: string;
  } {
    if (customerRiskScore === undefined) {
      return { level: 'MEDIUM', reason: 'No customer risk score available' };
    }

    if (customerRiskScore >= 0.8) {
      return {
        level: 'CRITICAL',
        reason: `High-risk customer (${(customerRiskScore * 100).toFixed(0)}% risk score)`,
      };
    }

    if (customerRiskScore >= 0.6) {
      return {
        level: 'HIGH',
        reason: `Elevated customer risk (${(customerRiskScore * 100).toFixed(0)}% risk score)`,
      };
    }

    if (customerRiskScore >= 0.4) {
      return {
        level: 'MEDIUM',
        reason: `Moderate customer risk (${(customerRiskScore * 100).toFixed(0)}% risk score)`,
      };
    }

    return {
      level: 'LOW',
      reason: `Low-risk customer (${(customerRiskScore * 100).toFixed(0)}% risk score)`,
    };
  }

  private assessSlaRisk(
    slaUrgency: 'low' | 'normal' | 'high' | 'critical',
    policyResolver: DecisionPolicyResolver
  ): { level: RiskLevel; reason: string } {
    const mappedRisk = policyResolver.getSlaUrgencyRiskLevel(slaUrgency);
    const reason = `SLA urgency: ${slaUrgency}`;

    return { level: mappedRisk, reason };
  }

  private assessRetryRisk(
    retryCount: number,
    policyResolver: DecisionPolicyResolver
  ): { level: RiskLevel; reason: string } {
    if (retryCount >= policyResolver.getRetryLimitBeforeHumanOverride()) {
      return {
        level: 'CRITICAL',
        reason: `Excessive retries (${retryCount} attempts)`,
      };
    }

    if (retryCount >= policyResolver.getRetryLimitBeforeEscalation()) {
      return {
        level: 'HIGH',
        reason: `Multiple retry attempts (${retryCount} attempts)`,
      };
    }

    if (retryCount > 0) {
      return {
        level: 'MEDIUM',
        reason: `Retry attempt (${retryCount} attempts)`,
      };
    }

    return { level: 'LOW', reason: 'First attempt' };
  }

  private assessCommandRisk(command: any): {
    level: RiskLevel;
    reason: string;
  } {
    // Voice commands have higher risk due to direct customer interaction
    if (command.channel === 'voice') {
      return {
        level: 'MEDIUM',
        reason: 'Voice channel requires careful execution',
      };
    }

    // High-priority commands have higher risk
    if (command.priority === 'urgent') {
      return { level: 'HIGH', reason: 'Urgent priority command' };
    }

    return { level: 'LOW', reason: 'Standard command type' };
  }

  private assessEvidenceRisk(
    evidenceSoFar: string[],
    _stageId: string
  ): { level: RiskLevel; reason: string } {
    // Lack of evidence increases risk
    if (evidenceSoFar.length === 0) {
      return {
        level: 'MEDIUM',
        reason: 'No evidence collected yet for this opportunity',
      };
    }

    // Check for negative evidence (failures, disqualifications)
    const negativeEvidence = evidenceSoFar.filter(
      e =>
        e.includes('failed') || e.includes('disqualified') || e.includes('lost')
    );

    if (negativeEvidence.length > 0) {
      return {
        level: 'HIGH',
        reason: `Previous negative evidence: ${negativeEvidence.join(', ')}`,
      };
    }

    return {
      level: 'LOW',
      reason: `${evidenceSoFar.length} evidence items collected`,
    };
  }

  private maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
    const hierarchy: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    return hierarchy[Math.max(hierarchy.indexOf(a), hierarchy.indexOf(b))];
  }

  private getRecommendedActions(
    riskLevel: RiskLevel,
    _riskFactors: string[]
  ): string[] {
    const actions: string[] = [];

    if (riskLevel === 'CRITICAL') {
      actions.push('Require supervisor approval before execution');
      actions.push('Log detailed audit trail');
      actions.push('Consider human-only execution');
    } else if (riskLevel === 'HIGH') {
      actions.push('Require additional verification');
      actions.push('Enable detailed logging');
      actions.push('Consider assisted execution mode');
    } else if (riskLevel === 'MEDIUM') {
      actions.push('Enable enhanced monitoring');
      actions.push('Consider scripted execution where applicable');
    }

    return actions;
  }
}
