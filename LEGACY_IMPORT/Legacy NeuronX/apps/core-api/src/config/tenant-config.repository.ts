/**
 * Tenant Configuration Repository - WI-012: Configuration Persistence
 *
 * PostgreSQL-backed tenant configuration repository with IP protection.
 * Manages tenant attachments, overrides, and effective configuration assembly.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  TenantConfigurationAttachment,
  TenantConfigOverride,
  EffectiveConfiguration,
} from './config.types';

@Injectable()
export class TenantConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get tenant's configuration attachment
   */
  async getAttachment(
    tenantId: string
  ): Promise<TenantConfigurationAttachment | null> {
    const attachment = await this.prisma.tenantConfigAttachment.findUnique({
      where: { tenantId },
      include: {
        template: true,
      },
    });

    if (!attachment) return null;

    return {
      tenantId: attachment.tenantId,
      templateId: attachment.templateId || '',
      entitlementTierId: attachment.entitlementTierId || '',
      status: attachment.status as any,
      attachedAt: attachment.attachedAt.toISOString(),
      detachedAt: attachment.detachedAt?.toISOString(),
      attachedBy: attachment.attachedBy || '',
      templateVersion: attachment.template.version,
    };
  }

  /**
   * Set tenant's configuration attachment
   */
  async setAttachment(
    tenantId: string,
    templateId: string,
    entitlementTierId: string,
    attachedBy: string
  ): Promise<TenantConfigurationAttachment> {
    const attachment = await this.prisma.tenantConfigAttachment.upsert({
      where: { tenantId },
      update: {
        templateId,
        entitlementTierId,
        status: 'active',
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        templateId,
        entitlementTierId,
        status: 'active',
        attachedBy,
      },
      include: {
        template: true,
      },
    });

    return {
      tenantId: attachment.tenantId,
      templateId: attachment.templateId || '',
      entitlementTierId: attachment.entitlementTierId || '',
      status: attachment.status as any,
      attachedAt: attachment.attachedAt.toISOString(),
      attachedBy: attachment.attachedBy || '',
      templateVersion: attachment.template.version,
    };
  }

  /**
   * Get latest tenant configuration overrides
   */
  async getLatestOverrides(
    tenantId: string
  ): Promise<TenantConfigOverride | null> {
    const override = await this.prisma.tenantConfigOverride.findFirst({
      where: { tenantId },
      orderBy: { version: 'desc' },
    });

    if (!override) return null;

    return {
      id: override.id,
      tenantId: override.tenantId,
      version: override.version,
      overrides: override.overrides as any,
      description: override.description,
      createdAt: override.createdAt.toISOString(),
      updatedAt: override.updatedAt.toISOString(),
      updatedBy: override.updatedBy,
      correlationId: override.correlationId,
    };
  }

  /**
   * Write tenant configuration overrides
   */
  async writeOverrides(
    tenantId: string,
    overrides: any,
    updatedBy: string,
    correlationId?: string,
    description?: string
  ): Promise<TenantConfigOverride> {
    // Get current version to increment
    const latest = await this.getLatestOverrides(tenantId);
    const nextVersion = this.incrementVersion(latest?.version || '1.0.0');

    const created = await this.prisma.tenantConfigOverride.create({
      data: {
        tenantId,
        version: nextVersion,
        overrides,
        description,
        tenantConfigAttachmentId: tenantId,
        updatedBy,
        correlationId,
      },
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      version: created.version,
      overrides: created.overrides as any,
      description: created.description,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      updatedBy: created.updatedBy,
      correlationId: created.correlationId,
    };
  }

  /**
   * Get effective configuration from cache if valid
   */
  async getCachedEffectiveConfig(
    tenantId: string
  ): Promise<EffectiveConfiguration | null> {
    const cached = await this.prisma.effectiveConfigCache.findUnique({
      where: { tenantId },
    });

    if (!cached || (cached.expiresAt && cached.expiresAt < new Date())) {
      return null;
    }

    return {
      tenantId,
      config: cached.effectiveConfig as any,
      metadata: {
        templateId: cached.templateId,
        templateVersion: cached.templateVersion,
        entitlementTierId: cached.entitlementTierId,
        overrideVersion: cached.overrideVersion,
        computedAt: cached.computedAt.toISOString(),
        fromCache: true,
        cacheHitCount: cached.hitCount,
      },
    };
  }

  /**
   * Cache effective configuration
   */
  async cacheEffectiveConfig(
    tenantId: string,
    config: any,
    metadata: {
      templateId?: string;
      templateVersion?: string;
      entitlementTierId?: string;
      overrideVersion?: string;
    },
    ttlMinutes: number = 30
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const configHash = this.hashConfig(config);

    await this.prisma.effectiveConfigCache.upsert({
      where: { tenantId },
      update: {
        configHash,
        effectiveConfig: config,
        computedAt: new Date(),
        expiresAt,
        hitCount: 0,
        templateId: metadata.templateId,
        templateVersion: metadata.templateVersion,
        entitlementTierId: metadata.entitlementTierId,
        overrideVersion: metadata.overrideVersion,
      },
      create: {
        tenantId,
        configHash,
        effectiveConfig: config,
        computedAt: new Date(),
        expiresAt,
        templateId: metadata.templateId,
        templateVersion: metadata.templateVersion,
        entitlementTierId: metadata.entitlementTierId,
        overrideVersion: metadata.overrideVersion,
      },
    });
  }

  /**
   * Increment cache hit count
   */
  async incrementCacheHit(tenantId: string): Promise<void> {
    await this.prisma.effectiveConfigCache.update({
      where: { tenantId },
      data: {
        hitCount: { increment: 1 },
      },
    });
  }

  /**
   * Clear effective config cache for a tenant
   */
  async clearCache(tenantId: string): Promise<void> {
    await this.prisma.effectiveConfigCache.deleteMany({
      where: { tenantId },
    });
  }

  /**
   * Get configuration history for audit
   */
  async getConfigHistory(
    tenantId: string,
    limit: number = 50
  ): Promise<TenantConfigOverride[]> {
    const overrides = await this.prisma.tenantConfigOverride.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return overrides.map(override => ({
      id: override.id,
      tenantId: override.tenantId,
      version: override.version,
      overrides: override.overrides as any,
      description: override.description,
      createdAt: override.createdAt.toISOString(),
      updatedAt: override.updatedAt.toISOString(),
      updatedBy: override.updatedBy,
      correlationId: override.correlationId,
    }));
  }

  /**
   * Validate tenant isolation - ensure tenant cannot access other tenants' data
   */
  async validateTenantIsolation(
    requestingTenantId: string,
    targetTenantId: string
  ): Promise<boolean> {
    return requestingTenantId === targetTenantId;
  }

  /**
   * Increment semantic version
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  }

  /**
   * Create a simple hash of configuration for cache invalidation
   */
  private hashConfig(config: any): string {
    const str = JSON.stringify(config);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
