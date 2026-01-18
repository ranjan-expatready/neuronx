# 0005: Core Engine is Event-Driven

## Status

Accepted

## Context

NeuronX requires a robust, scalable architecture that can handle complex sales orchestration while maintaining auditability, replay capability, and strong consistency guarantees. The system must support:

- Multi-tenant isolation with data consistency
- Complex business workflows with conditional logic
- Real-time event processing with guaranteed delivery
- Complete audit trails for compliance and debugging
- Ability to replay historical events for state reconstruction
- High availability with failure recovery

Traditional request-response architectures struggle with:

- Complex orchestration scenarios requiring coordination
- Maintaining consistency across distributed operations
- Providing complete audit trails for regulatory compliance
- Scaling to handle high-volume event processing
- Supporting replay and debugging capabilities

Event-driven architecture provides the foundation for all these requirements by making events the primary mechanism for state changes and inter-component communication.

## Decision

NeuronX core engine will be built on an event-driven architecture where:

- **All State Changes Are Events**: No direct database mutations; all changes flow through events
- **Event Sourcing**: Current state is derived from event history, enabling replay and audit
- **Event-First Processing**: Business logic reacts to events, not API calls
- **Immutable Event Store**: Events are never modified once published
- **Tenant-Scoped Event Streams**: Events are isolated within tenant boundaries
- **Guaranteed Delivery**: At-least-once delivery with idempotency handling

## Consequences

### Positive

- **Auditability**: Complete audit trail of all system changes with full context
- **Replay Capability**: Ability to reconstruct state and debug issues by replaying events
- **Scalability**: Loose coupling enables horizontal scaling of event processors
- **Consistency**: Eventual consistency with strong ordering guarantees within tenants
- **Testability**: Event-driven testing enables deterministic scenario validation
- **Evolution**: Easy to add new event handlers without breaking existing functionality

### Negative

- **Complexity**: Event-driven systems require careful design of event schemas and handlers
- **Debugging**: Event flows can be harder to trace than direct API calls
- **Latency**: Event processing introduces additional steps in request paths
- **Learning Curve**: Team needs to understand event-driven patterns and CQRS
- **Storage**: Event storage grows over time, requiring retention policies

### Risks

- **Event Schema Evolution**: Breaking changes to event schemas require migration strategies
- **Event Ordering**: Ensuring correct event ordering in distributed systems
- **Duplicate Events**: Handling network failures that cause event duplication
- **Event Storm**: Recursive event generation causing infinite loops

## Alternatives Considered

### Alternative 1: Traditional CRUD Architecture

- **Pros**: Simple, familiar patterns, direct state management
- **Cons**: Poor auditability, difficult replay, tight coupling, scaling challenges
- **Rejected**: Doesn't meet auditability and replay requirements for enterprise sales

### Alternative 2: Saga Pattern for Orchestration

- **Pros**: Good for distributed transactions, clear orchestration flows
- **Cons**: Complex state management, limited audit capabilities, hard to replay
- **Rejected**: Sagas are complementary but don't provide the full audit and replay capabilities needed

### Alternative 3: Actor Model

- **Pros**: Strong consistency, isolation, fault tolerance
- **Cons**: Complex concurrency management, steep learning curve, limited ecosystem
- **Rejected**: While powerful, introduces unnecessary complexity for this domain

### Alternative 4: Hybrid Event-Driven with Direct State

- **Pros**: Balances simplicity with event benefits for key operations
- **Cons**: Inconsistent auditability, mixed paradigms, harder testing
- **Rejected**: Creates architectural inconsistency and weakens audit guarantees

## Implementation Strategy

### Event Store Design

- **Single Table Per Tenant**: tenant_events table with indexed event streams
- **Event Schema**: Structured JSON with versioned schemas
- **Indexing Strategy**: tenant_id + timestamp + event_type for efficient querying
- **Retention**: Hot (90 days), Warm (1 year), Cold (7 years) storage tiers

### Event Processing Pipeline

```typescript
// Event ingestion and processing
async function processEvent(event: NeuronxEvent): Promise<void> {
  // 1. Validate event schema and tenant context
  await validateEvent(event);

  // 2. Store event immutably
  await storeEvent(event);

  // 3. Route to appropriate handlers
  const handlers = await getEventHandlers(event.type);
  await Promise.all(handlers.map(h => h.handle(event)));

  // 4. Update derived state
  await updateDerivedState(event);
}
```

### Idempotency Handling

- **Idempotency Keys**: Client-provided keys for duplicate detection
- **Time Windows**: 24-hour sliding window for duplicate detection
- **Safe Retries**: Idempotent operations that can be repeated safely

### Event Replay Capabilities

- **State Reconstruction**: Replay events to rebuild entity state
- **Debugging**: Replay specific event sequences to reproduce issues
- **Migration**: Replay events through updated business logic
- **Testing**: Deterministic test execution through event replay

## Related ADRs

- 0006: Tenant isolation strategy
- 0007: Adapter-first vendor integration
- 0002: GoHighLevel as execution layer

## Notes

This event-driven foundation enables NeuronX to:

1. **Maintain Perfect Audit Trails**: Every state change is traceable through events
2. **Support Complex Orchestration**: Rules and workflows react to events naturally
3. **Enable Replay and Debugging**: Historical events can reconstruct any state
4. **Scale Horizontally**: Event processors can be scaled independently
5. **Evolve Safely**: New event handlers can be added without breaking existing flows

Key implementation principles:

- Events are the source of truth, not database state
- All business logic is event-driven
- Event schemas are versioned and backward-compatible
- Event processing is idempotent and retryable
- Event streams are tenant-isolated but globally ordered

Migration considerations:

- Existing state needs event sourcing during transition
- Event schemas must accommodate legacy data structures
- Gradual rollout of event-driven components
- Backward compatibility during transition period
