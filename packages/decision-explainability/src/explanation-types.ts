/**
 * Decision Explainability Types - WI-052: Decision Explainability Engine
 *
 * Types and schemas for structured decision explanations.
 */

import { z } from 'zod';

// Core explanation structure
export interface DecisionExplanation {
  explanationId: string;
  decisionId: string;
  timestamp: Date;
  tenantId: string;
  opportunityId: string;

  decisionSummary: DecisionSummary;
  policyFactors: PolicyFactor[];
  authorityFactors: AuthorityFactor[];
  billingFactors: BillingFactor[];
  driftFactors: DriftFactor[];
  constraints: Constraint[];

  finalJustification: FinalJustification;
  correlationIds: CorrelationIds;

  metadata: ExplanationMetadata;
}

// Decision summary
export interface DecisionSummary {
  actionTaken: string;
  channelSelected: string;
  actorType: 'AI' | 'HUMAN' | 'HYBRID';
  executionAllowed: boolean;
  voiceMode?: 'SCRIPTED' | 'CONVERSATIONAL' | 'HUMAN_ONLY';
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Policy factors
export interface PolicyFactor {
  policyType: 'decision' | 'channel_routing' | 'billing' | 'capability';
  policyVersion: string;
  ruleEvaluated: string;
  threshold?: any;
  actualValue?: any;
  result: 'allowed' | 'denied' | 'limited';
  reason: string;
}

// Authority factors
export interface AuthorityFactor {
  authorityType: 'org_scope' | 'capability' | 'approval_required';
  scope: string;
  requirement: string;
  satisfied: boolean;
  reason?: string;
}

// Billing factors
export interface BillingFactor {
  planTier: string;
  billingStatus: 'ACTIVE' | 'GRACE' | 'BLOCKED';
  quotaChecked: string;
  remaining?: number;
  allowed: boolean;
  reason: string;
}

// Drift factors
export interface DriftFactor {
  driftId: string;
  driftType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedComponent: string;
  impactOnDecision: string;
  driftTimestamp: Date;
}

// Constraints
export interface Constraint {
  constraintType:
    | 'time_window'
    | 'rate_limit'
    | 'capability_block'
    | 'billing_limit';
  source: string;
  enforced: boolean;
  details?: any;
}

// Final justification
export interface FinalJustification {
  blockingReason?: string;
  overrideReason?: string;
  escalationReason?: string;
  finalOutcome: 'allowed' | 'blocked' | 'escalated';
}

// Correlation IDs
export interface CorrelationIds {
  decision: string;
  execution?: string;
  audit: string;
  drift?: string;
}

// Metadata
export interface ExplanationMetadata {
  engineVersion: string;
  processingTimeMs: number;
  dataCompleteness: 'complete' | 'partial' | 'incomplete';
  missingDataReasons?: string[];
}

// Explanation request
export interface ExplanationRequest {
  decisionId: string;
  includeDriftFactors?: boolean;
  correlationId: string;
}

// Explanation response
export interface ExplanationResponse {
  success: boolean;
  explanation?: DecisionExplanation;
  error?: string;
  processingTimeMs: number;
}

// Storage interface
export interface ExplanationStorage {
  store(explanation: DecisionExplanation): Promise<void>;
  retrieve(explanationId: string): Promise<DecisionExplanation | null>;
  queryByDecision(decisionId: string): Promise<DecisionExplanation | null>;
  queryByTenant(
    tenantId: string,
    limit?: number
  ): Promise<DecisionExplanation[]>;
}

// Zod schemas for validation
export const DecisionSummarySchema = z.object({
  actionTaken: z.string(),
  channelSelected: z.string(),
  actorType: z.enum(['AI', 'HUMAN', 'HYBRID']),
  executionAllowed: z.boolean(),
  voiceMode: z.enum(['SCRIPTED', 'CONVERSATIONAL', 'HUMAN_ONLY']).optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

export const PolicyFactorSchema = z.object({
  policyType: z.enum(['decision', 'channel_routing', 'billing', 'capability']),
  policyVersion: z.string(),
  ruleEvaluated: z.string(),
  threshold: z.any().optional(),
  actualValue: z.any().optional(),
  result: z.enum(['allowed', 'denied', 'limited']),
  reason: z.string(),
});

export const AuthorityFactorSchema = z.object({
  authorityType: z.enum(['org_scope', 'capability', 'approval_required']),
  scope: z.string(),
  requirement: z.string(),
  satisfied: z.boolean(),
  reason: z.string().optional(),
});

export const BillingFactorSchema = z.object({
  planTier: z.string(),
  billingStatus: z.enum(['ACTIVE', 'GRACE', 'BLOCKED']),
  quotaChecked: z.string(),
  remaining: z.number().optional(),
  allowed: z.boolean(),
  reason: z.string(),
});

export const DriftFactorSchema = z.object({
  driftId: z.string(),
  driftType: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  affectedComponent: z.string(),
  impactOnDecision: z.string(),
  driftTimestamp: z.date(),
});

export const ConstraintSchema = z.object({
  constraintType: z.enum([
    'time_window',
    'rate_limit',
    'capability_block',
    'billing_limit',
  ]),
  source: z.string(),
  enforced: z.boolean(),
  details: z.any().optional(),
});

export const FinalJustificationSchema = z.object({
  blockingReason: z.string().optional(),
  overrideReason: z.string().optional(),
  escalationReason: z.string().optional(),
  finalOutcome: z.enum(['allowed', 'blocked', 'escalated']),
});

export const CorrelationIdsSchema = z.object({
  decision: z.string(),
  execution: z.string().optional(),
  audit: z.string(),
  drift: z.string().optional(),
});

export const ExplanationMetadataSchema = z.object({
  engineVersion: z.string(),
  processingTimeMs: z.number(),
  dataCompleteness: z.enum(['complete', 'partial', 'incomplete']),
  missingDataReasons: z.array(z.string()).optional(),
});

export const DecisionExplanationSchema = z.object({
  explanationId: z.string(),
  decisionId: z.string(),
  timestamp: z.date(),
  tenantId: z.string(),
  opportunityId: z.string(),
  decisionSummary: DecisionSummarySchema,
  policyFactors: z.array(PolicyFactorSchema),
  authorityFactors: z.array(AuthorityFactorSchema),
  billingFactors: z.array(BillingFactorSchema),
  driftFactors: z.array(DriftFactorSchema),
  constraints: z.array(ConstraintSchema),
  finalJustification: FinalJustificationSchema,
  correlationIds: CorrelationIdsSchema,
  metadata: ExplanationMetadataSchema,
});

export const ExplanationRequestSchema = z.object({
  decisionId: z.string(),
  includeDriftFactors: z.boolean().optional(),
  correlationId: z.string(),
});

// Configuration
export interface ExplainabilityConfig {
  enabled: boolean;
  includeDriftFactorsByDefault: boolean;
  maxProcessingTimeMs: number;
  storageRetentionDays: number;
}

export const DEFAULT_EXPLAINABILITY_CONFIG: ExplainabilityConfig = {
  enabled: true,
  includeDriftFactorsByDefault: true,
  maxProcessingTimeMs: 5000, // 5 seconds
  storageRetentionDays: 365,
};
