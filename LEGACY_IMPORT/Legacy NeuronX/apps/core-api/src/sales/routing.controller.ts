import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigLoader } from '../config/config.loader';
import { AuditService } from '../audit/audit.service';
import { AuthGuard } from '../authz/auth.guard';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/permissions.decorator';
import { PERMISSIONS } from '../authz/authz.types';
import { RoutingConfig } from '../config/config.types';

@Controller('api/v1/routing')
@UseGuards(AuthGuard, PermissionsGuard)
export class RoutingController {
  constructor(
    private readonly configLoader: ConfigLoader,
    private readonly auditService: AuditService
  ) {}

  @Get('policy')
  @RequirePermissions(PERMISSIONS.ADMIN_ALL)
  async getRoutingPolicy(@Request() req) {
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }

    const config = await this.configLoader.loadConfig('neuronx-config', {
      tenantId,
      environment: 'prod', // Defaulting to prod for MVP
    });

    if (!config) {
        // Return default structure if no config exists yet
        return {
            geographicPreferences: {},
            algorithm: 'capacity-based',
            teamCapacities: {},
            thresholds: {
                highLoadPercentage: 80,
                lowLoadPercentage: 20,
                rebalanceIntervalMinutes: 30
            }
        };
    }

    return config.domains.routing;
  }

  @Put('policy')
  @RequirePermissions(PERMISSIONS.ADMIN_ALL)
  async updateRoutingPolicy(@Request() req: any, @Body() body: Partial<RoutingConfig>) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const user = req.user || req.actor;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant context required');
    }

    // 1. Load existing config to preserve other domains
    const existingConfig = await this.configLoader.loadConfig('neuronx-config', {
      tenantId,
      environment: 'prod',
    });

    if (!existingConfig) {
      throw new InternalServerErrorException('Base configuration not found');
    }

    // 2. Update routing domain
    // We merge the incoming body with existing routing config to allow partial updates
    const updatedRoutingConfig: RoutingConfig = {
      ...existingConfig.domains.routing,
      ...body,
    };

    const updatedConfig = {
      ...existingConfig,
      domains: {
        ...existingConfig.domains,
        routing: updatedRoutingConfig,
      },
    };

    // 3. Save config
    await this.configLoader.saveConfig('neuronx-config', updatedConfig, {
      tenantId,
      environment: 'prod',
    });

    // 4. Audit Log
    await this.auditService.logEvent(
      'routing.policy.updated',
      {
        resourceId: 'neuronx-config',
        oldValues: existingConfig.domains.routing,
        newValues: updatedRoutingConfig,
        metadata: {
            updatedBy: user.id || user.username
        }
      },
      user.id || 'system',
      tenantId
    );

    return updatedRoutingConfig;
  }
}
