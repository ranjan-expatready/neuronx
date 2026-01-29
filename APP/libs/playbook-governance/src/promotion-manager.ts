/**
 * Promotion Manager - WI-030: Playbook Versioning & Governance
 *
 * Handles version promotion workflows and immutability enforcement.
 */

import { Playbook } from '@neuronx/playbook-engine';
import {
  PlaybookVersion,
  PlaybookVersionState,
  VersionPromotionRequest,
  VersionPromotionResult,
  VersionValidationResult,
  VersionComparison,
  MigrationRule,
  SemanticVersion,
} from './types';

/**
 * Manages playbook version promotion workflows
 */
export class PromotionManager {
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
   * Compare two versions semantically
   */
  private compareSemanticVersions(v1: string, v2: string): number {
    const sem1 = this.parseVersion(v1);
    const sem2 = this.parseVersion(v2);

    if (sem1.major !== sem2.major) return sem1.major - sem2.major;
    if (sem1.minor !== sem2.minor) return sem1.minor - sem2.minor;
    return sem1.patch - sem2.patch;
  }

  /**
   * Validate promotion request
   */
  validatePromotionRequest(request: VersionPromotionRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.playbookId) {
      errors.push('Playbook ID is required');
    }

    if (!request.fromVersion) {
      errors.push('From version is required');
    }

    if (!request.toVersion) {
      errors.push('To version is required');
    }

    if (!request.requestedBy) {
      errors.push('Requested by is required');
    }

    if (request.gradualRollout && !request.rolloutPercentage) {
      errors.push('Rollout percentage required for gradual rollout');
    }

