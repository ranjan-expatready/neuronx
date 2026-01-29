/**
 * Billing & Entitlements Types - WI-040
 *
 * Core types for billing and entitlement enforcement.
 */

import { z } from 'zod';

// Plan tiers
export enum PlanTier {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

// Billing Status (added for Sync Service)
export enum BillingStatus {
  ACTIVE = 'ACTIVE',
  GRACE = 'GRACE',
  BLOCKED = 'BLOCKED',
  CANCELLED = 'CANCELLED',
}

// Usage event types
export enum UsageType {
  EXECUTION = 'EXECUTION',
  VOICE_MINUTE = 'VOICE_MINUTE',
  EXPERIMENT = 'EXPERIMENT',
}

// Enforcement modes
export enum EnforcementMode {
  MONITOR_ONLY = 'monitor_only',
  BLOCK = 'block',
  GRACE_PERIOD = 'grace_period',
}

// Plan definition
export interface Plan {
  planId: string;
  tenantId: string;
  name: string;
  tier: PlanTier;
  limits: PlanLimits;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Plan limits
export interface PlanLimits {
  executionsPerMonth: number;
  voiceMinutesPerMonth: number;
  experimentsPerMonth: number;
  teams: number;
  operators: number;
}

// Usage event
export interface UsageEvent {
  eventId: string;
  tenantId: string;
  type: UsageType;
  quantity: number;
  correlationId: string;
  metadata?: Record<string, any>;
  occurredAt: Date;
}

// Usage meter (aggregated)
export interface UsageMeter {
  tenantId: string;
  period: string; // YYYY-MM format
  type: UsageType;
  totalQuantity: number;
  lastUpdated: Date;
}

// Billing decision
export interface BillingDecision {
  allowed: boolean;
  reason: string;
  remainingQuota?: number;
  currentUsage?: number;
  limit?: number;
  enforcementMode: EnforcementMode;
  planTier?: PlanTier;
}

// Entitlement check request
export interface EntitlementCheckRequest {
  tenantId: string;
  usageType: UsageType;
  quantity: number;
  correlationId: string;
}

// Usage aggregation request
export interface UsageAggregationRequest {
  tenantId: string;
  period?: string; // If not provided, uses current month
}

// Billing guard context (for execution integration)
export interface BillingGuardContext {
  tenantId: string;
  executionCommand: any; // From ExecutionAuthority
  decisionResult: any; // From DecisionEngine
  correlationId: string;
}

// Zod schemas for validation
export const PlanLimitsSchema = z.object({
  executionsPerMonth: z.number().min(0),
  voiceMinutesPerMonth: z.number().min(0),
  experimentsPerMonth: z.number().min(0),
  teams: z.number().min(0),
  operators: z.number().min(0),
});

export const PlanSchema = z.object({
  planId: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  tier: z.nativeEnum(PlanTier),
  limits: PlanLimitsSchema,
  isActive: z.boolean().default(true),
});

export const UsageEventSchema = z.object({
  eventId: z.string().min(1),
  tenantId: z.string().min(1),
  type: z.nativeEnum(UsageType),
  quantity: z.number().min(0),
  correlationId: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export const EntitlementCheckRequestSchema = z.object({
  tenantId: z.string().min(1),
  usageType: z.nativeEnum(UsageType),
  quantity: z.number().min(0),
  correlationId: z.string().min(1),
});
