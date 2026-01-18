/**
 * Playbook Intelligence Types - WI-031: Playbook Experimentation & Outcome Intelligence
 *
 * Defines experimentation framework for measuring and comparing playbook performance.
 */

import { PlaybookVersionId } from '@neuronx/playbook-governance';
import { CanonicalOpportunityStage } from '@neuronx/pipeline';

/**
 * Experiment states
 */
export enum ExperimentState {
  DRAFT = 'draft', // Being configured
  ACTIVE = 'active', // Running and assigning traffic
  COMPLETED = 'completed', // Finished, results available
  TERMINATED = 'terminated', // Stopped early
}

/**
 * Assignment strategies for experiment variants
 */
export enum AssignmentStrategyType {
  PERCENTAGE = 'percentage', // Simple percentage split
  COHORT_BASED = 'cohort_based', // Assign based on cohort characteristics
  RISK_BASED = 'risk_based', // Assign based on risk assessment
  DETERMINISTIC = 'deterministic', // Deterministic assignment for reproducibility
}

/**
 * Experiment variant definition
 */
export interface ExperimentVariant {
  variantId: string;
  playbookVersion: PlaybookVersionId;
  displayName: string;
  description: string;

  // Assignment weight (percentage or priority)
  weight: number;

  // Eligibility criteria
  eligibilityCriteria?: EligibilityCriteria;

  // Variant metadata
  isControl: boolean; // Is this the control/baseline variant
  tags?: string[];
}

/**
 * Eligibility criteria for variant assignment
 */
export interface EligibilityCriteria {
  // Deal characteristics
  minDealValue?: number;
  maxDealValue?: number;

  // Risk profile
  maxRiskScore?: number; // 0-100

  // Stage constraints
  allowedStages?: CanonicalOpportunityStage[];
  excludedStages?: CanonicalOpportunityStage[];

  // SLA constraints
  urgencyLevels?: ('low' | 'normal' | 'high' | 'urgent')[];

  // Geographic/business unit constraints
  tenantIds?: string[];
  regions?: string[];

  // Custom criteria (extensible)
  customCriteria?: Record<string, any>;
}

/**
 * Assignment strategy configuration
 */
export interface AssignmentStrategy {
  strategyType: AssignmentStrategyType;

  // Percentage-based configuration
  percentages?: Record<string, number>; // variantId -> percentage

  // Cohort-based configuration
  cohortDefinition?: CohortDefinition;

  // Risk-based configuration
  riskThresholds?: RiskThreshold[];

  // Deterministic configuration
  deterministicKey?: string; // Field to use for deterministic assignment
}

/**
 * Cohort definition for cohort-based assignment
 */
export interface CohortDefinition {
  cohortField: string; // e.g., 'industry', 'companySize', 'region'
  cohortValues: Record<string, string[]>; // cohortName -> fieldValues
  variantMapping: Record<string, string>; // cohortName -> variantId
}

/**
 * Risk thresholds for risk-based assignment
 */
export interface RiskThreshold {
  minRiskScore: number;
  maxRiskScore: number;
  variantId: string;
  priority: number; // Higher priority wins for overlapping ranges
}

/**
 * Complete experiment definition
 */
export interface ExperimentDefinition {
  experimentId: string;
  name: string;
  description: string;

  // Lifecycle
  state: ExperimentState;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  terminatedAt?: Date;

  // Ownership
  createdBy: string;
  tenantId?: string; // null for global experiments

  // Experiment configuration
  variants: ExperimentVariant[];
  assignmentStrategy: AssignmentStrategy;

  // Targeting and constraints
  targetingCriteria: ExperimentTargeting;
  safetyConstraints: ExperimentSafety;

  // Experiment parameters
  durationDays?: number;
  minSampleSize?: number;
  statisticalSignificance?: number; // Required confidence level

  // Metadata
  tags?: string[];
  businessObjective?: string;
  hypothesis?: string;
}

/**
 * Experiment targeting configuration
 */
export interface ExperimentTargeting {
  // Traffic allocation
  trafficPercentage: number; // 0-100, percentage of eligible opportunities

  // Time-based targeting
  activeHours?: {
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
  };

  // Geographic targeting
  regions?: string[];

  // User/role targeting (for internal experiments)
  allowedRoles?: string[];

  // Custom targeting rules
  customRules?: Record<string, any>;
}

/**
 * Safety constraints for experiments
 */
export interface ExperimentSafety {
  // Maximum impact limits
  maxConcurrentOpportunities?: number;
  maxDailyAssignments?: number;

  // Fallback rules
  fallbackVariant?: string; // variantId to use if assignment fails

  // Emergency controls
  emergencyStopEnabled: boolean;
  emergencyStopThresholds?: {
    errorRate?: number; // Maximum error rate before stopping
    performanceDegradation?: number; // Performance drop threshold
    safetyIncidents?: number; // Maximum safety incidents
  };

  // Monitoring
  healthCheckIntervalMinutes?: number;
}

/**
 * Assignment result
 */
export interface AssignmentResult {
  experimentId: string;
  opportunityId: string;
  tenantId?: string;

