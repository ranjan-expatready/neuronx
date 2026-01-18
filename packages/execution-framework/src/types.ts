/**
 * Execution Framework Types - WI-028: Adapter-First Execution Layer
 *
 * Core abstractions for stateless, adapter-first execution ensuring NeuronX authority.
 */

import { z } from 'zod';

// Action types that adapters can execute
export enum ExecutionActionType {
  SEND_SMS = 'SEND_SMS',
  SEND_EMAIL = 'SEND_EMAIL',
  MAKE_CALL = 'MAKE_CALL',
  BOOK_CALENDAR = 'BOOK_CALENDAR',
  UPDATE_CRM = 'UPDATE_CRM',
}

// Core execution command - the single contract for all adapter execution
export interface ExecutionCommand {
  commandId: string; // Unique identifier for idempotency
  tenantId: string; // Multi-tenant isolation
  leadId: string; // Lead context
  actionType: ExecutionActionType;
  payload: Record<string, any>; // Action-specific parameters
  correlationId: string; // Request tracing
  metadata?: Record<string, any>; // Additional context
  // WI-066: UAT execution metadata
  uatMode?: UatExecutionMode; // Execution mode for this command
  uatLabel?: string; // UAT label prefix for created records
}

// Execution result - standardized response from adapters
export interface ExecutionResult {
  success: boolean;
  commandId: string;
  externalId?: string; // Provider's reference ID
  error?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Adapter capabilities - what each adapter supports
export interface AdapterCapabilities {
  supportedActionTypes: ExecutionActionType[];
  name: string;
  version: string;
  rateLimits?: {
    requestsPerMinute: number;
    burstLimit: number;
  };
}

// Base adapter interface - all adapters must implement this
export interface ExecutionAdapter {
  getCapabilities(): AdapterCapabilities;

  supports(actionType: ExecutionActionType): boolean;

  execute(command: ExecutionCommand): Promise<ExecutionResult>;
}

// WI-066: UAT execution modes
export enum UatExecutionMode {
  DRY_RUN = 'dry_run', // No external calls, deterministic simulation
  LIVE_UAT = 'live_uat', // External calls permitted with allowlist validation
}

// Execution context - additional validation context
export interface ExecutionContext {
  tenantId: string;
  leadId: string;
  currentLeadState?: string; // From FSM
  billingStatus?: string; // Entitlement check
  capabilityGrants?: string[]; // Allowed capabilities
  // WI-066: UAT execution context
  uatMode?: UatExecutionMode;
  uatKillSwitch?: boolean;
  uatCorrelationId?: string;
}

// Orchestrator configuration
export interface ExecutionOrchestratorConfig {
  enableAuditLogging: boolean;
  enableBoundaryEnforcement: boolean;
  defaultTimeoutMs: number;
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
}

// Event types for execution audit trail
export enum ExecutionEventType {
  EXECUTION_ATTEMPTED = 'execution_attempted',
  EXECUTION_SUCCEEDED = 'execution_succeeded',
  EXECUTION_FAILED = 'execution_failed',
  ADAPTER_BOUNDARY_VIOLATION = 'adapter_boundary_violation',
  // WI-066: UAT execution modes
  UAT_DRY_RUN_EXECUTED = 'uat_dry_run_executed',
  UAT_LIVE_EXECUTION_BLOCKED = 'uat_live_execution_blocked',
  UAT_BOUNDARY_VIOLATION = 'uat_boundary_violation',
}

// Execution event payload
export interface ExecutionEvent {
  eventType: ExecutionEventType;
  tenantId: string;
  leadId: string;
  commandId: string;
  actionType: ExecutionActionType;
  adapterName: string;
  correlationId: string;
  timestamp: Date;
  success?: boolean;
  error?: string;
  externalId?: string;
  violationDetails?: string; // For boundary violations
  // WI-066: UAT execution event fields
  uatMode?: UatExecutionMode;
  uatCorrelationId?: string;
  uatBoundaryViolation?: string; // Specific UAT boundary violation details
}

// Validation result for command pre-flight checks
export interface CommandValidation {
  isValid: boolean;
  reason: string;
  blockingFactors?: string[]; // e.g., ['insufficient_billing', 'capability_denied']
}

// Orchestrator result - comprehensive execution outcome
export interface OrchestratorResult {
  success: boolean;
  commandId: string;
  actionType: ExecutionActionType;
  adapterUsed: string;
  executionResult?: ExecutionResult;
  validation?: CommandValidation;
  correlationId: string;
  timestamp: Date;
  auditReferenceId: string;
}

// Zod schemas for runtime validation
export const ExecutionActionTypeSchema = z.nativeEnum(ExecutionActionType);

export const ExecutionCommandSchema = z.object({
  commandId: z.string().min(1),
  tenantId: z.string().min(1),
  leadId: z.string().min(1),
  actionType: ExecutionActionTypeSchema,
  payload: z.record(z.any()),
  correlationId: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export const ExecutionResultSchema = z.object({
  success: z.boolean(),
  commandId: z.string(),
  externalId: z.string().optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  timestamp: z.date(),
});

export const ExecutionEventSchema = z.object({
  eventType: z.nativeEnum(ExecutionEventType),
  tenantId: z.string(),
  leadId: z.string(),
  commandId: z.string(),
  actionType: ExecutionActionTypeSchema,
  adapterName: z.string(),
  correlationId: z.string(),
  timestamp: z.date(),
  success: z.boolean().optional(),
  error: z.string().optional(),
  externalId: z.string().optional(),
  violationDetails: z.string().optional(),
});

// Utility functions
export function isTerminalAction(actionType: ExecutionActionType): boolean {
  // Actions that represent final outcomes
  return [
    ExecutionActionType.UPDATE_CRM, // State changes are final
    ExecutionActionType.BOOK_CALENDAR, // Booking is a commitment
  ].includes(actionType);
}

export function requiresHumanIntervention(
  actionType: ExecutionActionType
): boolean {
  // Actions that might need human follow-up
  return [
    ExecutionActionType.MAKE_CALL, // Voice calls need human handling
    ExecutionActionType.BOOK_CALENDAR, // Calendar bookings need confirmation
  ].includes(actionType);
}

export function getActionPriority(
  actionType: ExecutionActionType
): 'low' | 'normal' | 'high' | 'urgent' {
  switch (actionType) {
    case ExecutionActionType.MAKE_CALL:
      return 'urgent'; // Voice needs immediate attention
    case ExecutionActionType.SEND_SMS:
      return 'high'; // SMS for time-sensitive comms
    case ExecutionActionType.SEND_EMAIL:
      return 'normal'; // Email can be batched
    case ExecutionActionType.BOOK_CALENDAR:
      return 'high'; // Calendar affects scheduling
    case ExecutionActionType.UPDATE_CRM:
      return 'normal'; // CRM updates are routine
    default:
      return 'normal';
  }
}

// Boundary violation detection
export interface BoundaryViolation {
  type:
    | 'state_read'
    | 'decision_logic'
    | 'conditional_branching'
    | 'external_api_call';
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  adapterName: string;
  commandId: string;
}
