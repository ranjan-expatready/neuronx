# Usage Contracts - Monetization & Billing Foundation

**Version:** 1.0
**Status:** Canonical Contract (Enforceable)
**Authority:** WI-005 Monetization & Usage Contract Completion
**Last Updated:** 2026-01-03
**Purpose:** Agent-executable usage contracts defining WHAT can be measured and billed, without performing billing

## 1. Purpose & Scope

This contract defines canonical usage entities and billable dimensions for the Sales OS monetization system. Usage is observational-only and never authoritative - it cannot trigger state changes or business decisions.

### Non-Negotiable Invariants

- **Usage is NEVER Authoritative:** Usage data cannot trigger state changes, business decisions, or system behavior
- **Usage is Observational:** Usage tracks what happened, does not control what happens
- **Billing is OUT OF SCOPE:** This contract defines WHAT can be billed, not HOW billing occurs
- **Sales OS Boundary Respected:** All usage contracts terminate at VERIFIED_PAID → CaseOpened event
- **External Systems Cannot Emit Billable Usage:** Only NeuronX can emit billable usage events

### Usage Classifications

- **BILLABLE:** Usage that can be monetized per tenant entitlements
- **NON-BILLABLE:** Usage tracked for analytics but not monetized
- **INFORMATIONAL:** Usage tracked for operational insights only

## 2. Usage Entities

### Entity: UsageEvent

**Unique ID Pattern:** `usage-{uuid}`  
**Purpose:** Individual usage events for real-time metering and tenant activity tracking

**Required Fields (MUST):**

- `id: string` - UUID, primary key, immutable
- `tenantId: string` - Foreign key to tenant, required, immutable
- `metric: string` - Usage metric identifier, max 100 chars, controlled vocabulary
- `value: integer` - Usage quantity, positive integer, immutable after creation
- `timestamp: timestamp` - Event timestamp (ISO 8601 UTC), required, immutable
- `actorId: string` - Responsible actor UUID, required, immutable
- `correlationId: string` - Request correlation ID, required, immutable
- `createdAt: timestamp` - Record creation timestamp (ISO 8601 UTC), immutable

**Optional Fields (MAY):**

- `resourceId: string` - Associated resource UUID (lead, opportunity, etc.)
- `metadata: json` - Usage-specific metadata, structured
- `source: string` - Usage source identifier, max 100 chars

**Classification Rules:**

- **Lead Ingestion Events:** BILLABLE (per lead processed)
- **Scoring Computation:** BILLABLE (per scoring request)
- **Routing Decisions:** BILLABLE (per routing execution)
- **SLA Timer Events:** NON-BILLABLE (operational tracking)
- **Escalation Events:** NON-BILLABLE (quality tracking)
- **Voice Execution:** BILLABLE (per minute/call)
- **API Access:** BILLABLE (per request)

**Validation Rules:**

- Metric must be from controlled vocabulary (no custom metrics)
- Value must be positive integer
- Timestamp cannot be future-dated
- ActorId must reference valid actor
- CorrelationId required for audit chaining

**Idempotency Rules:**

- Events are idempotent by (tenantId, metric, correlationId, timestamp)
- Duplicate events are accepted but not double-counted
- Idempotency window: 24 hours

**Ownership:** NeuronX (metering logic and validation), Tenant (usage consumption data)  
**PII Classification:** LOW (usage metrics and actor attribution)  
**Audit Requirements:** All usage events audited for billing accuracy and dispute resolution

---

### Entity: UsageAggregate

**Unique ID Pattern:** `agg-{uuid}`  
**Purpose:** Aggregated usage data for billing periods and reporting

**Required Fields (MUST):**

- `id: string` - UUID, primary key, immutable
- `tenantId: string` - Foreign key to tenant, required, immutable
- `metric: string` - Usage metric identifier, max 100 chars, controlled vocabulary
- `period: string` - Billing period (YYYY-MM format), required, immutable
- `totalValue: integer` - Period total usage, non-negative integer, calculated
- `createdAt: timestamp` - Record creation timestamp (ISO 8601 UTC), immutable
- `updatedAt: timestamp` - Last update timestamp (ISO 8601 UTC), auto-updated

**Optional Fields (MAY):**

- `dailyBreakdown: json` - Daily usage breakdown by date
- `peakUsage: integer` - Peak daily usage value
- `lastUpdated: timestamp` - Last aggregation calculation timestamp
- `metadata: json` - Aggregation-specific metadata

