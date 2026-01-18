/**
 * Organization Authority Types - WI-035: Tenant & Organization Authority Model
 *
 * Defines hierarchical org structure with capability-based authorization.
 */

import { ExecutionChannel } from '@neuronx/execution-authority';

// ============================================================================
// AUTHORITY LEVELS & ROLES
// ============================================================================

/**
 * Authority levels in the org hierarchy
 */
export enum AuthorityLevel {
  SYSTEM = 'SYSTEM', // System-wide (rare, emergency only)
  ENTERPRISE = 'ENTERPRISE', // Top-level enterprise
  AGENCY = 'AGENCY', // Business unit/agency
  TEAM = 'TEAM', // Operational team
  INDIVIDUAL = 'INDIVIDUAL', // Individual user
}

/**
 * Organization roles with specific capabilities
 */
export enum OrgRole {
  ENTERPRISE_ADMIN = 'ENTERPRISE_ADMIN', // Full enterprise control
  AGENCY_ADMIN = 'AGENCY_ADMIN', // Agency management
  TEAM_LEAD = 'TEAM_LEAD', // Team supervision
  OPERATOR = 'OPERATOR', // Execution operations
  VIEWER = 'VIEWER', // Read-only access
  AUDITOR = 'AUDITOR', // Audit and compliance
}

/**
 * Capabilities define what actions can be performed
 */
export enum Capability {
  // Read capabilities
  READ_ALL = 'READ_ALL',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',

  // Execution capabilities
  APPROVE_HIGH_RISK_EXECUTION = 'APPROVE_HIGH_RISK_EXECUTION',
  APPROVE_MEDIUM_RISK_EXECUTION = 'APPROVE_MEDIUM_RISK_EXECUTION',
  ASSIST_EXECUTION = 'ASSIST_EXECUTION',
  ESCALATE_EXECUTION = 'ESCALATE_EXECUTION',

  // Token management
  REVOKE_EXECUTION_TOKENS = 'REVOKE_EXECUTION_TOKENS',

  // Playbook governance
  PROMOTE_PLAYBOOK_VERSION = 'PROMOTE_PLAYBOOK_VERSION',
  ROLLBACK_PLAYBOOK = 'ROLLBACK_PLAYBOOK',

  // Admin capabilities
  OVERRIDE_DECISION_ENGINE = 'OVERRIDE_DECISION_ENGINE',
  MANAGE_ORG_STRUCTURE = 'MANAGE_ORG_STRUCTURE',
  MANAGE_USER_ROLES = 'MANAGE_USER_ROLES',
}

// ============================================================================
// ORGANIZATION ENTITIES
// ============================================================================

/**
 * Enterprise - Top-level organizational unit
 */
