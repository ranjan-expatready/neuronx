/**
 * GHL Billing Webhook Controller Tests - WI-041
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GhlBillingWebhookController } from '../webhook.controller';
import { GhlBillingEventNormalizer } from '../event-normalizer';
import { EntitlementSyncService } from '../entitlement-sync.service';
import { GhlBillingEventType, GhlSubscriptionStatus } from '../types';

// Mock dependencies
vi.mock('../event-normalizer');
vi.mock('../entitlement-sync.service');

describe('GhlBillingWebhookController', () => {
  let controller: GhlBillingWebhookController;
  let mockNormalizer: any;
  let mockSyncService: any;

  beforeEach(() => {
    mockNormalizer = {
      normalizeEvent: vi.fn(),
    };

    mockSyncService = {
      syncBillingEvent: vi.fn(),
      isEventProcessed: vi.fn(),
    };

    controller = new GhlBillingWebhookController(
      mockNormalizer,
      mockSyncService
    );
  });

  describe('processBillingWebhook', () => {
    it('should process valid subscription webhook successfully', async () => {
      const payload = {
        event: {
          id: 'evt_123',
          type: GhlBillingEventType.SUBSCRIPTION_CREATED,
          created: 1640995200,
          data: { object: { account_id: 'acc_123' } },
        },
      };

      const headers = { 'x-tenant-id': 'tenant_1' };
      const normalizedEvent = {
        eventId: 'evt_123',
        eventType: GhlBillingEventType.SUBSCRIPTION_CREATED,
        tenantId: 'tenant_1',
      };

      mockNormalizer.normalizeEvent.mockReturnValue(normalizedEvent);
      mockSyncService.isEventProcessed.mockResolvedValue(false);
      mockSyncService.syncBillingEvent.mockResolvedValue({
        tenantId: 'tenant_1',
        billingStatus: 'ACTIVE',
        planTier: 'PRO',
        changed: true,
      });

      const result = await controller.processBillingWebhook(payload, headers);

      expect(result.status).toBe('accepted');
      expect(result.eventId).toBe('evt_123');
      expect(mockNormalizer.normalizeEvent).toHaveBeenCalledWith(
        payload,
        'tenant_1'
      );
      expect(mockSyncService.syncBillingEvent).toHaveBeenCalledWith(
        normalizedEvent
      );
    });

    it('should ignore unsupported events', async () => {
      const payload = {
        event: {
          id: 'evt_124',
          type: 'customer.created' as any,
          created: 1640995200,
          data: { object: {} },
        },
      };

      const headers = { 'x-tenant-id': 'tenant_1' };

      mockNormalizer.normalizeEvent.mockReturnValue(null);

      const result = await controller.processBillingWebhook(payload, headers);

      expect(result.status).toBe('ignored');
      expect(result.reason).toBe('unsupported_event');
      expect(mockSyncService.syncBillingEvent).not.toHaveBeenCalled();
    });

    it('should handle missing tenant ID', async () => {
      const payload = {
        event: {
          id: 'evt_125',
          type: GhlBillingEventType.SUBSCRIPTION_CREATED,
          created: 1640995200,
          data: { object: {} },
        },
      };

      const headers = {}; // Missing x-tenant-id

      const result = await controller.processBillingWebhook(payload, headers);

      expect(result.status).toBe('ignored');
      expect(result.reason).toBe('missing_tenant_id');
      expect(mockNormalizer.normalizeEvent).not.toHaveBeenCalled();
    });

    it('should handle already processed events', async () => {
      const payload = {
        event: {
          id: 'evt_126',
          type: GhlBillingEventType.SUBSCRIPTION_CREATED,
          created: 1640995200,
          data: { object: { account_id: 'acc_123' } },
        },
      };

      const headers = { 'x-tenant-id': 'tenant_1' };
      const normalizedEvent = {
        eventId: 'evt_126',
        eventType: GhlBillingEventType.SUBSCRIPTION_CREATED,
        tenantId: 'tenant_1',
      };

      mockNormalizer.normalizeEvent.mockReturnValue(normalizedEvent);
      mockSyncService.isEventProcessed.mockResolvedValue(true);

      const result = await controller.processBillingWebhook(payload, headers);

      expect(result.status).toBe('ignored');
      expect(result.reason).toBe('already_processed');
      expect(mockSyncService.syncBillingEvent).not.toHaveBeenCalled();
    });

    it('should return success even on processing errors', async () => {
      const payload = {
        event: {
          id: 'evt_127',
          type: GhlBillingEventType.SUBSCRIPTION_CREATED,
          created: 1640995200,
          data: { object: { account_id: 'acc_123' } },
        },
      };

      const headers = { 'x-tenant-id': 'tenant_1' };
      const normalizedEvent = {
        eventId: 'evt_127',
        eventType: GhlBillingEventType.SUBSCRIPTION_CREATED,
        tenantId: 'tenant_1',
      };

      mockNormalizer.normalizeEvent.mockReturnValue(normalizedEvent);
      mockSyncService.isEventProcessed.mockResolvedValue(false);
      mockSyncService.syncBillingEvent.mockRejectedValue(
        new Error('Sync failed')
      );

      const result = await controller.processBillingWebhook(payload, headers);

      expect(result.status).toBe('accepted');
      expect(result.eventId).toBe('evt_127');
      // Processing continues asynchronously despite errors
    });

    it('should handle invalid payload gracefully', async () => {
      const invalidPayload = { invalid: 'payload' } as any;
      const headers = { 'x-tenant-id': 'tenant_1' };

      mockNormalizer.normalizeEvent.mockReturnValue(null);

      const result = await controller.processBillingWebhook(
        invalidPayload,
        headers
      );

      expect(result.status).toBe('accepted_with_error');
      expect(result.error).toBeDefined();
    });

    it('should process events asynchronously', async () => {
      const payload = {
        event: {
          id: 'evt_128',
          type: GhlBillingEventType.SUBSCRIPTION_CREATED,
          created: 1640995200,
          data: { object: { account_id: 'acc_123' } },
        },
      };

      const headers = { 'x-tenant-id': 'tenant_1' };
      const normalizedEvent = {
        eventId: 'evt_128',
        eventType: GhlBillingEventType.SUBSCRIPTION_CREATED,
        tenantId: 'tenant_1',
      };

      mockNormalizer.normalizeEvent.mockReturnValue(normalizedEvent);
      mockSyncService.isEventProcessed.mockResolvedValue(false);
      mockSyncService.syncBillingEvent.mockImplementation(() => {
        return new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                tenantId: 'tenant_1',
                billingStatus: 'ACTIVE',
                planTier: 'PRO',
                changed: true,
              }),
            10
          )
        );
      });

      const result = await controller.processBillingWebhook(payload, headers);

      // Should return immediately without waiting for async processing
      expect(result.status).toBe('accepted');
      expect(result.eventId).toBe('evt_128');
    });
  });
});
