# Core Concepts

## Tenant

A tenant represents an organizational boundary for data isolation and configuration scoping. In DFY mode, each client deployment is a tenant. In SaaS mode, each subscribed organization is a tenant.

**Properties:**

- Unique identifier (UUID)
- Configuration namespace
- Data isolation boundary
- Audit trail scope
- Billing/accounting context

**Invariants:**

- Tenant data never mixes with other tenants
- Tenant configuration overrides global defaults
- Tenant events are scoped and auditable within tenant boundary

## Workspace / Client

A workspace represents a logical grouping within a tenant for operational separation. In DFY mode, this maps to individual client deployments. In SaaS mode, this represents sub-organizations or business units.

**Properties:**

- Tenant association
- Configuration inheritance from tenant
- Actor permissions boundary
- Process execution context

**Invariants:**

- Workspaces inherit tenant configuration
- Workspace events are tenant-scoped
- Workspace boundaries prevent cross-contamination

## Actor (Human/System)

An actor represents any entity that can initiate or participate in business processes. Actors generate events and are subjects of audit trails.

**Types:**

- **Human Actors**: Users with identities (sales reps, managers, admins)
- **System Actors**: Automated processes (webhooks, scheduled jobs, integrations)
- **External Actors**: Third-party systems (CRM, marketing automation)

**Properties:**

- Unique identifier within tenant
- Type classification (human/system/external)
- Permission context
- Audit attribution

**Invariants:**

- All actions are attributable to actors
- Actor permissions are checked before action execution
- Actor context is preserved in audit trails

## Event

An event represents a significant business occurrence that triggers state changes and workflows. Events are immutable, timestamped, and form the audit trail.

**Structure:**

```typescript
interface Event {
  id: string; // UUID
  tenantId: string; // Tenant scope
  workspaceId?: string; // Optional workspace scope
  actorId: string; // Who/what caused the event
  type: string; // Event type (domain.action)
  data: Record<string, any>; // Event payload
  metadata: {
    timestamp: Date;
    correlationId: string; // Request tracing
    causationId?: string; // Event that caused this
    idempotencyKey?: string; // For duplicate prevention
  };
}
```

**Invariants:**

- Events are immutable once published
- Events are ordered within tenant scope
- Events drive all state changes (no direct mutations)

## Rule

A rule represents business logic that evaluates events and triggers actions. Rules are declarative, testable, and auditable.

**Structure:**

```typescript
interface Rule {
  id: string;
  tenantId: string;
  name: string;
  conditions: RuleCondition[]; // When to trigger
  actions: RuleAction[]; // What to do
  priority: number; // Execution order
  enabled: boolean;
}
```

**Types:**

- **Event Rules**: Trigger on specific events
- **Scheduled Rules**: Time-based triggers
- **Conditional Rules**: Complex business logic

**Invariants:**

- Rules are tenant-scoped and configurable
- Rules are evaluated in priority order
- Rule execution is auditable and replayable

## Configuration

Configuration represents tenant-specific settings that control system behavior. Configuration is hierarchical and versioned.

**Hierarchy:**

1. **Global**: System-wide defaults
2. **Tenant**: Organization-specific overrides
3. **Workspace**: Department/unit-specific settings

**Structure:**

```typescript
interface Configuration {
  tenantId: string;
  workspaceId?: string;
  key: string;
  value: any;
  version: number;
  effectiveDate: Date;
}
```

**Invariants:**

- Configuration changes are versioned and auditable
- Configuration is inherited (workspace ← tenant ← global)
- Configuration changes trigger re-evaluation of rules

## State

State represents the current condition of business entities and processes. State is derived from event history and is reconstructable.

**Types:**

- **Entity State**: Current state of leads, opportunities, accounts
- **Process State**: Current state of workflows and sequences
- **System State**: Configuration and rule states

**Invariants:**

- State is computed from event history (event sourcing)
- State changes are triggered by events
- State is queryable but mutations go through events

## Adapter

An adapter provides protocol translation between NeuronX core and external systems. Adapters are stateless and handle only data transformation.

**Responsibilities:**

- Translate external events to NeuronX events
- Translate NeuronX commands to external API calls
- Handle authentication and rate limiting
- Provide error isolation and retry logic

**Structure:**

```typescript
interface Adapter {
  name: string;
  type: 'inbound' | 'outbound' | 'bidirectional';
  capabilities: string[]; // Supported operations
  config: Record<string, any>; // Adapter-specific settings
}
```

**Invariants:**

- Adapters contain no business logic
- Adapters are stateless and idempotent
- Adapters fail independently without affecting core
- Adapter boundaries prevent vendor logic leakage