export interface Enterprise {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Agency - Business unit within an enterprise
 */
export interface Agency {
  id: string;
  tenantId: string;
  enterpriseId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team - Operational unit within an agency
 */
export interface Team {
  id: string;
  tenantId: string;
  agencyId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Organization member - User within the org structure
 */
export interface OrgMember {
  id: string;
  tenantId: string;
  userId: string;
  displayName?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Role assignment - Links member to role at specific scope
 */
export interface RoleAssignment {
  id: string;
  tenantId: string;
  memberId: string;
  role: OrgRole;
  scopeType: 'enterprise' | 'agency' | 'team';
  scopeId: string; // enterpriseId, agencyId, or teamId
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
}

// ============================================================================
// AUTHORITY & APPROVAL
// ============================================================================

/**
 * Authority context for authorization decisions
 */
export interface AuthorityContext {
  tenantId: string;
  memberId: string;
  userId: string;
  roleAssignments: RoleAssignment[];
  resolvedCapabilities: Set<Capability>;
}

/**
 * Action types for operator workflows
 */
export enum ActionType {
  APPROVE = 'APPROVE',
  ASSIST = 'ASSIST',
  ESCALATE = 'ESCALATE',
  REVOKE_TOKEN = 'REVOKE_TOKEN',
}

/**
 * Risk levels aligned with Decision Engine
 */
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Voice modes for execution
 */
export enum VoiceMode {
  SCRIPTED = 'SCRIPTED',
  CONVERSATIONAL = 'CONVERSATIONAL',
  HUMAN_ONLY = 'HUMAN_ONLY',
}

/**
 * Approval requirement for actions
 */
export interface ApprovalRequirement {
  required: boolean;
  requiredCapabilities: Capability[];
  reason: string;
  escalationRole?: OrgRole;
  minimumAuthorityLevel?: AuthorityLevel;
}

/**
 * Action context for approval chain resolution
 */
export interface ActionContext {
  actionType: ActionType;
  riskLevel: RiskLevel;
  dealValue?: number;
  channel?: ExecutionChannel;
  voiceMode?: VoiceMode;
  opportunityId?: string;
  commandType?: string;
}

// ============================================================================
// CAPABILITY GRANTS
// ============================================================================

/**
 * Capability grants by role
 */
export interface CapabilityGrant {
  role: OrgRole;
  capabilities: Capability[];
}

/**
 * Predefined capability grants
 */
export const ROLE_CAPABILITIES: Record<OrgRole, Capability[]> = {
  [OrgRole.ENTERPRISE_ADMIN]: [
    Capability.READ_ALL,
    Capability.VIEW_AUDIT_LOGS,
    Capability.APPROVE_HIGH_RISK_EXECUTION,
    Capability.APPROVE_MEDIUM_RISK_EXECUTION,
    Capability.ASSIST_EXECUTION,
    Capability.ESCALATE_EXECUTION,
    Capability.REVOKE_EXECUTION_TOKENS,
    Capability.PROMOTE_PLAYBOOK_VERSION,
    Capability.ROLLBACK_PLAYBOOK,
    Capability.OVERRIDE_DECISION_ENGINE,
    Capability.MANAGE_ORG_STRUCTURE,
    Capability.MANAGE_USER_ROLES,
  ],

  [OrgRole.AGENCY_ADMIN]: [
    Capability.READ_ALL,
    Capability.VIEW_AUDIT_LOGS,
    Capability.APPROVE_HIGH_RISK_EXECUTION,
    Capability.APPROVE_MEDIUM_RISK_EXECUTION,
    Capability.ASSIST_EXECUTION,
    Capability.ESCALATE_EXECUTION,
    Capability.REVOKE_EXECUTION_TOKENS,
    Capability.PROMOTE_PLAYBOOK_VERSION,
    Capability.ROLLBACK_PLAYBOOK,
    Capability.MANAGE_ORG_STRUCTURE,
    Capability.MANAGE_USER_ROLES,
  ],

  [OrgRole.TEAM_LEAD]: [
    Capability.READ_ALL,
    Capability.APPROVE_MEDIUM_RISK_EXECUTION,
    Capability.APPROVE_HIGH_RISK_EXECUTION,
    Capability.ASSIST_EXECUTION,
    Capability.ESCALATE_EXECUTION,
    Capability.REVOKE_EXECUTION_TOKENS,
  ],

  [OrgRole.OPERATOR]: [
    Capability.READ_ALL,
    Capability.APPROVE_MEDIUM_RISK_EXECUTION,
    Capability.ASSIST_EXECUTION,
    Capability.ESCALATE_EXECUTION,
  ],

  [OrgRole.VIEWER]: [Capability.READ_ALL],

  [OrgRole.AUDITOR]: [Capability.READ_ALL, Capability.VIEW_AUDIT_LOGS],
};

// ============================================================================
// ERRORS
// ============================================================================

/**
 * Organization authorization error
 */
export class OrgAuthzError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 403,
    public readonly requiredCapabilities?: Capability[],
    public readonly actualCapabilities?: Capability[]
  ) {
    super(message);
    this.name = 'OrgAuthzError';
  }
}

/**
 * Organization scope error
 */
export class OrgScopeError extends OrgAuthzError {
  constructor(
    message: string,
    public readonly requiredScope: string,
    public readonly actualScope?: string
  ) {
    super(message, 'ORG_SCOPE_ERROR', 403);
    this.name = 'OrgScopeError';
  }
}

/**
 * Insufficient capabilities error
 */
export class InsufficientCapabilitiesError extends OrgAuthzError {
  constructor(required: Capability[], actual: Capability[]) {
    super(
      `Insufficient capabilities. Required: ${required.join(', ')}, Actual: ${actual.join(', ')}`,
      'INSUFFICIENT_CAPABILITIES',
      403,
      required,
      actual
    );
    this.name = 'InsufficientCapabilitiesError';
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Create enterprise request
 */
export interface CreateEnterpriseRequest {
  name: string;
  description?: string;
}

/**
 * Create agency request
 */
export interface CreateAgencyRequest {
  enterpriseId: string;
  name: string;
  description?: string;
}

/**
 * Create team request
 */
export interface CreateTeamRequest {
  agencyId: string;
  name: string;
  description?: string;
}

/**
 * Create member request
 */
export interface CreateMemberRequest {
  userId: string;
  displayName?: string;
  email?: string;
}

/**
 * Create role assignment request
 */
export interface CreateRoleAssignmentRequest {
  memberId: string;
  role: OrgRole;
  scopeType: 'enterprise' | 'agency' | 'team';
  scopeId: string;
}

/**
 * List role assignments response
 */
export interface ListRoleAssignmentsResponse {
  assignments: RoleAssignment[];
  total: number;
}
