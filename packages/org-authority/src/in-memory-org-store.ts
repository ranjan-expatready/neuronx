/**
 * In-Memory Org Store - WI-035: Tenant & Organization Authority Model
 *
 * In-memory implementation for testing and scaffolding. TODO: Replace with Prisma-based store.
 */

import {
  Enterprise,
  Agency,
  Team,
  OrgMember,
  RoleAssignment,
  CreateEnterpriseRequest,
  CreateAgencyRequest,
  CreateTeamRequest,
  CreateMemberRequest,
  CreateRoleAssignmentRequest,
  ListRoleAssignmentsResponse,
  OrgRole,
} from './types';

/**
 * In-memory organization store
 * TODO: Replace with Prisma-based implementation
 */
export class InMemoryOrgStore {
  private enterprises: Map<string, Enterprise> = new Map();
  private agencies: Map<string, Agency> = new Map();
  private teams: Map<string, Team> = new Map();
  private members: Map<string, OrgMember> = new Map();
  private roleAssignments: Map<string, RoleAssignment> = new Map();

  // ============================================================================
  // ENTERPRISE OPERATIONS
  // ============================================================================

  async createEnterprise(
    tenantId: string,
    request: CreateEnterpriseRequest
  ): Promise<Enterprise> {
    const enterprise: Enterprise = {
      id: `ent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      name: request.name,
      description: request.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.enterprises.set(enterprise.id, enterprise);
    return enterprise;
  }

  async getEnterprise(id: string): Promise<Enterprise | null> {
    return this.enterprises.get(id) || null;
  }

  async listEnterprises(tenantId: string): Promise<Enterprise[]> {
    return Array.from(this.enterprises.values()).filter(
      ent => ent.tenantId === tenantId
    );
  }

  // ============================================================================
  // AGENCY OPERATIONS
  // ============================================================================

  async createAgency(
    tenantId: string,
    request: CreateAgencyRequest
  ): Promise<Agency> {
    // Verify enterprise exists and belongs to tenant
    const enterprise = this.enterprises.get(request.enterpriseId);
    if (!enterprise || enterprise.tenantId !== tenantId) {
      throw new Error(
        `Enterprise ${request.enterpriseId} not found or access denied`
      );
    }

    const agency: Agency = {
      id: `agy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      enterpriseId: request.enterpriseId,
      name: request.name,
      description: request.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.agencies.set(agency.id, agency);
    return agency;
  }

  async getAgency(id: string): Promise<Agency | null> {
    return this.agencies.get(id) || null;
  }

  async listAgencies(
    tenantId: string,
    enterpriseId?: string
  ): Promise<Agency[]> {
    let agencies = Array.from(this.agencies.values()).filter(
      agy => agy.tenantId === tenantId
    );

    if (enterpriseId) {
      agencies = agencies.filter(agy => agy.enterpriseId === enterpriseId);
    }

    return agencies;
  }

  // ============================================================================
  // TEAM OPERATIONS
  // ============================================================================

  async createTeam(
    tenantId: string,
    request: CreateTeamRequest
  ): Promise<Team> {
    // Verify agency exists and belongs to tenant
    const agency = this.agencies.get(request.agencyId);
    if (!agency || agency.tenantId !== tenantId) {
      throw new Error(`Agency ${request.agencyId} not found or access denied`);
    }

    const team: Team = {
      id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      agencyId: request.agencyId,
      name: request.name,
      description: request.description,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.teams.set(team.id, team);
    return team;
  }

  async getTeam(id: string): Promise<Team | null> {
    return this.teams.get(id) || null;
  }

  async listTeams(tenantId: string, agencyId?: string): Promise<Team[]> {
    let teams = Array.from(this.teams.values()).filter(
      team => team.tenantId === tenantId
    );

    if (agencyId) {
      teams = teams.filter(team => team.agencyId === agencyId);
    }

    return teams;
  }

  // ============================================================================
  // MEMBER OPERATIONS
  // ============================================================================

  async createMember(
    tenantId: string,
    request: CreateMemberRequest
  ): Promise<OrgMember> {
    const member: OrgMember = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      userId: request.userId,
      displayName: request.displayName,
      email: request.email,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.members.set(member.id, member);
    return member;
  }

  async getMember(id: string): Promise<OrgMember | null> {
    return this.members.get(id) || null;
  }

  async getMemberByUserId(
    tenantId: string,
    userId: string
  ): Promise<OrgMember | null> {
    return (
      Array.from(this.members.values()).find(
        mem => mem.tenantId === tenantId && mem.userId === userId
      ) || null
    );
  }

  async listMembers(tenantId: string): Promise<OrgMember[]> {
    return Array.from(this.members.values()).filter(
      mem => mem.tenantId === tenantId
    );
  }

  // ============================================================================
  // ROLE ASSIGNMENT OPERATIONS
  // ============================================================================

  async createRoleAssignment(
    tenantId: string,
    request: CreateRoleAssignmentRequest
  ): Promise<RoleAssignment> {
    // Verify member exists and belongs to tenant
    const member = this.members.get(request.memberId);
    if (!member || member.tenantId !== tenantId) {
      throw new Error(`Member ${request.memberId} not found or access denied`);
    }

    // Verify scope exists and belongs to tenant
    await this.verifyScopeExists(tenantId, request.scopeType, request.scopeId);

    const assignment: RoleAssignment = {
      id: `ra_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      memberId: request.memberId,
      role: request.role,
      scopeType: request.scopeType,
      scopeId: request.scopeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.roleAssignments.set(assignment.id, assignment);
    return assignment;
  }

  async getRoleAssignment(id: string): Promise<RoleAssignment | null> {
    return this.roleAssignments.get(id) || null;
  }

  async listRoleAssignments(
    tenantId: string,
    memberId?: string,
    scopeType?: 'enterprise' | 'agency' | 'team',
    scopeId?: string
  ): Promise<ListRoleAssignmentsResponse> {
    let assignments = Array.from(this.roleAssignments.values()).filter(
      ra => ra.tenantId === tenantId && !ra.revokedAt
    );

    if (memberId) {
      assignments = assignments.filter(ra => ra.memberId === memberId);
    }

    if (scopeType && scopeId) {
      assignments = assignments.filter(
        ra => ra.scopeType === scopeType && ra.scopeId === scopeId
      );
    }

    return {
      assignments,
      total: assignments.length,
    };
  }

  async revokeRoleAssignment(id: string, revokedBy: string): Promise<void> {
    const assignment = this.roleAssignments.get(id);
    if (!assignment) {
      throw new Error(`Role assignment ${id} not found`);
    }

    if (assignment.revokedAt) {
      // Already revoked
      return;
    }

    assignment.revokedAt = new Date();
    assignment.updatedAt = new Date();

    // Add revocation metadata (would be stored in audit log in real implementation)
    (assignment as any).revokedBy = revokedBy;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async verifyScopeExists(
    tenantId: string,
    scopeType: 'enterprise' | 'agency' | 'team',
    scopeId: string
  ): Promise<void> {
    switch (scopeType) {
      case 'enterprise':
        const enterprise = this.enterprises.get(scopeId);
        if (!enterprise || enterprise.tenantId !== tenantId) {
          throw new Error(`Enterprise ${scopeId} not found or access denied`);
        }
        break;

      case 'agency':
        const agency = this.agencies.get(scopeId);
        if (!agency || agency.tenantId !== tenantId) {
          throw new Error(`Agency ${scopeId} not found or access denied`);
        }
        break;

      case 'team':
        const team = this.teams.get(scopeId);
        if (!team || team.tenantId !== tenantId) {
          throw new Error(`Team ${scopeId} not found or access denied`);
        }
        break;

      default:
        throw new Error(`Invalid scope type: ${scopeType}`);
    }
  }

  // ============================================================================
  // UTILITY METHODS FOR TESTING
  // ============================================================================

  async clearAll(): Promise<void> {
    this.enterprises.clear();
    this.agencies.clear();
    this.teams.clear();
    this.members.clear();
    this.roleAssignments.clear();
  }

  getStats(): {
    enterprises: number;
    agencies: number;
    teams: number;
    members: number;
    roleAssignments: number;
  } {
    return {
      enterprises: this.enterprises.size,
      agencies: this.agencies.size,
      teams: this.teams.size,
      members: this.members.size,
      roleAssignments: this.roleAssignments.size,
    };
  }

  // ============================================================================
  // RELATIONSHIP HELPERS (for scope resolution)
  // ============================================================================

  async getEnterpriseForAgency(agencyId: string): Promise<Enterprise | null> {
    const agency = this.agencies.get(agencyId);
    if (!agency) return null;

    return this.enterprises.get(agency.enterpriseId) || null;
  }

  async getAgencyForTeam(teamId: string): Promise<Agency | null> {
    const team = this.teams.get(teamId);
    if (!team) return null;

    return this.agencies.get(team.agencyId) || null;
  }

  async getEnterpriseForTeam(teamId: string): Promise<Enterprise | null> {
    const agency = await this.getAgencyForTeam(teamId);
    if (!agency) return null;

    return this.getEnterpriseForAgency(agency.id);
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  async validateOrgStructure(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check agency-enterprise relationships
    for (const agency of this.agencies.values()) {
      if (!this.enterprises.has(agency.enterpriseId)) {
        errors.push(
          `Agency ${agency.id} references non-existent enterprise ${agency.enterpriseId}`
        );
      }
    }

    // Check team-agency relationships
    for (const team of this.teams.values()) {
      if (!this.agencies.has(team.agencyId)) {
        errors.push(
          `Team ${team.id} references non-existent agency ${team.agencyId}`
        );
      }
    }

    // Check role assignment scopes
    for (const assignment of this.roleAssignments.values()) {
      try {
        await this.verifyScopeExists(
          assignment.tenantId,
          assignment.scopeType,
          assignment.scopeId
        );
      } catch (error) {
        errors.push(
          `Role assignment ${assignment.id} has invalid scope: ${error.message}`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
