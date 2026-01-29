/**
 * Execution Types - WI-028: Adapter-First Execution Layer
 *
 * Core types for the adapter-first execution framework.
 * NeuronX makes decisions, adapters only execute side effects.
 */

import { z } from 'zod';

// Action types that can be executed by adapters
export enum ExecutionActionType {
  SEND_SMS = 'SEND_SMS',
  SEND_EMAIL = 'SEND_EMAIL',
  MAKE_CALL = 'MAKE_CALL',
  BOOK_CALENDAR = 'BOOK_CALENDAR',
  UPDATE_CRM = 'UPDATE_CRM',
}

// Execution command - the core abstraction
export interface ExecutionCommand {
  commandId: string;
  tenantId: string;
  leadId: string;
  actionType: ExecutionActionType;
  payload: Record<string, any>;
  correlationId: string;
  requestedAt?: Date;
  requestedBy?: string;
}

// Execution result from adapter
export interface ExecutionResult {
  commandId: string;
  success: boolean;
  externalId?: string; // ID from external system (Twilio SID, email ID, etc.)
  errorMessage?: string;
  metadata?: Record<string, any>;
  executedAt: Date;
}

// Adapter capability check
export interface AdapterCapability {
  actionType: ExecutionActionType;
  supported: boolean;
  rateLimits?: {
    requestsPerMinute: number;
    burstLimit: number;
  };
}

// Event types for execution auditing
export enum ExecutionEventType {
  EXECUTION_ATTEMPTED = 'execution_attempted',
  EXECUTION_SUCCEEDED = 'execution_succeeded',
  EXECUTION_FAILED = 'execution_failed',
  ADAPTER_BOUNDARY_VIOLATION = 'adapter_boundary_violation',
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
  errorMessage?: string;
  externalId?: string;
  metadata?: Record<string, any>;
}

// Validation result for execution attempts
export interface ExecutionValidation {
  isValid: boolean;
  reason: string;
  blockedBy?: 'fsm_state' | 'capability' | 'billing' | 'policy';
}

// Adapter interface - execution only, no decisions
export interface ExecutionAdapter {
  name: string;

  /**
   * Check if this adapter supports the given action type
   */
  supports(actionType: ExecutionActionType): boolean;

  /**
   * Get adapter capabilities
   */
  getCapabilities(): AdapterCapability[];

  /**
   * Execute the command - SIDE EFFECTS ONLY
   * NO BUSINESS LOGIC, NO STATE CHANGES, NO DECISIONS
   */
  execute(command: ExecutionCommand): Promise<ExecutionResult>;

  /**
   * Get adapter health status
   */
  getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    lastChecked: Date;
  }>;
}

// Boundary violation types
export enum BoundaryViolationType {
  STATE_ACCESS_ATTEMPT = 'state_access_attempt',
  BUSINESS_LOGIC_IN_ADAPTER = 'business_logic_in_adapter',
  DECISION_MAKING_IN_ADAPTER = 'decision_making_in_adapter',
  EXTERNAL_DEPENDENCY_IN_ADAPTER = 'external_dependency_in_adapter',
}

// Boundary violation event
export interface BoundaryViolationEvent {
  eventType: 'adapter_boundary_violation';
  tenantId: string;
  leadId: string;
  commandId: string;
  adapterName: string;
  violationType: BoundaryViolationType;
  details: string;
  correlationId: string;
  timestamp: Date;
}

// Zod schemas for validation
export const ExecutionActionTypeSchema = z.nativeEnum(ExecutionActionType);

export const ExecutionCommandSchema = z.object({
  commandId: z.string().min(1),
  tenantId: z.string().min(1),
  leadId: z.string().min(1),
  actionType: ExecutionActionTypeSchema,
  payload: z.record(z.any()),
  correlationId: z.string().min(1),
  requestedAt: z.date().optional(),
  requestedBy: z.string().optional(),
});

export const ExecutionResultSchema = z.object({
  commandId: z.string(),
  success: z.boolean(),
  externalId: z.string().optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  executedAt: z.date(),
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
  errorMessage: z.string().optional(),
  externalId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Utility functions
export function isTerminalAction(_actionType: ExecutionActionType): boolean {
  // All execution actions are terminal - they complete immediately
  return true;
}

export function getActionCategory(
  actionType: ExecutionActionType
): 'communication' | 'crm' | 'calendar' {
  switch (actionType) {
    case ExecutionActionType.SEND_SMS:
    case ExecutionActionType.SEND_EMAIL:
    case ExecutionActionType.MAKE_CALL:
      return 'communication';
    case ExecutionActionType.UPDATE_CRM:
      return 'crm';
    case ExecutionActionType.BOOK_CALENDAR:
      return 'calendar';
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

export function requiresStateValidation(
  _actionType: ExecutionActionType
): boolean {
  // All actions require FSM state validation
  return true;
}

export function isIdempotent(_command: ExecutionCommand): boolean {
  // All commands are idempotent by commandId
  return true;
}
