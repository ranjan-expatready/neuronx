/**
 * GHL Billing Event Normalizer Tests - WI-041
 */

import { describe, it, expect } from 'vitest';
import { GhlBillingEventNormalizer } from '../event-normalizer';
import { GhlBillingEventType, GhlSubscriptionStatus } from '../types';

describe('GhlBillingEventNormalizer', () => {
  let normalizer: GhlBillingEventNormalizer;

  beforeEach(() => {
    normalizer = new GhlBillingEventNormalizer();
  });

  describe('normalizeEvent', () => {
    it('should normalize subscription.created event', () => {
      const payload = {
        event: {
          id: 'evt_123',
          type: GhlBillingEventType.SUBSCRIPTION_CREATED,
          created: 1640995200, // 2022-01-01
          data: {
            object: {
              id: 'sub_456',
              account_id: 'acc_789',
              status: 'active',
              items: {
                data: [
                  {
                    price: {
                      product: 'prod_neuronx_pro',
                    },
                  },
                ],
              },
            },
          },
        },
      };

      const result = normalizer.normalizeEvent(payload, 'tenant_1');

      expect(result).toEqual({
        eventId: 'evt_123',
        eventType: GhlBillingEventType.SUBSCRIPTION_CREATED,
        tenantId: 'tenant_1',
        ghlAccountId: 'acc_789',
        subscriptionId: 'sub_456',
        subscriptionStatus: GhlSubscriptionStatus.ACTIVE,
        productId: 'prod_neuronx_pro',
        occurredAt: new Date('2022-01-01T00:00:00.000Z'),
        rawPayload: payload,
      });
    });

    it('should normalize invoice.payment_failed event', () => {
      const payload = {
        event: {
          id: 'evt_124',
          type: GhlBillingEventType.INVOICE_PAYMENT_FAILED,
          created: 1640995200,
          data: {
            object: {
              id: 'in_456',
              account_id: 'acc_789',
              subscription: 'sub_123',
              amount_due: 2999,
              currency: 'usd',
            },
          },
        },
      };

      const result = normalizer.normalizeEvent(payload, 'tenant_1');

      expect(result?.eventType).toBe(
        GhlBillingEventType.INVOICE_PAYMENT_FAILED
      );
      expect(result?.invoiceId).toBe('in_456');
      expect(result?.subscriptionId).toBe('sub_123');
      expect(result?.amount).toBe(2999);
      expect(result?.currency).toBe('usd');
    });

    it('should return null for unsupported event types', () => {
      const payload = {
        event: {
          id: 'evt_125',
          type: 'customer.created' as any,
          created: 1640995200,
          data: { object: {} },
        },
      };

      const result = normalizer.normalizeEvent(payload, 'tenant_1');
      expect(result).toBeNull();
    });

    it('should return null for events without account_id', () => {
      const payload = {
        event: {
          id: 'evt_126',
          type: GhlBillingEventType.SUBSCRIPTION_CREATED,
          created: 1640995200,
          data: {
            object: {
              id: 'sub_456',
              status: 'active',
              // Missing account_id
            },
          },
        },
      };

      const result = normalizer.normalizeEvent(payload, 'tenant_1');
      expect(result).toBeNull();
    });

    it('should handle invalid payload gracefully', () => {
      const invalidPayload = { invalid: 'payload' } as any;

      const result = normalizer.normalizeEvent(invalidPayload, 'tenant_1');
      expect(result).toBeNull();
    });
  });

  describe('Subscription status mapping', () => {
    it('should map all valid subscription statuses', () => {
      const testCases = [
        { input: 'active', expected: GhlSubscriptionStatus.ACTIVE },
        { input: 'past_due', expected: GhlSubscriptionStatus.PAST_DUE },
        { input: 'unpaid', expected: GhlSubscriptionStatus.UNPAID },
        { input: 'canceled', expected: GhlSubscriptionStatus.CANCELED },
        { input: 'trialing', expected: GhlSubscriptionStatus.TRIALING },
        { input: 'unknown', expected: undefined },
      ];

      // We test the mapping indirectly through normalizeEvent
      testCases.forEach(({ input, expected }) => {
        const payload = {
          event: {
            id: 'evt_test',
            type: GhlBillingEventType.SUBSCRIPTION_UPDATED,
            created: 1640995200,
            data: {
              object: {
                id: 'sub_test',
                account_id: 'acc_test',
                status: input,
              },
            },
          },
        };

        const result = normalizer.normalizeEvent(payload, 'tenant_1');
        expect(result?.subscriptionStatus).toBe(expected);
      });
    });
  });
});
