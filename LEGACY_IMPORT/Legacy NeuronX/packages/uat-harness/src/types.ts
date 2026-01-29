/**
 * UAT Harness Types - WI-066: UAT Harness + Seed + Safety
 *
 * Defines the configuration schema and types for UAT environment management.
 * Ensures fail-closed behavior and strict validation.
 */

import { z } from 'zod';

/**
 * NeuronX environment modes
 */
export type NeuronxEnvironment = 'dev' | 'uat' | 'prod';

/**
 * UAT execution modes
 */
export type UatExecutionMode = 'dry_run' | 'live_uat';

/**
 * UAT configuration schema
 */
export const UatConfigSchema = z.object({
  // Core environment identification
  neuronxEnv: z.enum(['dev', 'uat', 'prod']).default('dev'),

  // UAT tenant isolation
  uatTenantIds: z.array(z.string()).default([]),

  // UAT execution mode
  uatMode: z.enum(['dry_run', 'live_uat']).default('dry_run'),

  // Kill switch - when true, blocks all adapter side-effects
  uatKillSwitch: z.boolean().default(true),

  // GHL-specific UAT isolation (optional)
  uatGhlLocationIds: z.array(z.string()).optional().default([]),

  // UAT label prefix for created records
  uatLabelPrefix: z.string().default('[UAT]'),

  // Provider-specific allowlists for LIVE_UAT mode
  uatTestPhoneAllowlist: z.array(z.string()).optional().default([]),
  uatEmailDomainAllowlist: z.array(z.string()).optional().default([]),
  uatCalendarAllowlist: z.array(z.string()).optional().default([]),
});

/**
 * UAT configuration interface
 */
export type UatConfig = z.infer<typeof UatConfigSchema>;

/**
 * UAT context passed to execution components
 */
export interface UatContext {
  config: UatConfig;
  tenantId: string;
  correlationId: string;
  timestamp: Date;
}

/**
 * UAT guard result
 */
export interface UatGuardResult {
  allowed: boolean;
  reason?: string;
  mode: UatExecutionMode;
  killSwitchActive: boolean;
}

/**
 * UAT audit event
 */
export interface UatAuditEvent {
  eventType:
    | 'uat_guard_check'
    | 'uat_adapter_execution'
    | 'uat_boundary_violation';
  tenantId: string;
  correlationId: string;
  timestamp: Date;
  details: Record<string, any>;
}

/**
 * Default UAT configuration values
 */
export const DEFAULT_UAT_CONFIG: UatConfig = {
  neuronxEnv: 'dev',
  uatTenantIds: [],
  uatMode: 'dry_run',
  uatKillSwitch: true,
  uatGhlLocationIds: [],
  uatLabelPrefix: '[UAT]',
  uatTestPhoneAllowlist: [],
  uatEmailDomainAllowlist: [],
  uatCalendarAllowlist: [],
};
