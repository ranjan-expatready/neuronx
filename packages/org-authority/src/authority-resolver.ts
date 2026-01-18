/**
 * Authority Resolver - WI-035: Tenant & Organization Authority Model
 *
 * Resolves capabilities and enforces scope-based authorization.
 */

import {
  AuthorityContext,
  Capability,
  OrgRole,
  RoleAssignment,
  OrgAuthzError,
  OrgScopeError,
  InsufficientCapabilitiesError,
} from './types';
import { CapabilityMap } from './capability-map';

/**
 * Authority resolver for capability and scope checks
 */
export class AuthorityResolver {
  /**
   * Resolve capabilities for an authority context
   */
  resolveCapabilities(
    context: Omit<AuthorityContext, 'resolvedCapabilities'>
  ): Set<Capability> {
    const capabilities = new Set<Capability>();

    // Add capabilities from all active role assignments
    for (const assignment of context.roleAssignments) {
      if (!assignment.revokedAt) {
        const roleCapabilities = CapabilityMap.getCapabilitiesForRole(
          assignment.role
        );
        roleCapabilities.forEach(cap => capabilities.add(cap));
      }
    }

    return capabilities;
  }

  /**
   * Check if context has a specific capability
   */
  hasCapability(context: AuthorityContext, capability: Capability): boolean {
    return context.resolvedCapabilities.has(capability);
  }

  /**
   * Assert capability (throws error if not authorized)
   */
  assertCapability(context: AuthorityContext, capability: Capability): void {
    if (!this.hasCapability(context, capability)) {
      throw new InsufficientCapabilitiesError(
        [capability],
        Array.from(context.resolvedCapabilities)
      );
    }
  }

  /**
   * Check if user can act on a specific team
   */
  canActOnTeam(context: AuthorityContext, teamId: string): boolean {
    // Check for direct team scope
    const hasDirectTeamAccess = context.roleAssignments.some(
      assignment =>
        assignment.scopeType === 'team' &&
        assignment.scopeId === teamId &&
        !assignment.revokedAt
    );

    if (hasDirectTeamAccess) {
      return true;
    }

    // Check for agency scope (parent of team)
    // TODO: Need team-to-agency mapping from store
    // For now, assume no parent scope access
    return false;
  }

  /**
   * Check if user can act on a specific agency
   */
  canActOnAgency(context: AuthorityContext, agencyId: string): boolean {
    // Check for direct agency scope
    const hasDirectAgencyAccess = context.roleAssignments.some(
      assignment =>
        assignment.scopeType === 'agency' &&
        assignment.scopeId === agencyId &&
        !assignment.revokedAt
    );

    if (hasDirectAgencyAccess) {
      return true;
    }

    // Check for enterprise scope (parent of agency)
    // TODO: Need agency-to-enterprise mapping from store
    // For now, assume no parent scope access
    return false;
  }

  /**
   * Check if user can act on enterprise
   */
  canActOnEnterprise(context: AuthorityContext, enterpriseId: string): boolean {
    // Check for direct enterprise scope
    const hasDirectEnterpriseAccess = context.roleAssignments.some(
      assignment =>
        assignment.scopeType === 'enterprise' &&
        assignment.scopeId === enterpriseId &&
        !assignment.revokedAt
    );

    return hasDirectEnterpriseAccess;
  }

  /**
   * Assert scope access for team action
   */
  assertCanActOnTeam(context: AuthorityContext, teamId: string): void {
    if (!this.canActOnTeam(context, teamId)) {
      throw new OrgScopeError(
        `Insufficient scope to act on team ${teamId}`,
        `team:${teamId}`,
        this.getCurrentScopes(context).join(', ')
      );
    }
  }

  /**
   * Assert scope access for agency action
   */
  assertCanActOnAgency(context: AuthorityContext, agencyId: string): void {
    if (!this.canActOnAgency(context, agencyId)) {
      throw new OrgScopeError(
        `Insufficient scope to act on agency ${agencyId}`,
        `agency:${agencyId}`,
        this.getCurrentScopes(context).join(', ')
      );
    }
  }

  /**
   * Assert scope access for enterprise action
   */
  assertCanActOnEnterprise(
    context: AuthorityContext,
    enterpriseId: string
  ): void {
    if (!this.canActOnEnterprise(context, enterpriseId)) {
      throw new OrgScopeError(
        `Insufficient scope to act on enterprise ${enterpriseId}`,
        `enterprise:${enterpriseId}`,
        this.getCurrentScopes(context).join(', ')
      );
    }
  }

