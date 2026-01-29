# NeuronX Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SYSTEMS                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │   CRM       │ │  Marketing  │ │ Accounting  │ │    ERP      │ │
│  │  Systems    │ │ Automation  │ │  Systems   │ │  Systems    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                       NEURONX PLATFORM                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 PLATFORM LAYER                              │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │ │
│  │  │   Tenant    │ │    RBAC     │ │   Billing   │            │ │
│  │  │ Management  │ │ Management  │ │ Management │            │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │ │
│  │  ┌─────────────┐ ┌─────────────┐                            │ │
│  │  │   Audit     │ │   Config    │                            │ │
│  │  │   Logging   │ │ Management  │                            │ │
│  │  └─────────────┘ └─────────────┘                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 SALES CORE                                  │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │ │
│  │  │   Lead      │ │  Workflow   │ │ Predictive  │            │ │
│  │  │  Scoring    │ │  Engine     │ │ Analytics   │            │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │ │
│  │  ┌─────────────┐ ┌─────────────┐                            │ │
│  │  │   Process   │ │   Sales     │                            │ │
│  │  │  Orchestration│ │ Intelligence│                            │ │
│  │  └─────────────┘ └─────────────┘                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 ADAPTER LAYER                               │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │ │
│  │  │ GoHighLevel │ │  WhatsApp   │ │    Email    │            │ │
│  │  │   Adapter   │ │  Adapter    │ │   Adapter   │            │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │ │
│  │  │   Slack     │ │   Teams     │ │   Custom    │            │ │
│  │  │   Adapter   │ │  Adapter    │ │   API       │            │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXECUTION LAYER                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │ GoHighLevel │ │  WhatsApp   │ │    Email    │ │   Custom    │ │
│  │   UI/UX     │ │ Business API│ │   Service   │ │  Interface  │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### Sales Core

**Purpose**: Contains all NeuronX intelligence, business logic, and orchestration capabilities.

**Components**:

- **Lead Scoring Engine**: AI-driven algorithms for prospect qualification and prioritization
- **Workflow Engine**: Rule-based process orchestration and automated task management
- **Predictive Analytics**: Machine learning models for pipeline forecasting and performance insights
- **Process Orchestration**: Event-driven workflow management and state transitions
- **Sales Intelligence**: AI-powered coaching, territory optimization, and opportunity analysis

**Boundaries**:

- Owns all sales domain logic and algorithms
- Maintains data models for sales entities and relationships
- Provides orchestration APIs for external execution
- Never implements user interfaces or external API integrations

### Back Office (Integration Layer)

**Purpose**: Interfaces with external business systems for data synchronization and process integration.

**Components**:

- **CRM Integration**: Bidirectional sync with Salesforce, HubSpot, Pipedrive
- **Marketing Automation**: Integration with Marketo, Pardot, ActiveCampaign
- **Accounting Systems**: Sync with QuickBooks, Xero, NetSuite
- **ERP Systems**: Integration with SAP, Oracle, Microsoft Dynamics
- **HR Systems**: Connection to Workday, BambooHR, ADP

**Boundaries**:

- Acts as data bridges, not business logic containers
- Transforms data formats between NeuronX and external systems
- Handles authentication and rate limiting for external APIs
- Never implements business rules or decision logic

### Platform Layer

**Purpose**: Provides cross-cutting capabilities required for multi-tenant SaaS operation.

**Components**:

- **Tenant Management**: Organization isolation, data partitioning, and resource allocation
- **RBAC Management**: Role-based access control, permission hierarchies, and user management
- **Billing Management**: Subscription tracking, usage metering, and invoicing integration
- **Audit Logging**: Comprehensive activity tracking, compliance logging, and data governance
- **Configuration Management**: System-wide settings, feature flags, and environment management

**Boundaries**:

- Provides infrastructure services, not business logic
- Enforces security and compliance policies
- Manages resource allocation and usage tracking
- Never contains sales-specific algorithms or workflows

### Adapter Layer

**Purpose**: Translates NeuronX orchestration commands into execution platform APIs.

**Components**:

- **GoHighLevel Adapter**: Interface for workflow execution and UI rendering
- **Communication Adapters**: WhatsApp, Email, SMS, and voice integration
- **Collaboration Adapters**: Slack, Microsoft Teams, and internal messaging
- **Custom API Adapters**: Generic REST/GraphQL interfaces for custom integrations
- **Webhook Adapters**: Event-driven notifications and external triggers

