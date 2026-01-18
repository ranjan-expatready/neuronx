/**
 * Decision Engine Types - WI-029: Decision Engine & Actor Orchestration
 *
 * Defines the complete decision framework for determining WHO executes,
 * HOW it's done, and under WHAT constraints.
 */

import { ExecutionCommand, EvidenceType } from '@neuronx/playbook-engine';

/**
 * Decision enforcement modes
 */
export type DecisionEnforcementMode =
  | 'monitor_only'
  | 'block'
  | 'block_and_escalate';

/**
 * Actor types that can execute commands
 */
export type ActorType = 'AI' | 'HUMAN' | 'HYBRID';

/**
 * Execution modes
 */
export type ExecutionMode = 'AUTONOMOUS' | 'ASSISTED' | 'APPROVAL_REQUIRED';

/**
 * Voice execution modes
 */
export type VoiceMode = 'SCRIPTED' | 'CONVERSATIONAL';

/**
 * Risk levels for decision making
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Decision context - inputs required for decision making
 */
export interface DecisionContext {
  /** Tenant making the request */
  tenantId: string;

  /** Opportunity being acted upon */
  opportunityId: string;

  /** Current playbook stage */
  stageId: string;

  /** Execution command to be evaluated */
  executionCommand: ExecutionCommand;

  /** Deal value in USD (affects risk assessment) */
  dealValue?: number;

  /** Customer risk score (0.0-1.0, higher = riskier) */
  customerRiskScore?: number;

  /** SLA urgency level */
  slaUrgency: 'low' | 'normal' | 'high' | 'critical';

  /** Number of previous attempts for this action */
  retryCount: number;

  /** Evidence collected so far for this opportunity */
  evidenceSoFar: EvidenceType[];

  /** Playbook version being used */
  playbookVersion: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Timestamp of decision request */
  requestedAt: Date;
}

/**
 * Decision result - immutable output of decision engine
 */
export interface DecisionResult {
  /** Whether execution is allowed */
  allowed: boolean;

  /** Reason for the decision (for audit) */
  reason: string;

  /** Selected actor type */
  actor: ActorType;

  /** Selected execution mode */
  mode: ExecutionMode;

  /** Voice mode (if applicable) */
  voiceMode?: VoiceMode;

  /** Whether escalation is required */
  escalationRequired: boolean;

  /** Additional execution constraints */
  executionConstraints: string[];

  /** Risk level assessment */
  riskLevel: RiskLevel;

  /** Decision timestamp */
  decidedAt: Date;

  /** Correlation ID */
  correlationId: string;

  /** Decision engine version */
  decisionEngineVersion: string;
}

/**
 * Actor capability assessment
 */
export interface ActorCapability {
  actorType: ActorType;
  canExecute: boolean;
  confidence: number; // 0.0-1.0
  constraints: string[];
  riskFactors: string[];
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  overallRisk: RiskLevel;
  riskFactors: string[];
  mitigationRequired: boolean;
  recommendedActions: string[];
}

/**
 * Decision engine configuration
 */
export interface DecisionEngineConfig {
  /** Default enforcement mode */
  enforcementMode: DecisionEnforcementMode;

  /** Risk thresholds for actor selection */
  riskThresholds: {
    aiAllowed: RiskLevel;
    humanRequired: RiskLevel;
    approvalRequired: RiskLevel;
  };

  /** Deal value thresholds */
  dealValueThresholds: {
    low: number; // <$10K
    medium: number; // $10K-$100K
    high: number; // >$100K
  };

  /** SLA-based urgency mapping */
  slaUrgencyMapping: {
    low: RiskLevel;
    normal: RiskLevel;
    high: RiskLevel;
    critical: RiskLevel;
  };

  /** Voice mode selection rules */
  voiceModeRules: {
    scriptedRequired: RiskLevel;
    conversationalAllowed: RiskLevel;
  };

  /** Retry limits before escalation */
  retryLimits: {
    beforeEscalation: number;
    beforeHumanOverride: number;
  };
}

/**
 * Default decision engine configuration
 */
export const DEFAULT_DECISION_CONFIG: DecisionEngineConfig = {
  enforcementMode: 'monitor_only',
  riskThresholds: {
    aiAllowed: 'MEDIUM',
    humanRequired: 'HIGH',
    approvalRequired: 'CRITICAL',
  },
  dealValueThresholds: {
    low: 10000, // $10K
    medium: 100000, // $100K
    high: 100000, // $100K+
  },
  slaUrgencyMapping: {
    low: 'LOW',
    normal: 'MEDIUM',
    high: 'HIGH',
    critical: 'CRITICAL',
  },
  voiceModeRules: {
    scriptedRequired: 'HIGH',
    conversationalAllowed: 'LOW',
  },
  retryLimits: {
    beforeEscalation: 3,
    beforeHumanOverride: 5,
  },
};

/**
 * Decision audit event
 */
export interface DecisionAuditEvent {
  eventId: string;
  tenantId: string;
  opportunityId: string;
  decisionContext: DecisionContext;
  decisionResult: DecisionResult;
  enforcementMode: DecisionEnforcementMode;
  enforced: boolean;
  timestamp: Date;
  correlationId: string;
}
