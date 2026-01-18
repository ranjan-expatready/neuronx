/**
 * Org Authority Service - WI-035: Tenant & Organization Authority Model
 *
 * Core API service for org authority operations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  AuthorityResolver,
  ApprovalChainResolver,
  InMemoryOrgStore,
  AuthorityContext,
  ActionContext,
  ApprovalRequirement,
  CreateEnterpriseRequest,
  CreateAgencyRequest,
  CreateTeamRequest,
  CreateMemberRequest,
  CreateRoleAssignmentRequest,
  ListRoleAssignmentsResponse,
} from '@neuronx/org-authority';
import { TenantContext } from '../config/tenant-context';
import {
  Principal,
  PrincipalContext,
  PrincipalExtractorService,
} from '../authz/principal';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrgAuthorityService {
  private readonly logger = new Logger(OrgAuthorityService.name);
  private readonly resolver = new AuthorityResolver();
  private readonly approvalResolver = new ApprovalChainResolver();
  private readonly store = new InMemoryOrgStore(); // TODO: Replace with Prisma store
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly tenantContext: TenantContext,
    private readonly principalExtractor: PrincipalExtractorService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Extract principal from request
   */
  async extractPrincipal(request: any): Promise<Principal> {
    const { principal } = await this.principalExtractor.extract(request);
    return principal;
  }

  /**
   * Get authority context from request
   */
  async getAuthorityContextFromRequest(
    request: any
  ): Promise<AuthorityContext> {
    const principal = await this.extractPrincipal(request);
    return this.getAuthorityContext(principal);
  }

  /**
   * Require capability from request (throws error if not authorized)
   */
  async requireCapabilityFromRequest(
    request: any,
    capability: any
  ): Promise<void> {
    const principal = await this.extractPrincipal(request);
    await this.requireCapability(principal, capability);
  }

  /**
   * Get authority context for principal
   */
  async getAuthorityContext(principal: Principal): Promise<AuthorityContext> {
    const { tenantId, userId } = principal;

    // Get member for user (if exists)
    let memberId: string | undefined;
    if (principal.memberId) {
      memberId = principal.memberId;
    } else {
      const member = await this.store.getMemberByUserId(tenantId, userId);
      memberId = member?.id;
    }

    // Get role assignments for member (if exists)
    let roleAssignments: any[] = [];
    if (memberId) {
      const { assignments } = await this.store.listRoleAssignments(
        tenantId,
        memberId
      );
      roleAssignments = assignments;
    }

    return this.resolver.createContext(
      tenantId,
      memberId || '',
      userId,
      roleAssignments
    );
  }

  /**
   * Require capability (throws error if not authorized)
   */
  async requireCapability(
    principal: Principal,
    capability: any
  ): Promise<void> {
    const context = await this.getAuthorityContext(principal);
    this.resolver.assertCapability(context, capability);
  }

  /**
   * Get approval requirement for action context
   */
  getApprovalRequirement(context: ActionContext): ApprovalRequirement {
    return this.approvalResolver.getApprovalRequirement(context);
  }

  // ============================================================================
  // ORGANIZATION MANAGEMENT (Admin-only operations)
  // ============================================================================

  async createEnterprise(request: CreateEnterpriseRequest): Promise<any> {
    const tenantId = this.tenantContext.tenantId;
    return this.store.createEnterprise(tenantId, request);
  }

  async createAgency(request: CreateAgencyRequest): Promise<any> {
    const tenantId = this.tenantContext.tenantId;
    return this.store.createAgency(tenantId, request);
  }

  async createTeam(request: CreateTeamRequest): Promise<any> {
    const tenantId = this.tenantContext.tenantId;
    return this.store.createTeam(tenantId, request);
  }

  async createMember(request: CreateMemberRequest): Promise<any> {
    const tenantId = this.tenantContext.tenantId;
    return this.store.createMember(tenantId, request);
  }

  async createRoleAssignment(
    request: CreateRoleAssignmentRequest
  ): Promise<any> {
    const tenantId = this.tenantContext.tenantId;
    return this.store.createRoleAssignment(tenantId, request);
  }

  async listRoleAssignments(
    memberId?: string,
    scopeType?: 'enterprise' | 'agency' | 'team',
    scopeId?: string
  ): Promise<ListRoleAssignmentsResponse> {
    const tenantId = this.tenantContext.tenantId;
    return this.store.listRoleAssignments(
      tenantId,
      memberId,
      scopeType,
      scopeId
    );
  }

  async revokeRoleAssignment(
    assignmentId: string,
    revokedBy: string
  ): Promise<void> {
    return this.store.revokeRoleAssignment(assignmentId, revokedBy);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  async validateOrgStructure(): Promise<{ valid: boolean; errors: string[] }> {
    return this.store.validateOrgStructure();
  }

  getOrgStats() {
    return this.store.getStats();
  }

  // ============================================================================
  // INTEGRATION MAPPING MANAGEMENT (WI-038)
  // ============================================================================

  /**
   * Create an integration mapping
   */
  async createIntegrationMapping(
    tenantId: string,
    provider: string,
    locationId: string,
    teamId: string,
    agencyId?: string,
    description?: string,
    createdBy: string
  ): Promise<any> {
    try {
      const mapping = await this.prisma.orgIntegrationMapping.create({
        data: {
          tenantId,
          provider,
          locationId,
          teamId,
          agencyId,
          description,
          createdBy,
        },
        include: {
          team: true,
          agency: true,
        },
      });

      await this.auditService.logEvent({
        eventType: 'integration_mapping_created',
        tenantId,
        userId: createdBy,
        resourceId: mapping.id,
        resourceType: 'org_integration_mapping',
        action: 'integration_mapping_created',
        details: {
          provider,
          locationId,
          teamId,
          agencyId,
          description,
        },
      });

      return mapping;
    } catch (error) {
      if (error.code === 'P2002') {
        throw new Error(
          `Integration mapping already exists for ${provider}:${locationId}`
        );
      }
      throw error;
    }
  }

  /**
   * List integration mappings
   */
  async listIntegrationMappings(
    tenantId: string,
    provider?: string,
    teamId?: string
  ): Promise<any[]> {
    const where: any = { tenantId };
    if (provider) where.provider = provider;
    if (teamId) where.teamId = teamId;

    return await this.prisma.orgIntegrationMapping.findMany({
      where,
      include: {
        team: true,
        agency: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete an integration mapping
   */
  async deleteIntegrationMapping(
    tenantId: string,
    id: string,
    deletedBy: string
  ): Promise<void> {
    const mapping = await this.prisma.orgIntegrationMapping.findUnique({
      where: { id },
      include: { team: true, agency: true },
    });

    if (!mapping || mapping.tenantId !== tenantId) {
      throw new Error('Integration mapping not found');
    }

    await this.prisma.orgIntegrationMapping.delete({
      where: { id },
    });

    await this.auditService.logEvent({
      eventType: 'integration_mapping_deleted',
      tenantId,
      userId: deletedBy,
      resourceId: id,
      resourceType: 'org_integration_mapping',
      action: 'integration_mapping_deleted',
      details: {
        provider: mapping.provider,
        locationId: mapping.locationId,
        teamId: mapping.teamId,
        agencyId: mapping.agencyId,
      },
    });
  }
}
