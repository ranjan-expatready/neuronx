/**
 * Decision Policy Resolver - WI-042: Decision Policy Configuration
 *
 * Provides type-safe access to decision policy values for the DecisionEngine.
 * Acts as a bridge between policy configuration and decision logic.
 */

import { Injectable } from '@nestjs/common';
import { DecisionPolicyLoader } from './decision-policy.loader';
import { RiskLevel, DecisionEnforcementMode } from '../types';

@Injectable()
export class DecisionPolicyResolver {
  constructor(private readonly policyLoader: DecisionPolicyLoader) {}

  // Enforcement settings
  getEnforcementMode(): DecisionEnforcementMode {
    return this.policyLoader.getEnforcementMode();
  }

  // Risk thresholds
  getAiAllowedRiskThreshold(): RiskLevel {
    return this.policyLoader.getRiskThresholds().aiAllowed;
  }

  getHumanRequiredRiskThreshold(): RiskLevel {
    return this.policyLoader.getRiskThresholds().humanRequired;
  }

  getApprovalRequiredRiskThreshold(): RiskLevel {
    return this.policyLoader.getRiskThresholds().approvalRequired;
  }

  // Deal value thresholds
  getLowDealValueThreshold(): number {
    return this.policyLoader.getDealValueThresholds().low;
  }

  getMediumDealValueThreshold(): number {
    return this.policyLoader.getDealValueThresholds().medium;
  }

  getHighDealValueThreshold(): number {
    return this.policyLoader.getDealValueThresholds().high;
  }

  // SLA urgency mapping
  getSlaUrgencyRiskLevel(
    urgency: 'low' | 'normal' | 'high' | 'critical'
  ): RiskLevel {
    return this.policyLoader.getSlaUrgencyMapping()[urgency];
  }

  // Voice mode rules
  getScriptedRequiredRiskThreshold(): RiskLevel {
    return this.policyLoader.getVoiceModeRules().scriptedRequired;
  }

  getConversationalAllowedRiskThreshold(): RiskLevel {
    return this.policyLoader.getVoiceModeRules().conversationalAllowed;
  }

  // Voice constraints
  getMaxVoiceDurationMinutes(): number {
    return this.policyLoader.getVoiceConstraints().maxDurationMinutes;
  }

  getScriptedConfidenceThreshold(): number {
    return this.policyLoader.getVoiceConstraints().scriptedConfidenceThreshold;
  }

  getConversationalRiskLimit(): RiskLevel {
    return this.policyLoader.getVoiceConstraints().conversationalRiskLimit;
  }

  // Actor selection rules
  getAiConfidenceThreshold(): number {
    return this.policyLoader.getActorSelectionRules().aiConfidenceThreshold;
  }

  getHybridActorThreshold(): number {
    return this.policyLoader.getActorSelectionRules().hybridActorThreshold;
  }

  isHumanFallbackEnabled(): boolean {
    return this.policyLoader.getActorSelectionRules().humanFallbackEnabled;
  }

  // Execution mode rules
  getAutonomousMaxRisk(): RiskLevel {
    return this.policyLoader.getExecutionModeRules().autonomousMaxRisk;
  }

  getAssistedMinRisk(): RiskLevel {
    return this.policyLoader.getExecutionModeRules().assistedMinRisk;
  }

  getApprovalMinRisk(): RiskLevel {
    return this.policyLoader.getExecutionModeRules().approvalMinRisk;
  }

  shouldHybridAlwaysBeAssisted(): boolean {
    return this.policyLoader.getExecutionModeRules().hybridAlwaysAssisted;
  }

  // Escalation rules
  shouldCriticalRiskAlwaysEscalate(): boolean {
    return this.policyLoader.getEscalationRules().criticalRiskAlwaysEscalate;
  }

  getHighValueDealEscalationThreshold(): number {
    return this.policyLoader.getEscalationRules().highValueDealThreshold;
  }

  getRetryCountEscalationThreshold(): number {
    return this.policyLoader.getEscalationRules().retryCountEscalationThreshold;
  }

  shouldSlaCriticalAlwaysEscalate(): boolean {
    return this.policyLoader.getEscalationRules().slaCriticalEscalation;
  }

  // Retry limits
  getRetryLimitBeforeEscalation(): number {
    return this.policyLoader.getRetryLimits().beforeEscalation;
  }

  getRetryLimitBeforeHumanOverride(): number {
    return this.policyLoader.getRetryLimits().beforeHumanOverride;
  }

  // Feature flags
  isVoiceExecutionEnabled(): boolean {
    return this.policyLoader.getFeatures().voiceExecution;
  }

  areAiActorsEnabled(): boolean {
    return this.policyLoader.getFeatures().aiActors;
  }

  areHybridActorsEnabled(): boolean {
    return this.policyLoader.getFeatures().hybridActors;
  }

  isRiskAssessmentEnabled(): boolean {
    return this.policyLoader.getFeatures().riskAssessment;
  }

  isEscalationWorkflowEnabled(): boolean {
    return this.policyLoader.getFeatures().escalationWorkflow;
  }

  // Utility methods for decision logic
  isRiskLevelAtOrAbove(level: RiskLevel, threshold: RiskLevel): boolean {
    const riskOrder: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const levelIndex = riskOrder.indexOf(level);
    const thresholdIndex = riskOrder.indexOf(threshold);
    return levelIndex >= thresholdIndex;
  }

  isRiskLevelBelow(level: RiskLevel, threshold: RiskLevel): boolean {
    return !this.isRiskLevelAtOrAbove(level, threshold);
  }

  isRiskLevelAtOrBelow(level: RiskLevel, threshold: RiskLevel): boolean {
    const riskOrder: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const levelIndex = riskOrder.indexOf(level);
    const thresholdIndex = riskOrder.indexOf(threshold);
    return levelIndex <= thresholdIndex;
  }

  classifyDealValueRisk(dealValue?: number): RiskLevel {
    if (!dealValue) return 'LOW';

    if (dealValue < this.getLowDealValueThreshold()) {
      return 'LOW';
    } else if (dealValue < this.getMediumDealValueThreshold()) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  shouldEscalateBasedOnDealValue(
    dealValue?: number,
    actorType?: 'AI' | 'HUMAN' | 'HYBRID'
  ): boolean {
    if (!dealValue || actorType === 'HUMAN') return false;

    return dealValue >= this.getHighValueDealEscalationThreshold();
  }
}
