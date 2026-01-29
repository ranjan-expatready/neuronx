/**
 * Work Queue Service - WI-037: Opportunity → Team Binding
 *
 * Provides work queue items filtered by team scope for operators.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { OrgAuthorityService } from '../org-authority/org-authority.service';
import { Principal } from '../authz/principal';

export interface WorkQueueFilters {
  reason?: string[];
  priority?: string[];
  slaUrgent?: boolean;
  teamId?: string;
  agencyId?: string;
}

export interface WorkQueueItem {
  id: string;
  opportunityId: string;
  opportunity: {
    id: string;
    name: string;
    value?: number;
    stage: string;
    assignedTo?: string;
    team?: { id: string; name: string };
    agency?: { id: string; name: string };
  };
  type: 'approval_required' | 'assistance_needed' | 'escalation_pending';
  reason: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requiredCapabilities: string[];
  createdAt: Date;
  slaDeadline?: Date;
  metadata?: Record<string, any>;
}

/**
 * Work queue service
 */
@Injectable()
export class WorkQueueService {
  private readonly logger = new Logger(WorkQueueService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly orgAuthority: OrgAuthorityService
  ) {}

  /**
   * Get work queue items for principal (filtered by scope)
   */
  async getWorkQueue(
    principal: Principal,
    filters: WorkQueueFilters = {},
    pagination: { limit?: number; offset?: number } = {}
  ): Promise<{ items: WorkQueueItem[]; total: number }> {
    const { limit = 50, offset = 0 } = pagination;

    // Get authority context to determine accessible scopes
    const authorityContext =
      await this.orgAuthority.getAuthorityContext(principal);

    // Determine accessible team/agency IDs
    const accessibleScopes = await this.getAccessibleScopes(
      authorityContext,
      principal.tenantId
    );

    if (
      accessibleScopes.teams.length === 0 &&
      accessibleScopes.agencies.length === 0
    ) {
      // No accessible scopes - return empty
      return { items: [], total: 0 };
    }

    // Build query for opportunities requiring work
    const where: any = {
      tenantId: principal.tenantId,
      isActive: true,
    };

    // Apply scope filtering
    if (accessibleScopes.teams.length > 0) {
      where.OR = [
        { teamId: { in: accessibleScopes.teams } },
        // Include unassigned opportunities for enterprise/agency admins
        ...(accessibleScopes.agencies.length > 0
          ? [{ teamId: null, agencyId: { in: accessibleScopes.agencies } }]
          : []),
      ];
    } else if (accessibleScopes.agencies.length > 0) {
      where.OR = [
        { agencyId: { in: accessibleScopes.agencies } },
        { teamId: null, agencyId: { in: accessibleScopes.agencies } },
      ];
    }

    // Apply additional filters
    if (filters.teamId) {
      where.teamId = filters.teamId;
    }
    if (filters.agencyId) {
      where.agencyId = filters.agencyId;
    }

    // Get opportunities that might need work
    // This is a simplified implementation - in practice, you'd have a separate
    // work item table that tracks specific actions needed
    const opportunities = await this.prisma.opportunity.findMany({
      where,
      include: {
        team: { select: { id: true, name: true } },
        agency: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Transform opportunities into work queue items
    // This is a simplified transformation - in practice, you'd have business logic
    // to determine what work is actually needed
    const items: WorkQueueItem[] = opportunities.map(opp =>
      this.opportunityToWorkItem(opp)
    );

    // Apply reason/priority filters
    let filteredItems = items;
    if (filters.reason?.length) {
      filteredItems = filteredItems.filter(item =>
        filters.reason!.some(reason => item.reason.includes(reason))
      );
    }
    if (filters.priority?.length) {
      filteredItems = filteredItems.filter(item =>
        filters.priority!.includes(item.priority)
      );
    }
    if (filters.slaUrgent) {
      filteredItems = filteredItems.filter(
        item => item.priority === 'urgent' || item.slaDeadline
      );
    }

    return {
      items: filteredItems,
      total: filteredItems.length, // Simplified - in practice, you'd count from DB
    };
  }

  /**
   * Get accessible scopes for principal
   */
  private async getAccessibleScopes(
    authorityContext: any,
    tenantId: string
  ): Promise<{ teams: string[]; agencies: string[]; enterprise?: string }> {
    const teams: string[] = [];
    const agencies: string[] = [];

    // Check each role assignment for accessible scopes
    for (const assignment of authorityContext.roleAssignments) {
      if (!assignment.revokedAt) {
        switch (assignment.scopeType) {
          case 'team':
            if (!teams.includes(assignment.scopeId)) {
              teams.push(assignment.scopeId);
            }
            break;
          case 'agency':
            if (!agencies.includes(assignment.scopeId)) {
              agencies.push(assignment.scopeId);
            }
            break;
          case 'enterprise':
            // Enterprise access - get all teams/agencies for enterprise
            const enterpriseTeams = await this.prisma.team.findMany({
              where: {
                tenantId,
                agency: {
                  enterpriseId: assignment.scopeId,
                },
              },
              select: { id: true },
            });
            const enterpriseAgencies = await this.prisma.agency.findMany({
              where: {
                tenantId,
                enterpriseId: assignment.scopeId,
              },
              select: { id: true },
            });

            teams.push(...enterpriseTeams.map(t => t.id));
            agencies.push(...enterpriseAgencies.map(a => a.id));
            break;
        }
      }
    }

    return { teams: [...new Set(teams)], agencies: [...new Set(agencies)] };
  }

  /**
   * Transform opportunity to work queue item
   * This is a simplified implementation - in practice, you'd have business logic
   * to determine what work is actually needed for each opportunity
   */
  private opportunityToWorkItem(opportunity: any): WorkQueueItem {
    // Determine work type based on opportunity state
    let type: WorkQueueItem['type'] = 'approval_required';
    let reason = 'Opportunity requires review';
    let priority: WorkQueueItem['priority'] = 'normal';
    let requiredCapabilities = ['READ_ALL'];

    // Business logic for work item determination
    if (
      opportunity.stage === 'qualified' &&
      opportunity.value &&
      opportunity.value > 50000
    ) {
      type = 'approval_required';
      reason = 'High-value qualified opportunity needs approval';
      priority = 'high';
      requiredCapabilities = ['APPROVE_HIGH_RISK_EXECUTION'];
    } else if (opportunity.stage === 'prospect_identified') {
      type = 'assistance_needed';
      reason = 'New prospect needs initial outreach';
      priority = 'normal';
      requiredCapabilities = ['ASSIST_EXECUTION'];
    } else if (opportunity.status === 'escalation_pending') {
      type = 'escalation_pending';
      reason = 'Opportunity requires escalation';
      priority = 'urgent';
      requiredCapabilities = ['ESCALATE_EXECUTION'];
    }

    // Set SLA deadline for urgent items
    const slaDeadline =
      priority === 'urgent'
        ? new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
        : undefined;

    return {
      id: `work_${opportunity.id}`,
      opportunityId: opportunity.id,
      opportunity: {
        id: opportunity.id,
        name: opportunity.name,
        value: opportunity.value,
        stage: opportunity.stage,
        assignedTo: opportunity.assignedTo,
        team: opportunity.team,
        agency: opportunity.agency,
      },
      type,
      reason,
      priority,
      requiredCapabilities,
      createdAt: opportunity.updatedAt,
      slaDeadline,
      metadata: {
        teamId: opportunity.teamId,
        agencyId: opportunity.agencyId,
        hasTeamAssignment: !!opportunity.teamId,
      },
    };
  }

  /**
   * Get work queue statistics for principal
   */
  async getWorkQueueStats(principal: Principal): Promise<{
    total: number;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    urgentCount: number;
  }> {
    const { items } = await this.getWorkQueue(principal, {}, { limit: 1000 });

    const stats = {
      total: items.length,
      byPriority: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      urgentCount: 0,
    };

    for (const item of items) {
      // Count by priority
      stats.byPriority[item.priority] =
        (stats.byPriority[item.priority] || 0) + 1;

      // Count by type
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;

      // Count urgent
      if (item.priority === 'urgent') {
        stats.urgentCount++;
      }
    }

    return stats;
  }

  /**
   * Validate work queue access
   */
  async validateWorkQueueAccess(
    principal: Principal,
    opportunityId: string
  ): Promise<{ accessible: boolean; reason?: string }> {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, tenantId: principal.tenantId },
    });

    if (!opportunity) {
      return { accessible: false, reason: 'Opportunity not found' };
    }

    // Check scope access
    const authorityContext =
      await this.orgAuthority.getAuthorityContext(principal);

    if (opportunity.teamId) {
      try {
        await this.orgAuthority.assertCanActOnTeam(
          authorityContext,
          opportunity.teamId
        );
        return { accessible: true };
      } catch (error) {
        return { accessible: false, reason: 'Insufficient team scope' };
      }
    }

    if (opportunity.agencyId) {
      try {
        await this.orgAuthority.assertCanActOnAgency(
          authorityContext,
          opportunity.agencyId
        );
        return { accessible: true };
      } catch (error) {
        return { accessible: false, reason: 'Insufficient agency scope' };
      }
    }

    // No team/agency assignment - check enterprise access
    // This is simplified - in practice, you'd have enterprise scope checking
    return {
      accessible: true,
      reason: 'No team assignment - enterprise access assumed',
    };
  }
}
