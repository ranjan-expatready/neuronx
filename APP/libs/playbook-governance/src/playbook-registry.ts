/**
 * Playbook Registry - WI-030: Playbook Versioning & Governance
 *
 * Manages playbook versions through their lifecycle with strict immutability guarantees.
 */

import { Playbook, PlaybookStage } from '@neuronx/playbook-engine';
import {
  PlaybookVersion,
  PlaybookVersionState,
  PlaybookVersionId,
  VersionQueryOptions,
  VersionValidationResult,
  VersionPromotionRequest,
  VersionPromotionResult,
  VersionRollbackRequest,
  VersionRollbackResult,
  GovernanceAuditEvent,
  SemanticVersion,
} from './types';

/**
 * In-memory implementation of playbook version registry
 * In production, this would be backed by a database with proper transactions
 */
export class PlaybookRegistry {
  private versions = new Map<string, PlaybookVersion[]>();
  private activeVersions = new Map<string, PlaybookVersion>();
  private auditLog: GovernanceAuditEvent[] = [];

  /**
   * Generate a unique version key for internal storage
   */
  private getVersionKey(playbookId: string, tenantId?: string): string {
    return tenantId ? `${tenantId}:${playbookId}` : `global:${playbookId}`;
  }

  /**
   * Parse semantic version string
   */
  private parseVersion(version: string): SemanticVersion {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      throw new Error(`Invalid semantic version: ${version}`);
    }
    return {
      major: parts[0],
      minor: parts[1],
      patch: parts[2],
    };
  }

  /**
   * Generate next version number
   */
  private generateNextVersion(lastVersion?: string): string {
    if (!lastVersion) {
      return '1.0.0';
    }

    const current = this.parseVersion(lastVersion);
    // For now, always increment minor version for new drafts
    return `${current.major}.${current.minor + 1}.0`;
  }

  /**
   * Calculate checksum for playbook integrity
   */
  private calculateChecksum(playbook: Playbook): string {
    // Simple checksum - in production, use proper hashing
    const content = JSON.stringify(playbook);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Validate playbook version before operations
   */
  private validateVersion(playbook: Playbook): VersionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!playbook.playbookId) {
      errors.push('Playbook ID is required');
    }

    if (!playbook.name) {
      errors.push('Playbook name is required');
    }

    if (!playbook.entryStage) {
      errors.push('Entry stage is required');
    }

    if (!playbook.stages || Object.keys(playbook.stages).length === 0) {
      errors.push('At least one stage is required');
    }

    // Check stage references
    const stageIds = Object.keys(playbook.stages);
    if (!stageIds.includes(playbook.entryStage)) {
      errors.push(`Entry stage '${playbook.entryStage}' not found in stages`);
    }

    // Check transition references
    for (const [stageId, stage] of Object.entries(playbook.stages) as [
      string,
      PlaybookStage,
    ][]) {
      if (!stageIds.includes(stage.onSuccess.nextStage)) {
        errors.push(
          `Stage '${stageId}' references unknown success stage '${stage.onSuccess.nextStage}'`
        );
      }
      if (!stageIds.includes(stage.onFailure.nextStage)) {
        errors.push(
          `Stage '${stageId}' references unknown failure stage '${stage.onFailure.nextStage}'`
        );
      }
    }

    // For now, assume no breaking changes and low migration complexity
    const breakingChanges = false;
    const backwardCompatible = true;
    const migrationRequired = false;
    const migrationComplexity = 'low' as const;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      breakingChanges,
      backwardCompatible,
      migrationRequired,
      migrationComplexity,
    };
  }

  /**
   * Log audit event
   */
  private logAuditEvent(
    event: Omit<GovernanceAuditEvent, 'eventId' | 'timestamp'>
  ): void {
    const auditEvent: GovernanceAuditEvent = {
      ...event,
      eventId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    this.auditLog.push(auditEvent);
  }

  /**
   * Create a new playbook version (always starts as DRAFT)
   */
  createVersion(
    playbook: Playbook,
    createdBy: string,
    tenantId?: string,
    changeDescription = ''
  ): PlaybookVersion {
    const validation = this.validateVersion(playbook);
    if (!validation.valid) {
      throw new Error(`Invalid playbook: ${validation.errors.join(', ')}`);
    }

    const versionKey = this.getVersionKey(playbook.playbookId, tenantId);
    const existingVersions = this.versions.get(versionKey) || [];
    const lastVersion = existingVersions
      .filter(v => v.state !== PlaybookVersionState.DRAFT)
      .sort(
        (a, b) =>
          this.parseVersion(b.id.version).major -
          this.parseVersion(a.id.version).major
      )[0];

    const nextVersion = this.generateNextVersion(lastVersion?.id.version);

    const versionId: PlaybookVersionId = {
      playbookId: playbook.playbookId,
      version: nextVersion,
      tenantId,
    };

    // Ensure playbook has correct metadata
    const versionedPlaybook: Playbook = {
      ...playbook,
      version: nextVersion,
      tenantId,
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy,
    };

    const version: PlaybookVersion = {
      id: versionId,
      playbook: versionedPlaybook,
      state: PlaybookVersionState.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      changeDescription,
      breakingChanges: false,
      requiresApproval: false,
      usageCount: 0,
      checksum: this.calculateChecksum(versionedPlaybook),
    };

    // Store version
    const versions = this.versions.get(versionKey) || [];
    versions.push(version);
    this.versions.set(versionKey, versions);

    this.logAuditEvent({
      eventType: 'version_created',
      tenantId,
      playbookId: playbook.playbookId,
      version: nextVersion,
      actor: createdBy,
      details: { changeDescription },
      requiresAudit: false,
      complianceChecked: true,
    });

    return version;
  }

  /**
   * Get a specific playbook version
   */
  getVersion(
    playbookId: string,
    version: string,
    tenantId?: string
  ): PlaybookVersion | null {
    const versionKey = this.getVersionKey(playbookId, tenantId);
    const versions = this.versions.get(versionKey) || [];
    return versions.find(v => v.id.version === version) || null;
  }

  /**
   * Get active version for a playbook
   */
  getActiveVersion(
    playbookId: string,
    tenantId?: string
  ): PlaybookVersion | null {
    const versionKey = this.getVersionKey(playbookId, tenantId);
    return this.activeVersions.get(versionKey) || null;
  }

  /**
   * Query versions with filtering options
   */
  queryVersions(
    playbookId: string,
    options: VersionQueryOptions = {}
  ): PlaybookVersion[] {
    const versionKey = this.getVersionKey(playbookId, options.tenantId);
    let versions = this.versions.get(versionKey) || [];

    // Filter by state
    if (options.state) {
      versions = versions.filter(v => v.state === options.state);
    }

    // Filter retired versions unless explicitly requested
    if (!options.includeRetired) {
      versions = versions.filter(v => v.state !== PlaybookVersionState.RETIRED);
    }

    // Sort by version descending (newest first)
    versions.sort((a, b) => {
      const aVer = this.parseVersion(a.id.version);
      const bVer = this.parseVersion(b.id.version);
      if (aVer.major !== bVer.major) return bVer.major - aVer.major;
      if (aVer.minor !== bVer.minor) return bVer.minor - aVer.minor;
      return bVer.patch - aVer.patch;
    });

    // Apply pagination
    if (options.offset) {
      versions = versions.slice(options.offset);
    }
    if (options.limit) {
      versions = versions.slice(0, options.limit);
    }

    return versions;
  }

  /**
   * Update a draft version (only allowed for DRAFT state)
   */
  updateDraft(
    playbookId: string,
    version: string,
    updatedPlaybook: Playbook,
    updatedBy: string,
    changeDescription?: string,
    tenantId?: string
  ): PlaybookVersion {
    const existingVersion = this.getVersion(playbookId, version, tenantId);
    if (!existingVersion) {
      throw new Error(`Version ${version} of playbook ${playbookId} not found`);
    }

    if (existingVersion.state !== PlaybookVersionState.DRAFT) {
      throw new Error(
        `Cannot update version in ${existingVersion.state} state`
      );
    }

    const validation = this.validateVersion(updatedPlaybook);
    if (!validation.valid) {
      throw new Error(`Invalid playbook: ${validation.errors.join(', ')}`);
    }

    // Update the version
    const updatedVersion: PlaybookVersion = {
      ...existingVersion,
      playbook: {
        ...updatedPlaybook,
        version,
        tenantId,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
      changeDescription: changeDescription || existingVersion.changeDescription,
      checksum: this.calculateChecksum(updatedPlaybook),
    };

    // Replace in storage
    const versionKey = this.getVersionKey(playbookId, tenantId);
    const versions = this.versions.get(versionKey) || [];
    const index = versions.findIndex(v => v.id.version === version);
    versions[index] = updatedVersion;
    this.versions.set(versionKey, versions);

    return updatedVersion;
  }

  /**
   * Promote a version to active (immutable operation)
   */
  promoteVersion(request: VersionPromotionRequest): VersionPromotionResult {
    const version = this.getVersion(
      request.playbookId,
      request.fromVersion,
      request.tenantId
    );
    if (!version) {
      return {
        success: false,
        errors: [
          `Version ${request.fromVersion} of playbook ${request.playbookId} not found`,
        ],
      };
    }

    if (version.state !== PlaybookVersionState.REVIEW) {
      return {
        success: false,
        errors: [
          `Version is in ${version.state} state, must be REVIEW to promote`,
        ],
      };
    }

    // Create promoted version (immutable)
    const promotedVersion: PlaybookVersion = {
      ...version,
      state: PlaybookVersionState.ACTIVE,
      promotedBy: request.requestedBy,
      promotedAt: new Date(),
      updatedAt: new Date(),
    };

    // Update version in storage
    const versionKey = this.getVersionKey(request.playbookId, request.tenantId);
    const versions = this.versions.get(versionKey) || [];
    const index = versions.findIndex(v => v.id.version === request.fromVersion);
    versions[index] = promotedVersion;
    this.versions.set(versionKey, versions);

    // Set as active version
    this.activeVersions.set(versionKey, promotedVersion);

    this.logAuditEvent({
      eventType: 'version_promoted',
      tenantId: request.tenantId,
      playbookId: request.playbookId,
      version: request.toVersion,
      actor: request.requestedBy,
      details: { changeDescription: request.changeDescription },
      requiresAudit: true,
      complianceChecked: true,
    });

    return {
      success: true,
      promotedVersion,
    };
  }

  /**
   * Retire an active version
   */
  retireVersion(
    playbookId: string,
    version: string,
    retiredBy: string,
    reason: string,
    tenantId?: string
  ): VersionRollbackResult {
    const versionToRetire = this.getVersion(playbookId, version, tenantId);
    if (!versionToRetire) {
      return {
        success: false,
        affectedOpportunities: 0,
        errors: [`Version ${version} of playbook ${playbookId} not found`],
      };
    }

    if (versionToRetire.state !== PlaybookVersionState.ACTIVE) {
      return {
        success: false,
        affectedOpportunities: 0,
        errors: [
          `Version is in ${versionToRetire.state} state, must be ACTIVE to retire`,
        ],
      };
    }

    // Update version state
    const retiredVersion: PlaybookVersion = {
      ...versionToRetire,
      state: PlaybookVersionState.RETIRED,
      retiredAt: new Date(),
      retiredBy,
      updatedAt: new Date(),
    };

    // Update in storage
    const versionKey = this.getVersionKey(playbookId, tenantId);
    const versions = this.versions.get(versionKey) || [];
    const index = versions.findIndex(v => v.id.version === version);
    versions[index] = retiredVersion;
    this.versions.set(versionKey, versions);

    // Remove from active versions
    this.activeVersions.delete(versionKey);

    this.logAuditEvent({
      eventType: 'version_retired',
      tenantId,
      playbookId,
      version,
      actor: retiredBy,
      details: { reason },
      requiresAudit: true,
      complianceChecked: true,
    });

    return {
      success: true,
      rolledBackVersion: retiredVersion,
      affectedOpportunities: 0, // Would be calculated in real implementation
    };
  }

  /**
   * Get audit log for governance
   */
  getAuditLog(playbookId?: string, tenantId?: string): GovernanceAuditEvent[] {
    let events = this.auditLog;

    if (playbookId) {
      events = events.filter(e => e.playbookId === playbookId);
    }

    if (tenantId) {
      events = events.filter(e => e.tenantId === tenantId);
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}
