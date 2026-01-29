// GHL Boundary Violation Types and Enums

export enum ViolationSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ViolationType {
  LOGIC_IN_WORKFLOW = 'LOGIC_IN_WORKFLOW',
  UNAPPROVED_STAGE_TRANSITION = 'UNAPPROVED_STAGE_TRANSITION',
  UNAPPROVED_AUTOMATION_ACTION = 'UNAPPROVED_AUTOMATION_ACTION',
  AI_WORKER_UNSCOPED_ACTIONS = 'AI_WORKER_UNSCOPED_ACTIONS',
  WEBHOOK_BYPASS_RISK = 'WEBHOOK_BYPASS_RISK',
  UNKNOWN_RISK = 'UNKNOWN_RISK',
}

export enum EntityType {
  WORKFLOW = 'workflow',
  PIPELINE = 'pipeline',
  AI_WORKER = 'ai_worker',
  CALENDAR = 'calendar',
  WEBHOOK = 'webhook',
  OPPORTUNITY = 'opportunity',
  CONTACT = 'contact',
}

export interface ViolationEvidence {
  before?: any;
  after?: any;
  offendingNode?: any;
  matchedPatterns?: string[];
  context?: Record<string, any>;
}

export interface GhlViolation {
  // Primary identifiers
  id: string;
  tenantId: string;
  snapshotId: string;

  // Violation details
  violationId: string; // Unique identifier for this specific violation instance
  violationType: ViolationType;
  severity: ViolationSeverity;

  // Entity context
  entityType: EntityType;
  entityId: string;
  path: string; // diffPath-like pointer (e.g., "workflows.123.triggers.0.conditions.1")

  // Evidence and details
  evidence: ViolationEvidence;

  // Policy context
  policyVersion: string;
  correlationId: string;

  // Metadata
  createdAt: Date;
  detectedAt: Date;

  // Immutable audit trail
  metadata?: Record<string, any>;
}

// Database representation (matches Prisma model)
export interface GhlViolationRecord {
  id: string;
  tenantId: string;
  snapshotId: string;
  violationId: string;
  violationType: ViolationType;
  severity: ViolationSeverity;
  entityType: EntityType;
  entityId: string;
  path: string;
  evidence: ViolationEvidence;
  policyVersion: string;
  correlationId: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

// Analysis result containing multiple violations
export interface BoundaryAnalysisResult {
  tenantId: string;
  snapshotId: string;
  correlationId: string;
  policyVersion: string;
  violations: GhlViolation[];
  analyzedAt: Date;
  analysisDuration: number; // milliseconds
  entityCount: number;
  summary: {
    totalViolations: number;
    violationsBySeverity: Record<ViolationSeverity, number>;
    violationsByType: Record<ViolationType, number>;
    violationsByEntityType: Record<EntityType, number>;
  };
}

// Severity level configuration
export interface SeverityLevelConfig {
  description: string;
  blocksTenant: boolean;
}

// Violation category descriptions
export const VIOLATION_CATEGORIES: Record<ViolationType, string> = {
  [ViolationType.LOGIC_IN_WORKFLOW]:
    'Business logic embedded in workflow conditions',
  [ViolationType.UNAPPROVED_STAGE_TRANSITION]:
    'Pipeline stage changes not matching NeuronX FSM',
  [ViolationType.UNAPPROVED_AUTOMATION_ACTION]:
    'Actions that perform business decisions',
  [ViolationType.AI_WORKER_UNSCOPED_ACTIONS]:
    'AI performing decisions instead of evidence gathering',
  [ViolationType.WEBHOOK_BYPASS_RISK]:
    'Webhooks calling endpoints without NeuronX authority',
  [ViolationType.UNKNOWN_RISK]:
    'Unrecognized action types requiring classification',
};

// Severity level configurations
export const SEVERITY_LEVELS: Record<ViolationSeverity, SeverityLevelConfig> = {
  [ViolationSeverity.LOW]: {
    description: 'Minor policy violations, monitoring recommended',
    blocksTenant: false,
  },
  [ViolationSeverity.MEDIUM]: {
    description: 'Moderate violations requiring attention',
    blocksTenant: false,
  },
  [ViolationSeverity.HIGH]: {
    description: 'Severe violations that should block operations',
    blocksTenant: true,
  },
  [ViolationSeverity.CRITICAL]: {
    description: 'Critical violations that must block tenant',
    blocksTenant: true,
  },
};
