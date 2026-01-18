/**
 * Decision Policy Types - WI-042: Decision Policy Configuration
 *
 * Strongly-typed schema for decision policy configuration.
 * All decision thresholds and rules are defined here.
 */

import { z } from 'zod';
import { RiskLevel, DecisionEnforcementMode } from '../types';

// Base risk level enum for policy
export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// Enforcement mode enum for policy
export const DecisionEnforcementModeSchema = z.enum([
  'monitor_only',
  'block',
  'block_and_escalate',
]);

// Deal value thresholds schema
export const DealValueThresholdsSchema = z.object({
  low: z
    .number()
    .min(0)
    .describe('Deal value threshold for low-risk classification ($10K)'),
  medium: z
    .number()
    .min(0)
    .describe('Deal value threshold for medium-risk classification ($100K)'),
  high: z
    .number()
    .min(0)
    .describe('Deal value threshold for high-risk classification ($100K+)'),
});

// Risk thresholds for actor selection
export const RiskThresholdsSchema = z.object({
  aiAllowed: RiskLevelSchema.describe(
    'Maximum risk level where AI execution is allowed'
  ),
  humanRequired: RiskLevelSchema.describe(
    'Minimum risk level requiring human execution'
  ),
  approvalRequired: RiskLevelSchema.describe(
    'Minimum risk level requiring approval'
  ),
});

// SLA urgency to risk level mapping
export const SlaUrgencyMappingSchema = z.object({
  low: RiskLevelSchema.describe('Risk level for low SLA urgency'),
  normal: RiskLevelSchema.describe('Risk level for normal SLA urgency'),
  high: RiskLevelSchema.describe('Risk level for high SLA urgency'),
  critical: RiskLevelSchema.describe('Risk level for critical SLA urgency'),
});

// Voice mode selection rules
export const VoiceModeRulesSchema = z.object({
  scriptedRequired: RiskLevelSchema.describe(
    'Minimum risk level requiring scripted voice mode'
  ),
  conversationalAllowed: RiskLevelSchema.describe(
    'Maximum risk level allowing conversational voice mode'
  ),
});

// Retry limits configuration
export const RetryLimitsSchema = z.object({
  beforeEscalation: z
    .number()
    .min(0)
    .max(10)
    .describe('Retry attempts before escalation required'),
  beforeHumanOverride: z
    .number()
    .min(0)
    .max(20)
    .describe('Retry attempts before human override required'),
});

// Voice execution constraints
export const VoiceConstraintsSchema = z.object({
  maxDurationMinutes: z
    .number()
    .min(1)
    .max(30)
    .describe('Maximum voice call duration in minutes'),
  scriptedConfidenceThreshold: z
    .number()
    .min(0)
    .max(1)
    .describe('Minimum confidence for scripted voice'),
  conversationalRiskLimit: RiskLevelSchema.describe(
    'Maximum risk level for conversational voice'
  ),
});

// Actor selection rules
export const ActorSelectionRulesSchema = z.object({
  aiConfidenceThreshold: z
    .number()
    .min(0)
    .max(1)
    .describe('Minimum confidence for AI execution'),
  hybridActorThreshold: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence threshold triggering hybrid mode'),
  humanFallbackEnabled: z
    .boolean()
    .describe('Whether human fallback is enabled for low-confidence AI'),
});

// Escalation rules
export const EscalationRulesSchema = z.object({
  criticalRiskAlwaysEscalate: z
    .boolean()
    .describe('Whether critical risk always requires escalation'),
  highValueDealThreshold: z
    .number()
    .min(0)
    .describe('Deal value threshold triggering escalation'),
  retryCountEscalationThreshold: z
    .number()
    .min(0)
    .describe('Retry count triggering escalation'),
  slaCriticalEscalation: z
    .boolean()
    .describe('Whether critical SLA always requires escalation'),
});

// Execution mode selection rules
export const ExecutionModeRulesSchema = z.object({
  autonomousMaxRisk: RiskLevelSchema.describe(
    'Maximum risk level for autonomous execution'
  ),
  assistedMinRisk: RiskLevelSchema.describe(
    'Minimum risk level requiring assisted execution'
  ),
  approvalMinRisk: RiskLevelSchema.describe(
    'Minimum risk level requiring approval'
  ),
  hybridAlwaysAssisted: z
    .boolean()
    .describe('Whether hybrid actors always require assistance'),
});

// Main decision policy schema
export const DecisionPolicySchema = z.object({
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .describe('Policy version (semantic versioning)'),
  description: z.string().describe('Human-readable policy description'),

  // Enforcement settings
  enforcementMode: DecisionEnforcementModeSchema.describe(
    'Default enforcement mode'
  ),

  // Core decision thresholds
  riskThresholds: RiskThresholdsSchema,
  dealValueThresholds: DealValueThresholdsSchema,
  slaUrgencyMapping: SlaUrgencyMappingSchema,

  // Voice-specific rules
  voiceModeRules: VoiceModeRulesSchema,
  voiceConstraints: VoiceConstraintsSchema,

  // Actor and execution rules
  actorSelectionRules: ActorSelectionRulesSchema,
  executionModeRules: ExecutionModeRulesSchema,
  escalationRules: EscalationRulesSchema,

  // Retry behavior
  retryLimits: RetryLimitsSchema,

  // Feature flags
  features: z.object({
    voiceExecution: z.boolean().describe('Whether voice execution is enabled'),
    aiActors: z.boolean().describe('Whether AI actors are enabled'),
    hybridActors: z.boolean().describe('Whether hybrid actors are enabled'),
    riskAssessment: z.boolean().describe('Whether risk assessment is enabled'),
    escalationWorkflow: z
      .boolean()
      .describe('Whether escalation workflow is enabled'),
  }),

  // Metadata
  metadata: z.object({
    createdAt: z.string().datetime().describe('Policy creation timestamp'),
    createdBy: z.string().describe('Policy author'),
    lastModified: z.string().datetime().describe('Last modification timestamp'),
    lastModifiedBy: z.string().describe('Last modifier'),
    changeReason: z.string().describe('Reason for last change'),
  }),
});

// Type exports
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type DecisionEnforcementMode = z.infer<
  typeof DecisionEnforcementModeSchema
>;
export type DealValueThresholds = z.infer<typeof DealValueThresholdsSchema>;
export type RiskThresholds = z.infer<typeof RiskThresholdsSchema>;
export type SlaUrgencyMapping = z.infer<typeof SlaUrgencyMappingSchema>;
export type VoiceModeRules = z.infer<typeof VoiceModeRulesSchema>;
export type VoiceConstraints = z.infer<typeof VoiceConstraintsSchema>;
export type ActorSelectionRules = z.infer<typeof ActorSelectionRulesSchema>;
export type ExecutionModeRules = z.infer<typeof ExecutionModeRulesSchema>;
export type EscalationRules = z.infer<typeof EscalationRulesSchema>;
export type RetryLimits = z.infer<typeof RetryLimitsSchema>;
export type DecisionPolicy = z.infer<typeof DecisionPolicySchema>;

// Policy validation error type
export interface PolicyValidationError {
  path: string;
  message: string;
  value?: any;
}

// Policy loader result
export interface PolicyLoadResult {
  policy: DecisionPolicy;
  errors: PolicyValidationError[];
  warnings: string[];
  valid: boolean;
}
