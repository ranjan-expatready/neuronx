// Rep Skill Tier Enums
// Defines the four skill tiers that govern human behavior in NeuronX

export enum SkillTier {
  L1 = 'L1', // Script-Locked
  L2 = 'L2', // Script-Guided
  L3 = 'L3', // Script-Optional
  L4 = 'L4', // Supervisor
}

// Skill Tier Metadata
export const SKILL_TIER_METADATA = {
  [SkillTier.L1]: {
    name: 'Script-Locked',
    description: 'Entry-level reps with maximum safety controls',
    level: 1,
    autonomy: 'minimal',
    riskTolerance: 'very_low',
  },
  [SkillTier.L2]: {
    name: 'Script-Guided',
    description: 'Experienced reps with guided autonomy',
    level: 2,
    autonomy: 'guided',
    riskTolerance: 'low',
  },
  [SkillTier.L3]: {
    name: 'Script-Optional',
    description: 'High-performing reps with significant autonomy',
    level: 3,
    autonomy: 'high',
    riskTolerance: 'medium',
  },
  [SkillTier.L4]: {
    name: 'Supervisor',
    description: 'Senior reps and managers with override authority',
    level: 4,
    autonomy: 'full',
    riskTolerance: 'high',
  },
} as const;

// Authorization Action Types
export enum AuthorizationAction {
  FSM_TRANSITION = 'FSM_TRANSITION',
  VOICE_MODE_SELECTION = 'VOICE_MODE_SELECTION',
  DEAL_VALUE_ACCESS = 'DEAL_VALUE_ACCESS',
  DECISION_OVERRIDE = 'DECISION_OVERRIDE',
  ESCALATION_REQUEST = 'ESCALATION_REQUEST',
  EXECUTION_AUTHORIZATION = 'EXECUTION_AUTHORIZATION',
}

// Authorization Result
export enum AuthorizationResult {
  ALLOWED = 'ALLOWED',
  DENIED = 'DENIED',
  REQUIRES_APPROVAL = 'REQUIRES_APPROVAL',
  REQUIRES_ESCALATION = 'REQUIRES_ESCALATION',
}

// Override Types
export enum OverrideType {
  DECISION_OVERRIDE = 'DECISION_OVERRIDE',
  ESCALATION_REQUEST = 'ESCALATION_REQUEST',
  EMERGENCY_OVERRIDE = 'EMERGENCY_OVERRIDE',
  SUPERVISOR_APPROVAL = 'SUPERVISOR_APPROVAL',
}

// Risk Levels (correspond to policy restrictions)
export enum RiskLevel {
  STANDARD = 'STANDARD',
  HIGH_RISK = 'HIGH_RISK',
  ENTERPRISE = 'ENTERPRISE',
  REGULATED = 'REGULATED',
}

// Training Status
export enum TrainingStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  REQUIRED_RECERTIFICATION = 'REQUIRED_RECERTIFICATION',
}

// Certification Types
export enum CertificationType {
  SALES_FUNDAMENTALS = 'SALES_FUNDAMENTALS',
  PRODUCT_KNOWLEDGE = 'PRODUCT_KNOWLEDGE',
  ADVANCED_CLOSING = 'ADVANCED_CLOSING',
  OBJECTION_HANDLING = 'OBJECTION_HANDLING',
  NEGOTIATION = 'NEGOTIATION',
  LEADERSHIP = 'LEADERSHIP',
  COACHING = 'COACHING',
  COMPLIANCE = 'COMPLIANCE',
}

// Advancement Criteria Types
export enum AdvancementCriterion {
  DEAL_VALUE_CLOSED = 'DEAL_VALUE_CLOSED',
  DEALS_CLOSED = 'DEALS_CLOSED',
  TIME_IN_ROLE = 'TIME_IN_ROLE',
  CUSTOMER_SATISFACTION = 'CUSTOMER_SATISFACTION',
  TEAM_PERFORMANCE_IMPROVEMENT = 'TEAM_PERFORMANCE_IMPROVEMENT',
  SUPERVISOR_RECOMMENDATION = 'SUPERVISOR_RECOMMENDATION',
  MANAGER_APPROVAL = 'MANAGER_APPROVAL',
  EXECUTIVE_APPROVAL = 'EXECUTIVE_APPROVAL',
}
