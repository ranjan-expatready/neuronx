# WI-041: GHL Billing → Entitlement Sync Adapter

**Status:** 🟢 Active
**Created:** 2026-01-05
**Priority:** Critical
**Assigned:** Cursor Agent

## Problem Statement

WI-040 implemented complete billing and entitlements authority, but NeuronX has no way to sync billing state from GHL. This creates a critical disconnect:

1. **Billing State Gap**: GHL manages subscriptions and payments, but NeuronX doesn't know about billing changes
2. **Entitlement Drift**: Customers could have active GHL subscriptions but be blocked in NeuronX
3. **Revenue Risk**: No automated sync means manual intervention required for billing changes
4. **Customer Experience**: Billing changes don't reflect in execution permissions

This prevents automated billing lifecycle management and creates operational overhead.

## Solution Overview

Implement a **read-only billing sync adapter** that:

1. **Consumes GHL Webhooks**: Listens to specific billing events from GHL
2. **Maps Deterministically**: Translates GHL subscription states to NeuronX billing status
3. **Updates Entitlements**: Syncs billing state into NeuronX entitlement system
4. **Maintains Separation**: GHL owns billing, NeuronX owns execution authority

**Non-Negotiable**: This is read-only sync only. No Stripe SDK, no payment logic, no billing creation.

## Acceptance Criteria

### AC-041.01: Billing Sync Architecture

- [x] Read-only adapter package created with clean separation
- [x] No Stripe SDK or payment logic in NeuronX
- [x] Webhook processing is asynchronous and never blocks
- [x] Database schema supports tenant billing state persistence
- [x] Configuration supports product-to-plan mappings

### AC-041.02: Event Processing

- [x] Only processes supported billing events (subscription.\_, invoice.payment\_\_)
- [x] Idempotent processing prevents duplicate syncs
- [x] Event normalization extracts relevant billing data
- [x] Tenant isolation maintains multi-tenant security
- [x] Full audit trail for all sync operations

### AC-041.03: State Mapping

- [x] Deterministic mapping: GHL active → NeuronX ACTIVE
- [x] Grace period handling: past_due/unpaid → GRACE
- [x] Blocking enforcement: canceled → BLOCKED
- [x] Product mapping: GHL products → NeuronX plan tiers
- [x] Fallback to default plan when mapping missing

### AC-041.04: Integration & Reliability

- [x] Billing sync service integrates with existing entitlement system
- [x] Webhook failures don't block GHL processing
- [x] Async processing prevents webhook timeouts
- [x] Comprehensive error handling and logging
- [x] Test coverage for all mapping scenarios

## Technical Implementation

### Billing Sync Adapter Architecture

**Core Components:**

```typescript
// Webhook processing
export class GhlBillingWebhookController    // HTTP endpoint for GHL webhooks
export class GhlBillingEventNormalizer      // Converts webhook payloads to events

// Sync logic
export class EntitlementSyncService         // Maps and syncs billing state

// External integration
export class BillingSyncService             // Updates NeuronX entitlement state
```

**Supported Events (Only These):**

```typescript
enum GhlBillingEventType {
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELED = 'subscription.canceled',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  INVOICE_PAYMENT_SUCCEEDED = 'invoice.payment_succeeded',
}
```

**Database Schema:**

```sql
-- Tenant billing state (external sync)
model TenantBillingState {
  tenantId          String   @id
  billingStatus     String   // ACTIVE | GRACE | BLOCKED
  statusReason      String?
  statusUpdatedAt   DateTime
  planTier          String   // FREE | PRO | ENTERPRISE
  planTierReason    String?
  planTierUpdatedAt DateTime
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### Event Processing Flow

**Webhook Reception:**

```typescript
@Post('webhooks/ghl-billing')
async processBillingWebhook(@Body() payload, @Headers() headers) {
  const tenantId = headers['x-tenant-id'];

  // Normalize event (extract billing data)
  const event = this.normalizer.normalizeEvent(payload, tenantId);

  if (!event) return { status: 'ignored' };

  // Check idempotency
  if (await this.syncService.isEventProcessed(event.eventId)) {
    return { status: 'already_processed' };
  }

  // Process asynchronously (fire-and-forget)
  this.processAsync(event);

  return { status: 'accepted' }; // Never fail webhook
}
```

**Async Processing:**

```typescript
private async processAsync(event: NormalizedBillingEvent) {
  try {
    const result = await this.syncService.syncBillingEvent(event);

    // Update NeuronX billing state
    await this.billingSyncService.setBillingStatus(
      result.tenantId,
      result.billingStatus,
      `Synced from GHL ${event.eventType}`
    );

    await this.billingSyncService.setPlanTier(
      result.tenantId,
      result.planTier,
      `Synced from GHL ${event.eventType}`
    );

    // Audit the sync
    await this.auditSync(event, result);

  } catch (error) {
    // Log error but don't retry (webhook already accepted)
    this.logger.error('Billing sync failed', { error, eventId: event.eventId });
  }
}
```

### Deterministic State Mapping

**Subscription Status Mapping:**

```typescript
// GHL → NeuronX billing status
const statusMapping = {
  [GhlSubscriptionStatus.ACTIVE]: BillingStatus.ACTIVE,
  [GhlSubscriptionStatus.TRIALING]: BillingStatus.ACTIVE,
  [GhlSubscriptionStatus.PAST_DUE]: BillingStatus.GRACE,
  [GhlSubscriptionStatus.UNPAID]: BillingStatus.GRACE,
  [GhlSubscriptionStatus.CANCELED]: BillingStatus.BLOCKED,
};
```

**Product to Plan Mapping:**

```typescript
// Configurable mapping (no hardcoding)
const productMappings = [
  { ghlProductId: 'prod_neuronx_free', neuronxPlanTier: 'FREE' },
  { ghlProductId: 'prod_neuronx_pro', neuronxPlanTier: 'PRO' },
  { ghlProductId: 'prod_neuronx_enterprise', neuronxPlanTier: 'ENTERPRISE' },
];

