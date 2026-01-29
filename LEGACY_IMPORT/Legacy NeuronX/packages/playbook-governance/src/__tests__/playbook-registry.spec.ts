/**
 * Playbook Registry Tests - WI-030: Playbook Versioning & Governance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PlaybookRegistry } from '../playbook-registry';
import { PlaybookVersionState } from '../types';
import { Playbook } from '@neuronx/playbook-engine';

describe('PlaybookRegistry', () => {
  let registry: PlaybookRegistry;
  let samplePlaybook: Playbook;

  beforeEach(() => {
    registry = new PlaybookRegistry();
    samplePlaybook = {
      playbookId: 'test-playbook',
      version: '1.0.0',
      name: 'Test Playbook',
      description: 'A test playbook',
      tenantId: 'test-tenant',
      entryStage: 'prospect_identified',
      stages: {
        prospect_identified: {
          stageId: 'prospect_identified',
          canonicalStage: 'PROSPECT_IDENTIFIED' as any,
          displayName: 'Prospect Identified',
          description: 'Initial prospect stage',
          mustDo: [
            {
              actionId: 'contact_attempt',
              actionType: 'contact_attempt',
              channel: 'voice',
              slaMinutes: 15,
              evidenceRequired: 'call_attempt_logged',
            },
          ],
          onSuccess: {
            condition: {
              conditionType: 'evidence_present',
              evidenceType: 'call_connected',
            },
            nextStage: 'initial_contact',
          },
          onFailure: {
            condition: {
              conditionType: 'evidence_absent',
              evidenceType: 'call_attempt_logged',
            },
            nextStage: 'lost',
          },
        },
        initial_contact: {
          stageId: 'initial_contact',
          canonicalStage: 'INITIAL_CONTACT' as any,
          displayName: 'Initial Contact',
          description: 'First contact made',
          mustDo: [],
          onSuccess: {
            condition: {
              conditionType: 'evidence_present',
              evidenceType: 'qualification_complete',
            },
            nextStage: 'qualified',
          },
          onFailure: {
            condition: {
              conditionType: 'evidence_absent',
              evidenceType: 'qualification_complete',
            },
            nextStage: 'lost',
          },
        },
        qualified: {
          stageId: 'qualified',
          canonicalStage: 'QUALIFIED' as any,
          displayName: 'Qualified',
          description: 'Lead qualified',
          mustDo: [],
          onSuccess: {
            condition: { conditionType: 'manual_decision' },
            nextStage: 'closed_won',
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
          description: 'Opportunity lost',
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
        closed_won: {
          stageId: 'closed_won',
          canonicalStage: 'CLOSED_WON' as any,
          displayName: 'Closed Won',
          description: 'Deal closed successfully',
          mustDo: [],
          onSuccess: {
            condition: { conditionType: 'manual_decision' },
            nextStage: 'closed_won',
          },
          onFailure: {
            condition: { conditionType: 'manual_decision' },
            nextStage: 'closed_won',
          },
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user',
      isActive: false,
    };
  });

  describe('createVersion', () => {
    it('should create a new playbook version in DRAFT state', () => {
      const version = registry.createVersion(
        samplePlaybook,
        'test-user',
        'test-tenant'
      );

      expect(version.id.playbookId).toBe('test-playbook');
      expect(version.id.version).toBe('1.0.0');
      expect(version.id.tenantId).toBe('test-tenant');
      expect(version.state).toBe(PlaybookVersionState.DRAFT);
      expect(version.createdBy).toBe('test-user');
      expect(version.changeDescription).toBe('');
    });

    it('should generate next version number for subsequent drafts', () => {
      registry.createVersion(samplePlaybook, 'test-user', 'test-tenant');
      const secondVersion = registry.createVersion(
        { ...samplePlaybook, name: 'Updated Playbook' },
        'test-user',
        'test-tenant',
        'Updated description'
      );

      expect(secondVersion.id.version).toBe('1.1.0');
      expect(secondVersion.changeDescription).toBe('Updated description');
    });

    it('should validate playbook before creation', () => {
      const invalidPlaybook = { ...samplePlaybook, playbookId: '' };

      expect(() => {
        registry.createVersion(invalidPlaybook, 'test-user');
      }).toThrow('Invalid playbook');
    });
  });

  describe('getVersion', () => {
    it('should retrieve a specific version', () => {
      const created = registry.createVersion(
        samplePlaybook,
        'test-user',
        'test-tenant'
      );

      const retrieved = registry.getVersion(
        'test-playbook',
        '1.0.0',
        'test-tenant'
      );

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent version', () => {
      const retrieved = registry.getVersion('non-existent', '1.0.0');

      expect(retrieved).toBeNull();
    });
  });

  describe('getActiveVersion', () => {
    it('should return null when no active version exists', () => {
      const active = registry.getActiveVersion('test-playbook', 'test-tenant');

      expect(active).toBeNull();
    });

    it('should return active version after promotion', () => {
      const version = registry.createVersion(
        samplePlaybook,
        'test-user',
        'test-tenant'
      );

      // Simulate promotion (would normally be done by promotion manager)
      const activeVersion = { ...version, state: PlaybookVersionState.ACTIVE };
      (registry as any).activeVersions.set(
        'test-tenant:test-playbook',
        activeVersion
      );

      const retrieved = registry.getActiveVersion(
        'test-playbook',
        'test-tenant'
      );

      expect(retrieved).toEqual(activeVersion);
    });
  });

  describe('queryVersions', () => {
    beforeEach(() => {
      registry.createVersion(samplePlaybook, 'test-user', 'test-tenant');
      registry.createVersion(
        { ...samplePlaybook, name: 'Version 2' },
        'test-user',
        'test-tenant'
      );
    });

    it('should return all versions for a playbook', () => {
      const versions = registry.queryVersions('test-playbook', {
        tenantId: 'test-tenant',
      });

      expect(versions).toHaveLength(2);
      expect(versions[0].id.version).toBe('1.1.0'); // Newest first
      expect(versions[1].id.version).toBe('1.0.0');
    });

    it('should filter by state', () => {
      const draftVersions = registry.queryVersions('test-playbook', {
        tenantId: 'test-tenant',
        state: PlaybookVersionState.DRAFT,
      });

      expect(draftVersions).toHaveLength(2);
      expect(
        draftVersions.every(v => v.state === PlaybookVersionState.DRAFT)
      ).toBe(true);
    });

    it('should exclude retired versions by default', () => {
      // Mark one version as retired
      const versions = registry.queryVersions('test-playbook', {
        tenantId: 'test-tenant',
      });
      versions[0].state = PlaybookVersionState.RETIRED;

      const activeVersions = registry.queryVersions('test-playbook', {
        tenantId: 'test-tenant',
      });

      expect(
        activeVersions.every(v => v.state !== PlaybookVersionState.RETIRED)
      ).toBe(true);
    });
  });

  describe('updateDraft', () => {
    it('should update a draft version', () => {
      const version = registry.createVersion(
        samplePlaybook,
        'test-user',
        'test-tenant'
      );
      const updatedPlaybook = { ...samplePlaybook, name: 'Updated Name' };

      const updated = registry.updateDraft(
        'test-playbook',
        '1.0.0',
        updatedPlaybook,
        'test-user',
        'Updated description',
        'test-tenant'
      );

      expect(updated.playbook.name).toBe('Updated Name');
      expect(updated.changeDescription).toBe('Updated description');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        updated.createdAt.getTime()
      );
    });

    it('should reject updates to non-draft versions', () => {
      const version = registry.createVersion(
        samplePlaybook,
        'test-user',
        'test-tenant'
      );

      // Simulate making it active
      const versions = (registry as any).versions.get(
        'test-tenant:test-playbook'
      );
      versions[0].state = PlaybookVersionState.ACTIVE;

      expect(() => {
        registry.updateDraft(
          'test-playbook',
          '1.0.0',
          samplePlaybook,
          'test-user',
          '',
          'test-tenant'
        );
      }).toThrow('Cannot update version in active state');
    });
  });

  describe('promoteVersion', () => {
    it('should promote a review version to active', () => {
      const version = registry.createVersion(
        samplePlaybook,
        'test-user',
        'test-tenant'
      );

      // Put in review state
      const versions = (registry as any).versions.get(
        'test-tenant:test-playbook'
      );
      versions[0].state = PlaybookVersionState.REVIEW;

      const request = {
        playbookId: 'test-playbook',
        fromVersion: '1.0.0',
        toVersion: '1.0.0',
        tenantId: 'test-tenant',
        requestedBy: 'test-user',
        requestedAt: new Date(),
        changeDescription: 'Promotion test',
      };

      const result = registry.promoteVersion(request);

      expect(result.success).toBe(true);
      expect(result.promotedVersion?.state).toBe(PlaybookVersionState.ACTIVE);
      expect(result.promotedVersion?.promotedBy).toBe('test-user');
    });

    it('should reject promotion of non-review versions', () => {
      const version = registry.createVersion(
        samplePlaybook,
        'test-user',
        'test-tenant'
      );

      const request = {
        playbookId: 'test-playbook',
        fromVersion: '1.0.0',
        toVersion: '1.0.0',
        tenantId: 'test-tenant',
        requestedBy: 'test-user',
        requestedAt: new Date(),
        changeDescription: 'Promotion test',
      };

      const result = registry.promoteVersion(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Version is in draft state, must be REVIEW'
      );
    });
  });

  describe('retireVersion', () => {
    it('should retire an active version', () => {
      const version = registry.createVersion(
        samplePlaybook,
        'test-user',
        'test-tenant'
      );

      // Make it active
      const versions = (registry as any).versions.get(
        'test-tenant:test-playbook'
      );
      versions[0].state = PlaybookVersionState.ACTIVE;
      (registry as any).activeVersions.set(
        'test-tenant:test-playbook',
        versions[0]
      );

      const result = registry.retireVersion(
        'test-playbook',
        '1.0.0',
        'test-user',
        'End of life',
        'test-tenant'
      );

      expect(result.success).toBe(true);
      expect(result.rolledBackVersion?.state).toBe(
        PlaybookVersionState.RETIRED
      );
      expect(result.rolledBackVersion?.retiredBy).toBe('test-user');
    });

    it('should reject retirement of non-active versions', () => {
      const version = registry.createVersion(
        samplePlaybook,
        'test-user',
        'test-tenant'
      );

      const result = registry.retireVersion(
        'test-playbook',
        '1.0.0',
        'test-user',
        'End of life',
        'test-tenant'
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Version is in draft state, must be ACTIVE'
      );
    });
  });

  describe('getAuditLog', () => {
    it('should return audit events for a playbook', () => {
      registry.createVersion(samplePlaybook, 'test-user', 'test-tenant');

      const auditLog = registry.getAuditLog('test-playbook', 'test-tenant');

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].eventType).toBe('version_created');
      expect(auditLog[0].actor).toBe('test-user');
    });

    it('should return events in reverse chronological order', () => {
      registry.createVersion(samplePlaybook, 'test-user', 'test-tenant');
      registry.createVersion(
        { ...samplePlaybook, name: 'Version 2' },
        'test-user',
        'test-tenant'
      );

      const auditLog = registry.getAuditLog('test-playbook', 'test-tenant');

      expect(auditLog).toHaveLength(2);
      expect(auditLog[0].timestamp.getTime()).toBeGreaterThan(
        auditLog[1].timestamp.getTime()
      );
    });
  });
});