**Classification Rules:**

- **All Aggregates:** BILLABLE (aggregated billable events)
- **Exception:** SLA and escalation aggregates are NON-BILLABLE

**Validation Rules:**

- Period must be valid YYYY-MM format
- Total value must equal sum of underlying UsageEvents
- Cannot be modified after billing period closes
- Must be recalculated if underlying events change

**Aggregation Rules:**

- Aggregates calculated daily at period boundaries
- Historical aggregates immutable once billed
- Real-time aggregates updated as events arrive
- Aggregation windows: daily, monthly, quarterly

**Ownership:** NeuronX (aggregation logic and calculations), Tenant (aggregated usage data)  
**PII Classification:** LOW (aggregated metrics)  
**Audit Requirements:** All aggregation calculations audited for billing accuracy

---

## 3. Billable Dimensions (Declarative Only)

### Lead Ingestion Domain

**Metric:** `lead.ingestion`  
**Unit:** Count (per lead processed)  
**Aggregation Window:** Daily  
**Entitlement Dependency:** Yes (leads per month)  
**Forbidden Billing Cases:** Test leads, duplicate leads, rejected leads  
**Classification:** BILLABLE  
**Usage Event Trigger:** Lead creation from any source (form, API, import)

### Lead Scoring Domain

**Metric:** `lead.scoring`  
**Unit:** Count (per scoring computation)  
**Aggregation Window:** Daily  
**Entitlement Dependency:** Yes (scorings per month)  
**Forbidden Billing Cases:** Failed scoring attempts, cached results  
**Classification:** BILLABLE  
**Usage Event Trigger:** ML model execution for lead qualification

### Routing Domain

**Metric:** `routing.execution`  
**Unit:** Count (per routing decision executed)  
**Aggregation Window:** Daily  
**Entitlement Dependency:** Yes (routings per month)  
**Forbidden Billing Cases:** Failed routing attempts, re-routings  
**Classification:** BILLABLE  
**Usage Event Trigger:** Assignment algorithm execution

### SLA Timer Domain

**Metric:** `sla.timer`  
**Unit:** Count (per timer instance)  
**Aggregation Window:** Monthly  
**Entitlement Dependency:** No (unlimited)  
**Forbidden Billing Cases:** None (operational tracking)  
**Classification:** NON-BILLABLE  
**Usage Event Trigger:** SLA timer creation and breaches

### Escalation Domain

**Metric:** `escalation.event`  
**Unit:** Count (per escalation triggered)  
**Aggregation Window:** Monthly  
**Entitlement Dependency:** No (unlimited)  
**Forbidden Billing Cases:** None (quality tracking)  
**Classification:** NON-BILLABLE  
**Usage Event Trigger:** Escalation chain activation

### Voice Execution Domain

**Metric:** `voice.execution`  
**Unit:** Minutes (per voice interaction)  
**Aggregation Window:** Daily  
**Entitlement Dependency:** Yes (voice minutes per month)  
**Forbidden Billing Cases:** Failed calls, unanswered calls, boundary violations  
**Classification:** BILLABLE  
**Usage Event Trigger:** Voice platform execution completion

### API Access Domain

**Metric:** `api.request`  
**Unit:** Count (per API call)  
**Aggregation Window:** Daily  
**Entitlement Dependency:** Yes (API calls per month)  
**Forbidden Billing Cases:** Rate limited requests, authentication failures  
**Classification:** BILLABLE  
**Usage Event Trigger:** API endpoint access (any method)

### Appointment Domain

**Metric:** `appointment.scheduled`  
**Unit:** Count (per appointment created)  
**Aggregation Window:** Daily  
**Entitlement Dependency:** Yes (appointments per month)  
**Forbidden Billing Cases:** Cancelled appointments, no-shows  
**Classification:** BILLABLE  
**Usage Event Trigger:** Appointment creation via any channel

### Payment Processing Domain

**Metric:** `payment.processed`  
**Unit:** Count (per payment attempt)  
**Aggregation Window:** Daily  
**Entitlement Dependency:** No (transaction fees separate)  
**Forbidden Billing Cases:** Failed payments, refunds  
**Classification:** NON-BILLABLE  
**Usage Event Trigger:** Payment initiation (any method)

### Case Opening Domain

**Metric:** `case.opened`  
**Unit:** Count (per case opened)  
**Aggregation Window:** Monthly  
**Entitlement Dependency:** No (boundary event)  
**Forbidden Billing Cases:** None (terminal event)  
**Classification:** INFORMATIONAL  
**Usage Event Trigger:** CaseOpenedEvent creation