// Fallback for unmapped products
const defaultPlanTier = 'FREE';
```

**Invoice Event Handling:**

```typescript
// Invoice events don't directly change subscription status
// They trigger subscription updates which contain the actual status
if (eventType.includes('invoice.payment_')) {
  // Don't change billing status - wait for subscription event
  return BillingStatus.ACTIVE; // No change
}
```

### Integration with Billing Authority

**Sync Service Integration:**

```typescript
// In billing-entitlements package
@Injectable()
export class BillingSyncService {
  async setBillingStatus(
    tenantId: string,
    status: BillingStatus,
    reason?: string
  ) {
    await this.prisma.tenantBillingState.upsert({
      where: { tenantId },
      update: {
        billingStatus: status,
        statusReason: reason,
        statusUpdatedAt: new Date(),
      },
      create: {
        /* ... */
      },
    });
  }

  async setPlanTier(tenantId: string, planTier: PlanTier, reason?: string) {
    await this.prisma.tenantBillingState.upsert({
      where: { tenantId },
      update: {
        planTier,
        planTierReason: reason,
        planTierUpdatedAt: new Date(),
      },
      create: {
        /* ... */
      },
    });
  }
}
```

**Billing Guard Integration:**

```typescript
// In existing billing guard (WI-040)
async checkExecutionEntitlement(context) {
  // Get current billing state
  const billingState = await this.billingSyncService.getBillingState(tenantId);

  if (!billingState) {
    return { allowed: false, reason: 'No billing state found' };
  }

  // Check billing status
  if (billingState.billingStatus === BillingStatus.BLOCKED) {
    return { allowed: false, reason: 'Billing blocked' };
  }

  if (billingState.billingStatus === BillingStatus.GRACE) {
    // Allow but with warning
    return { allowed: true, reason: 'Grace period active' };
  }

  // Continue with existing logic...
}
```

### Configuration & Deployment

**Environment Variables:**

```bash
# Webhook endpoint
GHL_BILLING_WEBHOOK_PATH=/api/webhooks/ghl-billing

# Product mappings (JSON)
GHL_PRODUCT_MAPPINGS='[
  {"ghlProductId": "prod_neuronx_free", "neuronxPlanTier": "FREE"},
  {"ghlProductId": "prod_neuronx_pro", "neuronxPlanTier": "PRO"}
]'

# Fallback settings
GHL_DEFAULT_PLAN_TIER=FREE
GHL_GRACE_PERIOD_DAYS=7

