/**
 * Rollback Manager Tests - WI-030: Playbook Versioning & Governance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RollbackManager } from '../rollback-manager';
import {
  PlaybookVersion,
  PlaybookVersionState,
  VersionRollbackRequest,
} from '../types';

describe('RollbackManager', () => {
  let rollbackManager: RollbackManager;
  let currentVersion: PlaybookVersion;
  let targetVersion: PlaybookVersion;

  beforeEach(() => {
    rollbackManager = new RollbackManager();

    const samplePlaybook = {
      playbookId: 'test-playbook',
      version: '2.0.0',
      name: 'Test Playbook',
      description: 'A test playbook',
      tenantId: 'test-tenant',
      entryStage: 'stage1',
      stages: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user',
      isActive: false,
    };

    currentVersion = {
      id: {
        playbookId: 'test-playbook',
        version: '2.0.0',
        tenantId: 'test-tenant',
      },
      playbook: samplePlaybook,
      state: PlaybookVersionState.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user',
      changeDescription: 'Version 2.0.0',
      breakingChanges: false,
      requiresApproval: false,
      usageCount: 100,
      checksum: 'version-2-checksum',
    };

    targetVersion = {
      id: {
        playbookId: 'test-playbook',
        version: '1.0.0',
        tenantId: 'test-tenant',
      },
      playbook: { ...samplePlaybook, version: '1.0.0' },
      state: PlaybookVersionState.RETIRED,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      createdBy: 'test-user',
      changeDescription: 'Version 1.0.0',
      breakingChanges: false,
      requiresApproval: false,
      usageCount: 50,
      checksum: 'version-1-checksum',
    };
  });

  describe('validateRollbackRequest', () => {
    it('should validate a correct rollback request', () => {
      const request: VersionRollbackRequest = {
        playbookId: 'test-playbook',
        fromVersion: '2.0.0',
        toVersion: '1.0.0',
        tenantId: 'test-tenant',
        requestedBy: 'admin-user',
        requestedAt: new Date(),
        reason: 'Issues with 2.0.0',
      };

      const result = rollbackManager.validateRollbackRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid rollback requests', () => {
      const invalidRequest = {
        playbookId: '',
        fromVersion: '2.0.0',
        toVersion: '2.0.0', // Same version
        requestedBy: 'admin-user',
        requestedAt: new Date(),
        reason: 'Test rollback',
      };

      const result = rollbackManager.validateRollbackRequest(
        invalidRequest as any
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Playbook ID is required');
      expect(result.errors).toContain('Cannot rollback to the same version');
    });
  });

  describe('assessRollbackSafety', () => {
    it('should assess low-risk rollback as safe', () => {
      const assessment = rollbackManager.assessRollbackSafety(
        currentVersion,
        targetVersion,
        5
      );

      expect(assessment.safe).toBe(true);
      expect(assessment.riskLevel).toBe('low');
      expect(assessment.reasons).toHaveLength(0);
    });

    it('should assess high-risk rollback as unsafe', () => {
      const highImpactVersion = { ...currentVersion, breakingChanges: true };

      const assessment = rollbackManager.assessRollbackSafety(
        highImpactVersion,
        targetVersion,
        150
      );

      expect(assessment.safe).toBe(false);
      expect(assessment.riskLevel).toBe('high');
      expect(assessment.reasons).toContain(
        'High impact: 150 opportunities affected'
      );
      expect(assessment.reasons).toContain(
        'Target version has breaking changes'
      );
    });

    it('should assess medium-risk rollback', () => {
      const assessment = rollbackManager.assessRollbackSafety(
        currentVersion,
        targetVersion,
        25
      );

      expect(assessment.safe).toBe(true);
      expect(assessment.riskLevel).toBe('medium');
      expect(assessment.reasons).toContain(
        'Medium impact: 25 opportunities affected'
      );
    });
  });

  describe('generateRollbackPlan', () => {
    it('should generate a rollback plan', () => {
      const plan = rollbackManager.generateRollbackPlan(
        currentVersion,
        targetVersion
      );

      expect(plan.steps).toContain('Backup current active version (2.0.0)');
      expect(plan.steps).toContain('Update active version pointer to 1.0.0');
      expect(plan.steps).toContain('Validate system health');
      expect(plan.estimatedDuration).toBeGreaterThan(0);
      expect(plan.requiresDowntime).toBe(false);
      expect(plan.rollbackInstructions).toContain('Immediate rollback command');
    });

    it('should mark high-risk rollbacks as requiring downtime', () => {
      const breakingTarget = { ...targetVersion, breakingChanges: true };

      const plan = rollbackManager.generateRollbackPlan(
        currentVersion,
        breakingTarget
      );

      expect(plan.requiresDowntime).toBe(true);
      expect(plan.steps).toContain(
        'Wait for human review of affected opportunities'
      );
    });
  });

  describe('executeRollback', () => {
    it('should execute a safe rollback', async () => {
      const request: VersionRollbackRequest = {
        playbookId: 'test-playbook',
        fromVersion: '2.0.0',
        toVersion: '1.0.0',
        tenantId: 'test-tenant',
        requestedBy: 'admin-user',
        requestedAt: new Date(),
        reason: 'Issues with 2.0.0',
        immediate: false,
      };

      const result = await rollbackManager.executeRollback(
        request,
        currentVersion,
        targetVersion
      );

      expect(result.success).toBe(true);
      expect(result.rolledBackVersion?.state).toBe(PlaybookVersionState.ACTIVE);
      expect(result.affectedOpportunities).toBeGreaterThanOrEqual(0);
    });

    it('should reject unsafe rollbacks when not immediate', async () => {
      const request: VersionRollbackRequest = {
        playbookId: 'test-playbook',
        fromVersion: '2.0.0',
        toVersion: '1.0.0',
        tenantId: 'test-tenant',
        requestedBy: 'admin-user',
        requestedAt: new Date(),
        reason: 'High risk rollback',
        immediate: false,
      };

      // Make it unsafe by affecting many opportunities
      const unsafeCurrentVersion = { ...currentVersion, usageCount: 200 };

      const result = await rollbackManager.executeRollback(
        request,
        unsafeCurrentVersion,
        targetVersion
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unsafe rollback');
    });

    it('should allow unsafe rollbacks when immediate flag is set', async () => {
      const request: VersionRollbackRequest = {
        playbookId: 'test-playbook',
        fromVersion: '2.0.0',
        toVersion: '1.0.0',
        tenantId: 'test-tenant',
        requestedBy: 'admin-user',
        requestedAt: new Date(),
        reason: 'Emergency rollback',
        immediate: true,
      };

      // Make it unsafe
      const unsafeCurrentVersion = { ...currentVersion, usageCount: 200 };

      const result = await rollbackManager.executeRollback(
        request,
        unsafeCurrentVersion,
        targetVersion
      );

      expect(result.success).toBe(true);
    });
  });

  describe('emergencyRollback', () => {
    it('should execute emergency rollback bypassing safety checks', async () => {
      const result = await rollbackManager.emergencyRollback(
        'test-playbook',
        '1.0.0',
        'emergency-user',
        'Critical system issue',
        'test-tenant'
      );

      expect(result.success).toBe(true);
      expect(result.rolledBackVersion?.id.version).toBe('1.0.0');
      expect(result.rolledBackVersion?.createdBy).toBe('emergency-user');
    });
  });

  describe('getRollbackHistory', () => {
    it('should return rollback history for a playbook', async () => {
      const request: VersionRollbackRequest = {
        playbookId: 'test-playbook',
        fromVersion: '2.0.0',
        toVersion: '1.0.0',
        tenantId: 'test-tenant',
        requestedBy: 'admin-user',
        requestedAt: new Date(),
        reason: 'Test rollback',
      };

      await rollbackManager.executeRollback(
        request,
        currentVersion,
        targetVersion
      );

      const history = rollbackManager.getRollbackHistory(
        'test-playbook',
        'test-tenant'
      );

      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(true);
      expect(history[0].rolledBackVersion?.id.version).toBe('1.0.0');
    });
  });

  describe('validateRollbackSuccess', () => {
    it('should validate successful rollback', () => {
      const rollbackResult = {
        success: true,
        rolledBackVersion: targetVersion,
        affectedOpportunities: 10,
      };

      const validation =
        rollbackManager.validateRollbackSuccess(rollbackResult);

      expect(validation.success).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.recommendations).toContain(
        'Increase monitoring frequency'
      );
    });

    it('should identify rollback issues', () => {
      const rollbackResult = {
        success: true,
        rolledBackVersion: targetVersion,
        affectedOpportunities: 200,
      };

      const validation =
        rollbackManager.validateRollbackSuccess(rollbackResult);

      expect(validation.success).toBe(false);
      expect(validation.issues).toContain(
        'High number of affected opportunities - monitor closely'
      );
    });
  });

  describe('createContingencyPlan', () => {
    it('should create a contingency plan', () => {
      const previousVersions = [
        { ...targetVersion, id: { ...targetVersion.id, version: '1.1.0' } },
        targetVersion,
      ];

      const plan = rollbackManager.createContingencyPlan(
        currentVersion,
        previousVersions
      );

      expect(plan.primaryRollback).toBe('1.1.0');
      expect(plan.secondaryRollback).toBe('1.0.0');
      expect(plan.emergencyContacts).toContain('platform-team@neuronx.com');
      expect(plan.monitoringPoints).toContain('Error rate > 5%');
    });
  });
});
