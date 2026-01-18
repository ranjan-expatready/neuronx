/**
 * In-Memory Pipeline Stage Registry Implementation
 *
 * Provides pipeline configuration using in-memory storage.
 * In production, this should be backed by the tenant configuration repository.
 */

import { Injectable } from '@nestjs/common';
import {
  CanonicalOpportunityStage,
  PipelineConfiguration,
  PipelineStageMapping,
} from './types';
import {
  PipelineStageRegistry,
  DEFAULT_PIPELINE_CONFIGURATION,
} from './pipeline-stage-registry';

@Injectable()
export class InMemoryPipelineStageRegistry implements PipelineStageRegistry {
  private readonly pipelineConfigs = new Map<string, PipelineConfiguration>();

  constructor() {
    // Initialize with default configuration for all tenants
    // In production, this would load from tenant config repository
  }

  async getMapping(
    tenantId: string,
    pipelineId: string
  ): Promise<PipelineStageMapping[]> {
    const config = await this.getPipelineConfiguration(tenantId, pipelineId);
    return config?.stages || [];
  }

  async getAllowedTransitions(
    tenantId: string,
    pipelineId: string
  ): Promise<Record<CanonicalOpportunityStage, CanonicalOpportunityStage[]>> {
    const config = await this.getPipelineConfiguration(tenantId, pipelineId);
    return (
      config?.allowedTransitions ||
      DEFAULT_PIPELINE_CONFIGURATION.allowedTransitions
    );
  }

  async mapGhlStageToCanonical(
    tenantId: string,
    pipelineId: string,
    ghlStageId: string
  ): Promise<CanonicalOpportunityStage | null> {
    const mappings = await this.getMapping(tenantId, pipelineId);
    const mapping = mappings.find(m => m.ghlStageId === ghlStageId);
    return mapping?.canonicalStage || null;
  }

  async hasStageMapping(
    tenantId: string,
    pipelineId: string,
    ghlStageId: string
  ): Promise<boolean> {
    const canonicalStage = await this.mapGhlStageToCanonical(
      tenantId,
      pipelineId,
      ghlStageId
    );
    return canonicalStage !== null;
  }

  async getPipelineConfiguration(
    tenantId: string,
    pipelineId: string
  ): Promise<PipelineConfiguration | null> {
    const key = `${tenantId}:${pipelineId}`;

    // Check if we have a tenant-specific configuration
    if (this.pipelineConfigs.has(key)) {
      return this.pipelineConfigs.get(key)!;
    }

    // Fall back to default configuration for all tenants
    // In production, this would check tenant config repository first
    const config: PipelineConfiguration = {
      tenantId,
      pipelineId: pipelineId || DEFAULT_PIPELINE_CONFIGURATION.pipelineId,
      name: DEFAULT_PIPELINE_CONFIGURATION.name,
      stages: DEFAULT_PIPELINE_CONFIGURATION.stages,
      allowedTransitions: DEFAULT_PIPELINE_CONFIGURATION.allowedTransitions,
    };
    return config;
  }

  /**
   * Set custom pipeline configuration for a tenant
   * This would be called when tenant config is loaded/updated
   */
  setPipelineConfiguration(config: PipelineConfiguration): void {
    const key = `${config.tenantId}:${config.pipelineId}`;
    this.pipelineConfigs.set(key, config);
  }
}
