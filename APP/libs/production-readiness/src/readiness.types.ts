// Production Readiness Dashboard Types
// Enterprise-grade tenant readiness and trust assessment

// Status Enums
export enum ReadinessStatus {
  READY = 'READY',
  WARN = 'WARN',
  BLOCKED = 'BLOCKED',
  UNKNOWN = 'UNKNOWN',
}

export enum SignalStatus {
  PASS = 'PASS',
  WARN = 'WARN',
  FAIL = 'FAIL',
  UNKNOWN = 'UNKNOWN',
}

// Domain Identifiers
export enum ReadinessDomain {
  SYSTEM_HEALTH = 'systemHealth',
  GOVERNANCE = 'governance',
  GHL_TRUST = 'ghlTrust',
  VOICE_RISK = 'voiceRisk',
  BILLING_REVENUE = 'billingRevenue',
}

// Signal Structure
export interface ReadinessSignal {
  key: string;
  value: any;
  unit?: string;
  status: SignalStatus;
  reason: string;
  evidenceRefs?: string[];
  policyRef?: string;
  lastUpdated?: Date;
}

// Next Step Structure
export interface ReadinessNextStep {
  title: string;
  action: string;
  ownerRole: string;
  estimatedMins: number;
  linkToDocs?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Domain Status Structure
export interface DomainStatus {
  status: ReadinessStatus;
  summary: string;
  signals: ReadinessSignal[];
  actionableNextSteps: ReadinessNextStep[];
  lastEvaluated: Date;
  evaluationDurationMs: number;
  domainScore?: number; // 0-100, optional
}

// Overall Readiness Structure
export interface OverallReadiness {
  status: ReadinessStatus;
  summary: string;
  score?: number; // 0-100, deterministic weighting
  blockingReasons: string[];
  lastEvaluated: Date;
}

// Complete Readiness Report
export interface ReadinessReport {
  tenantId: string;
  correlationId: string;
  generatedAt: Date;
  overall: OverallReadiness;
  domains: {
    [ReadinessDomain.SYSTEM_HEALTH]: DomainStatus;
    [ReadinessDomain.GOVERNANCE]: DomainStatus;
    [ReadinessDomain.GHL_TRUST]: DomainStatus;
    [ReadinessDomain.VOICE_RISK]: DomainStatus;
    [ReadinessDomain.BILLING_REVENUE]: DomainStatus;
  };
  evidence: {
    linksOrPaths: string[];
  };
}

// Evaluation Context
export interface ReadinessEvaluationContext {
  tenantId: string;
  correlationId: string;
  evaluationStartTime: Date;
  includeDetails: boolean;
}

// Domain Evaluator Interface
export interface DomainEvaluator {
  readonly domain: ReadinessDomain;

  evaluate(context: ReadinessEvaluationContext): Promise<DomainStatus>;
}

// Readiness Engine Configuration
export interface ReadinessEngineConfig {
  evaluationTimeoutMs: number;
  enableDetailedSignals: boolean;
  scoringWeights?: {
    [ReadinessDomain.SYSTEM_HEALTH]: number;
    [ReadinessDomain.GOVERNANCE]: number;
    [ReadinessDomain.GHL_TRUST]: number;
    [ReadinessDomain.VOICE_RISK]: number;
    [ReadinessDomain.BILLING_REVENUE]: number;
  };
  scoringThresholds?: {
    readyMinScore: number; // Min score for READY status
    warnMinScore: number; // Min score for WARN status (below this is BLOCKED)
  };
}

// Scoring Configuration (if used)
export const DEFAULT_SCORING_WEIGHTS = {
  [ReadinessDomain.SYSTEM_HEALTH]: 0.25,
  [ReadinessDomain.GOVERNANCE]: 0.2,
  [ReadinessDomain.GHL_TRUST]: 0.2,
  [ReadinessDomain.VOICE_RISK]: 0.15,
  [ReadinessDomain.BILLING_REVENUE]: 0.2,
} as const;

export const DEFAULT_SCORING_THRESHOLDS = {
  readyMinScore: 80,
  warnMinScore: 60,
} as const;

// Domain-specific types for evaluators

// System Health Signals
export interface SystemHealthSignals {
  apiResponsiveness: ReadinessSignal;
  queueBacklog?: ReadinessSignal;
  errorRate?: ReadinessSignal;
  policyLoadersStatus: ReadinessSignal;
  databaseConnectivity: ReadinessSignal;
}

// Governance Signals
export interface GovernanceSignals {
  decisionEnforcementMode: ReadinessSignal;
  billingEnforcementMode: ReadinessSignal;
  boundaryEnforcementMode: ReadinessSignal;
  blockedActionsCount: ReadinessSignal;
  overrideJustificationsRate: ReadinessSignal;
  missingPrincipalAttributionRate: ReadinessSignal;
}

// GHL Trust Signals
export interface GhlTrustSignals {
  snapshotFreshness: ReadinessSignal;
  driftSeverityCount: ReadinessSignal;
  boundaryViolationsCount: ReadinessSignal;
  mappingCoverage: ReadinessSignal;
  unmappedLocationsCount: ReadinessSignal;
}

// Voice Risk Signals
export interface VoiceRiskSignals {
  voiceModeDistribution?: ReadinessSignal;
  enumOutcomeCompliance: ReadinessSignal;
  recordingCompliance?: ReadinessSignal;
  piiMaskingCompliance?: ReadinessSignal;
  durationViolationCount: ReadinessSignal;
}

// Billing Revenue Signals
export interface BillingRevenueSignals {
  billingStatus: ReadinessSignal;
  planTierResolved: ReadinessSignal;
  usageVsLimits: ReadinessSignal;
  gracePeriodRemaining?: ReadinessSignal;
  billingSyncFailures: ReadinessSignal;
}

// Evidence Reference Types
export enum EvidenceType {
  POLICY_VERSION = 'POLICY_VERSION',
  SNAPSHOT_ID = 'SNAPSHOT_ID',
  AUDIT_LOG_ENTRY = 'AUDIT_LOG_ENTRY',
  METRIC_QUERY = 'METRIC_QUERY',
  CONFIG_VALIDATION = 'CONFIG_VALIDATION',
}

export interface EvidenceReference {
  type: EvidenceType;
  id: string;
  description: string;
  link?: string;
}
