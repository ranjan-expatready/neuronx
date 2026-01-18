/**
 * Execution Authority Types - WI-034: Multi-Channel Execution Authority + Tokenized Actor Model
 *
 * Defines types for authoritative execution routing and secure token lifecycle.
 */

import { ExecutionCommand } from '@neuronx/playbook-engine';
import { DecisionResult, ActorType } from '@neuronx/decision-engine';
import { CanonicalOpportunityStage } from '@neuronx/pipeline';

/**
 * Supported execution channels
 */
export enum ExecutionChannel {
  VOICE = 'voice',
  SMS = 'sms',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
  CALENDAR = 'calendar',
}

/**
 * Execution plan result
 */
export interface ExecutionPlan {
  // Authorization
  allowed: boolean;
  reason: string;

  // Execution details
  actor: ActorType;
  mode: 'AUTONOMOUS' | 'ASSISTED' | 'APPROVAL_REQUIRED';
  channel: ExecutionChannel;

  // Adapter command (what to send to the adapter)
  adapterCommand: AdapterCommand;

  // Security token (if required for side effects)
  token?: ExecutionToken;

  // Constraints and limits
  constraints: ExecutionConstraints;

  // Audit and correlation
  correlationId: string;
  auditReason: string;

  // Metadata
  riskAssessment: RiskAssessment;
  estimatedCost?: number;
  slaRequirements?: SlaRequirements;
}

/**
 * Adapter command (what the adapter should execute)
 */
export interface AdapterCommand {
  commandId: string;
  commandType: ExecutionCommand['commandType'];

  // Channel-specific data
  channelData: ChannelSpecificData;

  // Execution metadata
  timeoutSeconds?: number;
  retryPolicy?: RetryPolicy;
  idempotencyKey?: string;
}

/**
 * Channel-specific execution data
 */
export type ChannelSpecificData =
  | VoiceChannelData
  | SmsChannelData
  | EmailChannelData
  | WhatsAppChannelData
  | CalendarChannelData;

/**
 * Voice channel data
 */
export interface VoiceChannelData {
  toPhone: string;
  scriptId?: string;
  voiceMode: 'SCRIPTED' | 'CONVERSATIONAL' | 'HUMAN_ONLY';
  recordingEnabled: boolean;
  maxDurationSeconds: number;
}

/**
 * SMS channel data
 */
export interface SmsChannelData {
  toPhone: string;
  message: string;
  templateId?: string;
  priority: 'low' | 'normal' | 'high';
}

/**
 * Email channel data
 */
export interface EmailChannelData {
  toEmail: string;
  subject: string;
  body: string;
  templateId?: string;
  priority: 'low' | 'normal' | 'high';
  attachments?: EmailAttachment[];
}

/**
 * WhatsApp channel data
 */
export interface WhatsAppChannelData {
  toPhone: string;
  message: string;
  templateId?: string;
  mediaUrl?: string;
}

/**
 * Calendar channel data
 */
export interface CalendarChannelData {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  location?: string;
  meetingType: 'discovery' | 'followup' | 'closing' | 'escalation';
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  data?: Buffer;
}

/**
 * Retry policy for execution
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelaySeconds: number;
  backoffMultiplier: number;
  maxDelaySeconds?: number;
}

/**
 * Execution constraints
 */
export interface ExecutionConstraints {
  maxCost?: number;
  maxDurationSeconds?: number;
  allowedHours?: {
    start: string; // HH:MM
    end: string; // HH:MM
    timezone: string;
  };
  geographicRestrictions?: string[];
  complianceRequirements?: string[];
}

/**
 * Risk assessment for execution
 */
export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  factors: RiskFactor[];
  mitigationStrategies: string[];
}

/**
 * Risk factor
 */
export interface RiskFactor {
  factor: string;
  impact: number; // 0-100
  probability: number; // 0-100
  description: string;
}

/**
 * SLA requirements
 */
export interface SlaRequirements {
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  targetResponseTimeMinutes: number;
  escalationRequired: boolean;
  escalationTimeMinutes?: number;
}

/**
 * Execution token for secure side effects
 */
export interface ExecutionToken {
  tokenId: string;
  tenantId: string;
  opportunityId: string;

  // Scope restrictions
  actorType: ActorType;
  mode: 'AUTONOMOUS' | 'ASSISTED' | 'APPROVAL_REQUIRED';
  channelScope: ExecutionChannel;
  commandType: ExecutionCommand['commandType'];

  // Security
  correlationId: string;
  expiresAt: Date;
  createdAt: Date;
  createdBy: string;