**Boundaries**:

- Translates between NeuronX commands and execution platform APIs
- Handles protocol differences and data format conversions
- Manages authentication and connection pooling
- Never implements business logic or stores persistent data

## Architecture Boundaries

### Logic Flow Rules

1. **Sales Intelligence Flows Upward**: All business logic originates in Sales Core and flows to adapters
2. **Platform Services Flow Downward**: Infrastructure services support all layers but don't contain business logic
3. **Data Flows Through Adapters**: External system data enters through Back Office and gets processed by Sales Core
4. **Execution Commands Flow Outward**: Orchestration decisions are sent to Adapter Layer for execution

### Data Ownership

1. **Sales Core Owns Business Data**: Lead scores, workflow states, predictive models, and sales intelligence
2. **Platform Layer Owns Metadata**: Tenant configurations, user permissions, audit logs, and system settings
3. **Back Office Owns External References**: Customer IDs in CRM, account codes in ERP, employee IDs in HR
4. **Adapters Own Execution State**: Message delivery status, API call responses, webhook acknowledgments

### Interface Contracts

1. **Sales Core APIs**: Internal orchestration interfaces consumed by Platform Layer
2. **Platform APIs**: Infrastructure services consumed by all modules
3. **Adapter APIs**: Execution interfaces called by Sales Core orchestration
4. **Back Office APIs**: Data synchronization interfaces called by Sales Core

## Future SaaS Evolution

### Phase 1: DFY Architecture (Current)

- Single-tenant deployments with direct database access
- GoHighLevel as primary execution layer
- NeuronX team manages infrastructure and configurations
- Direct integrations with customer systems

### Phase 2: Hybrid Architecture (Transition)

- Multi-tenant database schema with tenant isolation
- Self-service configuration interfaces
- API-first architecture for all integrations
- Gradual migration of DFY configurations to SaaS templates

### Phase 3: Pure SaaS Architecture (Future)

- Complete multi-tenancy with resource pooling
- Marketplace for third-party adapters and integrations
- Automated scaling and high availability
- Self-service onboarding and configuration

### Migration Strategy

- Maintain backward compatibility for DFY deployments
- Implement tenant isolation without breaking existing integrations
- Gradually expose configuration APIs for self-service
- Preserve all existing business logic during architectural evolution

### Scaling Considerations

- Horizontal scaling of Sales Core intelligence services
- Multi-tenant database optimization and query isolation
- CDN distribution of static configuration data
- Event-driven architecture for cross-tenant communication

## Detailed Component Interactions

### Event-Driven Flow

```
External Trigger → Adapter → Event Bus → Rules Engine → State Update → Command Generation → Adapter → External Execution
```

**Step-by-Step Interaction:**

1. **External Event Ingestion**
   - GHL webhook received by GHL Adapter
   - Adapter validates and transforms to NeuronX event
   - Event published to tenant-scoped event bus

2. **Event Processing**
   - Rules Engine evaluates event against active rules
   - Matching rules trigger workflow state changes
   - Lead scoring engine processes qualification updates

3. **State Management**
   - Event-sourced state updates applied to entities
   - Configuration resolution for tenant/workspace settings
   - Audit trail entries created for all changes

4. **Command Orchestration**
   - Workflow engine generates execution commands
   - Communication sequences calculated and queued
   - Task assignments optimized and dispatched

5. **External Execution**
   - Commands routed to appropriate adapters
   - GHL adapter translates to GHL API calls
   - Results fed back as events for state updates

### Data Flow Patterns

**Read Operations:**

```
Client Request → API Gateway → Authentication → Tenant Context → Business Logic → State Query → Response
```

**Write Operations:**

```
Client Request → API Gateway → Authentication → Tenant Context → Validation → Event Creation → State Update → Response
```

**Background Processing:**

```
Scheduled Job → Tenant Iterator → Business Logic → Event Generation → Rules Processing → Command Queue → Adapter Execution
```

## Event Flow Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             EVENT FLOW ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │  EXTERNAL   │───▶│   ADAPTER   │───▶│ EVENT BUS   │───▶│ RULES ENGINE │       │
│  │   SYSTEM    │    │   LAYER     │    │             │    │             │       │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │
│                                                                                 │
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │ STATE       │◀───│ EVENT       │◀───│ WORKFLOW    │◀───│ COMMAND      │       │
│  │ STORE       │    │ SOURCING   │    │ ENGINE      │    │ GENERATION  │       │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘       │
│                                                                                 │
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                          │
│  │ EXECUTION   │◀───│ ADAPTER     │◀───│ COMMAND     │                          │
│  │ RESULTS     │    │ LAYER      │    │ QUEUE       │                          │
│  └─────────────┘    └─────────────┘    └─────────────┘                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Flow Explanation:**

