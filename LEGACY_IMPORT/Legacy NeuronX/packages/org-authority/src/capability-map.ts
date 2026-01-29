/**
 * Capability Map - WI-035: Tenant & Organization Authority Model
 *
 * Strict mapping of roles to capabilities with clear enterprise governance.
 */

import { OrgRole, Capability, ROLE_CAPABILITIES } from './types';

/**
 * Capability mapping service
 */
export class CapabilityMap {
  /**
   * Get capabilities for a specific role
   */
  static getCapabilitiesForRole(role: OrgRole): Capability[] {
    return ROLE_CAPABILITIES[role] || [];
  }

  /**
   * Check if a role has a specific capability
   */
  static roleHasCapability(role: OrgRole, capability: Capability): boolean {
    const capabilities = this.getCapabilitiesForRole(role);
    return capabilities.includes(capability);
  }

  /**
   * Get all roles that have a specific capability
   */
  static getRolesWithCapability(capability: Capability): OrgRole[] {
    return Object.entries(ROLE_CAPABILITIES)
      .filter(([, capabilities]) => capabilities.includes(capability))
      .map(([role]) => role as OrgRole);
  }

  /**
   * Validate capability assignment (no cycles, no escalation)
   */
  static validateCapabilityAssignment(
    role: OrgRole,
    capability: Capability
  ): boolean {
    // Basic validation - ensure the capability makes sense for the role level
    const roleHierarchy: Record<OrgRole, number> = {
      [OrgRole.ENTERPRISE_ADMIN]: 5,
      [OrgRole.AGENCY_ADMIN]: 4,
      [OrgRole.TEAM_LEAD]: 3,
      [OrgRole.OPERATOR]: 2,
      [OrgRole.AUDITOR]: 1,
      [OrgRole.VIEWER]: 0,
    };

    const capabilityRequirements: Record<Capability, number> = {
      [Capability.READ_ALL]: 0,
      [Capability.VIEW_AUDIT_LOGS]: 1,
      [Capability.ASSIST_EXECUTION]: 2,
      [Capability.APPROVE_MEDIUM_RISK_EXECUTION]: 2,
      [Capability.ESCALATE_EXECUTION]: 2,
      [Capability.APPROVE_HIGH_RISK_EXECUTION]: 3,
      [Capability.REVOKE_EXECUTION_TOKENS]: 3,
      [Capability.PROMOTE_PLAYBOOK_VERSION]: 4,
      [Capability.ROLLBACK_PLAYBOOK]: 4,
      [Capability.OVERRIDE_DECISION_ENGINE]: 5,
      [Capability.MANAGE_ORG_STRUCTURE]: 4,
      [Capability.MANAGE_USER_ROLES]: 4,
    };

    const roleLevel = roleHierarchy[role] || 0;
    const requiredLevel = capabilityRequirements[capability] || 0;

    return roleLevel >= requiredLevel;
  }

  /**
   * Get capability description for documentation
   */
  static getCapabilityDescription(capability: Capability): string {
    const descriptions: Record<Capability, string> = {
      [Capability.READ_ALL]: 'Read access to all system data',
      [Capability.VIEW_AUDIT_LOGS]: 'Access to audit logs and compliance data',
      [Capability.APPROVE_HIGH_RISK_EXECUTION]:
        'Approve high-risk or critical execution actions',
      [Capability.APPROVE_MEDIUM_RISK_EXECUTION]:
        'Approve medium-risk execution actions',
      [Capability.ASSIST_EXECUTION]:
        'Assist in execution workflows and provide guidance',
      [Capability.ESCALATE_EXECUTION]:
        'Escalate execution issues to higher authority',
      [Capability.REVOKE_EXECUTION_TOKENS]:
        'Revoke execution tokens and stop running processes',
      [Capability.PROMOTE_PLAYBOOK_VERSION]:
        'Promote playbook versions to production',
      [Capability.ROLLBACK_PLAYBOOK]: 'Rollback playbook versions in emergency',
      [Capability.OVERRIDE_DECISION_ENGINE]:
        'Override automated decision engine results',
      [Capability.MANAGE_ORG_STRUCTURE]:
        'Create and modify organizational structure',
      [Capability.MANAGE_USER_ROLES]:
        'Assign and modify user roles and permissions',
    };

    return descriptions[capability] || 'Unknown capability';
  }

