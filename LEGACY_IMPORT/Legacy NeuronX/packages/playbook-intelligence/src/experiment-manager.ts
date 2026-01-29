/**
 * Experiment Manager - WI-031: Playbook Experimentation & Outcome Intelligence
 *
 * Manages experiment lifecycle and deterministic assignment of opportunities to variants.
 */

import {
  ExperimentDefinition,
  ExperimentState,
  ExperimentVariant,
  AssignmentStrategyType,
  AssignmentResult,
  ExperimentAuditEvent,
  ExperimentHealth,
  ExperimentIssue,
} from './types';
import { CanonicalOpportunityStage } from '@neuronx/pipeline';

/**
 * Opportunity context for assignment decisions
 */
export interface OpportunityContext {
  opportunityId: string;
  tenantId?: string;
  currentStage: CanonicalOpportunityStage;
  dealValue: number;
  riskScore: number; // 0-100
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  industry?: string;
  companySize?: number;
  region?: string;
  customAttributes?: Record<string, any>;
}

/**
 * In-memory experiment manager implementation
 */
export class ExperimentManager {
  private experiments = new Map<string, ExperimentDefinition>();
  private activeAssignments = new Map<string, AssignmentResult>();
  private auditLog: ExperimentAuditEvent[] = [];

  /**
   * Generate deterministic assignment key
   */
  private generateAssignmentKey(
    experimentId: string,
    opportunityId: string
  ): string {
    // Use a simple hash for deterministic assignment
    const combined = `${experimentId}:${opportunityId}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if opportunity is eligible for experiment
   */
  private isEligible(
    opportunity: OpportunityContext,
    experiment: ExperimentDefinition
  ): { eligible: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 1.0; // Base eligibility score

    // Check targeting criteria
    const targeting = experiment.targetingCriteria;

    // Traffic percentage (random sampling)
    if (Math.random() * 100 > targeting.trafficPercentage) {
      reasons.push(
        `Not selected by traffic sampling (${targeting.trafficPercentage}%)`
      );
      return { eligible: false, score: 0, reasons };
    }

    // Time-based targeting
    if (targeting.activeHours) {
      const now = new Date();
      const currentTime = now
        .toLocaleTimeString('en-US', {
          hour12: false,
          timeZone: targeting.activeHours.timezone,
        })
        .substring(0, 5);

      if (
        currentTime < targeting.activeHours.start ||
        currentTime > targeting.activeHours.end
      ) {
        reasons.push('Outside active hours');
        return { eligible: false, score: 0, reasons };
      }
    }

    // Geographic targeting
    if (
      targeting.regions &&
      opportunity.region &&
      !targeting.regions.includes(opportunity.region)
    ) {
      reasons.push(`Region ${opportunity.region} not targeted`);
      return { eligible: false, score: 0, reasons };
    }

    // Check all variants for eligibility
    const eligibleVariants: ExperimentVariant[] = [];

    for (const variant of experiment.variants) {
      if (!variant.eligibilityCriteria) {
        eligibleVariants.push(variant);
        continue;
      }

      const criteria = variant.eligibilityCriteria;
      let variantEligible = true;

      // Deal value constraints
      if (
        criteria.minDealValue &&
        opportunity.dealValue < criteria.minDealValue
      ) {
        variantEligible = false;
        reasons.push(
          `Deal value below minimum for variant ${variant.variantId}`
        );
      }
      if (
        criteria.maxDealValue &&
        opportunity.dealValue > criteria.maxDealValue
      ) {
        variantEligible = false;
        reasons.push(
          `Deal value above maximum for variant ${variant.variantId}`
        );
      }

      // Risk constraints
      if (
        criteria.maxRiskScore &&
        opportunity.riskScore > criteria.maxRiskScore
      ) {
        variantEligible = false;
        reasons.push(`Risk score too high for variant ${variant.variantId}`);
      }

      // Stage constraints
      if (
        criteria.allowedStages &&
        !criteria.allowedStages.includes(opportunity.currentStage)
      ) {
        variantEligible = false;
        reasons.push(`Stage not allowed for variant ${variant.variantId}`);
      }
      if (
        criteria.excludedStages &&
        criteria.excludedStages.includes(opportunity.currentStage)
      ) {
        variantEligible = false;
        reasons.push(`Stage excluded for variant ${variant.variantId}`);
      }

      // SLA constraints
      if (
        criteria.urgencyLevels &&
        !criteria.urgencyLevels.includes(opportunity.urgency)
      ) {
        variantEligible = false;
        reasons.push(
          `Urgency level not allowed for variant ${variant.variantId}`
        );
      }

      // Tenant constraints
      if (
        criteria.tenantIds &&
        opportunity.tenantId &&
        !criteria.tenantIds.includes(opportunity.tenantId)
      ) {
        variantEligible = false;
        reasons.push(`Tenant not allowed for variant ${variant.variantId}`);
      }

      if (variantEligible) {
        eligibleVariants.push(variant);
      }
    }

    if (eligibleVariants.length === 0) {
      reasons.push('No eligible variants found');
      return { eligible: false, score: 0, reasons };
    }

    // Calculate eligibility score based on how well it matches targeting
    score = eligibleVariants.length / experiment.variants.length;

    return { eligible: true, score, reasons: [] };
  }

  /**
   * Assign opportunity to experiment variant using configured strategy
   */
  private assignVariant(
    opportunity: OpportunityContext,
    experiment: ExperimentDefinition
  ): { variantId: string; reason: string; confidence: number } {
    const strategy = experiment.assignmentStrategy;
    const assignmentKey = this.generateAssignmentKey(
      experiment.experimentId,
      opportunity.opportunityId
    );

    switch (strategy.strategyType) {
      case AssignmentStrategyType.PERCENTAGE:
        return this.assignByPercentage(opportunity, experiment, assignmentKey);

      case AssignmentStrategyType.COHORT_BASED:
        return this.assignByCohort(opportunity, experiment);

      case AssignmentStrategyType.RISK_BASED:
        return this.assignByRisk(opportunity, experiment);

      case AssignmentStrategyType.DETERMINISTIC:
        return this.assignDeterministically(
          opportunity,
          experiment,
          assignmentKey
        );

      default:
        // Fallback to percentage assignment
        return this.assignByPercentage(opportunity, experiment, assignmentKey);
    }
  }

  /**
   * Percentage-based assignment
   */
  private assignByPercentage(
    opportunity: OpportunityContext,
    experiment: ExperimentDefinition,
    assignmentKey: string
  ): { variantId: string; reason: string; confidence: number } {
    const strategy = experiment.assignmentStrategy;

    if (!strategy.percentages) {
      throw new Error('Percentage strategy requires percentages configuration');
    }

    // Use assignment key for deterministic assignment
    const keyHash = parseInt(assignmentKey, 36);
    const randomValue = (keyHash % 100) / 100; // 0-1

    let cumulativePercentage = 0;
    for (const [variantId, percentage] of Object.entries(
      strategy.percentages
    )) {
      cumulativePercentage += percentage / 100;
      if (randomValue <= cumulativePercentage) {
        return {
          variantId,
          reason: `Assigned by percentage (${percentage}%)`,
          confidence: 1.0,
        };
      }
    }

    // Fallback to first variant
    const fallbackVariant = Object.keys(strategy.percentages)[0];
    return {
      variantId: fallbackVariant,
      reason: 'Fallback assignment',
      confidence: 0.5,
    };
  }

  /**
   * Cohort-based assignment
   */
  private assignByCohort(
    opportunity: OpportunityContext,
    experiment: ExperimentDefinition
  ): { variantId: string; reason: string; confidence: number } {
    const strategy = experiment.assignmentStrategy;

    if (!strategy.cohortDefinition) {
      throw new Error('Cohort strategy requires cohort definition');
    }

    const cohortDef = strategy.cohortDefinition;
    const fieldValue =
      opportunity[cohortDef.cohortField as keyof OpportunityContext];

    if (!fieldValue) {
      return {
        variantId: experiment.variants[0].variantId, // Fallback
        reason: `No value for cohort field ${cohortDef.cohortField}`,
        confidence: 0.3,
      };
    }

    // Find matching cohort
    for (const [cohortName, values] of Object.entries(cohortDef.cohortValues)) {
      if (values.includes(fieldValue as string)) {
        const variantId = cohortDef.variantMapping[cohortName];
        if (variantId) {
          return {
            variantId,
            reason: `Assigned to cohort ${cohortName}`,
            confidence: 0.9,
          };
        }
      }
    }

    // No matching cohort
    return {
      variantId: experiment.variants[0].variantId,
      reason: 'No matching cohort found',
      confidence: 0.4,
    };
  }

  /**
   * Risk-based assignment
   */
  private assignByRisk(
    opportunity: OpportunityContext,
    experiment: ExperimentDefinition
  ): { variantId: string; reason: string; confidence: number } {
    const strategy = experiment.assignmentStrategy;

    if (!strategy.riskThresholds) {
      throw new Error('Risk strategy requires risk thresholds');
    }

    // Sort thresholds by priority (highest first)
    const sortedThresholds = [...strategy.riskThresholds].sort(
      (a, b) => b.priority - a.priority
    );

    for (const threshold of sortedThresholds) {
      if (
        opportunity.riskScore >= threshold.minRiskScore &&
        opportunity.riskScore <= threshold.maxRiskScore
      ) {
        return {
          variantId: threshold.variantId,
          reason: `Risk score ${opportunity.riskScore} in range [${threshold.minRiskScore}, ${threshold.maxRiskScore}]`,
          confidence: 0.95,
        };
      }
    }

    // No matching threshold
    return {
      variantId: experiment.variants[0].variantId,
      reason: `No risk threshold matched score ${opportunity.riskScore}`,
      confidence: 0.6,
    };
  }

  /**
   * Deterministic assignment
   */
  private assignDeterministically(
    opportunity: OpportunityContext,
    experiment: ExperimentDefinition,
    assignmentKey: string
  ): { variantId: string; reason: string; confidence: number } {
    const strategy = experiment.assignmentStrategy;
    const keyField = strategy.deterministicKey || 'opportunityId';

    const keyValue = opportunity[keyField as keyof OpportunityContext];
    if (!keyValue) {
      return {
        variantId: experiment.variants[0].variantId,
        reason: `No value for deterministic key ${keyField}`,
        confidence: 0.5,
      };
    }

    // Use hash of key value for deterministic assignment
    const hash = this.generateAssignmentKey(
      experiment.experimentId,
      keyValue as string
    );
    const variantIndex = parseInt(hash, 36) % experiment.variants.length;

    return {
      variantId: experiment.variants[variantIndex].variantId,
      reason: `Deterministic assignment using ${keyField}`,
      confidence: 1.0,
    };
  }

  /**
   * Check safety constraints
   */
  private checkSafetyConstraints(
    experiment: ExperimentDefinition,
    currentAssignments: number
  ): { safe: boolean; reason: string } {
    const safety = experiment.safetyConstraints;

    if (
      safety.maxConcurrentOpportunities &&
      currentAssignments >= safety.maxConcurrentOpportunities
    ) {
      return {
        safe: false,
        reason: `Maximum concurrent opportunities (${safety.maxConcurrentOpportunities}) exceeded`,
      };
    }

    // Additional safety checks could include:
    // - Daily assignment limits
    // - Error rate monitoring
    // - Performance degradation detection

    return { safe: true, reason: 'Safety constraints satisfied' };
  }

  /**
   * Log audit event
   */
  private logAuditEvent(
    event: Omit<ExperimentAuditEvent, 'eventId' | 'timestamp'>
  ): void {
    const auditEvent: ExperimentAuditEvent = {
      ...event,
      eventId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    this.auditLog.push(auditEvent);
  }

  /**
   * Create a new experiment
   */
  createExperiment(
    experiment: Omit<
      ExperimentDefinition,
      'experimentId' | 'state' | 'createdAt' | 'updatedAt'
    >,
    createdBy: string
  ): ExperimentDefinition {
    const experimentId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullExperiment: ExperimentDefinition = {
      ...experiment,
      experimentId,
      state: ExperimentState.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
    };

    this.experiments.set(experimentId, fullExperiment);

    this.logAuditEvent({
      eventType: 'experiment_created',
      experimentId,
      tenantId: experiment.tenantId,
      actor: createdBy,
      details: { name: experiment.name },
      requiresAudit: true,
      complianceChecked: true,
    });

    return fullExperiment;
  }

  /**
   * Start an experiment
   */
  startExperiment(
    experimentId: string,
    startedBy: string
  ): ExperimentDefinition {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.state !== ExperimentState.DRAFT) {
      throw new Error(
        `Experiment ${experimentId} is in ${experiment.state} state, must be DRAFT to start`
      );
    }

    // Validate experiment configuration
    this.validateExperiment(experiment);

    const startedExperiment: ExperimentDefinition = {
      ...experiment,
      state: ExperimentState.ACTIVE,
      startedAt: new Date(),
      updatedAt: new Date(),
    };

    this.experiments.set(experimentId, startedExperiment);

    this.logAuditEvent({
      eventType: 'experiment_started',
      experimentId,
      tenantId: experiment.tenantId,
      actor: startedBy,
      details: { name: experiment.name },
      requiresAudit: true,
      complianceChecked: true,
    });

    return startedExperiment;
  }

  /**
   * Validate experiment configuration
   */
  private validateExperiment(experiment: ExperimentDefinition): void {
    if (experiment.variants.length < 2) {
      throw new Error('Experiment must have at least 2 variants');
    }

    if (!experiment.variants.some(v => v.isControl)) {
      throw new Error('Experiment must have a control variant');
    }

    const totalWeight = experiment.variants.reduce(
      (sum, v) => sum + v.weight,
      0
    );
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error('Variant weights must sum to 100');
    }

    // Additional validation could include:
    // - Variant playbook versions exist
    // - Assignment strategy is valid
    // - Safety constraints are reasonable
  }

  /**
   * Assign opportunity to experiment variant
   */
  assignOpportunity(
    opportunity: OpportunityContext,
    experimentId: string,
    assignedBy = 'system'
  ): AssignmentResult | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.state !== ExperimentState.ACTIVE) {
      return null; // Experiment not active
    }

    // Check if already assigned
    const existingKey = `${experimentId}:${opportunity.opportunityId}`;
    if (this.activeAssignments.has(existingKey)) {
      return this.activeAssignments.get(existingKey)!;
    }

    // Check eligibility
    const eligibility = this.isEligible(opportunity, experiment);
    if (!eligibility.eligible) {
      return null; // Not eligible
    }

    // Check safety constraints
    const currentAssignments = Array.from(
      this.activeAssignments.values()
    ).filter(a => a.experimentId === experimentId).length;

    const safetyCheck = this.checkSafetyConstraints(
      experiment,
      currentAssignments
    );
    if (!safetyCheck.safe) {
      return null; // Safety violation
    }

    // Assign variant
    const assignment = this.assignVariant(opportunity, experiment);

    const result: AssignmentResult = {
      experimentId,
      opportunityId: opportunity.opportunityId,
      tenantId: opportunity.tenantId,
      assignedVariantId: assignment.variantId,
      assignmentReason: assignment.reason,
      assignmentConfidence: assignment.confidence,
      assignedAt: new Date(),
      assignedBy,
      assignmentKey: this.generateAssignmentKey(
        experimentId,
        opportunity.opportunityId
      ),
      eligibilityScore: eligibility.score,
    };

    // Store assignment
    this.activeAssignments.set(existingKey, result);

    this.logAuditEvent({
      eventType: 'assignment_made',
      experimentId,
      tenantId: opportunity.tenantId,
      actor: assignedBy,
      details: {
        opportunityId: opportunity.opportunityId,
        variantId: assignment.variantId,
        reason: assignment.reason,
      },
      requiresAudit: false,
      complianceChecked: true,
    });

    return result;
  }

  /**
   * Get experiment by ID
   */
  getExperiment(experimentId: string): ExperimentDefinition | null {
    return this.experiments.get(experimentId) || null;
  }

  /**
   * List experiments with filtering
   */
  listExperiments(filters?: {
    tenantId?: string;
    state?: ExperimentState;
    createdBy?: string;
  }): ExperimentDefinition[] {
    let experiments = Array.from(this.experiments.values());

    if (filters?.tenantId) {
      experiments = experiments.filter(e => e.tenantId === filters.tenantId);
    }

    if (filters?.state) {
      experiments = experiments.filter(e => e.state === filters.state);
    }

    if (filters?.createdBy) {
      experiments = experiments.filter(e => e.createdBy === filters.createdBy);
    }

    return experiments.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Complete an experiment
   */
  completeExperiment(
    experimentId: string,
    completedBy: string
  ): ExperimentDefinition {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.state !== ExperimentState.ACTIVE) {
      throw new Error(
        `Experiment ${experimentId} is in ${experiment.state} state, must be ACTIVE to complete`
      );
    }

    const completedExperiment: ExperimentDefinition = {
      ...experiment,
      state: ExperimentState.COMPLETED,
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    this.experiments.set(experimentId, completedExperiment);

    this.logAuditEvent({
      eventType: 'experiment_completed',
      experimentId,
      tenantId: experiment.tenantId,
      actor: completedBy,
      details: { name: experiment.name },
      requiresAudit: true,
      complianceChecked: true,
    });

    return completedExperiment;
  }

  /**
   * Terminate an experiment early
   */
  terminateExperiment(
    experimentId: string,
    terminatedBy: string,
    reason: string
  ): ExperimentDefinition {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.state !== ExperimentState.ACTIVE) {
      throw new Error(
        `Experiment ${experimentId} is in ${experiment.state} state, cannot terminate`
      );
    }

    const terminatedExperiment: ExperimentDefinition = {
      ...experiment,
      state: ExperimentState.TERMINATED,
      terminatedAt: new Date(),
      updatedAt: new Date(),
    };

    this.experiments.set(experimentId, terminatedExperiment);

    this.logAuditEvent({
      eventType: 'experiment_terminated',
      experimentId,
      tenantId: experiment.tenantId,
      actor: terminatedBy,
      details: { name: experiment.name, reason },
      requiresAudit: true,
      complianceChecked: true,
    });

    return terminatedExperiment;
  }

  /**
   * Get assignment for an opportunity
   */
  getAssignment(
    experimentId: string,
    opportunityId: string
  ): AssignmentResult | null {
    const key = `${experimentId}:${opportunityId}`;
    return this.activeAssignments.get(key) || null;
  }

  /**
   * Get audit log
   */
  getAuditLog(
    experimentId?: string,
    tenantId?: string
  ): ExperimentAuditEvent[] {
    let events = this.auditLog;

    if (experimentId) {
      events = events.filter(e => e.experimentId === experimentId);
    }

    if (tenantId) {
      events = events.filter(e => e.tenantId === tenantId);
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Check experiment health
   */
  checkHealth(experimentId: string): ExperimentHealth {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    // Calculate health metrics (simplified)
    const assignments = Array.from(this.activeAssignments.values()).filter(
      a => a.experimentId === experimentId
    );

    const assignmentRate = assignments.length / 24; // Per hour approximation
    const dataCompleteness = 0.95; // Mock value
    const errorRate = 0.001; // Mock value
    const safetyIncidents = 0; // Mock value

    let status: ExperimentHealth['status'] = 'healthy';
    const issues: ExperimentIssue[] = [];

    if (errorRate > 0.01) {
      status = 'warning';
      issues.push({
        issueId: `issue_${Date.now()}`,
        severity: 'medium',
        category: 'assignment',
        description: `High error rate: ${errorRate}`,
        detectedAt: new Date(),
      });
    }

    if (safetyIncidents > 0) {
      status = 'critical';
      issues.push({
        issueId: `issue_${Date.now() + 1}`,
        severity: 'high',
        category: 'safety',
        description: `${safetyIncidents} safety incidents detected`,
        detectedAt: new Date(),
      });
    }

    return {
      experimentId,
      status,
      assignmentRate,
      dataCompleteness,
      errorRate,
      safetyIncidents,
      issues,
      lastChecked: new Date(),
    };
  }
}
