# 0007: Adapter-First Vendor Integration

## Status

Accepted

## Context

NeuronX must integrate with external systems (GoHighLevel, CRM platforms, communication services) while maintaining architectural purity and future flexibility. The integration strategy impacts:

- **Vendor Lock-in**: Ability to switch platforms without rewriting core logic
- **Business Logic Leakage**: Preventing sales intelligence from leaking into adapters
- **Maintenance Burden**: Managing external API changes and deprecations
- **Testing Complexity**: Validating integrations without external dependencies
- **Evolution Speed**: Adding new integrations without core system changes
- **Platform Independence**: Supporting multiple execution platforms simultaneously

Poor integration design leads to:

- Tight coupling between NeuronX core and external systems
- Business logic scattered across adapter code
- Difficult platform migrations and vendor switches
- Fragile integrations that break with external changes
- Testing challenges requiring external service mocking
- Architectural debt that hinders SaaS evolution

Adapter-first integration ensures clean separation between NeuronX intelligence and external execution platforms.

## Decision

Implement **adapter-first integration** where:

- **Adapters Are Stateless Protocol Translators**: No business logic, only data transformation
- **NeuronX Commands Drive Execution**: Core system sends execution commands to adapters
- **Event-Driven Communication**: External events become NeuronX events through adapters
- **Contract-Based Interfaces**: Strict contracts define adapter capabilities and boundaries
- **Configuration-Driven Behavior**: Adapter behavior controlled by tenant configuration
- **Testable Isolation**: Adapters tested independently of core business logic

## Consequences

### Positive

- **Platform Independence**: Easy switching between execution platforms
- **Clean Architecture**: Business logic remains in core, adapters are pure translation
- **Testability**: Adapters tested in isolation with mocked external services
- **Maintainability**: External API changes isolated to adapter layer
- **Scalability**: Adapters can be scaled independently of core logic
- **Evolution Flexibility**: New integrations don't require core changes

### Negative

- **Development Overhead**: Additional abstraction layer for each integration
- **Performance Impact**: Command translation adds latency to execution paths
- **Complexity**: Understanding the full flow requires tracing through adapters
- **Contract Management**: Strict contracts require careful version management
- **Testing Burden**: Contract tests required for each adapter type

### Risks

- **Contract Drift**: Adapter implementations diverging from contracts
- **Performance Bottlenecks**: Adapter layer becoming a bottleneck
- **Inconsistent Behavior**: Different adapters handling same commands differently
- **Version Compatibility**: Adapter version mismatches causing failures

## Alternatives Considered

### Alternative 1: Direct API Integration

- **Pros**: Simpler implementation, direct control, better performance
- **Cons**: Business logic leakage, tight coupling, difficult testing
- **Rejected**: Violates architectural boundaries and prevents platform evolution

### Alternative 2: Unified Integration Platform

- **Pros**: Single integration layer, standardized patterns, easier maintenance
- **Cons**: Additional vendor dependency, potential feature gaps, cost overhead
- **Rejected**: Adds complexity and cost without solving the core architectural problem

### Alternative 3: Business Logic in Adapters

- **Pros**: Faster implementation, platform-specific optimizations
- **Cons**: Logic leakage, testing challenges, migration difficulty
- **Rejected**: Creates the exact anti-pattern we're trying to avoid

### Alternative 4: Event-Driven Integration Only

- **Pros**: Clean separation, easy testing, scalable
- **Cons**: Complex orchestration, latency issues, debugging challenges
- **Rejected**: Commands are needed for outbound execution, not just events

## Implementation Strategy

### Adapter Architecture Pattern

```typescript
interface Adapter {
  // Inbound: External events → NeuronX events
  onEvent(externalEvent: any): Promise<NeuronxEvent[]>;

  // Outbound: NeuronX commands → External actions
  execute(command: NeuronxCommand): Promise<ExecutionResult>;

  // Health and capabilities
  getHealth(): Promise<HealthStatus>;
  getCapabilities(): AdapterCapabilities;
}
```

### Command-Driven Execution

