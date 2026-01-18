/**
 * GHL Capability Policy Types - WI-048: GHL Capability Allow/Deny Matrix
 *
 * Defines the schema for controlling which GHL capabilities are allowed per plan tier.
 */

import { z } from 'zod';

// Plan tier enum (matches billing-entitlements)
export enum PlanTier {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

// GHL capability names (matches adapter interfaces)
export enum GhlCapability {
  // CRM capabilities
  CRM_CREATE_LEAD = 'crm_create_lead',
  CRM_UPDATE_LEAD = 'crm_update_lead',
  CRM_LIST_LEADS = 'crm_list_leads',
  CRM_CREATE_OPPORTUNITY = 'crm_create_opportunity',
  CRM_UPDATE_OPPORTUNITY = 'crm_update_opportunity',
  CRM_LIST_OPPORTUNITIES = 'crm_list_opportunities',
  CRM_GET_PIPELINES = 'crm_get_pipelines',

  // Conversation capabilities
  CONVERSATION_SEND_MESSAGE = 'conversation_send_message',
  CONVERSATION_LIST_MESSAGES = 'conversation_list_messages',
  CONVERSATION_GET_CONVERSATION = 'conversation_get_conversation',
  CONVERSATION_LIST_CONVERSATIONS = 'conversation_list_conversations',
  CONVERSATION_TAG_CONVERSATION = 'conversation_tag_conversation',
  CONVERSATION_UPDATE_STATUS = 'conversation_update_status',

  // Workflow capabilities
  WORKFLOW_TRIGGER = 'workflow_trigger',
  WORKFLOW_PAUSE = 'workflow_pause',
  WORKFLOW_RESUME = 'workflow_resume',
  WORKFLOW_CANCEL = 'workflow_cancel',
  WORKFLOW_GET_EXECUTION = 'workflow_get_execution',
  WORKFLOW_LIST_EXECUTIONS = 'workflow_list_executions',
  WORKFLOW_GET_WORKFLOWS = 'workflow_get_workflows',
  WORKFLOW_GET_WORKFLOW = 'workflow_get_workflow',

  // Identity capabilities
  IDENTITY_LIST_USERS = 'identity_list_users',
  IDENTITY_GET_USER = 'identity_get_user',
  IDENTITY_GET_USER_BY_EMAIL = 'identity_get_user_by_email',
  IDENTITY_MAP_EXTERNAL_USER = 'identity_map_external_user',
  IDENTITY_SYNC_PERMISSIONS = 'identity_sync_permissions',

  // Calendar capabilities
  CALENDAR_CREATE_EVENT = 'calendar_create_event',
  CALENDAR_UPDATE_EVENT = 'calendar_update_event',
  CALENDAR_GET_EVENT = 'calendar_get_event',
  CALENDAR_LIST_EVENTS = 'calendar_list_events',
  CALENDAR_CANCEL_EVENT = 'calendar_cancel_event',

  // Voice capabilities (through Twilio integration)
  VOICE_CALL_INITIATE = 'voice_call_initiate',
  VOICE_CALL_RECORDING = 'voice_call_recording',
  VOICE_WEBHOOK_PROCESSING = 'voice_webhook_processing',

  // Webhook capabilities
  WEBHOOK_RECEIVE_EVENTS = 'webhook_receive_events',
  WEBHOOK_SIGNATURE_VERIFICATION = 'webhook_signature_verification',
}

// Enforcement modes for capabilities
export enum CapabilityEnforcementMode {
  BLOCK = 'block', // Hard block - capability not allowed
  ALLOW_WITH_AUDIT = 'allow_with_audit', // Allow but log usage
  ALLOW_WITH_LIMITS = 'allow_with_limits', // Allow with rate/count limits
}

// Capability limits (for allow_with_limits mode)
const CapabilityLimitsSchema = z.object({
  maxRequestsPerHour: z.number().min(0).optional(),
  maxRequestsPerDay: z.number().min(0).optional(),
  maxConcurrent: z.number().min(0).optional(),
  maxDataSizeBytes: z.number().min(0).optional(),
  allowedTimeWindows: z
    .array(
      z.object({
        start: z.string(), // HH:MM format
        end: z.string(), // HH:MM format
        daysOfWeek: z.array(z.number().min(0).max(6)).optional(), // 0=Sunday, 6=Saturday
      })
    )
    .optional(),
});

// Individual capability configuration
const CapabilityConfigSchema = z.object({
  capability: z.nativeEnum(GhlCapability),
  enforcementMode: z.nativeEnum(CapabilityEnforcementMode),
  limits: CapabilityLimitsSchema.optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
});

// Plan-specific capability matrix
const PlanCapabilityMatrixSchema = z.object({
  planTier: z.nativeEnum(PlanTier),
  capabilities: z.array(CapabilityConfigSchema),
  description: z.string().optional(),
});

// Fallback behavior for unknown capabilities
const UnknownCapabilityFallbackSchema = z.object({
  defaultMode: z.nativeEnum(CapabilityEnforcementMode),
  alertOnUnknown: z.boolean().default(true),
  alertChannels: z.array(z.string()).optional(),
});

// Audit and monitoring configuration
const AuditConfigSchema = z.object({
  auditCapabilityUsage: z.boolean().default(true),
  auditCapabilityDenials: z.boolean().default(true),
  auditCapabilityLimitsExceeded: z.boolean().default(true),
  auditRetentionDays: z.number().min(1).default(90),
});

// Main GHL capability policy schema
export const GhlCapabilityPolicySchema = z.object({
  // Version for policy management
  version: z.string().min(1),

  // Plan-specific capability matrices
  planCapabilityMatrices: z.array(PlanCapabilityMatrixSchema),

  // Fallback behavior for unknown capabilities
  unknownCapabilityFallback: UnknownCapabilityFallbackSchema,

  // Audit and monitoring settings
  audit: AuditConfigSchema,

  // Metadata
  description: z.string().optional(),
  lastUpdated: z.string().optional(),
  updatedBy: z.string().optional(),

  // Environment-specific overrides (optional)
  environmentOverrides: z
    .record(z.string(), z.array(PlanCapabilityMatrixSchema))
    .optional(),
});

// TypeScript types
export type GhlCapabilityPolicy = z.infer<typeof GhlCapabilityPolicySchema>;
export type CapabilityConfig = z.infer<typeof CapabilityConfigSchema>;
export type CapabilityLimits = z.infer<typeof CapabilityLimitsSchema>;
export type PlanCapabilityMatrix = z.infer<typeof PlanCapabilityMatrixSchema>;
export type UnknownCapabilityFallback = z.infer<
  typeof UnknownCapabilityFallbackSchema
>;
export type AuditConfig = z.infer<typeof AuditConfigSchema>;

// Resolution result types
export interface CapabilityResolutionResult {
  allowed: boolean;
  enforcementMode: CapabilityEnforcementMode;
  limits?: CapabilityLimits;
  reason: string;
  capabilityConfig?: CapabilityConfig;
}

export interface CapabilityCheckContext {
  tenantId: string;
  planTier: PlanTier;
  capability: GhlCapability;
  environment: string;
  userId?: string;
  requestMetadata?: Record<string, any>;
}
