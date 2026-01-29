/**
 * Opportunity Service - WI-037: Opportunity → Team Binding
 *
 * Handles opportunity lifecycle with team binding for scope enforcement.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TeamResolverService } from '../org-authority/team-resolver.service';
import { AuditService } from '../audit/audit.service';

export interface CreateOpportunityRequest {
  tenantId: string;
  externalId?: string;
  leadId: string;
  name: string;
  description?: string;
  value?: number;
  currency?: string;
  pipelineId?: string;
  assignedTo?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  correlationId: string;
  createdBy: string;

  // Team binding inputs (for GHL integration)
  provider?: string; // 'ghl', etc.
  locationId?: string;
  pipelineId?: string;
}

export interface UpdateOpportunityRequest {
  id: string;
  tenantId: string;
  updates: Partial<CreateOpportunityRequest>;
  correlationId: string;
  updatedBy: string;
}

/**
 * Opportunity service with team binding
 */
@Injectable()
export class OpportunityService {
  private readonly logger = new Logger(OpportunityService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly teamResolver: TeamResolverService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Create opportunity with team binding
   */
  async createOpportunity(request: CreateOpportunityRequest): Promise<any> {
    const {
      tenantId,
      externalId,
      leadId,
      name,
      provider,
      locationId,
      pipelineId,
      correlationId,
      createdBy,
      ...opportunityData
    } = request;

    // Resolve team binding if provider/location info available
    let teamBinding: { agencyId?: string; teamId: string } | null = null;
    if (provider && (locationId || pipelineId)) {
      try {
        const resolution = await this.teamResolver.resolveTeam({
          tenantId,
          provider,
          locationId,
          pipelineId,
          correlationId,
        });

        teamBinding = {
          agencyId: resolution.agencyId,
          teamId: resolution.teamId,
        };

        this.logger.log(
          `Team binding resolved for opportunity: ${resolution.teamId}`,
          {
            tenantId,
            correlationId,
            resolutionSource: resolution.resolutionSource,
            confidence: resolution.confidence,
          }
        );
      } catch (error) {
        // Log warning but don't fail opportunity creation
        this.logger.warn(
          `Team binding failed for opportunity: ${error.message}`,
          {
            tenantId,
            correlationId,
            provider,
            locationId,
            pipelineId,
          }
        );

        // Audit the unassigned opportunity
        await this.auditService.logEvent({
          eventType: 'opportunity_team_unassigned',
          tenantId,
          userId: 'system',
          resourceId: `pending_${correlationId}`,
          resourceType: 'opportunity',
          action: 'opportunity_created_unassigned',
          details: {
            provider,
            locationId,
            pipelineId,
            error: error.message,
            correlationId,
          },
        });
      }
    }

    // Create opportunity
    const opportunity = await this.prisma.opportunity.create({
      data: {
        tenantId,
        externalId,
        leadId,
        name,
        description: opportunityData.description,
        value: opportunityData.value,
        currency: opportunityData.currency || 'USD',
        pipelineId: opportunityData.pipelineId,
        assignedTo: opportunityData.assignedTo,
        agencyId: teamBinding?.agencyId,
        teamId: teamBinding?.teamId,
        customFields: opportunityData.customFields || {},
        tags: opportunityData.tags || [],
        createdBy,
        updatedBy: createdBy,
      },
    });

    // Audit the opportunity creation
    await this.auditService.logEvent({
      eventType: 'opportunity_created',
      tenantId,
      userId: createdBy,
      resourceId: opportunity.id,
      resourceType: 'opportunity',
      action: 'opportunity_created',
      details: {
        externalId,
        leadId,
        name,
        teamId: teamBinding?.teamId,
        agencyId: teamBinding?.agencyId,
        correlationId,
      },
    });

    this.logger.log(`Opportunity created: ${opportunity.id}`, {
      tenantId,
      correlationId,
      teamId: teamBinding?.teamId,
      externalId,
    });

    return opportunity;
  }

  /**
   * Update opportunity
   */
  async updateOpportunity(request: UpdateOpportunityRequest): Promise<any> {
    const { id, tenantId, updates, correlationId, updatedBy } = request;

    // Check if team binding needs updating
    let teamBindingUpdate: { agencyId?: string; teamId?: string } | undefined;
    if (updates.provider && (updates.locationId || updates.pipelineId)) {
      try {
        const resolution = await this.teamResolver.resolveTeam({
          tenantId,
          provider: updates.provider,
          locationId: updates.locationId,
          pipelineId: updates.pipelineId,
          correlationId,
        });

        teamBindingUpdate = {
          agencyId: resolution.agencyId,
          teamId: resolution.teamId,
        };
      } catch (error) {
        this.logger.warn(
          `Team binding update failed for opportunity ${id}: ${error.message}`,
          {
            tenantId,
            correlationId,
          }
        );
      }
    }

    // Update opportunity
    const opportunity = await this.prisma.opportunity.update({
      where: { id, tenantId },
      data: {
        ...updates,
        ...teamBindingUpdate,
        updatedAt: new Date(),
        updatedBy,
      },
    });

    // Audit the update
    await this.auditService.logEvent({
      eventType: 'opportunity_updated',
      tenantId,
      userId: updatedBy,
      resourceId: opportunity.id,
      resourceType: 'opportunity',
      action: 'opportunity_updated',
      details: {
        updates: Object.keys(updates),
        teamBindingUpdated: !!teamBindingUpdate,
        correlationId,
      },
    });

    return opportunity;
  }

  /**
   * Get opportunity by ID
   */
  async getOpportunity(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.opportunity.findFirst({
      where: { id, tenantId },
      include: {
        team: {
          select: { id: true, name: true, agencyId: true },
        },
        agency: {
          select: { id: true, name: true, enterpriseId: true },
        },
      },
    });
  }

  /**
   * Get opportunities with team filtering
   */
  async getOpportunities(params: {
    tenantId: string;
    teamId?: string;
    agencyId?: string;
    status?: string;
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ opportunities: any[]; total: number }> {
    const {
      tenantId,
      teamId,
      agencyId,
      status,
      assignedTo,
      limit = 50,
      offset = 0,
    } = params;

    const where: any = { tenantId };

    if (teamId) where.teamId = teamId;
    if (agencyId) where.agencyId = agencyId;
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;

    const [opportunities, total] = await Promise.all([
      this.prisma.opportunity.findMany({
        where,
        include: {
          team: { select: { id: true, name: true } },
          agency: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.opportunity.count({ where }),
    ]);

    return { opportunities, total };
  }

  /**
   * Get opportunities requiring team assignment
   */
  async getUnassignedOpportunities(
    tenantId: string,
    limit = 100
  ): Promise<any[]> {
    return this.prisma.opportunity.findMany({
      where: {
        tenantId,
        teamId: null,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Assign team to opportunity (manual override)
   */
  async assignTeam(
    opportunityId: string,
    tenantId: string,
    teamId: string,
    assignedBy: string,
    correlationId: string
  ): Promise<void> {
    // Verify team exists and belongs to tenant
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tenantId },
    });

    if (!team) {
      throw new Error(`Team ${teamId} not found or access denied`);
    }

    // Update opportunity
    await this.prisma.opportunity.update({
      where: { id: opportunityId, tenantId },
      data: {
        teamId,
        agencyId: team.agencyId,
        updatedAt: new Date(),
        updatedBy: assignedBy,
      },
    });

    // Audit the assignment
    await this.auditService.logEvent({
      eventType: 'opportunity_team_assigned',
      tenantId,
      userId: assignedBy,
      resourceId: opportunityId,
      resourceType: 'opportunity',
      action: 'opportunity_team_assigned',
      details: {
        teamId,
        agencyId: team.agencyId,
        correlationId,
      },
    });

    this.logger.log(
      `Team assigned to opportunity: ${opportunityId} → ${teamId}`,
      {
        tenantId,
        correlationId,
        assignedBy,
      }
    );
  }

  /**
   * Reassign opportunity to a different team (WI-038)
   */
  async reassignTeam(
    opportunityId: string,
    tenantId: string,
    reassignment: {
      newTeamId: string;
      reason: string;
      reassignedBy: string;
      correlationId: string;
    }
  ): Promise<any> {
    const { newTeamId, reason, reassignedBy, correlationId } = reassignment;

    // Get current opportunity
    const currentOpportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId, tenantId },
      select: {
        id: true,
        teamId: true,
        agencyId: true,
        value: true,
        stage: true,
        externalId: true,
      },
    });

    if (!currentOpportunity) {
      throw new Error(`Opportunity ${opportunityId} not found`);
    }

    // Get new team to determine agency
    const newTeam = await this.prisma.team.findUnique({
      where: { id: newTeamId },
      select: {
        id: true,
        agencyId: true,
        name: true,
      },
    });

    if (!newTeam) {
      throw new Error(`Team ${newTeamId} not found`);
    }

    const oldTeamId = currentOpportunity.teamId;
    const oldAgencyId = currentOpportunity.agencyId;
    const newAgencyId = newTeam.agencyId;

    // Update opportunity
    const updatedOpportunity = await this.prisma.opportunity.update({
      where: { id: opportunityId, tenantId },
      data: {
        teamId: newTeamId,
        agencyId: newAgencyId,
        updatedAt: new Date(),
        updatedBy: reassignedBy,
      },
      include: {
        team: true,
        agency: true,
      },
    });

    // Audit the reassignment
    await this.auditService.logEvent({
      eventType: 'opportunity_team_reassigned',
      tenantId,
      userId: reassignedBy,
      resourceId: opportunityId,
      resourceType: 'opportunity',
      action: 'opportunity_team_reassigned',
      details: {
        oldTeamId,
        newTeamId,
        oldAgencyId,
        newAgencyId,
        reason,
        dealValue: currentOpportunity.value,
        stage: currentOpportunity.stage,
        externalId: currentOpportunity.externalId,
        correlationId,
      },
    });

    this.logger.log(
      `Team reassigned for opportunity: ${opportunityId} (${oldTeamId} → ${newTeamId})`,
      {
        tenantId,
        correlationId,
        reassignedBy,
        reason,
      }
    );

    return updatedOpportunity;
  }

  /**
   * Check if opportunity is in CaseOpen state
   */
  async isOpportunityCaseOpen(opportunityId: string, tenantId: string): Promise<boolean> {
    const opportunity = await this.getOpportunity(opportunityId, tenantId);
    // TODO: Implement actual CaseOpen logic based on stage/status
    return !!opportunity; 
  }

  /**
   * Validate opportunity data consistency
   */
  async validateOpportunities(
    tenantId: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check team-agency relationships
    const opportunities = await this.prisma.opportunity.findMany({
      where: { tenantId },
      include: { team: true, agency: true },
    });

    for (const opp of opportunities) {
      // Validate team-agency consistency
      if (opp.teamId && opp.agencyId && opp.team) {
        if (opp.team.agencyId !== opp.agencyId) {
          errors.push(
            `Opportunity ${opp.id}: team ${opp.teamId} does not belong to agency ${opp.agencyId}`
          );
        }
      }

      // Validate agency relationship
      if (opp.agencyId && opp.agency && opp.team) {
        if (opp.team.agencyId !== opp.agencyId) {
          errors.push(
            `Opportunity ${opp.id}: team-agency relationship inconsistent`
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
