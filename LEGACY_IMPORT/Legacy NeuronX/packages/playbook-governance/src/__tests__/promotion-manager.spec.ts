/**
 * Promotion Manager Tests - WI-030: Playbook Versioning & Governance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromotionManager } from '../promotion-manager';
import {
  PlaybookVersion,
  PlaybookVersionState,
  VersionPromotionRequest,
} from '../types';
import { Playbook } from '@neuronx/playbook-engine';

describe('PromotionManager', () => {
  let promotionManager: PromotionManager;
  let sampleVersion: PlaybookVersion;
  let samplePlaybook: Playbook;

  beforeEach(() => {
    promotionManager = new PromotionManager();

    samplePlaybook = {
      playbookId: 'test-playbook',
      version: '1.0.0',
      name: 'Test Playbook',
      description: 'A test playbook',
      tenantId: 'test-tenant',
      entryStage: 'stage1',
      stages: {
        stage1: {
          stageId: 'stage1',
          canonicalStage: 'PROSPECT_IDENTIFIED' as any,
          displayName: 'Stage 1',
          description: 'First stage',
          mustDo: [],
          onSuccess: {
            condition: { conditionType: 'manual_decision' },
            nextStage: 'stage2',
          },
          onFailure: {
            condition: { conditionType: 'manual_decision' },
            nextStage: 'lost',
          },
        },
        stage2: {
          stageId: 'stage2',
          canonicalStage: 'INITIAL_CONTACT' as any,
          displayName: 'Stage 2',
          description: 'Second stage',
          mustDo: [],
          onSuccess: {
            condition: { conditionType: 'manual_decision' },
            nextStage: 'stage2',
          },
          onFailure: {
            condition: { conditionType: 'manual_decision' },
            nextStage: 'lost',
          },
        },
        lost: {
          stageId: 'lost',
          canonicalStage: 'LOST' as any,
          displayName: 'Lost',
          description: 'Lost stage',
          mustDo: [],
          onSuccess: {
            condition: { conditionType: 'manual_decision' },
            nextStage: 'lost',
          },
          onFailure: {
            condition: { conditionType: 'manual_decision' },
            nextStage: 'lost',
          },
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user',
      isActive: false,
    };

    sampleVersion = {
      id: {
        playbookId: 'test-playbook',
        version: '1.0.0',
        tenantId: 'test-tenant',
      },
      playbook: samplePlaybook,
      state: PlaybookVersionState.REVIEW,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user',
      changeDescription: 'Initial version',
      breakingChanges: false,
      requiresApproval: false,
      usageCount: 0,
      checksum: 'test-checksum',
    };
  });

  describe('validatePromotionRequest', () => {
    it('should validate a correct promotion request', () => {
      const request: VersionPromotionRequest = {
        playbookId: 'test-playbook',
        fromVersion: '1.0.0',
        toVersion: '1.0.0',
        tenantId: 'test-tenant',
        requestedBy: 'test-user',
        requestedAt: new Date(),
        changeDescription: 'Test promotion',
      };

      const result = promotionManager.validatePromotionRequest(request);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid promotion requests', () => {
      const invalidRequest = {
        playbookId: '',
        fromVersion: '',
        toVersion: '1.0.0',
        requestedBy: 'test-user',
        requestedAt: new Date(),
        changeDescription: 'Test promotion',
      };

      const result = promotionManager.validatePromotionRequest(
        invalidRequest as any
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Playbook ID is required');
      expect(result.errors).toContain('From version is required');
    });

    it('should validate gradual rollout parameters', () => {
      const request: VersionPromotionRequest = {
        playbookId: 'test-playbook',
        fromVersion: '1.0.0',
        toVersion: '1.0.0',
        tenantId: 'test-tenant',
        requestedBy: 'test-user',
        requestedAt: new Date(),
        changeDescription: 'Test promotion',
        gradualRollout: true,
        rolloutPercentage: 150, // Invalid percentage
      };

      const result = promotionManager.validatePromotionRequest(request);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Rollout percentage must be between 0 and 100'
      );
    });
  });

  describe('canPromote', () => {
    it('should allow promotion of valid review version', () => {
      const result = promotionManager.canPromote(sampleVersion);

      expect(result.canPromote).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should reject promotion of draft version', () => {
      const draftVersion = {
        ...sampleVersion,
        state: PlaybookVersionState.DRAFT,
      };

      const result = promotionManager.canPromote(draftVersion);

      expect(result.canPromote).toBe(false);
      expect(result.reasons).toContain(
        'Version is in draft state, must be REVIEW'
      );
    });

    it('should reject promotion of breaking changes without approval', () => {
      const breakingVersion = {
        ...sampleVersion,
        breakingChanges: true,
        approvedBy: undefined,
      };

      const result = promotionManager.canPromote(breakingVersion);

      expect(result.canPromote).toBe(false);
      expect(result.reasons).toContain('Breaking changes require approval');
    });

    it('should allow promotion with approval', () => {
      const approvedVersion = {
        ...sampleVersion,
        breakingChanges: true,
        requiresApproval: true,
        approvedBy: ['approver1', 'approver2'],
      };

      const result = promotionManager.canPromote(approvedVersion);

      expect(result.canPromote).toBe(true);
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions and identify changes', () => {
      const oldVersion = sampleVersion;

      const newPlaybook = {
        ...samplePlaybook,
        stages: {
          ...samplePlaybook.stages,
          newStage: {
            stageId: 'newStage',
            canonicalStage: 'QUALIFIED' as any,
            displayName: 'New Stage',
            description: 'Added stage',
            mustDo: [],
            onSuccess: {
              condition: { conditionType: 'manual_decision' },
              nextStage: 'newStage',
            },
            onFailure: {
              condition: { conditionType: 'manual_decision' },
              nextStage: 'lost',
            },
          },
        },
      };

      const newVersion: PlaybookVersion = {
        ...sampleVersion,
        id: { ...sampleVersion.id, version: '1.1.0' },
        playbook: newPlaybook,
      };

      const comparison = promotionManager.compareVersions(
        oldVersion,
        newVersion
      );

      expect(comparison.changes.addedStages).toContain('newStage');
      expect(comparison.changes.removedStages).toHaveLength(0);
      expect(comparison.compatibility.breaking).toBe(false);
      expect(comparison.compatibility.requiresMigration).toBe(true);
      expect(comparison.compatibility.migrationComplexity).toBe('low');
    });

    it('should detect breaking changes', () => {
      const oldVersion = sampleVersion;

      const breakingPlaybook = {
        ...samplePlaybook,
        stages: {
          // Removed stage1 - this is breaking
          stage2: samplePlaybook.stages.stage2,
          lost: samplePlaybook.stages.lost,
        },
        entryStage: 'stage2', // Changed entry stage
      };

      const breakingVersion: PlaybookVersion = {
        ...sampleVersion,
        id: { ...sampleVersion.id, version: '2.0.0' },
        playbook: breakingPlaybook,
      };

      const comparison = promotionManager.compareVersions(
        oldVersion,
        breakingVersion
      );

      expect(comparison.changes.removedStages).toContain('stage1');
      expect(comparison.compatibility.breaking).toBe(true);
      expect(comparison.compatibility.migrationComplexity).toBe('high');
    });
  });

  describe('generateMigrationRules', () => {
    it('should generate migration rules for version transition', () => {
      const oldVersion = sampleVersion;
      const newVersion = {
        ...sampleVersion,
        id: { ...sampleVersion.id, version: '1.1.0' },
      };

      const comparison = promotionManager.compareVersions(
        oldVersion,
        newVersion
      );
      const rules = promotionManager.generateMigrationRules(comparison);

      expect(rules).toHaveLength(1);
      const rule = rules[0];
      expect(rule.fromVersion).toBe('1.0.0');
      expect(rule.toVersion).toBe('1.1.0');
      expect(rule.affectsOpportunities).toBe('none');
      expect(rule.requiresHumanReview).toBe(false);
    });
  });

  describe('executePromotion', () => {
    it('should execute promotion for valid request', async () => {
      const request: VersionPromotionRequest = {
        playbookId: 'test-playbook',
        fromVersion: '1.0.0',
        toVersion: '1.0.0',
        tenantId: 'test-tenant',
        requestedBy: 'test-user',
        requestedAt: new Date(),
        changeDescription: 'Test promotion',
      };

      const result = await promotionManager.executePromotion(
        request,
        sampleVersion
      );

      expect(result.success).toBe(true);
      expect(result.promotedVersion?.state).toBe(PlaybookVersionState.ACTIVE);
      expect(result.promotedVersion?.promotedBy).toBe('test-user');
    });

    it('should reject invalid promotion requests', async () => {
      const invalidRequest = {
        playbookId: '',
        fromVersion: '1.0.0',
        toVersion: '1.0.0',
        requestedBy: 'test-user',
        requestedAt: new Date(),
        changeDescription: 'Test promotion',
      };

      const result = await promotionManager.executePromotion(
        invalidRequest as any,
        sampleVersion
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Playbook ID is required');
    });
  });

  describe('enforceImmutability', () => {
    it('should allow operations on draft versions', () => {
      const draftVersion = {
        ...sampleVersion,
        state: PlaybookVersionState.DRAFT,
      };

      expect(() => {
        promotionManager.enforceImmutability(draftVersion, 'update');
      }).not.toThrow();
    });

    it('should reject operations on immutable versions', () => {
      const activeVersion = {
        ...sampleVersion,
        state: PlaybookVersionState.ACTIVE,
      };

      expect(() => {
        promotionManager.enforceImmutability(activeVersion, 'update');
      }).toThrow('Cannot update version 1.0.0 in active state');
    });
  });

  describe('validateIntegrity', () => {
    it('should validate version integrity', () => {
      const isValid = promotionManager.validateIntegrity(
        sampleVersion,
        samplePlaybook
      );

      expect(isValid).toBe(true);
    });
  });
});