- **External Systems** send triggers (webhooks, API calls, scheduled events)
- **Adapter Layer** translates external events to NeuronX events
- **Event Bus** routes events to appropriate handlers within tenant boundaries
- **Rules Engine** evaluates events against business rules and triggers workflows
- **Workflow Engine** orchestrates complex multi-step processes
- **Command Generation** creates execution commands for external systems
- **Command Queue** manages execution order and prioritization
- **Adapter Layer** translates commands to external API calls
- **State Store** maintains current entity state through event sourcing
- **Execution Results** feed back as events to maintain audit trail

## Failure Modes and Retries

### Adapter Failure Scenarios

**Network Failures:**

- External API timeouts or connection failures
- DNS resolution issues or network partitions
- Rate limiting by external services

**Mitigation:**

```typescript
// Exponential backoff with jitter
const retryPolicy = {
  maxAttempts: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 300000, // 5 minutes
  backoffFactor: 2,
  jitter: 0.1, // ±10% randomization
};
```

**Authentication Failures:**

- Expired tokens or invalid credentials
- Permission changes in external systems
- Account suspension or deactivation

**Mitigation:**

- Automatic token refresh for OAuth flows
- Alert generation for manual credential updates
- Graceful degradation to read-only mode

**Data Format Changes:**

- External API schema modifications
- Breaking changes in webhook payloads
- Field mapping inconsistencies

**Mitigation:**

- Schema validation with version detection
- Automatic retry with updated mappings
- Alert generation for manual intervention

### Event Processing Failures

**Duplicate Event Handling:**

- Network retries causing duplicate events
- Idempotency key conflicts

**Mitigation:**

- Idempotency key validation before processing
- Duplicate detection within time windows
- Safe retry with conflict resolution

**Rule Engine Failures:**

- Invalid rule conditions causing exceptions
- Circular rule dependencies
- Resource exhaustion from complex evaluations

**Mitigation:**

- Rule validation at configuration time
- Circuit breaker pattern for rule evaluation
- Timeout limits on rule processing

**State Update Conflicts:**

- Concurrent modifications to same entities
- Event ordering issues in distributed systems

**Mitigation:**

- Optimistic concurrency control
- Eventual consistency with conflict resolution
- Audit trail preservation during conflicts

### Recovery Strategies

**Immediate Recovery (< 1 minute):**

- Automatic retries with backoff
- Failover to secondary adapters
- Circuit breaker activation

**Short-term Recovery (1-15 minutes):**

- Queue replay for transient failures
- Manual intervention alerts
- Degraded mode operation

**Long-term Recovery (> 15 minutes):**

- Configuration updates for permanent changes
- Code deployments for bug fixes
- External system maintenance coordination

## Future Module Integration Points

### AI/ML Module (Predictive Analytics)

**Integration Point:** Sales Core → AI Service

```typescript
interface AIPredictionService {
  scoreLead(leadData: Lead): Promise<LeadScore>;
  forecastPipeline(historicalData: SalesData): Promise<PipelineForecast>;
  recommendActions(context: SalesContext): Promise<ActionRecommendation[]>;
}
```

**Plug-in Location:** After event processing, before command generation
**Data Flow:** Events → AI Service → Enriched Events → Rules Engine

### Back Office Integration Module

**Integration Point:** Sales Core → Back Office Adapters

```typescript
interface BackOfficeSync {
  syncCustomerData(leadId: string): Promise<CustomerData>;
  updateAccounting(opportunityId: string): Promise<void>;
  syncInventory(productIds: string[]): Promise<InventoryData>;
}
```

**Plug-in Location:** Event processing pipeline for data enrichment
**Data Flow:** External Events → Back Office Sync → Enriched Events

### Advanced Analytics Module

**Integration Point:** Platform Layer → Analytics Engine

```typescript
interface AnalyticsEngine {
  trackEvent(event: NeuronxEvent): Promise<void>;
  generateReport(query: AnalyticsQuery): Promise<AnalyticsReport>;
  detectAnomalies(timeframe: TimeRange): Promise<Anomaly[]>;
}
```