```typescript
// Core business logic generates commands
const command = {
  id: uuid(),
  tenantId: context.tenantId,
  type: 'ghl.workflow.trigger',
  data: {
    workflowId: 'nurture-sequence',
    contactId: lead.externalId,
  },
  metadata: {
    correlationId: event.id,
    priority: 'normal',
  },
};

// Adapter translates to external API
await ghlAdapter.execute(command);
```

### Event Translation Pattern

```typescript
// External webhook → NeuronX event
ghlAdapter.onEvent(webhookPayload) {
  return [{
    id: uuid(),
    tenantId: this.tenantId,
    type: 'lead.contact.ingested',
    data: transformGHLToNeuronX(webhookPayload),
    metadata: {
      source: 'ghl',
      idempotencyKey: webhookPayload.id,
      correlationId: webhookPayload.correlation_id
    }
  }];
}
```

### Contract Testing Strategy

```typescript
// Contract test for GHL adapter
describe('GHL Adapter Contract', () => {
  it('should transform contact.created webhook to lead.contact.ingested', () => {
    const webhook = { id: '123', email: 'test@example.com' };
    const events = adapter.onEvent(webhook);

    expect(events[0]).toMatchObject({
      type: 'lead.contact.ingested',
      data: { externalId: '123', email: 'test@example.com' },
    });
  });

  it('should execute workflow.trigger command', async () => {
    const command = {
      type: 'ghl.workflow.trigger',
      data: { workflowId: '123' },
    };
    const result = await adapter.execute(command);

    expect(result.success).toBe(true);
    expect(result.externalId).toBeDefined();
  });
});
```

### Error Handling and Resilience

- **Retry Logic**: Exponential backoff for transient failures
- **Circuit Breaker**: Automatic failure isolation for unhealthy adapters
- **Fallback Strategies**: Degraded operation when adapters fail
- **Monitoring**: Comprehensive metrics for adapter health and performance

### Version Management

- **Semantic Versioning**: Major.minor.patch for adapter releases
- **Compatibility Matrix**: NeuronX version compatibility with adapter versions
- **Migration Support**: Automatic adapter updates with backward compatibility
- **Rollback Capability**: Quick rollback to previous adapter versions

## Adapter Categories

### Execution Adapters (Outbound Focus)

- **GHL Adapter**: Workflow execution, UI rendering, contact management
- **Communication Adapters**: Email, SMS, voice, WhatsApp integration
- **CRM Adapters**: Salesforce, HubSpot, Pipedrive synchronization

### Data Adapters (Bidirectional)

- **Back Office Adapters**: ERP, accounting, HR system integration
- **Analytics Adapters**: Business intelligence and reporting platforms
- **Storage Adapters**: Cloud storage and document management

### Event Adapters (Inbound Focus)

- **Webhook Adapters**: External service event ingestion
- **Polling Adapters**: Scheduled data synchronization
- **Streaming Adapters**: Real-time event processing

## Quality Assurance

### Testing Strategy

- **Unit Tests**: Adapter logic and data transformation
- **Contract Tests**: Interface compliance and behavior validation
- **Integration Tests**: End-to-end flows with mocked external services
- **Performance Tests**: Throughput and latency validation

### Monitoring and Observability

- **Health Checks**: Automatic adapter health monitoring
- **Performance Metrics**: Latency, throughput, error rates by adapter
- **Business Metrics**: Successful executions, failure patterns, retry rates
- **Alerting**: Automatic alerts for adapter failures or performance degradation

## Related ADRs

- 0005: Core engine is event-driven
- 0002: GoHighLevel as execution layer
- 0004: Modular back-office integration strategy

## Notes

Adapter-first integration enables NeuronX to:

1. **Maintain Architectural Purity**: Business logic stays in core, adapters are pure translation
2. **Support Platform Evolution**: Easy migration between execution platforms
3. **Enable Testing Excellence**: Isolated testing of adapters and core logic
4. **Scale Independently**: Adapters and core can scale separately
5. **Support Multiple Platforms**: Simultaneous support for different execution platforms

Key success factors:

- Strict contract enforcement between core and adapters
- Comprehensive testing of adapter contracts
- Clear separation of concerns and responsibilities
- Robust error handling and monitoring
- Version compatibility and migration strategies

This approach prevents vendor lock-in while maintaining clean architecture, enabling NeuronX to evolve from DFY to multi-platform SaaS without architectural rewrites.