    if (
      request.rolloutPercentage &&
      (request.rolloutPercentage < 0 || request.rolloutPercentage > 100)
    ) {
      errors.push('Rollout percentage must be between 0 and 100');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if version can be promoted
   */
  canPromote(version: PlaybookVersion): {
    canPromote: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    if (version.state !== PlaybookVersionState.REVIEW) {
      reasons.push(`Version is in ${version.state} state, must be REVIEW`);
    }

    if (version.breakingChanges && !version.approvedBy?.length) {
      reasons.push('Breaking changes require approval');
    }

    if (version.requiresApproval && !version.approvedBy?.length) {
      reasons.push('Version requires approval before promotion');
    }

    // Additional checks could include:
    // - Test coverage requirements
    // - Performance benchmarks
    // - Security reviews

    return { canPromote: reasons.length === 0, reasons };
  }

  /**
   * Compare two playbook versions to identify changes
   */
  compareVersions(
    fromVersion: PlaybookVersion,
    toVersion: PlaybookVersion
  ): VersionComparison {
    const fromStages = Object.keys(fromVersion.playbook.stages);
    const toStages = Object.keys(toVersion.playbook.stages);

    const addedStages = toStages.filter(stage => !fromStages.includes(stage));
    const removedStages = fromStages.filter(stage => !toStages.includes(stage));
    const commonStages = fromStages.filter(stage => toStages.includes(stage));

    const modifiedStages: string[] = [];
    const addedActions: string[] = [];
    const removedActions: string[] = [];
    const modifiedActions: string[] = [];

    // Compare common stages
    for (const stageId of commonStages) {
      const fromStage = fromVersion.playbook.stages[stageId];
      const toStage = toVersion.playbook.stages[stageId];

      // Compare mustDo actions
      const fromActions = fromStage.mustDo.map((a: any) => a.actionId);
      const toActions = toStage.mustDo.map((a: any) => a.actionId);

      const stageAddedActions = toActions.filter((a: string) => !fromActions.includes(a));
    const stageRemovedActions = fromActions.filter(
      (a: string) => !toActions.includes(a)
    );

    addedActions.push(...stageAddedActions.map((a: string) => `${stageId}:${a}`));
    removedActions.push(...stageRemovedActions.map((a: string) => `${stageId}:${a}`));

      // Check for modifications (simplified - could be more detailed)
      if (JSON.stringify(fromStage) !== JSON.stringify(toStage)) {
        modifiedStages.push(stageId);
      }

      // Check common actions for modifications
      const commonActions = fromActions.filter((a: string) => toActions.includes(a));
      for (const actionId of commonActions) {
        const fromAction = fromStage.mustDo.find((a: any) => a.actionId === actionId);
        const toAction = toStage.mustDo.find((a: any) => a.actionId === actionId);

        if (
          fromAction &&
          toAction &&
          JSON.stringify(fromAction) !== JSON.stringify(toAction)
        ) {
          modifiedActions.push(`${stageId}:${actionId}`);
        }
      }
    }

    // Determine compatibility
    const hasBreakingChanges =
      removedStages.length > 0 || removedActions.length > 0;
    const requiresMigration = hasBreakingChanges || modifiedStages.length > 0;
    const migrationComplexity = this.assessMigrationComplexity(
      addedStages,
      removedStages,
      modifiedStages,
      addedActions,
      removedActions,
      modifiedActions
    );

    return {
      fromVersion,
      toVersion,
      changes: {
        addedStages,
        removedStages,
        modifiedStages,
        addedActions,
        removedActions,
        modifiedActions,
      },
      compatibility: {
        breaking: hasBreakingChanges,
        requiresMigration,
        migrationComplexity,
      },
    };
  }

  /**
   * Assess migration complexity
   */
  private assessMigrationComplexity(
    addedStages: string[],
    removedStages: string[],
    modifiedStages: string[],
    addedActions: string[],
    removedActions: string[],
    modifiedActions: string[]
  ): 'low' | 'medium' | 'high' {
    const totalChanges =
      addedStages.length +
      removedStages.length +
      modifiedStages.length +
      addedActions.length +
      removedActions.length +
      modifiedActions.length;

    if (removedStages.length > 0 || removedActions.length > 5) {
      return 'high';
    }

    if (totalChanges > 10 || modifiedStages.length > 3) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate migration rules for version transition
   */
  generateMigrationRules(comparison: VersionComparison): MigrationRule[] {
    const rules: MigrationRule[] = [];

    // For now, create a simple migration rule
    // In production, this would be more sophisticated
    const rule: MigrationRule = {
      ruleId: `migration_${comparison.fromVersion.id.version}_to_${comparison.toVersion.id.version}`,
      fromVersion: comparison.fromVersion.id.version,
      toVersion: comparison.toVersion.id.version,
      affectsOpportunities: comparison.compatibility.breaking
        ? 'in_progress'
        : 'none',
      requiresHumanReview:
        comparison.compatibility.migrationComplexity === 'high',

      stageMappings: {},
      actionMappings: {},
      dataTransformations: {},

      rollbackInstructions: `Revert to version ${comparison.fromVersion.id.version}`,
    };

    // Generate stage mappings for renamed stages (simplified)
    for (const removedStage of comparison.changes.removedStages) {
      // This would require manual mapping in real implementation
      rule.stageMappings[removedStage] = removedStage; // Placeholder
    }

    rules.push(rule);
    return rules;
  }

  /**
   * Execute promotion (this would involve more complex logic in production)
   */
  async executePromotion(
    request: VersionPromotionRequest,
    version: PlaybookVersion
  ): Promise<VersionPromotionResult> {
    // Validate request
    const validation = this.validatePromotionRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }

    // Check if version can be promoted
    const promotionCheck = this.canPromote(version);
    if (!promotionCheck.canPromote) {
      return {
        success: false,
        errors: promotionCheck.reasons,
      };
    }

    // In a real implementation, this would:
    // 1. Create backup of current active version
    // 2. Update database transactions
    // 3. Notify stakeholders
    // 4. Handle gradual rollout
    // 5. Monitor for issues

    return {
      success: true,
      promotedVersion: {
        ...version,
        state: PlaybookVersionState.ACTIVE,
        promotedBy: request.requestedBy,
        promotedAt: new Date(),
      },
    };
  }

  /**
   * Enforce immutability - prevent modifications to non-draft versions
   */
  enforceImmutability(version: PlaybookVersion, operation: string): void {
    if (version.state !== PlaybookVersionState.DRAFT) {
      throw new Error(
        `Cannot ${operation} version ${version.id.version} in ${version.state} state. Only DRAFT versions can be modified.`
      );
    }
  }

  /**
   * Validate version integrity using checksum
   */
  validateIntegrity(version: PlaybookVersion, playbook: Playbook): boolean {
    // In production, recalculate checksum and compare
    return true; // Simplified for now
  }
}