**Plug-in Location:** Event bus for passive monitoring
**Data Flow:** All Events → Analytics Engine (async processing)

### Compliance and Audit Module

**Integration Point:** Platform Layer → Compliance Service

```typescript
interface ComplianceService {
  validateEvent(event: NeuronxEvent): Promise<ComplianceCheck>;
  generateAuditReport(tenantId: string): Promise<AuditReport>;
  handleDataSubjectRequest(request: DataSubjectRequest): Promise<void>;
}
```

**Plug-in Location:** Event ingestion and processing pipeline
**Data Flow:** Events → Compliance Validation → Processing

### Marketplace Module (SaaS Future)

**Integration Point:** Platform Layer → Marketplace Service

```typescript
interface MarketplaceService {
  discoverAdapters(tenantId: string): Promise<AdapterDefinition[]>;
  installAdapter(
    tenantId: string,
    adapterId: string
  ): Promise<InstallationResult>;
  manageSubscriptions(tenantId: string): Promise<Subscription[]>;
}
```

**Plug-in Location:** Configuration management and adapter discovery
**Data Flow:** Tenant Requests → Marketplace → Adapter Provisioning

## Component Communication Patterns

### Synchronous Communication

- API calls between Platform Layer components
- Configuration resolution during request processing
- Real-time validation and authorization checks

### Asynchronous Communication

- Event publishing and subscription (primary pattern)
- Command queuing for external execution
- Background job processing for heavy computations

### Request-Response Patterns

- HTTP APIs for external client communication
- Internal RPC calls for component-to-component communication
- Database queries for state retrieval

### Event-Driven Patterns

- Event sourcing for state management
- CQRS for read/write separation
- Saga pattern for distributed transactions
- Eventual consistency for cross-service updates

## Control Plane Architecture

### Control Plane Responsibilities

The Control Plane provides runtime configuration management for NeuronX, enabling safe deployment of business rule changes without code deployments.

**Core Functions:**

- **Configuration Storage**: Versioned, tenant-scoped configuration storage
- **Validation Engine**: Schema-based validation with business rule enforcement
- **Rollout Management**: Gradual deployment with monitoring and rollback
- **Audit Trail**: Complete history of configuration changes
- **Resolution Engine**: Hierarchical configuration inheritance (Global → Tenant → Workspace)

### Configuration Domains

- **Business Rules**: Lead scoring algorithms, workflow triggers, notification rules
- **System Limits**: Rate limits, quotas, timeouts, concurrency controls
- **Integration Configs**: Adapter credentials, mappings, endpoints, limits

### Rollout Strategy

```typescript
// Gradual rollout with monitoring
const rollout = {
  strategy: 'percentage',
  initialPercentage: 5,
  incrementPercentage: 5,
  evaluationPeriod: '30 minutes',
  successCriteria: {
    errorRateThreshold: 0.01, // 1% error rate
    performanceDegradation: 0.05, // 5% performance drop
  },
  autoRollback: true,
};
```

## Outbox Pattern Implementation

### Reliable Event Publishing

The Outbox pattern ensures events are reliably published to external systems even in the presence of failures.

**Pattern Implementation:**

1. **Business Transaction**: Update business state and write to outbox table in single transaction
2. **Background Processing**: Separate process reads from outbox and publishes to message bus
3. **Idempotent Publishing**: Handle duplicate publishes gracefully
4. **Cleanup**: Remove successfully published events from outbox

**Database Schema:**

```sql
CREATE TABLE event_outbox (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  event_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Outbox Processor

```typescript
class OutboxProcessor {
  async processBatch(): Promise<void> {
    const pendingEvents = await db.eventOutbox.findMany({
      where: { status: 'pending' },
      take: 100,
    });

    for (const outboxEvent of pendingEvents) {
      try {
        await eventBus.publish(outboxEvent.eventData);
        await db.eventOutbox.update({
          where: { id: outboxEvent.id },
          data: { status: 'published' },
        });
      } catch (error) {
        await this.handlePublishFailure(outboxEvent, error);
      }
    }
  }
}
```

### Failure Handling

- **Retry Logic**: Exponential backoff with configurable limits
- **Dead Letter Queue**: Events that repeatedly fail are moved to DLQ for manual review
- **Circuit Breaker**: Temporarily disable publishing if external systems are down
- **Monitoring**: Track publish success rates, retry counts, and processing latency