  assignedVariantId: string;
  assignmentReason: string;
  assignmentConfidence: number; // 0-1, how confident the assignment is

  assignedAt: Date;
  assignedBy: string; // 'system' or user ID

  // Assignment metadata
  assignmentKey?: string; // Used for deterministic assignments
  eligibilityScore?: number; // How well the opportunity matched criteria
}

/**
 * Outcome metrics for tracking
 */
export interface OutcomeMetrics {
  // Conversion metrics
  reachedTargetStage: boolean;
  conversionTimeMinutes?: number;
  finalStage?: CanonicalOpportunityStage;

  // Performance metrics
  totalInteractions: number;
  successfulInteractions: number;
  failedInteractions: number;

  // Time metrics
  timeToFirstContact?: number;
  timeToQualification?: number;
  totalDurationMinutes?: number;

  // Quality metrics
  complianceScore?: number; // 0-100, adherence to playbook
  riskIncidents: number;
  safetyViolations: number;

  // Cost metrics
  totalCost?: number;
  costPerInteraction?: number;

  // Custom metrics
  customMetrics?: Record<string, number>;
}

/**
 * Outcome event recording
 */
export interface OutcomeEvent {
  eventId: string;
  experimentId: string;
  opportunityId: string;
  variantId: string;
  tenantId?: string;

  eventType:
    | 'stage_reached'
    | 'interaction_completed'
    | 'conversion'
    | 'failure'
    | 'safety_incident';
  eventData: Record<string, any>;

  recordedAt: Date;
  correlationId: string;
}

/**
 * Experiment results summary
 */
export interface ExperimentResults {
  experimentId: string;
  variantResults: Record<string, VariantResults>;
  overallMetrics: ExperimentMetrics;

  // Statistical analysis
  statisticalSummary: StatisticalSummary;
  confidenceIntervals: Record<string, ConfidenceInterval>;

  // Recommendations
  recommendations: ExperimentRecommendation[];

  // Analysis metadata
  analyzedAt: Date;
  sampleSize: number;
  analysisDurationDays: number;
}

/**
 * Results for a specific variant
 */
export interface VariantResults {
  variantId: string;
  sampleSize: number;
  metrics: OutcomeMetrics;

  // Statistical measures
  mean: Record<string, number>;
  median: Record<string, number>;
  standardDeviation: Record<string, number>;
  confidenceInterval95: Record<string, [number, number]>;

  // Performance indicators
  conversionRate: number;
  averageTimeToConversion?: number;
  riskIncidentRate: number;
  costEfficiency?: number;
}

/**
 * Overall experiment metrics
 */
export interface ExperimentMetrics {
  totalSampleSize: number;
  averageConversionRate: number;
  averageTimeToConversion?: number;
  totalRiskIncidents: number;
  totalSafetyViolations: number;
  totalCost?: number;

  // Experiment health
  assignmentSuccessRate: number;
  dataCompleteness: number; // Percentage of complete outcome data
}

/**
 * Statistical summary
 */
export interface StatisticalSummary {
  statisticalSignificance: number; // p-value
  effectSize: number; // Cohen's d or similar
  power: number; // Statistical power achieved

  // Key comparisons
  winnerVariant?: string;
  confidenceLevel: number;

  // Analysis notes
  assumptions: string[];
  limitations: string[];
}

/**
 * Confidence interval
 */
export interface ConfidenceInterval {
  metric: string;
  lowerBound: number;
  upperBound: number;
  confidenceLevel: number; // e.g., 0.95 for 95%
}

/**
 * Experiment recommendations
 */
export interface ExperimentRecommendation {
  recommendationId: string;
  type:
    | 'promote_variant'
    | 'continue_experiment'
    | 'stop_experiment'
    | 'investigate_anomaly';

  variantId?: string;
  confidence: number; // 0-1
  rationale: string;

  // Action details
  actionRequired: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';

  // Supporting data
  supportingMetrics: Record<string, number>;
  riskAssessment: string;
}

/**
 * Experiment audit event
 */
export interface ExperimentAuditEvent {
  eventId: string;
  experimentId: string;
  eventType:
    | 'experiment_created'
    | 'experiment_started'
    | 'assignment_made'
    | 'outcome_recorded'
    | 'experiment_completed'
    | 'experiment_terminated'
    | 'recommendation_generated';

  tenantId?: string;
  actor: string; // 'system' or user ID
  timestamp: Date;

  // Event details
  details: Record<string, any>;

  // Compliance tracking
  requiresAudit: boolean;
  complianceChecked: boolean;
  complianceNotes?: string;
}

/**
 * Experiment health status
 */
export interface ExperimentHealth {
  experimentId: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';

  // Health indicators
  assignmentRate: number; // Assignments per hour
  dataCompleteness: number; // Percentage of complete data
  errorRate: number; // Errors per 1000 assignments
  safetyIncidents: number; // Safety incidents in last 24h

  // Issues
  issues: ExperimentIssue[];

  lastChecked: Date;
}

/**
 * Experiment issue
 */
export interface ExperimentIssue {
  issueId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'assignment' | 'data' | 'safety' | 'performance';
  description: string;
  detectedAt: Date;
  resolvedAt?: Date;
}
