import type { GhlBoundaryPolicy } from './boundary-policy.schema';
import type { ViolationSeverity, ViolationType } from './ghl-violation.types';

/**
 * Resolves policy decisions and provides convenient access to policy rules
 */
export class BoundaryPolicyResolver {
  constructor(private readonly policy: GhlBoundaryPolicy) {}

  /**
   * Check if an action is allowed in workflows
   */
  isWorkflowActionAllowed(action: string): boolean {
    return this.policy.allowedWorkflowActions.includes(action);
  }

  /**
   * Check if an action is denied in workflows (business logic)
   */
  isWorkflowActionDenied(action: string): boolean {
    return this.policy.deniedWorkflowActions.includes(action);
  }

  /**
   * Check if a pipeline mutation is allowed
   */
  isPipelineMutationAllowed(mutation: string): boolean {
    return this.policy.allowedPipelineMutations.includes(mutation);
  }

  /**
   * Check if a pipeline mutation is denied
   */
  isPipelineMutationDenied(mutation: string): boolean {
    return this.policy.deniedPipelineMutations.includes(mutation);
  }

  /**
   * Check if an AI worker capability is allowed
   */
  isAiWorkerCapabilityAllowed(capability: string): boolean {
    return this.policy.allowedAiWorkerCapabilities.includes(capability);
  }

  /**
   * Check if an AI worker capability is denied
   */
  isAiWorkerCapabilityDenied(capability: string): boolean {
    return this.policy.deniedAiWorkerCapabilities.includes(capability);
  }

  /**
   * Check if text matches any business logic patterns
   */
  matchesBusinessLogicPattern(text: string): {
    matched: boolean;
    patterns: string[];
  } {
    const matchedPatterns: string[] = [];

    for (const rule of this.policy.businessLogicRules) {
      for (const pattern of rule.patterns) {
        try {
          const regex = new RegExp(pattern, 'i'); // Case insensitive matching
          if (regex.test(text)) {
            matchedPatterns.push(`${rule.name}:${pattern}`);
          }
        } catch (error) {
          // Invalid regex pattern - skip
          console.warn(
            `Invalid regex pattern in business logic rule ${rule.name}: ${pattern}`
          );
        }
      }
    }

    return {
      matched: matchedPatterns.length > 0,
      patterns: matchedPatterns,
    };
  }

  /**
   * Check if complexity thresholds are exceeded
   */
  checkComplexityThresholds(metrics: {
    actionCount?: number;
    conditionDepth?: number;
    branchCount?: number;
    triggerCount?: number;
  }): { exceeded: boolean; violations: string[] } {
    const violations: string[] = [];
    const { thresholds } = this.policy;

    if (
      metrics.actionCount &&
      metrics.actionCount > thresholds.maxActionsPerWorkflow
    ) {
      violations.push(
        `Action count ${metrics.actionCount} exceeds threshold ${thresholds.maxActionsPerWorkflow}`
      );
    }

    if (
      metrics.conditionDepth &&
      metrics.conditionDepth > thresholds.maxConditionDepth
    ) {
      violations.push(
        `Condition depth ${metrics.conditionDepth} exceeds threshold ${thresholds.maxConditionDepth}`
      );
    }

    if (
      metrics.branchCount &&
      metrics.branchCount > thresholds.maxBranchCount
    ) {
      violations.push(
        `Branch count ${metrics.branchCount} exceeds threshold ${thresholds.maxBranchCount}`
      );
    }

    if (
      metrics.triggerCount &&
      metrics.triggerCount > thresholds.maxTriggerCount
    ) {
      violations.push(
        `Trigger count ${metrics.triggerCount} exceeds threshold ${thresholds.maxTriggerCount}`
      );
    }

    return {
      exceeded: violations.length > 0,
      violations,
    };
  }

  /**
   * Get severity configuration for a given severity level
   */
  getSeverityConfig(severity: ViolationSeverity) {
    return this.policy.severityLevels[severity];
  }

  /**
   * Get risk classification rule for a given risk type
   */
  getRiskClassificationRule(riskType: string) {
    return this.policy.riskClassificationRules[riskType];
  }

  /**
   * Check if webhook calls must include NeuronX token header
   */
  requiresNeuronxTokenHeader(): boolean {
    return this.policy.requireNeuronxTokenHeaderOnWebhookCalls;
  }

  /**
   * Get enforcement mode
   */
  getEnforcementMode(): 'monitor_only' | 'block' {
    return this.policy.enforcementMode;
  }

  /**
   * Check if enforcement should block operations
   */
  shouldBlockOperations(): boolean {
    return this.policy.enforcementMode === 'block';
  }

  /**
   * Get violation category description
   */
  getViolationCategoryDescription(violationType: ViolationType): string {
    return (
      this.policy.violationCategories[violationType] || 'Unknown violation type'
    );
  }

  /**
   * Get all policy thresholds for validation
   */
  getThresholds() {
    return { ...this.policy.thresholds };
  }

  /**
   * Get all allowed/denied lists for validation
   */
  getActionLists() {
    return {
      allowedWorkflowActions: [...this.policy.allowedWorkflowActions],
      deniedWorkflowActions: [...this.policy.deniedWorkflowActions],
      allowedPipelineMutations: [...this.policy.allowedPipelineMutations],
      deniedPipelineMutations: [...this.policy.deniedPipelineMutations],
      allowedAiWorkerCapabilities: [...this.policy.allowedAiWorkerCapabilities],
      deniedAiWorkerCapabilities: [...this.policy.deniedAiWorkerCapabilities],
    };
  }
}
