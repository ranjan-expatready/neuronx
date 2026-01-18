import { z } from 'zod';

// Voice Mode Enum Schema
export const VoiceModeSchema = z.enum(['AUTONOMOUS', 'ASSISTED', 'HUMAN_ONLY']);

// Script Type Enum Schema
export const ScriptTypeSchema = z.enum([
  'QUALIFICATION',
  'VALUE_PROPOSITION',
  'OBJECTION_HANDLING',
  'NEEDS_ANALYSIS',
  'BUDGET_DISCOVERY',
  'DECISION_MAKER_IDENTIFICATION',
  'PROPOSAL_FOLLOWUP',
  'NEGOTIATION',
  'COMMITMENT_CONFIRMATION',
  'NEXT_STEPS',
  'ONBOARDING_WELCOME',
  'GRACIOUS_LOSS',
  'REFERRAL_REQUEST',
  'ACKNOWLEDGMENT',
  'OUTCOME_COLLECTION',
]);

// Voice Mode Rule Schema (per state)
export const VoiceModeRuleSchema = z.object({
  allowedModes: z.array(VoiceModeSchema),
  defaultMode: VoiceModeSchema,
  requiresChecklist: z.boolean(),
  maxDurationMinutes: z.number().int().positive(),
  requiredScripts: z.array(ScriptTypeSchema),
});

// Risk Override Schema
export const RiskOverrideSchema = z.object({
  allowedModes: z.array(VoiceModeSchema),
  reason: z.string(),
  threshold: z.number().optional(),
  requiresSupervisorOverride: z.boolean().optional(),
  timeWindows: z
    .array(
      z.object({
        start: z.string(), // HH:MM format
        end: z.string(), // HH:MM format
        allowedModes: z.array(VoiceModeSchema),
      })
    )
    .optional(),
});

// Script Requirements Schema
export const ScriptRequirementsSchema = z.object({
  requiredScripts: z.array(ScriptTypeSchema),
  allowAdlib: z.boolean(),
  enforceOrder: z.boolean(),
  maxDeviations: z.number().int().min(0),
});

// Quality Thresholds Schema
export const QualityThresholdsSchema = z.object({
  minConfidenceScore: z.number().min(0).max(1),
  maxBackgroundNoise: z.number().min(0).max(1),
  minSpeechClarity: z.number().min(0).max(1),
  maxLatencyMs: z.number().int().positive(),
});

// Retry Rules Schema
export const RetryRulesSchema = z.object({
  maxRetries: z.number().int().min(0),
  backoffMultiplier: z.number().positive(),
  maxBackoffMinutes: z.number().int().positive(),
  escalationTriggers: z.array(
    z.object({
      condition: z.string(),
      action: z.string(),
    })
  ),
});

// Outcome Requirements Schema
export const OutcomeRequirementsSchema = z.object({
  requiredFields: z.array(z.string()),
  allowedOutcomes: z.array(z.string()),
  blockedOutcomes: z.array(z.string()),
});

// Billing Rules Schema
export const BillingRulesSchema = z.object({
  billableEvents: z.array(z.string()),
  nonBillableEvents: z.array(z.string()),
  rateMultipliers: z.record(z.string(), z.number().positive()),
});

// Compliance Rules Schema
export const ComplianceRulesSchema = z.object({
  recordingRequired: z.boolean(),
  piiMaskingEnabled: z.boolean(),
  auditRetentionDays: z.number().int().positive(),
  maxDailyCallsPerLead: z.number().int().positive(),
  cooldownPeriodMinutes: z.number().int().positive(),
});

// Emergency Overrides Schema
export const EmergencyOverridesSchema = z.object({
  enabled: z.boolean(),
  allowedModes: z.array(VoiceModeSchema),
  requiresApproval: z.boolean(),
  approvalTimeoutHours: z.number().int().positive(),
});

// Main Voice Policy Schema
export const VoicePolicySchema = z.object({
  enforcementMode: z.enum(['monitor_only', 'block']),

  // Voice Mode Selection Rules
  voiceModeRules: z.record(z.string(), VoiceModeRuleSchema),

  // Risk-Based Mode Overrides
  riskOverrides: z.record(z.string(), RiskOverrideSchema),

  // Script Requirements by Mode
  scriptRequirements: z.record(VoiceModeSchema, ScriptRequirementsSchema),

  // Call Quality Thresholds
  qualityThresholds: QualityThresholdsSchema,

  // Retry and Escalation Rules
  retryRules: RetryRulesSchema,

  // Outcome Enforcement
  outcomeRequirements: OutcomeRequirementsSchema,

  // Billing Integration
  billingRules: BillingRulesSchema,

  // Compliance and Governance
  complianceRules: ComplianceRulesSchema,

  // Emergency Overrides
  emergencyOverrides: EmergencyOverridesSchema,
});

// Type exports
export type VoiceMode = z.infer<typeof VoiceModeSchema>;
export type ScriptType = z.infer<typeof ScriptTypeSchema>;
export type VoiceModeRule = z.infer<typeof VoiceModeRuleSchema>;
export type RiskOverride = z.infer<typeof RiskOverrideSchema>;
export type ScriptRequirements = z.infer<typeof ScriptRequirementsSchema>;
export type QualityThresholds = z.infer<typeof QualityThresholdsSchema>;
export type RetryRules = z.infer<typeof RetryRulesSchema>;
export type OutcomeRequirements = z.infer<typeof OutcomeRequirementsSchema>;
export type BillingRules = z.infer<typeof BillingRulesSchema>;
export type ComplianceRules = z.infer<typeof ComplianceRulesSchema>;
export type EmergencyOverrides = z.infer<typeof EmergencyOverridesSchema>;
export type VoicePolicy = z.infer<typeof VoicePolicySchema>;