## 4. Usage Generation Rules

### Generation Authority

- **NeuronX Only:** Only NeuronX core can emit usage events
- **No External Emission:** External systems cannot emit billable usage
- **Boundary Respect:** Usage generation stops at VERIFIED_PAID → CaseOpened

### Event Generation Triggers

- **Synchronous:** Usage events generated synchronously with business events
- **Idempotent:** Duplicate business events do not generate duplicate usage
- **Failure Handling:** Usage generation failures do not block business operations
- **Correlation:** All usage events linked to business event correlationId

### Aggregation Rules

- **Real-Time:** Aggregates updated as events arrive
- **Periodic:** Daily aggregation runs at period boundaries
- **Immutable:** Historical aggregates cannot be modified
- **Recalculation:** Aggregates recalculated if underlying events corrected

## 5. Entitlement Dependencies

### Entitlement Types

- **Hard Limits:** Usage blocked when exceeded (leads, scorings, routings)
- **Soft Limits:** Usage allowed but flagged (voice minutes, API calls)
- **Unlimited:** No limits applied (SLA timers, escalations)

### Entitlement Checking

- **Pre-Execution:** Billable actions check entitlements before execution
- **Real-Time:** Entitlement validation occurs in real-time
- **Graceful Degradation:** Non-critical features degrade when limits exceeded
- **Audit Trail:** All entitlement checks logged

## 6. Correlation & Audit Rules

### Correlation Requirements

- **Request Level:** Every usage event must have correlationId
- **Business Event Link:** Usage events link to originating business events
- **Chain of Custody:** Complete audit trail from action to usage to billing

### Audit Requirements

- **Event Level:** Every usage event fully audited
- **Aggregation Level:** All aggregation calculations audited
- **Billing Level:** Usage-to-billing mapping audited
- **Retention:** Usage audit trails retained 7 years minimum

### Dispute Resolution

- **Event Reconstruction:** Usage events enable billing dispute investigation
- **Correlation Tracing:** correlationId enables end-to-end event tracing
- **Immutable Records:** Usage events cannot be modified after creation
- **Temporal Integrity:** Usage timestamps protected from manipulation

## 7. Usage Classifications Matrix

| Domain          | Metric                | Classification | Unit    | Aggregation | Entitlement Check |
| --------------- | --------------------- | -------------- | ------- | ----------- | ----------------- |
| Lead Ingestion  | lead.ingestion        | BILLABLE       | Count   | Daily       | Yes               |
| Lead Scoring    | lead.scoring          | BILLABLE       | Count   | Daily       | Yes               |
| Routing         | routing.execution     | BILLABLE       | Count   | Daily       | Yes               |
| SLA Timer       | sla.timer             | NON-BILLABLE   | Count   | Monthly     | No                |
| Escalation      | escalation.event      | NON-BILLABLE   | Count   | Monthly     | No                |
| Voice Execution | voice.execution       | BILLABLE       | Minutes | Daily       | Yes               |
| API Access      | api.request           | BILLABLE       | Count   | Daily       | Yes               |
| Appointment     | appointment.scheduled | BILLABLE       | Count   | Daily       | Yes               |
| Payment         | payment.processed     | NON-BILLABLE   | Count   | Daily       | No                |
| Case Opening    | case.opened           | INFORMATIONAL  | Count   | Monthly     | No                |

## 8. Forbidden Usage Patterns

### Never Authoritative

- Usage cannot trigger business decisions
- Usage cannot modify system state
- Usage cannot block business operations
- Usage cannot override entitlements

### Never External

- External systems cannot emit billable usage
- Third-party integrations cannot generate usage events
- Voice platforms cannot report billable metrics
- External APIs cannot create usage records

### Never Manipulable

- Usage events cannot be modified after creation
- Usage aggregates cannot be manually adjusted
- Usage timestamps cannot be backdated or future-dated
- Usage correlation cannot be broken

---

**Usage Contract Status:** ✅ MONETIZATION-READY
**Billing Scope:** ✅ WHAT (defined) vs HOW (future implementation)
**Authoritative Boundary:** ✅ Usage NEVER authoritative
**Sales OS Boundary:** ✅ Respects VERIFIED_PAID → CaseOpened termination
**External Systems:** ✅ NEVER emit billable usage directly
**Entitlement Foundation:** ✅ Ready for runtime enforcement
