# Adapter Architecture

**Last verified:** 2026-01-03
**Purpose:** Clean separation between NeuronX core and external vendor systems

## Overview

NeuronX implements a strict adapter pattern to maintain vendor-agnostic core business logic while enabling seamless integration with external CRM, communication, and automation platforms.

```
┌─────────────────────────────────┐
│         NeuronX Core            │
│                                 │
│  Business Logic & AI Orchestration │
│  ┌─────────────────────────────┐ │
│  │     Domain Services        │ │
│  │                             │ │
│  │ • Lead Scoring Engine      │ │
│  │ • Workflow Orchestration   │ │
│  │ • AI Decision Making       │ │
│  │ • Business Rules           │ │
│  └─────────────────────────────┘ │
│                                 │
│  ONLY imports canonical contracts │
│  NEVER imports vendor code       │
└─────────────────────────────────┘
                 │
                 │ Canonical Interfaces
                 │ (ICRMAdapter, etc.)
                 ▼
┌─────────────────────────────────┐
│       Adapter Layer            │
│                                 │
│  Protocol Translation & Mapping  │
│  ┌─────────────────────────────┐ │
│  │      GHL Adapter           │ │
│  │                             │ │
│  │ • GhlClient (HTTP)         │ │
│  │ • GhlMapper (Data)         │ │
│  │ • GhlAdapter (Interface)   │ │
│  └─────────────────────────────┘ │
│                                 │
│  ONLY exports canonical types    │
│  NEVER exports vendor types      │
└─────────────────────────────────┘
                 │
                 │ Vendor APIs
                 ▼
┌─────────────────────────────────┐
│    External Systems             │
│                                 │
│ • GoHighLevel CRM              │ │
│ • HubSpot CRM                  │ │
│ • Salesforce CRM               │ │
│ • Custom APIs                  │ │
└─────────────────────────────────┘
```

## Architectural Principles

### 1. Clean Separation of Concerns

**Core Business Logic:** Pure domain logic with no external dependencies

- Lead scoring algorithms
- Workflow orchestration rules
- AI decision making
- Business validation

**Adapter Layer:** Protocol translation and data mapping

- HTTP API calls
- Data transformation
- Error handling
- Rate limiting

### 2. Vendor Agnostic Interfaces

All external systems implement the same canonical interfaces:

```typescript
interface ICRMAdapter {
  createLead(request, context): Promise<Lead>;
  updateLead(request, context): Promise<Lead>;
  // ... etc
}
```

**Benefits:**

- Core logic unchanged when switching vendors
- Testable with mock adapters
- Future-proof for new integrations

### 3. Type Safety Boundaries

**Canonical Domain Models:** Business concepts, not vendor schemas

```typescript
// ✅ Canonical
interface Lead {
  id: string;
  email?: string;
  score?: number;
  status: 'new' | 'qualified' | 'disqualified';
}

// ❌ Vendor-specific (NEVER in core)
interface GhlContact {
  contactName: string;
  dateAdded: string;
  // GHL-specific fields
}
```

### 4. Context Propagation

All adapter operations include execution context:

```typescript
interface AdapterContext {
  tenantId: string; // Multi-tenant isolation
  correlationId: string; // Request tracing
  userId?: string; // Audit trail
  requestId: string; // Debug correlation
}
```

## Component Architecture

### Domain Models (`packages/domain/models/`)

Pure data structures representing business concepts. No business logic, no external dependencies.

**Key Models:**

- `Lead`, `Opportunity`, `Pipeline` - CRM entities
- `Message`, `Conversation` - Communication entities
- `Workflow`, `WorkflowExecution` - Automation entities
- `User` - Identity entities
- `CalendarEvent` - Scheduling entities

### Adapter Contracts (`packages/adapters/contracts/`)

Interface definitions that all adapters must implement.

**Core Interfaces:**

- `ICRMAdapter` - Lead and opportunity management
- `IConversationAdapter` - Multi-channel communications
- `IWorkflowAdapter` - Automation and workflow execution
- `IIdentityAdapter` - User and permission management
- `ICalendarAdapter` - Appointment scheduling
- `IBaseAdapter` - Health checks and capabilities

### GHL Adapter Implementation (`packages/adapters/ghl/`)

```
ghl/
├── ghl.types.ts      # GHL-specific types (internal only)
├── ghl.client.ts     # HTTP API client
├── ghl.mapper.ts     # Data transformation
├── ghl.adapter.ts    # Interface implementation
├── index.ts          # Public exports
└── __tests__/
    ├── ghl-adapter.contract.spec.ts
    └── ghl-mapper.snapshot.spec.ts
```

### Token Vault (`packages/security/token-vault/`)

Multi-tenant token management with encryption and automatic refresh.

**Key Features:**

- Tenant-specific token storage
- Automatic token refresh
- Encryption at rest
- Scope validation
- Audit logging

### Webhook Normalization (`packages/adapters/webhooks/`)

Standardized webhook processing with vendor-agnostic event emission.

**Features:**

- Signature verification
- Event normalization
- Correlation ID propagation
- Error handling and retry logic

## Data Flow Architecture

### Outbound Operations (Core → Vendor)

