/**
 * Org Authority Controller - WI-035: Tenant & Organization Authority Model
 *
 * Admin endpoints for managing org structure and authorities.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Query,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { OrgAuthorityService } from './org-authority.service';
import { RequireCapability } from './require-capability.decorator';
import { Capability } from '@neuronx/org-authority';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/permissions.decorator';

@Controller('org')
@UseGuards(PermissionsGuard)
export class OrgAuthorityController {
  private readonly logger = new Logger(OrgAuthorityController.name);

  constructor(private readonly orgAuthorityService: OrgAuthorityService) {}

  // ============================================================================
  // ENTERPRISE MANAGEMENT
  // ============================================================================

  @Post('enterprise')
  @RequirePermissions('admin:all') // Use existing admin permission for now
  async createEnterprise(@Body() body: { name: string; description?: string }) {
    this.logger.log(`Creating enterprise: ${body.name}`);

    try {
      const enterprise = await this.orgAuthorityService.createEnterprise(body);

      return {
        success: true,
        enterprise,
      };
    } catch (error) {
      this.logger.error(`Failed to create enterprise: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // AGENCY MANAGEMENT
  // ============================================================================

  @Post('agency')
  @RequirePermissions('admin:all')
  async createAgency(
    @Body() body: { enterpriseId: string; name: string; description?: string }
  ) {
    this.logger.log(
      `Creating agency: ${body.name} in enterprise ${body.enterpriseId}`
    );

    try {
      const agency = await this.orgAuthorityService.createAgency(body);

      return {
        success: true,
        agency,
      };
    } catch (error) {
      this.logger.error(`Failed to create agency: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // TEAM MANAGEMENT
  // ============================================================================

  @Post('team')
  @RequirePermissions('admin:all')
  async createTeam(
    @Body() body: { agencyId: string; name: string; description?: string }
  ) {
    this.logger.log(`Creating team: ${body.name} in agency ${body.agencyId}`);

    try {
      const team = await this.orgAuthorityService.createTeam(body);

      return {
        success: true,
        team,
      };
    } catch (error) {
      this.logger.error(`Failed to create team: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // MEMBER MANAGEMENT
  // ============================================================================

  @Post('member')
  @RequirePermissions('admin:all')
  async createMember(
    @Body() body: { userId: string; displayName?: string; email?: string }
  ) {
    this.logger.log(`Creating member for user: ${body.userId}`);

    try {
      const member = await this.orgAuthorityService.createMember(body);

      return {
        success: true,
        member,
      };
    } catch (error) {
      this.logger.error(`Failed to create member: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // ROLE ASSIGNMENT MANAGEMENT
  // ============================================================================

  @Post('role-assignment')
  @RequirePermissions('admin:all')
  async createRoleAssignment(
    @Body()
    body: {
      memberId: string;
      role: string;
      scopeType: 'enterprise' | 'agency' | 'team';
      scopeId: string;
    }
  ) {
    this.logger.log(`Creating role assignment for member ${body.memberId}`);

    try {
      const assignment =
        await this.orgAuthorityService.createRoleAssignment(body);

      return {
        success: true,
        assignment,
      };
    } catch (error) {
      this.logger.error(`Failed to create role assignment: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('role-assignments')
  @RequirePermissions('admin:all')
  async listRoleAssignments(
    @Query('memberId') memberId?: string,
    @Query('scopeType') scopeType?: 'enterprise' | 'agency' | 'team',
    @Query('scopeId') scopeId?: string
  ) {
    try {
      const result = await this.orgAuthorityService.listRoleAssignments(
        memberId,
        scopeType,
        scopeId
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      this.logger.error(`Failed to list role assignments: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Delete('role-assignment/:id')
  @RequirePermissions('admin:all')
  async revokeRoleAssignment(
    @Param('id') id: string,
    @Body() body: { revokedBy: string }
  ) {
    this.logger.log(`Revoking role assignment ${id}`);

    try {
      await this.orgAuthorityService.revokeRoleAssignment(id, body.revokedBy);

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(`Failed to revoke role assignment: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // INTEGRATION MAPPING MANAGEMENT (WI-038)
  // ============================================================================

  @Post('integrations/:provider/location-mappings')
  @RequirePermissions('admin:all')
  async createIntegrationMapping(
    @Param('provider') provider: string,
    @Body()
    body: {
      locationId: string;
      teamId: string;
      agencyId?: string;
      description?: string;
      createdBy: string;
    }
  ) {
    this.logger.log(
      `Creating ${provider} integration mapping for location ${body.locationId}`
    );

    try {
      const tenantId = this.orgAuthorityService['tenantContext'].tenantId;
      const mapping = await this.orgAuthorityService.createIntegrationMapping(
        tenantId,
        provider,
        body.locationId,
        body.teamId,
        body.agencyId,
        body.description,
        body.createdBy
      );

      return {
        success: true,
        mapping,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create integration mapping: ${error.message}`
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('integrations/:provider/location-mappings')
  @RequirePermissions('admin:all')
  async listIntegrationMappings(
    @Param('provider') provider: string,
    @Query('teamId') teamId?: string
  ) {
    try {
      const tenantId = this.orgAuthorityService['tenantContext'].tenantId;
      const mappings = await this.orgAuthorityService.listIntegrationMappings(
        tenantId,
        provider,
        teamId
      );

      return {
        success: true,
        mappings,
        total: mappings.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to list integration mappings: ${error.message}`
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Delete('integrations/location-mappings/:id')
  @RequirePermissions('admin:all')
  async deleteIntegrationMapping(
    @Param('id') id: string,
    @Body() body: { deletedBy: string }
  ) {
    this.logger.log(`Deleting integration mapping ${id}`);

    try {
      const tenantId = this.orgAuthorityService['tenantContext'].tenantId;
      await this.orgAuthorityService.deleteIntegrationMapping(
        tenantId,
        id,
        body.deletedBy
      );

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete integration mapping: ${error.message}`
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // UTILITY ENDPOINTS
  // ============================================================================

  @Get('stats')
  @RequirePermissions('admin:all')
  async getOrgStats() {
    const stats = this.orgAuthorityService.getOrgStats();

    return {
      success: true,
      stats,
    };
  }

  @Post('validate')
  @RequirePermissions('admin:all')
  async validateOrgStructure() {
    const validation = await this.orgAuthorityService.validateOrgStructure();

    return {
      success: true,
      validation,
    };
  }
}