# Security
GHL_WEBHOOK_SIGNATURE_VERIFICATION=true
```

**GHL Webhook Configuration:**

```json
{
  "url": "https://your-neuronx-instance.com/api/webhooks/ghl-billing",
  "events": [
    "subscription.created",
    "subscription.updated",
    "subscription.canceled",
    "invoice.payment_failed",
    "invoice.payment_succeeded"
  ],
  "secret": "your-webhook-secret"
}
```

### Audit & Monitoring

**Audit Trail:**

```typescript
// Every sync operation creates audit event
await this.prisma.auditLog.create({
  data: {
    tenantId: event.tenantId,
    actorId: 'ghl-billing-sync',
    actorType: 'system',
    action: 'billing_sync_completed',
    resourceType: 'billing_entitlement',
    resourceId: event.tenantId,
    oldValues: previousState,
    newValues: {
      billingStatus: newStatus,
      planTier: newPlanTier,
    },
    changes: {
      ghlEventId: event.eventId,
      ghlEventType: event.eventType,
      ghlAccountId: event.ghlAccountId,
      subscriptionId: event.subscriptionId,
    },
  },
});
```

**Monitoring Metrics:**

```typescript
// Key metrics for observability
billing_webhook_received_total{event_type}
billing_sync_completed_total{status}
billing_sync_failed_total{reason}
billing_status_changed_total{from_status, to_status}
```

### Error Handling & Reliability

**Webhook Failure Handling:**

```typescript
// Always return success to GHL
@Post()
async processBillingWebhook(@Body() payload, @Headers() headers) {
  try {
    // Process webhook...
    return { status: 'accepted' };
  } catch (error) {
    // Log error but return success
    this.logger.error('Webhook processing failed', { error });
    return { status: 'accepted_with_error', error: error.message };
  }
}
```

**Sync Failure Handling:**

```typescript
// Async processing with error isolation
private async processAsync(event) {
  try {
    await this.syncService.syncBillingEvent(event);
  } catch (error) {
    // Log but don't retry - webhook already accepted
    // Alert engineering team for investigation
    this.alertService.sendAlert('Billing sync failed', {
      eventId: event.eventId,
      tenantId: event.tenantId,
      error: error.message
    });
  }
}
```

**Idempotency:**

```typescript
// Prevent duplicate processing
async isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await this.prisma.auditLog.findFirst({
    where: {
      action: 'billing_sync_completed',
      'metadata.correlationId': `billing_sync_${eventId}`
    }
  });
  return !!existing;
}
```

## Testing Strategy

### Unit Tests (95%+ Coverage)

- **Event Normalizer**: All event types, payload variations, error cases
- **Sync Service**: State mapping, product mapping, audit logging
- **Webhook Controller**: Success responses, error handling, async processing
- **Billing Sync Service**: State persistence, status queries, error handling

### Integration Tests

- **End-to-End Sync**: Webhook → normalization → sync → billing state update
- **State Transitions**: All billing status changes, plan tier updates
- **Idempotency**: Duplicate webhook processing prevention
- **Multi-Tenant**: Tenant isolation and proper scoping

### Event Mapping Tests

```typescript
// Test all subscription status mappings
const testCases = [
  { ghlStatus: 'active', neuronxStatus: 'ACTIVE' },
  { ghlStatus: 'past_due', neuronxStatus: 'GRACE' },
  { ghlStatus: 'canceled', neuronxStatus: 'BLOCKED' },
  // ... all mappings
];

testCases.forEach(({ ghlStatus, neuronxStatus }) => {
  const event = createSubscriptionEvent(ghlStatus);
  const result = await syncService.syncBillingEvent(event);
  expect(result.billingStatus).toBe(neuronxStatus);
});
```

## Success Metrics

### Technical Metrics

- **Webhook Processing**: <100ms average response time (always success)
- **Sync Completion**: >99.9% successful sync operations
- **State Consistency**: 100% billing state matches GHL
- **Audit Completeness**: 100% sync operations audited
- **Error Rate**: <0.1% sync processing failures

### Business Metrics

- **Billing Sync Lag**: <5 minutes average sync delay
- **Status Accuracy**: 100% billing status matches GHL
- **Entitlement Enforcement**: 100% execution blocks match billing state
- **Customer Impact**: Zero blocked customers with active subscriptions
- **Operational Overhead**: Zero manual billing state corrections

## Future Extensions

### Advanced Features

- **Real-time Sync**: Streaming billing updates instead of webhooks
- **Custom Mappings**: API for tenant-specific product mappings
- **Billing Analytics**: Usage patterns and billing optimization insights
- **Multi-Currency**: Support for international billing scenarios
- **Billing Alerts**: Proactive notifications for billing events

### Enterprise Features

- **Bulk Operations**: Mass billing state updates for migrations
- **Audit Exports**: Regulatory-compliant billing audit reports
- **Billing History**: Complete billing lifecycle tracking
- **Integration APIs**: REST APIs for billing system integration
- **Billing Webhooks**: Outbound webhooks for billing events

## Implementation Notes

### Security Considerations

- Webhook signature verification (when enabled)
- Tenant ID validation and isolation
- Audit log integrity and immutability
- No sensitive billing data logging
- Rate limiting for webhook endpoints

### Performance Optimizations

- Async processing prevents webhook timeouts
- Database indexing for fast billing state queries
- Connection pooling for reliable database access
- Caching for frequently accessed billing state
- Batch processing for high-volume webhook scenarios

### Operational Considerations

- Monitoring dashboard for sync health
- Alerting for sync failures and anomalies
- Runbooks for billing sync incident response
- Backup and recovery procedures for billing state
- Regular audits of billing state consistency

This implementation creates a clean, reliable bridge between GHL's billing system and NeuronX's entitlement authority, enabling automated billing lifecycle management while maintaining strict separation of concerns.

**Key Achievement**: GHL owns billing/money, NeuronX owns execution authority, with reliable sync between them.

**Business Outcome**: Automated billing lifecycle eliminates manual intervention and ensures billing state always matches execution entitlements.
