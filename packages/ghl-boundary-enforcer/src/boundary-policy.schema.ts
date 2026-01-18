import { z } from 'zod';

// Business Logic Rule Schema
export const BusinessLogicRuleSchema = z.object({
  name: z.string(),
  description: z.string(),
  patterns: z.array(z.string()),
});

// Thresholds Schema
export const ThresholdsSchema = z.object({
  maxActionsPerWorkflow: z.number().int().positive(),
  maxConditionDepth: z.number().int().positive(),
  maxBranchCount: z.number().int().positive(),
  maxTriggerCount: z.number().int().positive(),
});

// Severity Level Schema
export const SeverityLevelSchema = z.object({
  description: z.string(),
  blocksTenant: z.boolean(),
});

// Risk Classification Rule Schema
export const RiskClassificationRuleSchema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  requiresReview: z.boolean(),
});

// Main Boundary Policy Schema
export const GhlBoundaryPolicySchema = z.object({
  enforcementMode: z.enum(['monitor_only', 'block']),

  // Business Logic Definition
  businessLogicRules: z.array(BusinessLogicRuleSchema),

  // Allowed Actions (Execution Surface Only)
  allowedWorkflowActions: z.array(z.string()),
  allowedPipelineMutations: z.array(z.string()),
  allowedAiWorkerCapabilities: z.array(z.string()),

  // Denied Actions (Business Logic)
  deniedWorkflowActions: z.array(z.string()),
  deniedPipelineMutations: z.array(z.string()),
  deniedAiWorkerCapabilities: z.array(z.string()),

  // Complexity Thresholds
  thresholds: ThresholdsSchema,

  // Security Requirements
  requireNeuronxTokenHeaderOnWebhookCalls: z.boolean(),

  // Risk Classification
  riskClassificationRules: z.record(z.string(), RiskClassificationRuleSchema),

  // Severity Mapping
  severityLevels: z.record(
    z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    SeverityLevelSchema
  ),

  // Violation Categories
  violationCategories: z.record(z.string(), z.string()),
});

// Type exports
export type BusinessLogicRule = z.infer<typeof BusinessLogicRuleSchema>;
export type Thresholds = z.infer<typeof ThresholdsSchema>;
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;
export type RiskClassificationRule = z.infer<
  typeof RiskClassificationRuleSchema
>;
export type GhlBoundaryPolicy = z.infer<typeof GhlBoundaryPolicySchema>;
