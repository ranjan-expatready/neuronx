# Webhooks and Events

**Last verified:** 2026-01-03
**Sources:** [GHL Webhooks](https://developers.gohighlevel.com/reference/webhooks), [Webhook Events](https://developers.gohighlevel.com/reference/webhook-events)

## Webhook Architecture

GoHighLevel provides real-time event notifications via webhooks to keep external systems synchronized with data changes.

### Webhook Delivery

- **Protocol:** HTTP POST with JSON payload
- **Retries:** Up to 5 attempts with exponential backoff
- **Timeout:** 10 second timeout per attempt
- **Signature:** HMAC-SHA256 signature for verification
- **Idempotency:** Each webhook includes unique event ID

### Security Headers

```javascript
// Every webhook request includes:
{
  'X-Webhook-Signature': 'sha256=abc123...',  // HMAC signature
  'X-Request-Id': 'req_1234567890',           // Unique request ID
  'User-Agent': 'GHL-Webhook/1.0'
}
```

### Signature Verification

```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}
```

## Core Webhook Events

### Contact Events

| Event                 | Trigger           | Payload Key Fields                   | NeuronX Mapping            |
| --------------------- | ----------------- | ------------------------------------ | -------------------------- |
| `contact.created`     | New contact added | `id`, `email`, `phone`, `locationId` | `neuronx.contact.ingested` |
| `contact.updated`     | Contact modified  | `id`, `changes[]`, `locationId`      | `neuronx.contact.updated`  |
| `contact.deleted`     | Contact removed   | `id`, `locationId`                   | `neuronx.contact.deleted`  |
| `contact.tag.added`   | Tag applied       | `id`, `tag`, `locationId`            | `neuronx.contact.tagged`   |
| `contact.tag.removed` | Tag removed       | `id`, `tag`, `locationId`            | `neuronx.contact.untagged` |

**Source:** [Contact Webhooks](https://developers.gohighlevel.com/reference/contact-webhooks)

### Opportunity Events

| Event                       | Trigger             | Payload Key Fields                            | NeuronX Mapping                     |
| --------------------------- | ------------------- | --------------------------------------------- | ----------------------------------- |
| `opportunity.created`       | New opportunity     | `id`, `contactId`, `pipelineId`, `value`      | `neuronx.opportunity.created`       |
| `opportunity.updated`       | Opportunity changed | `id`, `changes[]`, `oldValue`, `newValue`     | `neuronx.opportunity.updated`       |
| `opportunity.deleted`       | Opportunity removed | `id`, `contactId`                             | `neuronx.opportunity.deleted`       |
| `opportunity.stage_changed` | Stage progression   | `id`, `oldStageId`, `newStageId`, `contactId` | `neuronx.opportunity.stage_changed` |

**Source:** [Opportunity Webhooks](https://developers.gohighlevel.com/reference/opportunity-webhooks)

### Communication Events

| Event                           | Trigger          | Payload Key Fields                      | NeuronX Mapping                       |
| ------------------------------- | ---------------- | --------------------------------------- | ------------------------------------- |
| `conversation.created`          | New conversation | `id`, `contactId`, `type`, `locationId` | `neuronx.conversation.started`        |
| `conversation.message.sent`     | Message sent     | `conversationId`, `messageId`, `type`   | `neuronx.message.sent`                |
| `conversation.message.received` | Message received | `conversationId`, `messageId`, `type`   | `neuronx.message.received`            |
| `conversation.status_changed`   | Status update    | `id`, `oldStatus`, `newStatus`          | `neuronx.conversation.status_changed` |

**Source:** [Conversation Webhooks](https://developers.gohighlevel.com/reference/conversation-webhooks)

### Calendar Events

| Event                      | Trigger               | Payload Key Fields                        | NeuronX Mapping                 |
| -------------------------- | --------------------- | ----------------------------------------- | ------------------------------- |
| `calendar.event.created`   | Appointment booked    | `id`, `contactId`, `startTime`, `endTime` | `neuronx.appointment.booked`    |
| `calendar.event.updated`   | Appointment changed   | `id`, `changes[]`, `contactId`            | `neuronx.appointment.updated`   |
| `calendar.event.cancelled` | Appointment cancelled | `id`, `contactId`, `reason`               | `neuronx.appointment.cancelled` |
| `calendar.event.completed` | Appointment finished  | `id`, `contactId`, `duration`             | `neuronx.appointment.completed` |

**Source:** [Calendar Webhooks](https://developers.gohighlevel.com/reference/calendar-webhooks)

### Workflow Events

| Event                     | Trigger           | Payload Key Fields                   | NeuronX Mapping                   |
| ------------------------- | ----------------- | ------------------------------------ | --------------------------------- |
| `workflow.triggered`      | Workflow started  | `workflowId`, `contactId`, `trigger` | `neuronx.workflow.started`        |
| `workflow.step.completed` | Step finished     | `workflowId`, `stepId`, `contactId`  | `neuronx.workflow.step_completed` |
| `workflow.completed`      | Workflow finished | `workflowId`, `contactId`, `outcome` | `neuronx.workflow.completed`      |
| `workflow.failed`         | Workflow error    | `workflowId`, `contactId`, `error`   | `neuronx.workflow.failed`         |

**Source:** [Workflow Webhooks](https://developers.gohighlevel.com/reference/workflow-webhooks)

## Webhook Payload Structure

### Standard Payload Format

```json
{
  "event": "contact.created",
  "locationId": "loc_123",
  "companyId": "comp_456",
  "timestamp": "2024-01-03T10:30:00Z",
  "data": {
    // Event-specific data
    "id": "contact_789",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "metadata": {
    "webhookId": "web_123",
    "attempt": 1,
    "deliveredAt": "2024-01-03T10:30:05Z"
  }
}
```

### Event-Specific Payloads

#### Contact Created

```json
{
  "event": "contact.created",
  "locationId": "loc_123",
  "data": {
    "id": "contact_789",
    "email": "john@example.com",
    "phone": "+1234567890",
    "firstName": "John",
    "lastName": "Doe",
    "tags": ["lead", "website"],
    "customFields": {
      "source": "website",
      "company_size": "50-100"
    }
  }
}
```

#### Opportunity Stage Changed

```json
{
  "event": "opportunity.stage_changed",
  "locationId": "loc_123",
  "data": {
    "id": "opp_456",
    "contactId": "contact_789",
    "pipelineId": "pipe_123",
    "oldStageId": "stage_001",
    "newStageId": "stage_002",
    "oldStageName": "New Lead",
    "newStageName": "Contacted",
    "value": 5000,
    "currency": "USD"
  }
}
```

#### Conversation Message

```json
{
  "event": "conversation.message.received",
  "locationId": "loc_123",
  "data": {
    "conversationId": "conv_789",
    "messageId": "msg_456",
    "contactId": "contact_123",
    "type": "sms",
    "direction": "inbound",
    "message": "I'm interested in your services",
    "attachments": []
  }
}
```

## Recommended Webhooks for NeuronX MVP

### Essential Webhooks (Must Implement)

1. **contact.created** - Lead ingestion trigger
2. **contact.updated** - Contact data synchronization
3. **opportunity.created** - Deal tracking initialization
4. **opportunity.stage_changed** - Pipeline progression monitoring
5. **conversation.message.received** - Communication orchestration

### Important Webhooks (Should Implement)

1. **contact.tag.added/removed** - Segmentation updates
2. **calendar.event.created** - Appointment booking notifications
3. **workflow.triggered** - Automation monitoring
4. **conversation.created** - Communication thread tracking

### Optional Webhooks (Nice to Have)

1. **contact.deleted** - Cleanup operations
2. **opportunity.deleted** - Deal closure handling
3. **workflow.completed** - Process completion tracking

## Webhook Implementation Strategy

### Endpoint Design

```javascript
// Single webhook endpoint handles all events
app.post('/webhooks/ghl', async (req, res) => {
  try {
    // 1. Verify signature
    const signature = req.headers['x-webhook-signature'];
    const isValid = verifySignature(req.body, signature, WEBHOOK_SECRET);

    if (!isValid) {
      return res.status(401).send('Invalid signature');
    }

    // 2. Process event
    const { event, locationId, data } = req.body;

    // 3. Route to event handler
    await handleWebhookEvent(event, locationId, data);

    // 4. Acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Internal error');
  }
});
```

### Event Handler Pattern

```javascript
const eventHandlers = {
  'contact.created': async (locationId, data) => {
    // Transform to NeuronX event
    const neuronxEvent = {
      type: 'neuronx.contact.ingested',
      tenantId: await getTenantFromLocation(locationId),
      data: {
        externalId: data.id,
        email: data.email,
        source: 'ghl_webhook',
        locationId,
      },
    };

    await eventBus.publish(neuronxEvent);
  },

  'opportunity.stage_changed': async (locationId, data) => {
    const neuronxEvent = {
      type: 'neuronx.opportunity.stage_changed',
      tenantId: await getTenantFromLocation(locationId),
      data: {
        externalId: data.id,
        contactId: data.contactId,
        oldStage: data.oldStageName,
        newStage: data.newStageName,
        value: data.value,
      },
    };

    await eventBus.publish(neuronxEvent);
  },
};
```

### Retry and Idempotency Handling

#### Idempotency Strategy

```javascript
async function handleWebhookEvent(eventType, eventId, data) {
  // Check if event already processed
  const processed = await redis.get(`webhook:${eventId}`);

  if (processed) {
    console.log(`Webhook ${eventId} already processed, skipping`);
    return;
  }

  // Process event
  await eventHandlers[eventType](data);

  // Mark as processed (with TTL)
  await redis.setex(`webhook:${eventId}`, 86400, 'processed'); // 24 hours
}
```

#### Failure Recovery

```javascript
async function processWebhookWithRetry(webhookData, attempt = 1) {
  try {
    await processWebhook(webhookData);
  } catch (error) {
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      setTimeout(() => {
        processWebhookWithRetry(webhookData, attempt + 1);
      }, delay);
    } else {
      // Log permanent failure
      console.error('Webhook processing failed permanently:', webhookData);
    }
  }
}
```

## Testing and Debugging

### Webhook Testing Strategy

```javascript
// Mock webhook for testing
const testWebhook = {
  event: 'contact.created',
  locationId: 'loc_test',
  companyId: 'comp_test',
  timestamp: new Date().toISOString(),
  data: {
    id: 'contact_test_123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  },
};

// Test signature verification
const signature = createSignature(testWebhook, WEBHOOK_SECRET);
const isValid = verifySignature(testWebhook, signature, WEBHOOK_SECRET);
```

### Debug Headers

Always log these headers for troubleshooting:

- `X-Webhook-Signature`
- `X-Request-Id`
- `User-Agent`

### Common Issues

1. **Signature Verification Fails** - Check webhook secret configuration
2. **Duplicate Events** - Implement idempotency checks
3. **Missing Events** - Verify webhook URLs are registered correctly
4. **Payload Parsing Errors** - Validate JSON structure before processing

## NeuronX Event Mapping

| GHL Event                       | NeuronX Event                    | Purpose                      |
| ------------------------------- | -------------------------------- | ---------------------------- |
| `contact.created`               | `neuronx.contact.ingested`       | Lead ingestion pipeline      |
| `opportunity.stage_changed`     | `neuronx.opportunity.progressed` | Pipeline automation triggers |
| `conversation.message.received` | `neuronx.communication.received` | Response orchestration       |
| `calendar.event.created`        | `neuronx.appointment.scheduled`  | Follow-up sequence triggers  |

This webhook system provides real-time synchronization between GHL and NeuronX, enabling event-driven architectures and immediate response to business-critical changes.
