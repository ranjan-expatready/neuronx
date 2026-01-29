/**
 * Rollback Manager - WI-030: Playbook Versioning & Governance
 *
 * Handles safe rollback of playbook versions with migration and recovery.
 */

import {
  VersionRollbackRequest,
  VersionRollbackResult,
  PlaybookVersion,
  PlaybookVersionState,
  MigrationRule,
  GovernanceAuditEvent,
} from './types';

/**
 * Manages playbook version rollbacks
 */
export class RollbackManager {
  private rollbackHistory: Map<string, VersionRollbackResult[]> = new Map();

  /**
   * Generate rollback key for tracking
   */
  private getRollbackKey(playbookId: string, tenantId?: string): string {
    return tenantId ? `${tenantId}:${playbookId}` : `global:${playbookId}`;
  }

  /**
   * Validate rollback request
   */
  validateRollbackRequest(request: VersionRollbackRequest): {
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

    if (request.fromVersion === request.toVersion) {
      errors.push('Cannot rollback to the same version');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if rollback is safe
   */
  assessRollbackSafety(
    fromVersion: PlaybookVersion,
    toVersion: PlaybookVersion,
    affectedOpportunities: number
  ): {
    safe: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    reasons: string[];
  } {
    const reasons: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check version compatibility
    if (fromVersion.playbook.version !== toVersion.id.version) {
      reasons.push('Version mismatch in rollback request');
      riskLevel = 'high';
    }

    // Assess impact based on affected opportunities
    if (affectedOpportunities > 100) {
      reasons.push(
        `High impact: ${affectedOpportunities} opportunities affected`
      );
      riskLevel = 'high';
    } else if (affectedOpportunities > 20) {
      reasons.push(
        `Medium impact: ${affectedOpportunities} opportunities affected`
      );
      riskLevel = 'medium';
    }

    // Check for breaking changes in the rollback
    if (toVersion.breakingChanges) {
      reasons.push('Target version has breaking changes');
      riskLevel = 'high';
    }

    // Check rollback frequency (would require historical data)
    const rollbackKey = this.getRollbackKey(
      fromVersion.id.playbookId,
      fromVersion.id.tenantId
    );
    const recentRollbacks = this.rollbackHistory.get(rollbackKey) || [];
    const recentCount = recentRollbacks.filter(
      r =>
        r.rolledBackVersion &&
        r.rolledBackVersion.updatedAt >
          new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    if (recentCount > 2) {
      reasons.push('Frequent rollbacks detected - may indicate instability');
      riskLevel = 'medium';
    }

    return {
      safe: riskLevel !== 'high',
      riskLevel,
      reasons,
    };
  }

  /**
   * Generate rollback plan
   */
  generateRollbackPlan(
    fromVersion: PlaybookVersion,
    toVersion: PlaybookVersion,
    migrationRule?: MigrationRule
  ): {
    steps: string[];
    estimatedDuration: number; // in minutes
    requiresDowntime: boolean;
    rollbackInstructions: string;
  } {
    const steps: string[] = [];
    let estimatedDuration = 5; // base time
    let requiresDowntime = false;

    steps.push(`Backup current active version (${fromVersion.id.version})`);
    steps.push(`Update active version pointer to ${toVersion.id.version}`);
    steps.push('Clear version caches');

    if (migrationRule) {
      if (migrationRule.affectsOpportunities !== 'none') {
        steps.push(
          `Apply migration rules to ${migrationRule.affectsOpportunities} opportunities`
        );
        estimatedDuration += 10;
        if (migrationRule.requiresHumanReview) {
          steps.push('Wait for human review of affected opportunities');
          estimatedDuration += 30;
          requiresDowntime = true;
        }
      }
    }

    steps.push('Validate system health');
    steps.push('Monitor for issues (15 minute observation period)');

    const rollbackInstructions = [
      `Immediate rollback command: rollback ${fromVersion.id.playbookId} from ${fromVersion.id.version} to ${toVersion.id.version}`,
      'Monitor error rates and opportunity progression',
      'If issues persist, consider emergency rollback to previous stable version',
      'Document lessons learned for post-mortem',
    ].join('\n');

    return {
      steps,
      estimatedDuration,
      requiresDowntime,
      rollbackInstructions,
    };
  }

  /**
   * Execute rollback
   */
  async executeRollback(
    request: VersionRollbackRequest,
    fromVersion: PlaybookVersion,
    toVersion: PlaybookVersion,
    migrationRule?: MigrationRule
  ): Promise<VersionRollbackResult> {
    // Validate request
    const validation = this.validateRollbackRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        affectedOpportunities: 0,
        errors: validation.errors,
      };
    }

    // In a real implementation, this would:
    // 1. Create database transaction
    // 2. Update active version pointer
    // 3. Apply migration rules to affected opportunities
    // 4. Update caches and indexes
    // 5. Send notifications
    // 6. Monitor health

    // Simulate affected opportunities calculation
    const affectedOpportunities = Math.floor(Math.random() * 50); // Mock

    // Assess safety
    const safetyAssessment = this.assessRollbackSafety(
      fromVersion,
      toVersion,
      affectedOpportunities
    );
    if (!safetyAssessment.safe && !request.immediate) {
      return {
        success: false,
        affectedOpportunities,
        errors: [`Unsafe rollback: ${safetyAssessment.reasons.join(', ')}`],
      };
    }

    // Generate rollback plan
    const rollbackPlan = this.generateRollbackPlan(
      fromVersion,
      toVersion,
      migrationRule
    );

    // Execute rollback (simplified)
    const rollbackResult: VersionRollbackResult = {
      success: true,
      rolledBackVersion: {
        ...toVersion,
        state: PlaybookVersionState.ACTIVE,
        updatedAt: new Date(),
      },
      affectedOpportunities,
    };

    // Store rollback history
    const rollbackKey = this.getRollbackKey(
      request.playbookId,
      request.tenantId
    );
    const history = this.rollbackHistory.get(rollbackKey) || [];
    history.push(rollbackResult);
    this.rollbackHistory.set(rollbackKey, history);

    return rollbackResult;
  }

  /**
   * Emergency rollback - bypasses safety checks
   */
  async emergencyRollback(
    playbookId: string,
    targetVersion: string,
    executedBy: string,
    reason: string,
    tenantId?: string
  ): Promise<VersionRollbackResult> {
    // Emergency rollback bypasses normal validation
    // This should only be used in critical situations

    const emergencyResult: VersionRollbackResult = {
      success: true,
      rolledBackVersion: {
        id: {
          playbookId,
          version: targetVersion,
          tenantId,
        },
        playbook: {} as any, // Would be fetched in real implementation
        state: PlaybookVersionState.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: executedBy,
        changeDescription: `Emergency rollback: ${reason}`,
        breakingChanges: false,
        requiresApproval: false,
        usageCount: 0,
        checksum: 'emergency-rollback',
      },
      affectedOpportunities: 0, // Would be calculated
    };

    // Log emergency action
    console.error(
      `EMERGENCY ROLLBACK: ${playbookId} to ${targetVersion} by ${executedBy}. Reason: ${reason}`
    );

    return emergencyResult;
  }

  /**
   * Get rollback history
   */
  getRollbackHistory(
    playbookId: string,
    tenantId?: string
  ): VersionRollbackResult[] {
    const rollbackKey = this.getRollbackKey(playbookId, tenantId);
    return this.rollbackHistory.get(rollbackKey) || [];
  }

  /**
   * Validate rollback success
   */
  validateRollbackSuccess(
    rollbackResult: VersionRollbackResult,
    observationPeriodMinutes = 15
  ): { success: boolean; issues: string[]; recommendations: string[] } {
    // In real implementation, this would check:
    // - Error rates
    // - Opportunity progression
    // - System health metrics
    // - User reports

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Mock validation
    if (rollbackResult.affectedOpportunities > 10) {
      issues.push('High number of affected opportunities - monitor closely');
      recommendations.push('Increase monitoring frequency');
    }

    return {
      success: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Create rollback contingency plan
   */
  createContingencyPlan(
    currentVersion: PlaybookVersion,
    previousVersions: PlaybookVersion[]
  ): {
    primaryRollback: string;
    secondaryRollback: string;
    emergencyContacts: string[];
    monitoringPoints: string[];
  } {
    const sortedVersions = previousVersions
      .filter(
        v =>
          v.state === PlaybookVersionState.RETIRED ||
          v.state === PlaybookVersionState.REVIEW
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      primaryRollback: sortedVersions[0]?.id.version || 'N/A',
      secondaryRollback: sortedVersions[1]?.id.version || 'N/A',
      emergencyContacts: [
        'platform-team@neuronx.com',
        'oncall-engineer@neuronx.com',
      ],
      monitoringPoints: [
        'Error rate > 5%',
        'Opportunity stuck rate > 10%',
        'User-reported issues',
        'System performance degradation',
      ],
    };
  }
}
