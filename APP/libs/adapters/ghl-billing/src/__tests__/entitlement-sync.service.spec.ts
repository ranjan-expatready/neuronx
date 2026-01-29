/**
 * Entitlement Sync Service Tests - WI-041
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntitlementSyncService } from '../entitlement-sync.service';
import { BillingSyncService } from '@neuronx/billing-entitlements';
import {
  NormalizedBillingEvent,
  GhlBillingEventType,
  GhlSubscriptionStatus,
  BillingStatus,
  DEFAULT_GHL_BILLING_CONFIG,
} from '../types';

// Mock dependencies
vi.mock('@neuronx/billing-entitlements');

describe('EntitlementSyncService', () => {
  let syncService: EntitlementSyncService;
  let mockPrisma: any;
  let mockBillingSyncService: any;

  beforeEach(() => {
    mockPrisma = {
      auditLog: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
    };

    mockBillingSyncService = {
      setBillingStatus: vi.fn(),
      setPlanTier: vi.fn(),
    };

    syncService = new EntitlementSyncService(
      mockPrisma,
      mockBillingSyncService,
      DEFAULT_GHL_BILLING_CONFIG
    );
  });

  describe('syncBillingEvent', () => {
    it('should sync active subscription to ACTIVE billing status', async () => {
      const event: NormalizedBillingEvent = {
        eventId: 'evt_123',
        eventType: GhlBillingEventType.SUBSCRIPTION_CREATED,
        tenantId: 'tenant_1',
        ghlAccountId: 'acc_123',
        subscriptionId: 'sub_456',
        subscriptionStatus: GhlSubscriptionStatus.ACTIVE,
        productId: 'prod_neuronx_pro',
        occurredAt: new Date(),
      };

      mockBillingSyncService.setBillingStatus.mockResolvedValue(undefined);
      mockBillingSyncService.setPlanTier.mockResolvedValue(undefined);
      mockPrisma.auditLog.create.mockResolvedValue(undefined);

      const result = await syncService.syncBillingEvent(event);

      expect(result.tenantId).toBe('tenant_1');
      expect(result.billingStatus).toBe(BillingStatus.ACTIVE);
      expect(result.planTier).toBe('FREE'); // Default since no mapping configured
      expect(result.changed).toBe(true);

      expect(mockBillingSyncService.setBillingStatus).toHaveBeenCalledWith(
        'tenant_1',
        BillingStatus.ACTIVE,
        'Synced from GHL subscription.created'
      );

      expect(mockBillingSyncService.setPlanTier).toHaveBeenCalledWith(
        'tenant_1',
        'FREE',
        'Synced from GHL subscription.created'
      );
    });

    it('should sync canceled subscription to BLOCKED billing status', async () => {
      const event: NormalizedBillingEvent = {
        eventId: 'evt_124',
        eventType: GhlBillingEventType.SUBSCRIPTION_CANCELED,
        tenantId: 'tenant_1',
        ghlAccountId: 'acc_123',
        subscriptionId: 'sub_456',
        subscriptionStatus: GhlSubscriptionStatus.CANCELED,
        occurredAt: new Date(),
      };

      mockBillingSyncService.setBillingStatus.mockResolvedValue(undefined);
      mockBillingSyncService.setPlanTier.mockResolvedValue(undefined);
      mockPrisma.auditLog.create.mockResolvedValue(undefined);

      const result = await syncService.syncBillingEvent(event);

      expect(result.billingStatus).toBe(BillingStatus.BLOCKED);
      expect(mockBillingSyncService.setBillingStatus).toHaveBeenCalledWith(
        'tenant_1',
        BillingStatus.BLOCKED,
        'Synced from GHL subscription.canceled'
      );
    });

    it('should sync past_due subscription to GRACE billing status', async () => {
      const event: NormalizedBillingEvent = {
        eventId: 'evt_125',
        eventType: GhlBillingEventType.SUBSCRIPTION_UPDATED,
        tenantId: 'tenant_1',
        ghlAccountId: 'acc_123',
        subscriptionId: 'sub_456',
        subscriptionStatus: GhlSubscriptionStatus.PAST_DUE,
        occurredAt: new Date(),
      };

      mockBillingSyncService.setBillingStatus.mockResolvedValue(undefined);
      mockBillingSyncService.setPlanTier.mockResolvedValue(undefined);
      mockPrisma.auditLog.create.mockResolvedValue(undefined);

      const result = await syncService.syncBillingEvent(event);

      expect(result.billingStatus).toBe(BillingStatus.GACE);
      expect(mockBillingSyncService.setBillingStatus).toHaveBeenCalledWith(
        'tenant_1',
        BillingStatus.GRACE,
        'Synced from GHL subscription.updated'
      );
    });

    it('should create audit log for sync operation', async () => {
      const event: NormalizedBillingEvent = {
        eventId: 'evt_126',
        eventType: GhlBillingEventType.SUBSCRIPTION_CREATED,
        tenantId: 'tenant_1',
        ghlAccountId: 'acc_123',
        subscriptionId: 'sub_456',
        subscriptionStatus: GhlSubscriptionStatus.ACTIVE,
        occurredAt: new Date('2024-01-01T00:00:00Z'),
      };

      mockBillingSyncService.setBillingStatus.mockResolvedValue(undefined);
      mockBillingSyncService.setPlanTier.mockResolvedValue(undefined);
      mockPrisma.auditLog.create.mockResolvedValue(undefined);

      await syncService.syncBillingEvent(event);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant_1',
          actorId: 'ghl-billing-sync',
          actorType: 'system',
          action: 'billing_sync_completed',
          resourceType: 'billing_entitlement',
          resourceId: 'tenant_1',
          newValues: {
            billingStatus: BillingStatus.ACTIVE,
            planTier: 'FREE',
          },
          changes: expect.objectContaining({
            ghlEventId: 'evt_126',
            ghlEventType: GhlBillingEventType.SUBSCRIPTION_CREATED,
            ghlAccountId: 'acc_123',
            subscriptionId: 'sub_456',
          }),
        }),
      });
    });

    it('should handle sync errors gracefully', async () => {
      const event: NormalizedBillingEvent = {
        eventId: 'evt_127',
        eventType: GhlBillingEventType.SUBSCRIPTION_CREATED,
        tenantId: 'tenant_1',
        ghlAccountId: 'acc_123',
        subscriptionId: 'sub_456',
        subscriptionStatus: GhlSubscriptionStatus.ACTIVE,
        occurredAt: new Date(),
      };

      mockBillingSyncService.setBillingStatus.mockRejectedValue(
        new Error('Sync failed')
      );

      await expect(syncService.syncBillingEvent(event)).rejects.toThrow(
        'Sync failed'
      );
    });
  });

  describe('isEventProcessed', () => {
    it('should return true if event already processed', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue({ id: 'audit_123' });

      const processed = await syncService.isEventProcessed('evt_123');

      expect(processed).toBe(true);
      expect(mockPrisma.auditLog.findFirst).toHaveBeenCalledWith({
        where: {
          action: 'billing_sync_completed',
          'metadata.correlationId': 'billing_sync_evt_123',
        },
      });
    });

    it('should return false if event not processed', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);

      const processed = await syncService.isEventProcessed('evt_123');

      expect(processed).toBe(false);
    });
  });

  describe('Status mapping', () => {
    it('should map all subscription statuses correctly', () => {
      const testCases = [
        {
          status: GhlSubscriptionStatus.ACTIVE,
          expected: BillingStatus.ACTIVE,
        },
        {
          status: GhlSubscriptionStatus.PAST_DUE,
          expected: BillingStatus.GRACE,
        },
        { status: GhlSubscriptionStatus.UNPAID, expected: BillingStatus.GRACE },
        {
          status: GhlSubscriptionStatus.CANCELED,
          expected: BillingStatus.BLOCKED,
        },
        {
          status: GhlSubscriptionStatus.TRIALING,
          expected: BillingStatus.ACTIVE,
        },
      ];

      // Test the mapping indirectly through syncBillingEvent
      testCases.forEach(async ({ status, expected }) => {
        const event: NormalizedBillingEvent = {
          eventId: `evt_${status}`,
          eventType: GhlBillingEventType.SUBSCRIPTION_CREATED,
          tenantId: 'tenant_test',
          ghlAccountId: 'acc_test',
          subscriptionId: 'sub_test',
          subscriptionStatus: status,
          occurredAt: new Date(),
        };

        mockBillingSyncService.setBillingStatus.mockResolvedValue(undefined);
        mockBillingSyncService.setPlanTier.mockResolvedValue(undefined);
        mockPrisma.auditLog.create.mockResolvedValue(undefined);

        const result = await syncService.syncBillingEvent(event);
        expect(result.billingStatus).toBe(expected);
      });
    });
  });
});