  // Usage tracking
  usedAt?: Date;
  usedBy?: string;
  revokedAt?: Date;
  revokedBy?: string;

  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Token verification result
 */
export interface TokenVerificationResult {
  valid: boolean;
  token?: ExecutionToken;
  reason: string;
  canUse: boolean;
}

/**
 * Execution context (inputs to planning)
 */
export interface ExecutionContext {
  tenantId: string;
  opportunityId: string;
  executionCommand: ExecutionCommand;
  decisionResult: DecisionResult;

  // Additional context
  currentStage: CanonicalOpportunityStage;
  dealValue: number;
  riskScore: number;
  slaUrgency: 'low' | 'normal' | 'high' | 'urgent';
  retryCount: number;
  evidenceSoFar: string[];
  correlationId: string;
}

/**
 * Channel routing rule
 */
export interface ChannelRoutingRule {
  priority: number;
  condition: RoutingCondition;
  channel: ExecutionChannel;
  reason: string;
}

/**
 * Routing condition
 */
export interface RoutingCondition {
  // Command type constraints
  commandTypes?: ExecutionCommand['commandType'][];

  // Decision constraints
  actors?: ActorType[];
  modes?: ('AUTONOMOUS' | 'ASSISTED' | 'APPROVAL_REQUIRED')[];

  // Risk constraints
  minRiskScore?: number;
  maxRiskScore?: number;
  riskLevels?: ('low' | 'medium' | 'high' | 'critical')[];

  // Deal constraints
  minDealValue?: number;
  maxDealValue?: number;

  // SLA constraints
  urgencies?: ('low' | 'normal' | 'high' | 'urgent')[];

  // Stage constraints
  stages?: CanonicalOpportunityStage[];
  excludedStages?: CanonicalOpportunityStage[];

  // Retry constraints
  maxRetries?: number;

  // Custom conditions
  customRules?: Record<string, any>;
}

/**
 * Execution receipt (result of execution)
 */
export interface ExecutionReceipt {
  receiptId: string;
  executionPlan: ExecutionPlan;

  // Execution result
  status: 'success' | 'failed' | 'rejected' | 'timeout';
  reason: string;

  // External references
  externalRef?: string; // Twilio SID, email ID, etc.
  adapterResponse?: any;

  // Timing
  startedAt: Date;
  completedAt?: Date;
  durationSeconds?: number;

  // Evidence generated
  evidenceIds?: string[];

  // Audit
  correlationId: string;
  executedBy: string;
}

/**
 * Idempotency record
 */
export interface IdempotencyRecord {
  idempotencyKey: string;
  tenantId: string;
  endpoint: string;
  tokenId?: string;

  // Response data
  response: any;
  statusCode: number;

  // Timing
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Execution authority configuration
 */
export interface ExecutionAuthorityConfig {
  enabled: boolean;
  tokensEnabled: boolean;
  defaultTokenExpiryMinutes: number;

  // Channel configurations
  channels: Record<ExecutionChannel, ChannelConfig>;

  // Risk thresholds
  riskThresholds: {
    medium: number;
    high: number;
    critical: number;
  };

  // Cost limits
  costLimits: {
    perExecution: number;
    perHour: number;
    perDay: number;
  };

  // Observability
  metricsEnabled: boolean;
  auditLogEnabled: boolean;
}

/**
 * Channel-specific configuration
 */
export interface ChannelConfig {
  enabled: boolean;
  costPerExecution: number;
  maxConcurrency: number;
  timeoutSeconds: number;
  retryPolicy: RetryPolicy;
}

/**
 * Execution authority interface
 */
export interface ExecutionAuthority {
  /**
   * Plan execution for a command
   */
  planExecution(context: ExecutionContext): Promise<ExecutionPlan>;

  /**
   * Issue execution token
   */
  issueToken(plan: ExecutionPlan, issuedBy: string): Promise<ExecutionToken>;

  /**
   * Verify execution token
   */
  verifyToken(
    tokenId: string,
    requiredScope: {
      channel: ExecutionChannel;
      commandType: ExecutionCommand['commandType'];
    }
  ): Promise<TokenVerificationResult>;

  /**
   * Mark token as used
   */
  markTokenUsed(tokenId: string, usedBy: string): Promise<void>;

  /**
   * Revoke execution token
   */
  revokeToken(
    tokenId: string,
    revokedBy: string,
    reason: string
  ): Promise<void>;
}

/**
 * Policy guard for execution decisions
 */
export interface PolicyGuard {
  /**
   * Check if execution is allowed
   */
  checkPolicy(context: ExecutionContext): Promise<{
    allowed: boolean;
    reason: string;
    riskAssessment: RiskAssessment;
  }>;
}

/**
 * Channel router interface
 */
export interface ChannelRouter {
  /**
   * Route to appropriate channel
   */
  routeChannel(context: ExecutionContext): Promise<{
    channel: ExecutionChannel;
    reason: string;
    confidence: number;
  }>;
}
