/**
 * Channel Routing Policy Types - WI-043: Channel Routing Policy Configuration
 *
 * Defines the schema for channel routing rules extracted from hardcoded logic.
 */

import { z } from 'zod';
import { ExecutionChannel } from '../types';
import { ActorType } from '@neuronx/decision-engine';

// Import existing enums for policy validation
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type SlaUrgency = 'low' | 'normal' | 'high' | 'urgent';

// Zod schemas for policy validation
const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
const SlaUrgencySchema = z.enum(['low', 'normal', 'high', 'urgent']);
const ExecutionChannelSchema = z.nativeEnum(ExecutionChannel);
const ActorTypeSchema = z.nativeEnum(ActorType);

// Channel priority order schema
const ChannelPrioritySchema = z.array(ExecutionChannelSchema).min(1);

// Risk-based channel constraints schema
const RiskChannelConstraintsSchema = z.record(
  RiskLevelSchema,
  ExecutionChannelSchema.optional()
);

// Deal value routing schema
const DealValueThresholdSchema = z.object({
  minValue: z.number().min(0),
  maxValue: z.number().optional(),
  preferredChannel: ExecutionChannelSchema,
  reason: z.string(),
});

const DealValueRoutingSchema = z.array(DealValueThresholdSchema);

// SLA urgency overrides schema
const SlaUrgencyOverrideSchema = z.object({
  urgency: SlaUrgencySchema,
  commandTypes: z.array(z.string()).optional(), // ExecutionCommand['commandType'][]
  preferredChannel: ExecutionChannelSchema,
  reason: z.string(),
});

const SlaUrgencyOverridesSchema = z.array(SlaUrgencyOverrideSchema);

// Retry-based fallbacks schema
const RetryFallbackSchema = z.object({
  maxRetries: z.number().min(0),
  fallbackChannel: ExecutionChannelSchema,
  reason: z.string(),
});

const RetryFallbacksSchema = z.array(RetryFallbackSchema);

// Human-only channel enforcement schema
const HumanOnlyChannelSchema = z.object({
  commandTypes: z.array(z.string()).optional(),
  requiredChannel: ExecutionChannelSchema,
  reason: z.string(),
});

const HumanOnlyChannelsSchema = z.array(HumanOnlyChannelSchema);

// Risk score thresholds for routing
const RiskScoreThresholdsSchema = z.object({
  critical: z.number().min(0).max(100),
  high: z.number().min(0).max(100),
  medium: z.number().min(0).max(100),
  low: z.number().min(0).max(100),
});

// Default fallback routing by command type
const CommandFallbackSchema = z.object({
  commandType: z.string(), // ExecutionCommand['commandType']
  fallbackChannel: ExecutionChannelSchema,
  reason: z.string(),
});

const CommandFallbacksSchema = z.array(CommandFallbackSchema);

// Main channel routing policy schema
export const ChannelRoutingPolicySchema = z.object({
  // Default channel priority order
  channelPriorityOrder: ChannelPrioritySchema,

  // Risk-based constraints
  riskChannelConstraints: RiskChannelConstraintsSchema,

  // Deal value routing
  dealValueRouting: DealValueRoutingSchema,

  // SLA urgency overrides
  slaUrgencyOverrides: SlaUrgencyOverridesSchema,

  // Retry-based fallbacks
  retryFallbacks: RetryFallbacksSchema,

  // Human-only channel enforcement
  humanOnlyChannels: HumanOnlyChannelsSchema,

  // Risk score thresholds
  riskScoreThresholds: RiskScoreThresholdsSchema,

  // Command fallback routing
  commandFallbacks: CommandFallbacksSchema,
});

// TypeScript types
export type ChannelRoutingPolicy = z.infer<typeof ChannelRoutingPolicySchema>;
export type DealValueThreshold = z.infer<typeof DealValueThresholdSchema>;
export type DealValueRouting = z.infer<typeof DealValueRoutingSchema>;
export type SlaUrgencyOverride = z.infer<typeof SlaUrgencyOverrideSchema>;
export type SlaUrgencyOverrides = z.infer<typeof SlaUrgencyOverridesSchema>;
export type RetryFallback = z.infer<typeof RetryFallbackSchema>;
export type RetryFallbacks = z.infer<typeof RetryFallbacksSchema>;
export type HumanOnlyChannel = z.infer<typeof HumanOnlyChannelSchema>;
export type HumanOnlyChannels = z.infer<typeof HumanOnlyChannelsSchema>;
export type RiskScoreThresholds = z.infer<typeof RiskScoreThresholdsSchema>;
export type CommandFallback = z.infer<typeof CommandFallbackSchema>;
export type CommandFallbacks = z.infer<typeof CommandFallbacksSchema>;
