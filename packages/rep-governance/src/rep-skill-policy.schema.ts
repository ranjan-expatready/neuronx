import { z } from 'zod';

// Skill Tier Enum Schema
export const SkillTierSchema = z.enum(['L1', 'L2', 'L3', 'L4']);

// Authorization Action Enum Schema
export const AuthorizationActionSchema = z.enum([
  'FSM_TRANSITION',
  'VOICE_MODE_SELECTION',
  'DEAL_VALUE_ACCESS',
  'DECISION_OVERRIDE',
  'ESCALATION_REQUEST',
  'EXECUTION_AUTHORIZATION',
]);

// Override Type Enum Schema
export const OverrideTypeSchema = z.enum([
  'DECISION_OVERRIDE',
  'ESCALATION_REQUEST',
  'EMERGENCY_OVERRIDE',
  'SUPERVISOR_APPROVAL',
]);

// Certification Type Enum Schema
export const CertificationTypeSchema = z.enum([
  'SALES_FUNDAMENTALS',
  'PRODUCT_KNOWLEDGE',
  'ADVANCED_CLOSING',
  'OBJECTION_HANDLING',
  'NEGOTIATION',
  'LEADERSHIP',
  'COACHING',
  'COMPLIANCE',
]);

// Advancement Criterion Enum Schema
export const AdvancementCriterionSchema = z.enum([
  'DEAL_VALUE_CLOSED',
  'DEALS_CLOSED',
  'TIME_IN_ROLE',
  'CUSTOMER_SATISFACTION',
  'TEAM_PERFORMANCE_IMPROVEMENT',
  'SUPERVISOR_RECOMMENDATION',
  'MANAGER_APPROVAL',
  'EXECUTIVE_APPROVAL',
]);

// Skill Tier Permissions Schema
export const SkillTierPermissionsSchema = z.object({
  name: z.string(),
  description: z.string(),
  allowedFSMTransitions: z.array(z.string()), // Transition patterns like "state1->state2" or "*"
  blockedFSMTransitions: z.array(z.string()),
  allowedVoiceModes: z.array(z.string()), // From voice orchestration
  blockedVoiceModes: z.array(z.string()),
  maxDealValue: z.number().positive(),
  canRecommendQualification: z.boolean(),
  canRecommendDisqualification: z.boolean(),
  canOverrideDecisions: z.boolean(),
  requiresSupervisorApproval: z.boolean(),
  escalationRequired: z.boolean(),
});

// Risk Restrictions Schema
export const RiskRestrictionsSchema = z.object({
  allowedTiers: z.array(SkillTierSchema),
  requiresDualApproval: z.boolean().optional(),
  approvalTimeoutHours: z.number().positive().optional(),
  requiresComplianceReview: z.boolean().optional(),
  requiresLegalReview: z.boolean().optional(),
  additionalComplianceTraining: z.boolean().optional(),
});

// Override Policy Schema
export const OverridePolicySchema = z.object({
  allowedTiers: z.array(SkillTierSchema),
  requiresJustification: z.boolean(),
  justificationMinLength: z.number().int().positive().optional(),
  requiresSupervisorId: z.boolean().optional(),
  requiresCLevelApproval: z.boolean().optional(),
  approvalTimeoutHours: z.number().positive().optional(),
  auditRetentionDays: z.number().int().positive().optional(),
  autoEscalateTo: SkillTierSchema.optional(),
  responseTimeoutHours: z.number().positive().optional(),
});

// Training Requirements Schema
export const TrainingRequirementsSchema = z.object({
  requiredCertifications: z.array(CertificationTypeSchema),
  ongoingTrainingHoursPerMonth: z.number().int().positive(),
  recertificationFrequencyMonths: z.number().int().positive(),
});

// Advancement Criteria Schema
export const AdvancementCriteriaSchema = z.object({
  minDealValueClosed: z.number().positive().optional(),
  minDealsClosed: z.number().int().positive().optional(),
  minTimeInRoleMonths: z.number().int().positive().optional(),
  minCustomerSatisfactionScore: z.number().min(0).max(5).optional(),
  minTeamPerformanceImprovement: z.number().positive().optional(),
  requiresSupervisorRecommendation: z.boolean().optional(),
  requiresManagerApproval: z.boolean().optional(),
  requiresExecutiveApproval: z.boolean().optional(),
});

// Audit Policies Schema
export const AuditPoliciesSchema = z.object({
  allActionsAudited: z.boolean(),
  skillTierIncludedInAudit: z.boolean(),
  overrideJustificationsRequired: z.boolean(),
  violationEscalationEnabled: z.boolean(),
  complianceReportingEnabled: z.boolean(),
});

// Emergency Procedures Schema
export const EmergencyProceduresSchema = z.object({
  allowedTiers: z.array(SkillTierSchema),
  bypassNormalRestrictions: z.boolean(),
  requiresPostEventReview: z.boolean(),
  temporaryTierElevation: z.boolean().optional(),
  elevationDurationHours: z.number().positive().optional(),
  requiresPostEventJustification: z.boolean().optional(),
});

// Main Rep Skill Policy Schema
export const RepSkillPolicySchema = z.object({
  enforcementMode: z.enum(['monitor_only', 'block']),

  // Skill Tier Definitions
  skillTiers: z.record(SkillTierSchema, SkillTierPermissionsSchema),

  // Risk-Based Restrictions
  riskRestrictions: z.record(z.string(), RiskRestrictionsSchema),

  // Override Policies
  overridePolicies: z.record(OverrideTypeSchema, OverridePolicySchema),

  // Training & Certification
  trainingRequirements: z.record(SkillTierSchema, TrainingRequirementsSchema),

  // Advancement Criteria
  advancementCriteria: z.record(z.string(), AdvancementCriteriaSchema),

  // Audit & Compliance
  auditPolicies: AuditPoliciesSchema,

  // Emergency Procedures
  emergencyProcedures: z.record(z.string(), EmergencyProceduresSchema),

  // Integration Points
  integrationPoints: z.object({
    fsmTransitions: z.boolean(),
    voiceOrchestration: z.boolean(),
    executionAuthorization: z.boolean(),
    decisionEngine: z.boolean(),
    billingSystem: z.boolean(),
  }),
});

// Type exports
export type SkillTier = z.infer<typeof SkillTierSchema>;
export type AuthorizationAction = z.infer<typeof AuthorizationActionSchema>;
export type OverrideType = z.infer<typeof OverrideTypeSchema>;
export type CertificationType = z.infer<typeof CertificationTypeSchema>;
export type AdvancementCriterion = z.infer<typeof AdvancementCriterionSchema>;
export type SkillTierPermissions = z.infer<typeof SkillTierPermissionsSchema>;
export type RiskRestrictions = z.infer<typeof RiskRestrictionsSchema>;
export type OverridePolicy = z.infer<typeof OverridePolicySchema>;
export type TrainingRequirements = z.infer<typeof TrainingRequirementsSchema>;
export type AdvancementCriteria = z.infer<typeof AdvancementCriteriaSchema>;
export type AuditPolicies = z.infer<typeof AuditPoliciesSchema>;
export type EmergencyProcedures = z.infer<typeof EmergencyProceduresSchema>;
export type RepSkillPolicy = z.infer<typeof RepSkillPolicySchema>;