  /**
   * Get current scopes for a context
   */
  private getCurrentScopes(context: AuthorityContext): string[] {
    return context.roleAssignments
      .filter(assignment => !assignment.revokedAt)
      .map(assignment => `${assignment.scopeType}:${assignment.scopeId}`);
  }

  /**
   * Check if user has any administrative capabilities
   */
  hasAdministrativeCapabilities(context: AuthorityContext): boolean {
    return Array.from(context.resolvedCapabilities).some(capability =>
      CapabilityMap.isAdministrativeCapability(capability)
    );
  }

  /**
   * Check if user has execution capabilities
   */
  hasExecutionCapabilities(context: AuthorityContext): boolean {
    return Array.from(context.resolvedCapabilities).some(capability =>
      CapabilityMap.isExecutionCapability(capability)
    );
  }

  /**
   * Get the highest role in the user's assignments
   */
  getHighestRole(context: AuthorityContext): OrgRole | null {
    const roleHierarchy: Record<OrgRole, number> = {
      [OrgRole.ENTERPRISE_ADMIN]: 5,
      [OrgRole.AGENCY_ADMIN]: 4,
      [OrgRole.TEAM_LEAD]: 3,
      [OrgRole.OPERATOR]: 2,
      [OrgRole.AUDITOR]: 1,
      [OrgRole.VIEWER]: 0,
    };

    let highestRole: OrgRole | null = null;
    let highestLevel = -1;

    for (const assignment of context.roleAssignments) {
      if (!assignment.revokedAt) {
        const level = roleHierarchy[assignment.role] || 0;
        if (level > highestLevel) {
          highestLevel = level;
          highestRole = assignment.role;
        }
      }
    }

    return highestRole;
  }

  /**
   * Get all active roles for a context
   */
  getActiveRoles(context: AuthorityContext): OrgRole[] {
    return context.roleAssignments
      .filter(assignment => !assignment.revokedAt)
      .map(assignment => assignment.role);
  }

  /**
   * Check if user has sufficient authority for an action
   */
  hasSufficientAuthority(
    context: AuthorityContext,
    requiredCapabilities: Capability[],
    requiredScope?: { type: 'enterprise' | 'agency' | 'team'; id: string }
  ): boolean {
    // Check capabilities
    const hasAllCapabilities = requiredCapabilities.every(capability =>
      this.hasCapability(context, capability)
    );

    if (!hasAllCapabilities) {
      return false;
    }

    // Check scope if required
    if (requiredScope) {
      switch (requiredScope.type) {
        case 'enterprise':
          return this.canActOnEnterprise(context, requiredScope.id);
        case 'agency':
          return this.canActOnAgency(context, requiredScope.id);
        case 'team':
          return this.canActOnTeam(context, requiredScope.id);
        default:
          return false;
      }
    }

    return true;
  }

  /**
   * Assert sufficient authority for an action
   */
  assertSufficientAuthority(
    context: AuthorityContext,
    requiredCapabilities: Capability[],
    requiredScope?: { type: 'enterprise' | 'agency' | 'team'; id: string }
  ): void {
    // Check capabilities
    const missingCapabilities = requiredCapabilities.filter(
      capability => !this.hasCapability(context, capability)
    );

    if (missingCapabilities.length > 0) {
      throw new InsufficientCapabilitiesError(
        requiredCapabilities,
        Array.from(context.resolvedCapabilities)
      );
    }

    // Check scope if required
    if (requiredScope) {
      switch (requiredScope.type) {
        case 'enterprise':
          this.assertCanActOnEnterprise(context, requiredScope.id);
          break;
        case 'agency':
          this.assertCanActOnAgency(context, requiredScope.id);
          break;
        case 'team':
          this.assertCanActOnTeam(context, requiredScope.id);
          break;
      }
    }
  }

  /**
   * Get escalation path for missing capabilities
   */
  getEscalationPath(requiredCapabilities: Capability[]): OrgRole[] {
    const escalationRoles = new Set<OrgRole>();

    for (const capability of requiredCapabilities) {
      const path = CapabilityMap.getEscalationPath(capability);
      path.forEach(role => escalationRoles.add(role));
    }

    return Array.from(escalationRoles);
  }

  /**
   * Create authority context from role assignments
   */
  createContext(
    tenantId: string,
    memberId: string,
    userId: string,
    roleAssignments: RoleAssignment[]
  ): AuthorityContext {
    const resolvedCapabilities = this.resolveCapabilities({
      tenantId,
      memberId,
      userId,
      roleAssignments,
    });

    return {
      tenantId,
      memberId,
      userId,
      roleAssignments,
      resolvedCapabilities,
    };
  }
}