```
1. Core Service receives business request
   ↓
2. Core calls adapter interface method
   ↓
3. Adapter validates context and permissions
   ↓
4. Adapter retrieves valid token from vault
   ↓
5. Adapter transforms canonical data to vendor format
   ↓
6. Adapter makes HTTP API call to vendor
   ↓
7. Adapter transforms vendor response to canonical format
   ↓
8. Adapter returns canonical data to core
```

### Inbound Operations (Vendor → Core)

```
1. Vendor sends webhook to NeuronX endpoint
   ↓
2. Webhook middleware verifies signature
   ↓
3. Webhook normalizer maps to canonical event
   ↓
4. Event published to NeuronX event bus
   ↓
5. Core event handlers process domain events
   ↓
6. Core updates business state and triggers workflows
```

## Error Handling Architecture

### Canonical Error Types

```typescript
export class AdapterError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public retryable: boolean = false
  ) {
    /* ... */
  }
}

export class ValidationError extends AdapterError {
  constructor(field: string, message: string) {
    super(
      'VALIDATION_ERROR',
      `Validation failed for ${field}: ${message}`,
      400,
      false
    );
  }
}

export class RateLimitError extends AdapterError {
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMIT', 'Rate limit exceeded', 429, true);
    this.retryAfter = retryAfterSeconds;
  }
}
```

### Error Propagation Strategy

**Adapter Layer:** Catches vendor-specific errors, converts to canonical errors
**Core Layer:** Handles canonical errors with appropriate business logic
**Logging:** All errors include correlation IDs for end-to-end tracing

## Testing Strategy

### Contract Tests

Verify adapter implementations match canonical interfaces exactly.

```typescript
describe('GHL Adapter - Contract Compliance', () => {
  it('should implement createLead method', () => {
    expect(typeof adapter.createLead).toBe('function');
    // Verify signature matches ICRMAdapter
  });
});
```

### Integration Tests

Test end-to-end flows with mocked external APIs.

```typescript
describe('Lead Creation Flow', () => {
  it('should create lead through adapter', async () => {
    // Mock GHL API response
    mockGhlApi.createContact.mockResolvedValue(mockGhlContact);

    // Call canonical interface
    const lead = await crmAdapter.createLead(request, context);

    // Verify canonical data returned
    expect(lead.email).toBe(request.email);
    expect(lead.tenantId).toBe(context.tenantId);
  });
});
```

### Architecture Tests

Ensure no forbidden imports and proper type boundaries.

```typescript
describe('Architecture Boundaries', () => {
  it('should not import vendor types in core', () => {
    // Scan core modules for forbidden imports
    const violations = scanForVendorImports('packages/core');
    expect(violations).toHaveLength(0);
  });
});
```

## Security Architecture

### Token Management

- **Encryption:** Tokens encrypted at rest using tenant-specific keys
- **Access Control:** Tokens only accessible by authorized services
- **Rotation:** Automatic refresh with secure storage of refresh tokens
- **Audit:** All token access logged with correlation IDs

### Request Security

- **Authentication:** Bearer token authentication for all API calls
- **Authorization:** Scope validation before API execution
- **Rate Limiting:** Per-tenant and per-endpoint rate limiting
- **Monitoring:** Real-time monitoring of API usage and errors

## Operational Architecture

### Health Monitoring

```typescript
interface AdapterHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastChecked: Date;
  metrics: {
    requestsPerMinute: number;
    errorRate: number;
    averageResponseTime: number;
  };
}
```

### Scaling Considerations

**Horizontal Scaling:** Adapters are stateless, can scale independently
**Rate Limiting:** Distributed rate limit management across instances
**Caching:** Response caching for frequently accessed data
**Circuit Breakers:** Automatic failure isolation for external service issues

### Deployment Architecture

```
Load Balancer
    ↓
API Gateway (Rate Limiting, Authentication)
    ↓
NeuronX Core Services
    ↓
Adapter Layer (Stateless)
    ↓
External Vendor APIs
```

## Migration and Evolution

### Adding New Adapters

1. **Implement canonical interfaces** in new adapter package
2. **Create data mappers** for vendor-specific transformations
3. **Add contract tests** to verify interface compliance
4. **Update adapter factory** to support new vendor
5. **Test swappability** with existing core logic

### Interface Evolution

1. **Backward compatibility** maintained during transitions
2. **Additive changes** preferred over breaking changes
3. **Version interfaces** when breaking changes required
4. **Gradual migration** with feature flags

### Vendor Changes

1. **Monitor vendor APIs** for deprecation notices
2. **Implement adapter updates** to handle API changes
3. **Test backward compatibility** before deploying updates
4. **Rollback capability** for failed adapter updates

## Success Metrics

### Technical Metrics

- **Interface Compliance:** 100% contract test pass rate
- **Type Safety:** Zero vendor type leakage into core
- **Performance:** <50ms average adapter response time
- **Reliability:** 99.9% adapter availability

### Quality Metrics

- **Test Coverage:** 95%+ adapter code coverage
- **Error Handling:** <0.1% unhandled adapter errors
- **Security:** Zero security incidents from adapter layer
- **Maintainability:** <4 hours average time to add new adapter method

### Business Metrics

- **Integration Speed:** New vendor integration in <2 weeks
- **Switching Cost:** <1 day to switch between vendors
- **Development Velocity:** No integration work blocks feature development
- **Vendor Independence:** Core unaffected by vendor API changes

This adapter architecture ensures NeuronX remains vendor-agnostic, maintainable, and scalable while providing robust integrations with external business systems.
