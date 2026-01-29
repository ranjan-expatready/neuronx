/**
 * Canonical Opportunity Stages - WI-027: Authoritative Stage Gate
 *
 * These represent the authoritative business states that NeuronX owns.
 * External systems (GHL) map their stages to these canonical stages.
 */

export enum CanonicalOpportunityStage {
  // Prospect identification and initial contact
  PROSPECT_IDENTIFIED = 'prospect_identified',
  INITIAL_CONTACT = 'initial_contact',

  // Qualification phase
  QUALIFIED = 'qualified',
  NEEDS_ANALYSIS = 'needs_analysis',

  // Proposal and negotiation
  PROPOSAL_SENT = 'proposal_sent',
  NEGOTIATION = 'negotiation',

  // Closure
  COMMITTED = 'committed',
  CLOSED_WON = 'closed_won',
  CLOSED_LOST = 'closed_lost',

  // Post-sale
  IMPLEMENTATION = 'implementation',
  ONBOARDING = 'onboarding',
}

/**
 * Stage transition validation result
 */
export interface StageValidationResult {
  allowed: boolean;
  reason?: string;
  canonicalStage?: CanonicalOpportunityStage;
  suggestedAction?: 'allow' | 'block' | 'log';
}

/**
 * Pipeline stage mapping configuration
 */
export interface PipelineStageMapping {
  ghlStageId: string;
  canonicalStage: CanonicalOpportunityStage;
  description?: string;
  isWon?: boolean;
  isLost?: boolean;
}

/**
 * Pipeline configuration for a tenant
 */
export interface PipelineConfiguration {
  tenantId: string;
  pipelineId: string;
  name: string;
  stages: PipelineStageMapping[];
  allowedTransitions: Record<
    CanonicalOpportunityStage,
    CanonicalOpportunityStage[]
  >;
}

/**
 * Stage enforcement modes
 */
export type StageEnforcementMode =
  | 'monitor_only'
  | 'block'
  | 'block_and_revert';

/**
 * Stage transition event for audit logging
 */
export interface StageTransitionEvent {
  tenantId: string;
  opportunityId: string;
  pipelineId: string;
  fromStage?: CanonicalOpportunityStage;
  toStage: CanonicalOpportunityStage;
  requestedByGhlStageId?: string;
  source: 'api' | 'ghl_webhook' | 'manual';
  validationResult: StageValidationResult;
  enforced: boolean;
  correlationId: string;
  timestamp: Date;
}
