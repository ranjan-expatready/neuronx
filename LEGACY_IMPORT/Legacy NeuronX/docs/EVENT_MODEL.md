# Event Model

## Event Naming Conventions

Events follow a structured naming convention: `domain.entity.action`

**Format:** `{domain}.{entity}.{action}`

- **domain**: Business area (lead, opportunity, campaign, workflow)
- **entity**: Primary object (lead, contact, account, process)
- **action**: What happened (created, updated, scored, assigned, triggered)

**Examples:**

- `lead.contact.created` - New lead contact ingested
- `lead.score.computed` - Lead scoring calculation completed
- `workflow.sequence.triggered` - Workflow sequence initiated
- `campaign.email.sent` - Campaign email delivered

**Rules:**

- Use past tense for actions (created, not create)
- Be specific about the action (computed, not calculated)
- Group related events under consistent domains

## Core Domain Events

### Lead Events

- `lead.contact.ingested` - New lead data received from external source
- `lead.contact.updated` - Lead contact information modified
- `lead.score.computed` - Lead scoring algorithm executed
- `lead.segment.assigned` - Lead assigned to sales segment/territory
- `lead.owner.assigned` - Lead assigned to sales representative
- `lead.qualification.updated` - Lead qualification status changed

### Opportunity Events

- `opportunity.created` - New sales opportunity initiated
- `opportunity.stage.updated` - Opportunity moved to new sales stage
- `opportunity.value.updated` - Opportunity value or forecast changed
- `opportunity.closed.won` - Opportunity successfully closed
- `opportunity.closed.lost` - Opportunity lost

### Workflow Events

- `workflow.rule.triggered` - Business rule condition met
- `workflow.sequence.started` - Workflow sequence initiated
- `workflow.task.created` - New workflow task generated
- `workflow.task.completed` - Workflow task marked complete
- `workflow.sequence.completed` - Entire workflow sequence finished

### Communication Events

- `communication.email.sent` - Email message delivered
- `communication.email.opened` - Email opened by recipient
- `communication.email.clicked` - Email link clicked
- `communication.call.completed` - Phone call finished
- `communication.meeting.scheduled` - Meeting appointment created

### System Events

- `system.config.updated` - Configuration setting changed
- `system.rule.activated` - Business rule enabled
- `system.rule.deactivated` - Business rule disabled
- `system.adapter.connected` - External adapter connection established
- `system.adapter.disconnected` - External adapter connection lost

## Idempotency Rules

### Idempotency Key Strategy

Each event includes an optional `idempotencyKey` in metadata for duplicate prevention.

**Key Generation Rules:**

- **External Events**: Use external system's unique identifier
- **Internal Events**: Generate UUID for state changes
- **Retry Events**: Reuse original idempotency key
- **Batch Events**: Include batch identifier in key

**Idempotency Window:**

- Events are deduplicated within 24-hour sliding window
- Duplicate detection based on tenant + idempotencyKey
- Duplicate events are acknowledged but not reprocessed

### Duplicate Handling

```typescript
// Event processing with idempotency
if (await isEventProcessed(tenantId, event.idempotencyKey)) {
  return { status: 'duplicate', originalEventId: existingId };
}

// Process event
const result = await processEvent(event);

// Mark as processed
await markEventProcessed(tenantId, event.idempotencyKey, event.id);
```

## Audit + Replay Strategy

### Event Storage

Events are stored immutably with complete audit trail:

**Storage Structure:**

- Primary key: tenant_id + event_id
- Secondary index: tenant_id + timestamp
- Full event payload preserved
- Metadata includes processing timestamps

**Retention Policy:**

- Hot storage: 90 days (frequent access)
- Warm storage: 1 year (occasional access)
- Cold storage: 7 years (compliance retention)

### Replay Capability

System supports full event replay for:

**Use Cases:**

- **State Reconstruction**: Rebuild entity state from event history
- **Debugging**: Replay events to reproduce issues
- **Testing**: Replay scenarios for regression testing
- **Migration**: Replay events in new system versions

**Replay Rules:**

- Replay preserves original event timestamps
- Replay generates new event IDs but keeps original metadata
- Replay is scoped to tenant/workspace boundaries
- Replay operations are auditable

### Audit Trail

Every event contributes to the audit trail:

**Audit Properties:**

- **Who**: Actor ID and type
- **What**: Event type and data changes
- **When**: Exact timestamp with timezone
- **Where**: Tenant/workspace context
- **Why**: Correlation ID linking related events
- **How**: Processing result and any errors

## GoHighLevel Event Mapping

### Thin Trigger Only

GHL adapters generate minimal trigger events only. No business logic in adapters.

**GHL Event Sources:**

- **Webhook Events**: `ghl.webhook.received` (raw payload)
- **API Polling**: `ghl.contact.updated` (polled changes)
- **Workflow Triggers**: `ghl.workflow.triggered` (GHL workflow start)

**Mapping to NeuronX Events:**

```typescript
// GHL webhook → NeuronX event
ghlAdapter.onWebhook(payload) {
  const event = {
    type: 'lead.contact.ingested',
    data: transformGHLToNeuronX(payload),
    metadata: {
      source: 'ghl',
      originalId: payload.id,
      idempotencyKey: payload.external_id
    }
  };
  publishEvent(event);
}
```

### Event Flow Pattern

1. **GHL Action** → External webhook/API call
2. **Adapter Reception** → Raw data ingestion
3. **Event Publication** → Typed NeuronX event
4. **Rule Evaluation** → Business logic execution
5. **State Update** → Entity state changes
6. **Command Generation** → Action commands created
7. **Adapter Execution** → Commands sent to GHL/other systems

### Adapter Isolation

- GHL adapters never contain business rules
- GHL-specific logic stays in adapter layer
- Event transformation is declarative/configurable
- Adapter failures don't corrupt core business logic

## Event Processing Architecture

### Event Bus

Central event processing system with:

**Guarantees:**

- At-least-once delivery (retries on failure)
- Ordered processing within tenant
- Parallel processing across tenants
- Dead letter queue for unprocessable events

### Event Handlers

Typed event handlers for each domain:

**Handler Pattern:**

```typescript
interface EventHandler {
  eventTypes: string[];
  priority: number;
  handle(event: Event): Promise<void>;
}
```

### Event Sourcing

All state changes are event-sourced:

**State Reconstruction:**

```typescript
// Rebuild lead state from events
const leadState = await reconstructState(leadId, [
  'lead.contact.created',
  'lead.contact.updated',
  'lead.score.computed',
  'lead.owner.assigned',
]);
```

### Event Versioning

Events support versioning for schema evolution:

**Version Handling:**

- Event schema versions in metadata
- Backward-compatible event processing
- Migration scripts for schema changes
- Version validation on event ingestion
