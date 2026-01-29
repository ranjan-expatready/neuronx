import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class ConfigService {
  private readonly prisma = new PrismaClient();

  async getScoringConfig(tenantId: string): Promise<any> {
    // Get tenant-specific scoring config
    const tenantConfig = await this.prisma.config.findFirst({
      where: {
        tenantId,
        key: 'businessRules.leadScoring',
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    // Return tenant config or defaults
    if (tenantConfig) {
      return tenantConfig.value;
    }

    // Default scoring configuration
    return {
      algorithm: 'simple',
      routingThreshold: 70,
      weights: {
        source: {
          paid: 80,
          organic: 30,
        },
        companySize: {
          enterprise: 20,
          mid: 10,
          small: 0,
        },
        industry: {
          technology: 15,
          healthcare: 10,
          finance: 10,
        },
      },
    };
  }

  async getRoutingConfig(tenantId: string): Promise<any> {
    // Get tenant-specific routing config
    const tenantConfig = await this.prisma.config.findFirst({
      where: {
        tenantId,
        key: 'businessRules.leadRouting',
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    // Return tenant config or defaults
    if (tenantConfig) {
      return tenantConfig.value;
    }

    // Default routing configuration
    return {
      countryMapping: {
        IN: 'india-team',
        default: 'global-team',
      },
    };
  }

  async getSlaConfig(tenantId: string): Promise<any> {
    // Get tenant-specific SLA config
    const tenantConfig = await this.prisma.config.findFirst({
      where: {
        tenantId,
        key: 'businessRules.sla',
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    // Return tenant config or defaults
    if (tenantConfig) {
      return tenantConfig.value;
    }

    // Default SLA configuration
    return {
      followupWindowMinutes: 30,
      escalationEnabled: true,
      notificationChannels: ['email', 'slack'],
    };
  }

  async resolveConfig<T>(
    tenantId: string,
    workspaceId: string | undefined,
    key: string
  ): Promise<T | null> {
    // Check workspace-specific config first
    if (workspaceId) {
      const workspaceConfig = await this.prisma.config.findFirst({
        where: {
          tenantId,
          workspaceId,
          key,
          isActive: true,
        },
        orderBy: { version: 'desc' },
      });

      if (workspaceConfig) {
        return workspaceConfig.value as T;
      }
    }

    // Check tenant-level config
    const tenantConfig = await this.prisma.config.findFirst({
      where: {
        tenantId,
        workspaceId: null,
        key,
        isActive: true,
      },
      orderBy: { version: 'desc' },
    });

    if (tenantConfig) {
      return tenantConfig.value as T;
    }

    // No config found
    return null;
  }
}