  /**
   * Get role description for documentation
   */
  static getRoleDescription(role: OrgRole): string {
    const descriptions: Record<OrgRole, string> = {
      [OrgRole.ENTERPRISE_ADMIN]:
        'Full enterprise control and system administration',
      [OrgRole.AGENCY_ADMIN]: 'Agency-level management and governance',
      [OrgRole.TEAM_LEAD]: 'Team supervision and medium-risk approvals',
      [OrgRole.OPERATOR]: 'Execution operations and basic approvals',
      [OrgRole.VIEWER]: 'Read-only access to system data',
      [OrgRole.AUDITOR]: 'Audit and compliance monitoring access',
    };

    return descriptions[role] || 'Unknown role';
  }

  /**
   * Check if a capability is administrative (requires high trust)
   */
  static isAdministrativeCapability(capability: Capability): boolean {
    const adminCapabilities = [
      Capability.OVERRIDE_DECISION_ENGINE,
      Capability.MANAGE_ORG_STRUCTURE,
      Capability.MANAGE_USER_ROLES,
      Capability.PROMOTE_PLAYBOOK_VERSION,
      Capability.ROLLBACK_PLAYBOOK,
    ];

    return adminCapabilities.includes(capability);
  }

  /**
   * Check if a capability is execution-related
   */
  static isExecutionCapability(capability: Capability): boolean {
    const executionCapabilities = [
      Capability.APPROVE_HIGH_RISK_EXECUTION,
      Capability.APPROVE_MEDIUM_RISK_EXECUTION,
      Capability.ASSIST_EXECUTION,
      Capability.ESCALATE_EXECUTION,
      Capability.REVOKE_EXECUTION_TOKENS,
    ];

    return executionCapabilities.includes(capability);
  }

  /**
   * Get escalation path for capabilities
   */
  static getEscalationPath(capability: Capability): OrgRole[] {
    const escalationPaths: Record<Capability, OrgRole[]> = {
      [Capability.APPROVE_MEDIUM_RISK_EXECUTION]: [
        OrgRole.OPERATOR,
        OrgRole.TEAM_LEAD,
        OrgRole.AGENCY_ADMIN,
      ],
      [Capability.APPROVE_HIGH_RISK_EXECUTION]: [
        OrgRole.TEAM_LEAD,
        OrgRole.AGENCY_ADMIN,
        OrgRole.ENTERPRISE_ADMIN,
      ],
      [Capability.ASSIST_EXECUTION]: [OrgRole.OPERATOR, OrgRole.TEAM_LEAD],
      [Capability.ESCALATE_EXECUTION]: [
        OrgRole.OPERATOR,
        OrgRole.TEAM_LEAD,
        OrgRole.AGENCY_ADMIN,
      ],
      [Capability.REVOKE_EXECUTION_TOKENS]: [
        OrgRole.TEAM_LEAD,
        OrgRole.AGENCY_ADMIN,
        OrgRole.ENTERPRISE_ADMIN,
      ],
      [Capability.PROMOTE_PLAYBOOK_VERSION]: [
        OrgRole.AGENCY_ADMIN,
        OrgRole.ENTERPRISE_ADMIN,
      ],
      [Capability.ROLLBACK_PLAYBOOK]: [
        OrgRole.AGENCY_ADMIN,
        OrgRole.ENTERPRISE_ADMIN,
      ],
      [Capability.OVERRIDE_DECISION_ENGINE]: [OrgRole.ENTERPRISE_ADMIN],
      // Add missing keys with empty arrays to satisfy TS2739
      [Capability.READ_ALL]: [],
      [Capability.VIEW_AUDIT_LOGS]: [],
      [Capability.MANAGE_ORG_STRUCTURE]: [],
      [Capability.MANAGE_USER_ROLES]: [],
    };

    return escalationPaths[capability] || [];
  }
}
