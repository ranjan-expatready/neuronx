# 0011: AWS SQS/SNS Event and Queue System

## Status

Accepted

## Context

NeuronX requires a reliable, scalable messaging system for:

- **Event Distribution**: Reliable event publishing across services and tenants
- **Async Processing**: Decoupling heavy operations from API responses
- **Inter-Service Communication**: Clean service boundaries with message passing
- **Outbox Pattern**: Guaranteed event delivery with transaction consistency
- **Multi-Tenant Isolation**: Tenant-scoped message routing and processing
- **Failure Recovery**: Dead letter queues and retry mechanisms
- **Observability**: Message tracing and performance monitoring

Messaging system choice impacts:

- Reliability of event-driven workflows
- System decoupling and scalability
- Operational complexity and monitoring
- Cost of infrastructure and message volume
- Integration with existing AWS ecosystem
- Future cloud provider flexibility

Poor messaging choice leads to:

- Lost events and inconsistent state
- Tight coupling between services
- Performance bottlenecks under load
- Complex error handling and debugging
- High operational overhead
- Vendor lock-in challenges

## Decision

Adopt AWS SQS (Simple Queue Service) and SNS (Simple Notification Service) for event distribution and queuing, abstracted behind clean interfaces.

**Architecture Pattern:**

- **SNS Topics**: Event publishing and fan-out to multiple subscribers
- **SQS Queues**: Reliable message processing with visibility timeouts
- **EventBridge**: Advanced routing rules and event transformation
- **Outbox Tables**: Transactional event publishing guarantee

**Abstraction Layer:**

- **EventPublisher**: Abstract interface for event publishing
- **MessageConsumer**: Abstract interface for message processing
- **EventBus**: High-level event routing and filtering
- **OutboxProcessor**: Background job for reliable publishing

## Consequences

### Positive

- **Reliability**: At-least-once delivery with configurable retries
- **Scalability**: Virtually unlimited throughput and storage
- **AWS Integration**: Seamless integration with other AWS services
- **Cost Effective**: Pay-per-use pricing scales with usage
- **Observability**: Comprehensive monitoring and tracing
- **Enterprise Proven**: Used by major companies at massive scale
- **Multi-Tenant Ready**: Topic/queue isolation per tenant or service

### Negative

- **AWS Lock-in**: Tied to AWS ecosystem and pricing
- **Latency**: Cross-region communication adds milliseconds
- **Complexity**: Multiple services (SNS, SQS, EventBridge) to manage
- **Cost Monitoring**: Message volume can drive costs unexpectedly
- **Debugging**: Distributed message flow harder to trace
- **Cold Starts**: Lambda processing can have startup latency

### Risks

- **Message Loss**: Improper configuration can lead to lost messages
- **Duplicate Processing**: At-least-once delivery requires idempotency
- **Throttling**: AWS limits can cause processing delays
- **Cost Spikes**: Unexpected usage patterns can increase costs
- **Regional Failures**: Cross-region replication complexity

## Alternatives Considered

### Alternative 1: RabbitMQ

- **Pros**: Feature-rich, flexible routing, proven messaging
- **Cons**: Self-managed operational complexity, scaling challenges
- **Rejected**: Operational overhead and AWS integration advantages

### Alternative 2: Apache Kafka

- **Pros**: High throughput, durable storage, stream processing
- **Cons**: Complex operations, high resource requirements, steep learning curve
- **Rejected**: Operational complexity for current scale requirements

### Alternative 3: Redis Streams

- **Pros**: Simple, fast, integrated with existing Redis usage
- **Cons**: Durability concerns, scaling limitations, single-region
- **Rejected**: Durability and scaling concerns for enterprise messaging

### Alternative 4: Google Pub/Sub

- **Pros**: Reliable, scalable, good integration with GCP
- **Cons**: Vendor lock-in to different cloud provider
- **Rejected**: Prefer AWS ecosystem consistency

## Implementation Strategy

### Event Publishing Pattern

```typescript
// Abstract interface
interface EventPublisher {
  publish(event: NeuronxEvent): Promise<void>;
  publishBatch(events: NeuronxEvent[]): Promise<void>;
}

// SNS implementation
class SnsEventPublisher implements EventPublisher {
  async publish(event: NeuronxEvent): Promise<void> {
    const topicArn = this.getTopicArn(event.tenantId);
    await this.sns
      .publish({
        TopicArn: topicArn,
        Message: JSON.stringify(event),
        MessageAttributes: {
          eventType: { DataType: 'String', StringValue: event.type },
          tenantId: { DataType: 'String', StringValue: event.tenantId },
        },
      })
      .promise();
  }
}
```

### Message Processing Pattern

```typescript
// Abstract interface
interface MessageConsumer {
  process(message: SQSMessage): Promise<void>;
}

// SQS consumer implementation
class SqsMessageConsumer implements MessageConsumer {
  async process(message: SQSMessage): Promise<void> {
    const event = JSON.parse(message.Body);
    await this.eventHandler.handle(event);

    // Delete message after successful processing
    await this.sqs
      .deleteMessage({
        QueueUrl: this.queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      })
      .promise();
  }
}
```

### Outbox Pattern Implementation

```sql
-- Outbox table for transactional publishing
CREATE TABLE event_outbox (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  event_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0
);

-- Background processor
class OutboxProcessor {
  async processPendingEvents(): Promise<void> {
    const pendingEvents = await this.db.eventOutbox.findMany({
      where: { status: 'pending' },
      take: 100
    });

    for (const outboxEvent of pendingEvents) {
      try {
        await this.publisher.publish(outboxEvent.eventData);
        await this.db.eventOutbox.update({
          where: { id: outboxEvent.id },
          data: { status: 'published', publishedAt: new Date() }
        });
      } catch (error) {
        await this.handlePublishFailure(outboxEvent, error);
      }
    }
  }
}
```

### Multi-Tenant Message Routing

- **Topic per Service**: Core API, Adapters, Control Plane
- **Queue per Consumer**: Each service has dedicated queues
- **Tenant Filtering**: Message attributes for tenant-based routing
- **Dead Letter Queues**: Failed message handling and alerting

### Reliability Features

- **Visibility Timeouts**: Prevent duplicate processing
- **Dead Letter Queues**: Failed message isolation and alerting
- **Retry Policies**: Exponential backoff with maximum attempts
- **Idempotency**: Duplicate message detection and handling
- **Monitoring**: Message throughput, latency, and error rates

### Cost Optimization

- **Batch Operations**: Publish multiple messages together
- **Long Polling**: Reduce empty receive calls
- **Message Deduplication**: Prevent duplicate message processing
- **Queue Cleanup**: Remove unused queues and topics

## Related ADRs

- 0005: Core Engine is Event-Driven
- 0008: NestJS Backend Framework
- 0012: OpenTelemetry and Sentry Observability

## Notes

AWS SQS/SNS provides the reliable, scalable messaging foundation required for NeuronX's event-driven architecture. The abstraction layer ensures clean interfaces while leveraging AWS's proven infrastructure.

Key success factors:

- Proper abstraction layer prevents AWS lock-in
- Comprehensive monitoring and alerting for message flows
- Cost monitoring and optimization strategies
- Idempotency handling for reliable processing
- Multi-tenant message isolation and routing
- Outbox pattern for transactional consistency

The messaging choice enables NeuronX to build a loosely-coupled, event-driven system that can scale across tenants and services while maintaining reliability and observability.
