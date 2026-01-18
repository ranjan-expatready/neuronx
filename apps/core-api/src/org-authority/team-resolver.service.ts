/**
 * Team Resolver Service - WI-037: Opportunity → Team Binding
 *
 * Deterministically maps external system identifiers to org teams.
 * Enables scope enforcement for opportunities.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

export interface TeamResolutionInput {
  tenantId: string;
  provider: string; // 'ghl', 'salesforce', etc.
  locationId?: string; // GHL location ID
  pipelineId?: string; // Pipeline identifier
  correlationId: string;
}

export interface TeamResolutionResult {
  agencyId?: string;
  teamId: string;
  resolutionSource: 'mapping' | 'default' | 'fallback';
  confidence: number; // 0-1, how confident we are in this mapping
}

/**
 * Team resolver service
 */
@Injectable()
export class TeamResolverService {
  private readonly logger = new Logger(TeamResolverService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditService: AuditService
  ) {}

  /**
   * Resolve team for external system identifiers
   */
  async resolveTeam(input: TeamResolutionInput): Promise<TeamResolutionResult> {
    const { tenantId, provider, locationId, pipelineId, correlationId } = input;

    // Strategy 1: Direct location mapping (highest priority)
    if (locationId) {
      const locationMapping =
        await this.prisma.orgIntegrationMapping.findUnique({
          where: {
            tenantId_provider_locationId: {
              tenantId,
              provider,
              locationId,
            },
          },
        });

      if (locationMapping) {
        await this.auditMappingUsage(
          locationMapping,
          'location',
          correlationId
        );
        return {
          agencyId: locationMapping.agencyId || undefined,
          teamId: locationMapping.teamId,
          resolutionSource: 'mapping',
          confidence: 1.0,
        };
      }
    }

    // Strategy 2: Pipeline-based mapping (fallback)
    if (pipelineId) {
      // Look for any mapping with this pipelineId in custom fields or metadata
      // This is a simplified implementation - in practice, you might have a separate
      // pipeline-to-team mapping table
      const pipelineMappings = await this.prisma.orgIntegrationMapping.findMany(
        {
          where: {
            tenantId,
            provider,
            // TODO: Add pipelineId field to OrgIntegrationMapping if needed
          },
        }
      );

      // For now, return the first mapping found (simplified)
      if (pipelineMappings.length > 0) {
        const mapping = pipelineMappings[0];
        await this.auditMappingUsage(mapping, 'pipeline', correlationId);
        return {
          agencyId: mapping.agencyId || undefined,
          teamId: mapping.teamId,
          resolutionSource: 'mapping',
          confidence: 0.8, // Lower confidence for pipeline-based mapping
        };
      }
    }

    // Strategy 3: Default team for tenant (lowest priority)
    const defaultTeam = await this.getDefaultTeamForTenant(tenantId);
    if (defaultTeam) {
      await this.auditUnmappedResolution('default_team', correlationId, input);
      return {
        agencyId: defaultTeam.agencyId,
        teamId: defaultTeam.id,
        resolutionSource: 'default',
        confidence: 0.5,
      };
    }

    // Strategy 4: Create unassigned opportunity (error handling)
    await this.auditUnmappedResolution('unassigned', correlationId, input);
    throw new Error(
      `No team mapping found for tenant ${tenantId}, provider ${provider}`
    );
  }

  /**
   * Get default team for tenant (for unmapped opportunities)
   */
  private async getDefaultTeamForTenant(
    tenantId: string
  ): Promise<{ id: string; agencyId: string } | null> {
    // Get the first active team for the tenant
    // In practice, you might have a tenant configuration for default team
    const team = await this.prisma.team.findFirst({
      where: {
        tenantId,
        // TODO: Add isDefault flag to Team model if needed
      },
      orderBy: { createdAt: 'asc' },
    });

    if (team) {
      return { id: team.id, agencyId: team.agencyId };
    }

    return null;
  }

