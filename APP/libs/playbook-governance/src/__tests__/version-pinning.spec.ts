/**
 * Version Pinning Tests - WI-030: Playbook Versioning & Governance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VersionPinningManager } from '../version-pinning';
import { PlaybookVersion, PlaybookVersionState } from '../types';

describe('VersionPinningManager', () => {
  let pinningManager: VersionPinningManager;
  let sampleVersion: PlaybookVersion;

  beforeEach(() => {
    pinningManager = new VersionPinningManager();

    sampleVersion = {
      id: {
        playbookId: 'test-playbook',
        version: '1.0.0',
        tenantId: 'test-tenant',
      },
      playbook: {
        playbookId: 'test-playbook',
        version: '1.0.0',
        name: 'Test Playbook',
        description: 'A test playbook',
        tenantId: 'test-tenant',
        entryStage: 'stage1',
        stages: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test-user',
        isActive: false,
      },
      state: PlaybookVersionState.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user',
      changeDescription: 'Test version',
      breakingChanges: false,
      requiresApproval: false,
      usageCount: 0,
      checksum: 'test-checksum',
    };
  });

  describe('pinVersion', () => {
    it('should create a version pin', () => {
      const pin = pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'test-user',
        'Need stable version for compliance'
      );

      expect(pin.tenantId).toBe('test-tenant');
      expect(pin.opportunityId).toBe('opp-123');
      expect(pin.playbookId).toBe('test-playbook');
      expect(pin.pinnedVersion).toBe('1.0.0');
      expect(pin.pinnedBy).toBe('test-user');
      expect(pin.reason).toBe('Need stable version for compliance');
      expect(pin.expiresAt).toBeUndefined();
      expect(pin.autoRenew).toBe(false);
    });

    it('should create a pin with expiration', () => {
      const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      const pin = pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'test-user',
        'Temporary pin',
        expiryDate,
        true,
        'auto_renew_safe'
      );

      expect(pin.expiresAt).toEqual(expiryDate);
      expect(pin.autoRenew).toBe(true);
      expect(pin.renewalCondition).toBe('auto_renew_safe');
    });

    it('should reject duplicate pins', () => {
      pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'test-user',
        'First pin'
      );

      expect(() => {
        pinningManager.pinVersion(
          'test-tenant',
          'opp-123',
          'test-playbook',
          '1.1.0',
          'test-user',
          'Duplicate pin'
        );
      }).toThrow('Opportunity opp-123 is already pinned');
    });
  });

  describe('getPinnedVersion', () => {
    it('should retrieve an active pin', () => {
      const createdPin = pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'test-user',
        'Test pin'
      );

      const retrievedPin = pinningManager.getPinnedVersion(
        'test-tenant',
        'opp-123',
        'test-playbook'
      );

      expect(retrievedPin).toEqual(createdPin);
    });

    it('should return null for non-existent pins', () => {
      const pin = pinningManager.getPinnedVersion(
        'test-tenant',
        'non-existent',
        'test-playbook'
      );

      expect(pin).toBeNull();
    });

    it('should remove expired pins', () => {
      const expiredDate = new Date(Date.now() - 1000); // Already expired

      pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'test-user',
        'Expired pin',
        expiredDate,
        false
      );

      const pin = pinningManager.getPinnedVersion(
        'test-tenant',
        'opp-123',
        'test-playbook'
      );

      expect(pin).toBeNull();
    });

    it('should auto-renew eligible pins', () => {
      const expiredDate = new Date(Date.now() - 1000);

      pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'test-user',
        'Auto-renew pin',
        expiredDate,
        true,
        'auto_renew_safe'
      );

      const pin = pinningManager.getPinnedVersion(
        'test-tenant',
        'opp-123',
        'test-playbook'
      );

      expect(pin).not.toBeNull();
      expect(pin!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('unpinVersion', () => {
    it('should remove a pin', () => {
      pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'test-user',
        'Test pin'
      );

      const removed = pinningManager.unpinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        'admin-user'
      );

      expect(removed).toBe(true);

      const pin = pinningManager.getPinnedVersion(
        'test-tenant',
        'opp-123',
        'test-playbook'
      );

      expect(pin).toBeNull();
    });

    it('should return false for non-existent pins', () => {
      const removed = pinningManager.unpinVersion(
        'test-tenant',
        'non-existent',
        'test-playbook',
        'admin-user'
      );

      expect(removed).toBe(false);
    });
  });

  describe('getTenantPins', () => {
    it('should return all pins for a tenant', () => {
      pinningManager.pinVersion(
        'test-tenant',
        'opp-1',
        'playbook-a',
        '1.0.0',
        'user1',
        'Pin 1'
      );
      pinningManager.pinVersion(
        'test-tenant',
        'opp-2',
        'playbook-b',
        '2.0.0',
        'user2',
        'Pin 2'
      );
      pinningManager.pinVersion(
        'other-tenant',
        'opp-3',
        'playbook-c',
        '1.0.0',
        'user3',
        'Other tenant pin'
      );

      const tenantPins = pinningManager.getTenantPins('test-tenant');

      expect(tenantPins).toHaveLength(2);
      expect(tenantPins.every(pin => pin.tenantId === 'test-tenant')).toBe(
        true
      );
    });

    it('should clean up expired pins', () => {
      const expiredDate = new Date(Date.now() - 1000);

      pinningManager.pinVersion(
        'test-tenant',
        'opp-1',
        'playbook-a',
        '1.0.0',
        'user1',
        'Expired',
        expiredDate,
        false
      );
      pinningManager.pinVersion(
        'test-tenant',
        'opp-2',
        'playbook-b',
        '2.0.0',
        'user2',
        'Active'
      );

      const tenantPins = pinningManager.getTenantPins('test-tenant');

      expect(tenantPins).toHaveLength(1);
      expect(tenantPins[0].opportunityId).toBe('opp-2');
    });
  });

  describe('getPlaybookPins', () => {
    it('should return all pins for a playbook', () => {
      pinningManager.pinVersion(
        'tenant-a',
        'opp-1',
        'test-playbook',
        '1.0.0',
        'user1',
        'Pin 1'
      );
      pinningManager.pinVersion(
        'tenant-a',
        'opp-2',
        'test-playbook',
        '1.0.0',
        'user2',
        'Pin 2'
      );
      pinningManager.pinVersion(
        'tenant-b',
        'opp-3',
        'test-playbook',
        '1.0.0',
        'user3',
        'Other tenant'
      );

      const playbookPins = pinningManager.getPlaybookPins('test-playbook');

      expect(playbookPins).toHaveLength(3);
      expect(
        playbookPins.every(pin => pin.playbookId === 'test-playbook')
      ).toBe(true);
    });

    it('should filter by tenant', () => {
      pinningManager.pinVersion(
        'tenant-a',
        'opp-1',
        'test-playbook',
        '1.0.0',
        'user1',
        'Pin 1'
      );
      pinningManager.pinVersion(
        'tenant-b',
        'opp-2',
        'test-playbook',
        '1.0.0',
        'user2',
        'Pin 2'
      );

      const tenantAPins = pinningManager.getPlaybookPins(
        'test-playbook',
        'tenant-a'
      );

      expect(tenantAPins).toHaveLength(1);
      expect(tenantAPins[0].tenantId).toBe('tenant-a');
    });
  });

  describe('extendPin', () => {
    it('should extend pin expiration', () => {
      pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'user1',
        'Test pin'
      );

      const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

      const extendedPin = pinningManager.extendPin(
        'test-tenant',
        'opp-123',
        'test-playbook',
        newExpiry,
        'admin-user'
      );

      expect(extendedPin).not.toBeNull();
      expect(extendedPin!.expiresAt).toEqual(newExpiry);
    });

    it('should return null for non-existent pins', () => {
      const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const extendedPin = pinningManager.extendPin(
        'test-tenant',
        'non-existent',
        'test-playbook',
        newExpiry,
        'admin-user'
      );

      expect(extendedPin).toBeNull();
    });
  });

  describe('getEffectiveVersion', () => {
    it('should return pinned version when pin exists', () => {
      pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'user1',
        'Pinned for stability'
      );

      const result = pinningManager.getEffectiveVersion(
        'opp-123',
        'test-playbook',
        'test-tenant',
        sampleVersion
      );

      expect(result.isPinned).toBe(true);
      expect(result.pinReason).toBe('Pinned for stability');
      expect(result.version).toEqual(sampleVersion);
    });

    it('should return active version when no pin exists', () => {
      const result = pinningManager.getEffectiveVersion(
        'opp-123',
        'test-playbook',
        'test-tenant',
        sampleVersion
      );

      expect(result.isPinned).toBe(false);
      expect(result.pinReason).toBeUndefined();
      expect(result.version).toEqual(sampleVersion);
    });
  });

  describe('canTransitionToVersion', () => {
    it('should allow transition when no pin exists', () => {
      const result = pinningManager.canTransitionToVersion(
        'opp-123',
        'test-playbook',
        'test-tenant',
        '2.0.0'
      );

      expect(result.canTransition).toBe(true);
      expect(result.reason).toBe('No pinning constraints');
    });

    it('should allow transition to same pinned version', () => {
      pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'user1',
        'Test pin'
      );

      const result = pinningManager.canTransitionToVersion(
        'opp-123',
        'test-playbook',
        'test-tenant',
        '1.0.0'
      );

      expect(result.canTransition).toBe(true);
      expect(result.reason).toBe('Already pinned to target version');
    });

    it('should block transition to different version when pinned', () => {
      pinningManager.pinVersion(
        'test-tenant',
        'opp-123',
        'test-playbook',
        '1.0.0',
        'user1',
        'Test pin'
      );

      const result = pinningManager.canTransitionToVersion(
        'opp-123',
        'test-playbook',
        'test-tenant',
        '2.0.0'
      );

      expect(result.canTransition).toBe(false);
      expect(result.reason).toContain('is pinned to version 1.0.0');
    });
  });

  describe('cleanupExpiredPins', () => {
    it('should remove expired pins that are not auto-renewing', () => {
      const expiredDate = new Date(Date.now() - 1000);

      pinningManager.pinVersion(
        'test-tenant',
        'opp-1',
        'test-playbook',
        '1.0.0',
        'user1',
        'Expired',
        expiredDate,
        false
      );
      pinningManager.pinVersion(
        'test-tenant',
        'opp-2',
        'test-playbook',
        '1.0.0',
        'user2',
        'Active'
      );

      const cleanedCount = pinningManager.cleanupExpiredPins();

      expect(cleanedCount).toBe(1);

      const remainingPins = pinningManager.getTenantPins('test-tenant');
      expect(remainingPins).toHaveLength(1);
      expect(remainingPins[0].opportunityId).toBe('opp-2');
    });
  });
});
