/**
 * Pipeline Stage Registry - WI-027: Authoritative Stage Gate
 *
 * Manages tenant-specific pipeline configurations and stage mappings.
 * Maps external system stage IDs to canonical NeuronX stages.
 */

import {
  CanonicalOpportunityStage,
  PipelineConfiguration,
  PipelineStageMapping,
} from './types';

export interface PipelineStageRegistry {
  /**
   * Get stage mapping for a tenant
   */
  getMapping(
    tenantId: string,
    pipelineId: string
  ): Promise<PipelineStageMapping[]>;

  /**
   * Get allowed transitions for a tenant's pipeline
   */
  getAllowedTransitions(
    tenantId: string,
    pipelineId: string
  ): Promise<Record<CanonicalOpportunityStage, CanonicalOpportunityStage[]>>;

  /**
   * Map GHL stage ID to canonical stage
   */
  mapGhlStageToCanonical(
    tenantId: string,
    pipelineId: string,
    ghlStageId: string
  ): Promise<CanonicalOpportunityStage | null>;

  /**
   * Validate if a stage mapping exists
   */
  hasStageMapping(
    tenantId: string,
    pipelineId: string,
    ghlStageId: string
  ): Promise<boolean>;

  /**
   * Get pipeline configuration
   */
  getPipelineConfiguration(
    tenantId: string,
    pipelineId: string
  ): Promise<PipelineConfiguration | null>;
}

/**
 * Default pipeline configuration for new tenants
 * This provides a standard sales pipeline mapping
 */
export const DEFAULT_PIPELINE_CONFIGURATION: Omit<
  PipelineConfiguration,
  'tenantId'
> = {
  pipelineId: 'default',
  name: 'Standard Sales Pipeline',
  stages: [
    // Prospect stages
    {
      ghlStageId: 'prospect',
      canonicalStage: CanonicalOpportunityStage.PROSPECT_IDENTIFIED,
    },
    {
      ghlStageId: 'contacted',
      canonicalStage: CanonicalOpportunityStage.INITIAL_CONTACT,
    },

    // Qualification stages
    {
      ghlStageId: 'qualified',
      canonicalStage: CanonicalOpportunityStage.QUALIFIED,
    },
    {
      ghlStageId: 'needs-analysis',
      canonicalStage: CanonicalOpportunityStage.NEEDS_ANALYSIS,
    },

    // Proposal stages
    {
      ghlStageId: 'proposal',
      canonicalStage: CanonicalOpportunityStage.PROPOSAL_SENT,
    },
    {
      ghlStageId: 'negotiation',
      canonicalStage: CanonicalOpportunityStage.NEGOTIATION,
    },

    // Closure stages
    {
      ghlStageId: 'committed',
      canonicalStage: CanonicalOpportunityStage.COMMITTED,
    },
    {
      ghlStageId: 'won',
      canonicalStage: CanonicalOpportunityStage.CLOSED_WON,
      isWon: true,
    },
    {
      ghlStageId: 'lost',
      canonicalStage: CanonicalOpportunityStage.CLOSED_LOST,
      isLost: true,
    },
  ],
  allowedTransitions: {
    [CanonicalOpportunityStage.PROSPECT_IDENTIFIED]: [
      CanonicalOpportunityStage.INITIAL_CONTACT,
      CanonicalOpportunityStage.QUALIFIED,
    ],
    [CanonicalOpportunityStage.INITIAL_CONTACT]: [
      CanonicalOpportunityStage.QUALIFIED,
      CanonicalOpportunityStage.CLOSED_LOST,
    ],
    [CanonicalOpportunityStage.QUALIFIED]: [
      CanonicalOpportunityStage.NEEDS_ANALYSIS,
      CanonicalOpportunityStage.CLOSED_LOST,
    ],
    [CanonicalOpportunityStage.NEEDS_ANALYSIS]: [
      CanonicalOpportunityStage.PROPOSAL_SENT,
      CanonicalOpportunityStage.CLOSED_LOST,
    ],
    [CanonicalOpportunityStage.PROPOSAL_SENT]: [
      CanonicalOpportunityStage.NEGOTIATION,
      CanonicalOpportunityStage.CLOSED_LOST,
    ],
    [CanonicalOpportunityStage.NEGOTIATION]: [
      CanonicalOpportunityStage.COMMITTED,
      CanonicalOpportunityStage.CLOSED_WON,
      CanonicalOpportunityStage.CLOSED_LOST,
    ],
    [CanonicalOpportunityStage.COMMITTED]: [
      CanonicalOpportunityStage.CLOSED_WON,
      CanonicalOpportunityStage.CLOSED_LOST,
    ],
    [CanonicalOpportunityStage.CLOSED_WON]: [],
    [CanonicalOpportunityStage.CLOSED_LOST]: [],
    [CanonicalOpportunityStage.IMPLEMENTATION]: [],
    [CanonicalOpportunityStage.ONBOARDING]: [],
  } as Record<CanonicalOpportunityStage, CanonicalOpportunityStage[]>,
};
