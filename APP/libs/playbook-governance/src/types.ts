/**
 * Playbook Governance Types - WI-030: Playbook Versioning & Governance
 *
 * Defines versioning, lifecycle management, and governance for NeuronX playbooks.
 */

import { Playbook } from '@neuronx/playbook-engine';

/**
 * Version states for playbook lifecycle management
 */
export enum PlaybookVersionState {
  DRAFT = 'draft', // Being edited, mutable
  REVIEW = 'review', // Under review, immutable
  ACTIVE = 'active', // Live production version, immutable
  RETIRED = 'retired', // No longer in use, immutable
}

/**
 * Semantic version components
 */
export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Playbook version identifier
 */
export interface PlaybookVersionId {
  playbookId: string;
  version: string;
  tenantId?: string;
}

/**
 * Complete playbook version with metadata
 */
export interface PlaybookVersion {
  id: PlaybookVersionId;
  playbook: Playbook;

  // Version lifecycle
  state: PlaybookVersionState;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  promotedBy?: string;
  promotedAt?: Date;
  retiredAt?: Date;
  retiredBy?: string;

  // Governance
  requiresApproval: boolean;
  approvedBy?: string[];
  approvedAt?: Date[];
  changeDescription: string;
  breakingChanges: boolean;

  // Migration info
  migrationRules?: MigrationRule[];
  rollbackVersion?: string;

  // Usage tracking
  usageCount: number;
  lastUsedAt?: Date;

  // Checksum for integrity
  checksum: string;
}

/**
 * Migration rule for playbook version transitions
 */
export interface MigrationRule {
  ruleId: string;
  fromVersion: string;
  toVersion: string;

  // Migration scope
  affectsOpportunities: 'none' | 'in_progress' | 'all';
  requiresHumanReview: boolean;

  // Stage mapping rules
  stageMappings: Record<string, string>; // oldStageId -> newStageId

  // Action mapping rules
  actionMappings: Record<string, ActionMapping>;

  // Data transformation rules
  dataTransformations?: Record<string, any>;

  // Rollback instructions
  rollbackInstructions?: string;
}

/**
 * Action mapping for version migrations
 */
export interface ActionMapping {
  oldActionId: string;
  newActionId: string;
  parameterMappings: Record<string, string>; // oldParam -> newParam
  requiresRemapping: boolean;
}

/**
 * Version promotion request
 */
export interface VersionPromotionRequest {
  playbookId: string;
  fromVersion: string;
  toVersion: string;
  tenantId?: string;

  requestedBy: string;
  requestedAt: Date;
  changeDescription: string;

  requiresApproval: boolean;
  approvalWorkflow?: string;

  // Promotion constraints
  scheduledPromotion?: Date;
  gradualRollout: boolean;
  rolloutPercentage?: number;
}

/**
 * Version promotion result
 */
export interface VersionPromotionResult {
  success: boolean;
  promotedVersion?: PlaybookVersion;
  errors?: string[];

  // Rollback info if needed
  rollbackVersion?: string;
  rollbackInstructions?: string;
}

/**
 * Version rollback request
 */
export interface VersionRollbackRequest {
  playbookId: string;
  fromVersion: string;
  toVersion: string;
  tenantId?: string;

  requestedBy: string;
  requestedAt: Date;
  reason: string;

  // Rollback constraints
  immediate: boolean;
  affectsAll: boolean;
  opportunityFilter?: Record<string, any>;
}

/**
 * Version rollback result
 */
export interface VersionRollbackResult {
  success: boolean;
  rolledBackVersion?: PlaybookVersion;
  affectedOpportunities: number;
  errors?: string[];
}

/**
 * Version pinning for decisions
 */
export interface VersionPin {
  tenantId: string;
  opportunityId: string;
  playbookId: string;
  pinnedVersion: string;

  pinnedBy: string;
  pinnedAt: Date;
  reason: string;

  // Pin constraints
  expiresAt?: Date;
  autoRenew: boolean;
  renewalCondition?: string;
}

/**
 * Governance audit event
 */
export interface GovernanceAuditEvent {
  eventId: string;
  eventType:
    | 'version_created'
    | 'version_promoted'
    | 'version_retired'
    | 'version_pinned'
    | 'version_unpinned'
    | 'rollback_executed';

  tenantId?: string;
  playbookId: string;
  version?: string;

  actor: string;
  timestamp: Date;

  // Event details
  details: Record<string, any>;

  // Compliance tracking
  requiresAudit: boolean;
  complianceChecked: boolean;
  complianceNotes?: string;
}

/**
 * Version validation result
 */
export interface VersionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];

  // Version compatibility
  breakingChanges: boolean;
  backwardCompatible: boolean;

  // Migration assessment
  migrationRequired: boolean;
  migrationComplexity: 'low' | 'medium' | 'high';
}

/**
 * Playbook registry query options
 */
export interface VersionQueryOptions {
  state?: PlaybookVersionState;
  tenantId?: string;
  includeRetired?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  fromVersion: PlaybookVersion;
  toVersion: PlaybookVersion;

  changes: {
    addedStages: string[];
    removedStages: string[];
    modifiedStages: string[];
    addedActions: string[];
    removedActions: string[];
    modifiedActions: string[];
  };

  compatibility: {
    breaking: boolean;
    requiresMigration: boolean;
    migrationComplexity: 'low' | 'medium' | 'high';
  };
}
