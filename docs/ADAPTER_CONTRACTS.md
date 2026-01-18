# Adapter Contracts

## Adapter Responsibilities

### What Adapters Do

Adapters provide protocol translation between NeuronX core and external systems. They are stateless protocol bridges with no business logic.

**Core Functions:**

- **Event Translation**: Convert external events to NeuronX events
- **Command Execution**: Translate NeuronX commands to external API calls
- **Authentication**: Handle external system authentication
- **Error Handling**: Provide retry logic and error isolation
- **Rate Limiting**: Respect external system limits
- **Data Mapping**: Transform data between schemas

### What Adapters Cannot Do

Adapters are strictly forbidden from containing business logic or state.

**Prohibited:**

- Business rule evaluation
- Decision making or conditional logic
- Persistent state storage
- Cross-tenant data access
- Direct database operations
- Complex data transformations
- Workflow orchestration

## GoHighLevel Adapter Contract

### Inbound Events (External → NeuronX)

GHL adapter converts external triggers to NeuronX events.

**Supported Triggers:**

- **Webhook Events**: Contact creation, updates, deletions
- **Form Submissions**: Lead capture forms
- **Workflow Completions**: GHL workflow finished events
- **Campaign Events**: Email opens, clicks, bounces

**Event Mapping:**

```typescript
// GHL contact created → NeuronX lead ingested
ghlWebhook: {
  type: "contact.created",
  data: { id: "ghl_123", email: "user@company.com" }
}

becomes →

neuronxEvent: {
  type: "lead.contact.ingested",
  tenantId: "tenant-uuid",
  data: {
    externalId: "ghl_123",
    email: "user@company.com",
    source: "ghl"
  },
  metadata: {
    source: "ghl",
    idempotencyKey: "ghl_123"
  }
}
```

### Outbound Commands (NeuronX → External)

NeuronX core sends execution commands to GHL adapter.

**Supported Commands:**

- **Create/Update Contacts**: Sync lead data to GHL
- **Send Communications**: Email, SMS, voice messages
- **Trigger Workflows**: Start GHL automation sequences
- **Update Opportunities**: Sync deal stages and values
- **Create Tasks**: Add activities and follow-ups

**Command Structure:**

```typescript
interface ExecutionCommand {
  id: string;
  tenantId: string;
  type: 'ghl.contact.sync' | 'ghl.email.send' | 'ghl.workflow.trigger';
  data: Record<string, any>;
  metadata: {
    correlationId: string;
    priority: 'high' | 'normal' | 'low';
    retryPolicy: RetryPolicy;
  };
}
```

### Adapter Interface Contract

**Required Methods:**

```typescript
interface GHLAdapter {
  // Inbound: Convert external events
  onWebhook(payload: any, tenantConfig: TenantConfig): Promise<Event[]>;

  // Outbound: Execute NeuronX commands
  execute(command: ExecutionCommand): Promise<ExecutionResult>;

  // Health: Connection and capability checks
  healthCheck(): Promise<HealthStatus>;

  // Metadata: Supported operations
  getCapabilities(): AdapterCapabilities;
}
```

## General Adapter Contract

### Inbound Event Handling

**Responsibilities:**

- Validate incoming data format
- Extract tenant context from configuration
- Transform to NeuronX event format
- Apply idempotency keys
- Handle authentication and authorization

**Contract Requirements:**

- Events must include tenant_id from adapter configuration
- Idempotency keys must be stable across retries
- Event data must be sanitized and validated
- Authentication failures must not crash the adapter

### Outbound Command Execution

**Responsibilities:**

- Map NeuronX commands to external API calls
- Handle authentication and session management
- Implement retry logic with exponential backoff
- Transform error responses to standard format
- Respect rate limits and concurrency controls

**Contract Requirements:**

- Commands must be acknowledged within timeout period
- Failures must be retried according to policy
- Results must include execution status and external IDs
- Rate limiting must prevent external system overload

### Error Handling and Isolation

**Error Boundaries:**

- Adapter errors must not affect NeuronX core
- External system failures must be isolated
- Authentication issues must trigger alerts but not crashes
- Data format errors must be logged with context

**Retry Strategy:**

```typescript
const retryPolicy = {
  maxAttempts: 3,
  initialDelay: 1000, // ms
  backoffMultiplier: 2,
  maxDelay: 30000, // ms
};
```

### Contract Testing Requirements

**Unit Tests:**

- Event transformation logic
- Command mapping functions
- Error handling scenarios
- Authentication flows

**Contract Tests:**

- External API mocking and response validation
- Idempotency key handling
- Rate limit behavior
- Error response mapping

**Integration Tests:**

- End-to-end event flow (external → adapter → NeuronX)
- Command execution flow (NeuronX → adapter → external)
- Failure scenario handling
- Performance under load

### Configuration Contract

**Adapter Configuration:**

```typescript
interface AdapterConfig {
  tenantId: string;
  adapterType: 'ghl' | 'salesforce' | 'hubspot';
  credentials: {
    apiKey?: string;
    username?: string;
    password?: string;
    oauth?: OAuthConfig;
  };
  endpoints: {
    baseUrl: string;
    webhooks: WebhookConfig[];
  };
  mappings: {
    fieldMappings: Record<string, string>;
    eventMappings: Record<string, string>;
  };
  limits: {
    rateLimit: number;
    concurrency: number;
    timeout: number;
  };
}
```

### Monitoring and Observability

**Required Metrics:**

- Event processing throughput
- Command execution success/failure rates
- Authentication success rates
- External API latency and error rates
- Queue depth and processing delays

**Required Logs:**

- Event transformation details
- Command execution attempts and results
- Authentication events
- Error conditions with full context
- Performance metrics and thresholds

### Lifecycle Management

**Adapter States:**

- **Unconfigured**: Not yet set up for tenant
- **Configuring**: Initial setup in progress
- **Active**: Fully operational
- **Degraded**: Partial functionality due to external issues
- **Failed**: Completely non-functional

**Health Checks:**

- External system connectivity
- Authentication validity
- API rate limit status
- Configuration consistency
- Queue processing status

### Version Compatibility

**Adapter Versioning:**

- Semantic versioning (major.minor.patch)
- Backward compatibility within major versions
- Migration scripts for breaking changes
- Version negotiation during tenant setup

**Compatibility Matrix:**
| NeuronX Version | GHL Adapter | Status |
|----------------|-------------|--------|
| 1.x.x | 1.x.x | Compatible |
| 2.x.x | 2.x.x | Compatible |
| 2.x.x | 1.x.x | Migration Required |

## Security Contract

### Data Protection

- No sensitive data logging in plain text
- Secure credential storage and rotation
- TLS encryption for all external communications
- Input sanitization and validation

### Access Control

- Tenant-scoped configuration access
- Least-privilege external API permissions
- Audit logging of all adapter operations
- Secure credential management

### Compliance

- GDPR-compliant data handling
- SOC 2 compliant logging and monitoring
- Encryption at rest and in transit
- Regular security assessments
