/**
 * Billing Policy Types - WI-044: Billing Plan & Limit Configuration
 *
 * Defines the schema for billing limits and enforcement behavior extracted from hardcoded logic.
 */

import { z } from 'zod';
import { PlanTier, UsageType, EnforcementMode } from '../types';

// Base enums for policy validation
export type VoiceMode = 'SCRIPTED' | 'CONVERSATIONAL' | 'HUMAN_ONLY';

// Zod schemas for policy validation

// Plan limits schema
const PlanLimitsSchema = z.object({
  executionsPerMonth: z.number().min(-1), // -1 for unlimited
  voiceMinutesPerMonth: z.number().min(-1), // -1 for unlimited
  experimentsPerMonth: z.number().min(-1), // -1 for unlimited
  teams: z.number().min(-1), // -1 for unlimited
  operators: z.number().min(-1), // -1 for unlimited
});

// Individual plan configuration schema
const PlanConfigurationSchema = z.object({
  name: z.string().min(1),
  limits: PlanLimitsSchema,
  enforcementMode: z.nativeEnum(EnforcementMode),
  gracePeriodDays: z.number().min(0),
  warningThresholds: z.array(z.number().min(0).max(100)).optional(), // e.g., [80, 90] for 80% and 90% warnings
});

// Plans configuration schema
const PlansConfigurationSchema = z.record(
  z.nativeEnum(PlanTier),
  PlanConfigurationSchema
);

// Voice minute estimation schema
const VoiceMinuteEstimateSchema = z.object({
  voiceMode: z.enum(['SCRIPTED', 'CONVERSATIONAL', 'HUMAN_ONLY']),
  estimatedMinutes: z.number().min(0),
});

const VoiceEstimatesSchema = z.array(VoiceMinuteEstimateSchema);

// Usage type mapping schema
const UsageTypeMappingSchema = z.object({
  channels: z.array(z.string()), // channel names that map to this usage type
  usageType: z.nativeEnum(UsageType),
  quantity: z.number().min(0), // Fixed quantity for non-voice channels
});

// Usage extraction rules schema
const UsageExtractionRulesSchema = z.object({
  voiceEstimates: VoiceEstimatesSchema,
  usageTypeMappings: z.array(UsageTypeMappingSchema),
});

// Enforcement behavior schema
const EnforcementBehaviorSchema = z.object({
  defaultEnforcementMode: z.nativeEnum(EnforcementMode),
  defaultGracePeriodDays: z.number().min(0),
  failClosedOnErrors: z.boolean().default(true),
});

// Warning thresholds schema
const WarningThresholdsSchema = z.object({
  softWarning: z.number().min(0).max(100), // e.g., 80%
  hardWarning: z.number().min(0).max(100), // e.g., 90%
  criticalWarning: z.number().min(0).max(100), // e.g., 95%
});

// Main billing policy schema
export const BillingPolicySchema = z.object({
  // Plan configurations
  plans: PlansConfigurationSchema,

  // Usage extraction and estimation rules
  usageExtraction: UsageExtractionRulesSchema,

  // Enforcement behavior
  enforcement: EnforcementBehaviorSchema,

  // Global warning thresholds
  warningThresholds: WarningThresholdsSchema,
});

// TypeScript types
export type BillingPolicy = z.infer<typeof BillingPolicySchema>;
export type PlanLimits = z.infer<typeof PlanLimitsSchema>;
export type PlanConfiguration = z.infer<typeof PlanConfigurationSchema>;
export type PlansConfiguration = z.infer<typeof PlansConfigurationSchema>;
export type VoiceMinuteEstimate = z.infer<typeof VoiceMinuteEstimateSchema>;
export type VoiceEstimates = z.infer<typeof VoiceEstimatesSchema>;
export type UsageTypeMapping = z.infer<typeof UsageTypeMappingSchema>;
export type UsageExtractionRules = z.infer<typeof UsageExtractionRulesSchema>;
export type EnforcementBehavior = z.infer<typeof EnforcementBehaviorSchema>;
export type WarningThresholds = z.infer<typeof WarningThresholdsSchema>;