  /**
   * Create or update integration mapping
   */
  async upsertMapping(params: {
    tenantId: string;
    provider: string;
    locationId: string;
    agencyId?: string;
    teamId: string;
    description?: string;
    createdBy: string;
  }): Promise<void> {
    const {
      tenantId,
      provider,
      locationId,
      agencyId,
      teamId,
      description,
      createdBy,
    } = params;

    // Verify team exists and belongs to tenant
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tenantId },
    });

    if (!team) {
      throw new Error(`Team ${teamId} not found or access denied`);
    }

    // Verify agency if provided
    if (agencyId) {
      const agency = await this.prisma.agency.findFirst({
        where: { id: agencyId, tenantId },
      });

      if (!agency) {
        throw new Error(`Agency ${agencyId} not found or access denied`);
      }

      // Verify agency-team relationship
      if (team.agencyId !== agencyId) {
        throw new Error(`Team ${teamId} does not belong to agency ${agencyId}`);
      }
    }

    // Upsert the mapping
    await this.prisma.orgIntegrationMapping.upsert({
      where: {
        tenantId_provider_locationId: {
          tenantId,
          provider,
          locationId,
        },
      },
      update: {
        agencyId,
        teamId,
        description,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        provider,
        locationId,
        agencyId,
        teamId,
        description,
        createdBy,
      },
    });

    await this.auditService.logEvent({
      eventType: 'org_integration_mapping_updated',
      tenantId,
      userId: createdBy,
      resourceId: `${provider}:${locationId}`,
      resourceType: 'org_integration_mapping',
      action: 'mapping_created_or_updated',
      details: {
        provider,
        locationId,
        teamId,
        agencyId,
        correlationId: `mapping_${Date.now()}`,
      },
    });

    this.logger.log(
      `Integration mapping updated for ${provider}:${locationId} → team ${teamId}`,
      {
        tenantId,
        createdBy,
        teamId,
        agencyId,
      }
    );
  }

  /**
   * List mappings for tenant
   */
  async listMappings(tenantId: string, provider?: string): Promise<any[]> {
    const where: any = { tenantId };
    if (provider) {
      where.provider = provider;
    }

    const mappings = await this.prisma.orgIntegrationMapping.findMany({
      where,
      include: {
        team: {
          select: { id: true, name: true },
        },
        agency: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return mappings;
  }

  /**
   * Delete mapping
   */
  async deleteMapping(
    tenantId: string,
    provider: string,
    locationId: string,
    deletedBy: string
  ): Promise<void> {
    const mapping = await this.prisma.orgIntegrationMapping.findUnique({
      where: {
        tenantId_provider_locationId: {
          tenantId,
          provider,
          locationId,
        },
      },
    });

    if (!mapping) {
      throw new Error(`Mapping not found: ${provider}:${locationId}`);
    }

    await this.prisma.orgIntegrationMapping.delete({
      where: {
        tenantId_provider_locationId: {
          tenantId,
          provider,
          locationId,
        },
      },
    });

    await this.auditService.logEvent({
      eventType: 'org_integration_mapping_deleted',
      tenantId,
      userId: deletedBy,
      resourceId: `${provider}:${locationId}`,
      resourceType: 'org_integration_mapping',
      action: 'mapping_deleted',
      details: {
        provider,
        locationId,
        correlationId: `mapping_delete_${Date.now()}`,
      },
    });

    this.logger.log(
      `Integration mapping deleted for ${provider}:${locationId}`,
      {
        tenantId,
        deletedBy,
      }
    );
  }

  /**
   * Validate mapping configuration
   */
  async validateMappings(
    tenantId: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const mappings = await this.prisma.orgIntegrationMapping.findMany({
      where: { tenantId },
      include: { team: true, agency: true },
    });

    for (const mapping of mappings) {
      // Validate team exists
      if (!mapping.team) {
        errors.push(`Mapping ${mapping.id}: team ${mapping.teamId} not found`);
      }

      // Validate agency exists (if specified)
      if (mapping.agencyId && !mapping.agency) {
        errors.push(
          `Mapping ${mapping.id}: agency ${mapping.agencyId} not found`
        );
      }

      // Validate agency-team relationship
      if (
        mapping.agencyId &&
        mapping.team &&
        mapping.team.agencyId !== mapping.agencyId
      ) {
        errors.push(
          `Mapping ${mapping.id}: team ${mapping.teamId} does not belong to agency ${mapping.agencyId}`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Audit mapping usage
   */
  private async auditMappingUsage(
    mapping: any,
    resolutionType: 'location' | 'pipeline',
    correlationId: string
  ): Promise<void> {
    await this.auditService.logEvent({
      eventType: 'org_integration_mapping_used',
      tenantId: mapping.tenantId,
      userId: 'system',
      resourceId: mapping.id,
      resourceType: 'org_integration_mapping',
      action: 'mapping_resolved',
      details: {
        provider: mapping.provider,
        locationId: mapping.locationId,
        teamId: mapping.teamId,
        agencyId: mapping.agencyId,
        resolutionType,
        correlationId,
      },
    });
  }

  /**
   * Audit unmapped resolution
   */
  private async auditUnmappedResolution(
    resolutionType: 'default_team' | 'unassigned',
    correlationId: string,
    input: TeamResolutionInput
  ): Promise<void> {
    await this.auditService.logEvent({
      eventType: 'org_integration_mapping_unmapped',
      tenantId: input.tenantId,
      userId: 'system',
      resourceId: `unmapped_${input.provider}_${input.locationId || 'unknown'}`,
      resourceType: 'org_integration_mapping',
      action: 'unmapped_resolution',
      details: {
        provider: input.provider,
        locationId: input.locationId,
        pipelineId: input.pipelineId,
        resolutionType,
        correlationId,
      },
    });
  }
}
