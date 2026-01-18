# E2E Scenarios

**Purpose:** System behavior validation through complete end-to-end journeys. Each scenario represents a real user workflow with measurable outcomes.

## E2E-01: Lead Ingestion to Execution Journey

- **Related Stories:** STORY-01.01, STORY-02.01, STORY-02.02, STORY-04.01
- **Related REQs:** REQ-001, REQ-005, REQ-007, REQ-009, REQ-011

### Preconditions

- Tenant configured with GHL integration
- Lead scoring model active
- Routing rules defined for sales teams
- GHL adapter operational

### Trigger

External lead source (webhook, form submission, or API call) sends contact data to NeuronX

### Expected System Behavior

1. **Lead Ingestion** (STORY-01.01)
   - Webhook signature validated (REQ-015)
   - Canonical lead event created with full context
   - Audit record written to event store

2. **AI Scoring** (STORY-02.01)
   - Lead data processed through ML scoring model (REQ-005)
   - Confidence score calculated with Cipher monitoring
   - Qualification decision logged with explainability

3. **Predictive Routing** (STORY-02.02)
   - Team capacity and expertise analyzed
   - Optimal assignment determined via ML routing
   - Assignment decision audited with reasoning

4. **Execution Orchestration** (STORY-04.01)
   - Stateless execution command sent to GHL adapter
   - GHL workflow triggered as dumb execution action
   - No business logic or decisioning in GHL

### Expected Events & Audit Records

- `lead.ingested` event with full contact data
- `lead.scored` event with AI confidence and factors
- `lead.routed` event with team assignment and reasoning
- `execution.sent` event with GHL workflow trigger
- Complete audit trail for compliance reconstruction

### Expected External Execution

- GHL contact record created/updated
- GHL workflow triggered for follow-up sequence
- Sales team notified via GHL communication

## E2E-02: SLA Breach to Escalation Journey

- **Related Stories:** STORY-01.03, STORY-05.01
- **Related REQs:** REQ-008, REQ-009, REQ-015

### Preconditions

- SLA policy configured (e.g., 30-minute response requirement)
- Escalation rules defined with automatic follow-up
- Audit logging enabled for compliance

### Trigger

Qualified lead created but no sales activity occurs within SLA window

### Expected System Behavior

1. **SLA Monitoring** (STORY-01.03)
   - Event-driven timer monitors lead state
   - SLA breach detected based on time windows
   - No external platform dependency for timing logic

2. **Automatic Escalation** (REQ-008)
   - Escalation logic executes in NeuronX core
   - Follow-up actions calculated internally
   - Audit trail captures escalation decision

3. **Secure Notification** (STORY-05.01)
   - Escalation event triggers secure communication
   - Webhook signature validation if external notification
   - Idempotent processing prevents duplicate escalations

### Expected Events & Audit Records

- `sla.breached` event with timestamp and policy reference
- `lead.escalated` event with escalation actions and reasoning
- `communication.sent` event for follow-up notifications
- Audit trail enables SLA compliance reporting

### Expected External Execution

- GHL communication sent to assigned sales rep
- GHL task created for follow-up action
- Manager notification via GHL dashboard

## E2E-03: Webhook Failure Recovery

- **Related Stories:** STORY-05.01
- **Related REQs:** REQ-015

### Preconditions

- Webhook endpoint configured with signature validation
- Idempotency key generation active
- Retry logic configured for transient failures

### Trigger

GHL sends webhook with valid signature but NeuronX experiences temporary processing failure

### Expected System Behavior

1. **Signature Validation** (STORY-05.01)
   - HMAC-SHA256 signature verified successfully
   - Processing begins with validated payload

2. **Transient Failure Handling**
   - Processing failure detected and logged
   - Retry mechanism activated with exponential backoff
   - Original idempotency key preserved

3. **Successful Recovery**
   - Retry succeeds with same idempotency key
   - Event processed exactly once
   - Audit trail shows retry attempts and final success

### Expected Events & Audit Records

- `webhook.received` event with signature validation
- `processing.failed` event with error details
- `webhook.retried` event with attempt count
- `webhook.processed` event with final success
- Complete audit trail of failure and recovery

### Expected External Execution

- GHL receives no duplicate processing confirmation
- No duplicate actions triggered in external system
- Error logging available for GHL webhook dashboard

## E2E-04: DFY vs SaaS Behavior Difference (Conceptual)

- **Related Stories:** STORY-01.02, STORY-03.01, STORY-03.02
- **Related REQs:** REQ-013, REQ-014

### DFY Model Behavior (Current Implementation)

**Preconditions:**

- Single tenant operation (client-specific deployment)
- Direct GHL integration managed by NeuronX team
- NeuronX owns complete orchestration stack

**Trigger:**
Lead ingested through client-specific integration

**Expected Behavior:**

- Full NeuronX orchestration with GHL as execution layer
- NeuronX team manages configuration and optimization
- Direct integration with client's existing GHL account
- NeuronX responsible for data residency and uptime

### SaaS Model Behavior (Future Implementation)

**Preconditions:**

- Multi-tenant architecture with tenant isolation
- Self-service configuration through web interface
- Customers manage their own GHL integrations

**Trigger:**
Lead ingested through tenant-specific configuration

**Expected Behavior:**

- Tenant-scoped data isolation (REQ-013)
- Agency and location hierarchy support (REQ-014)
- Customer-owned configurations and data
- Subscription-based entitlement management

### Key Behavioral Differences

- **Data Ownership:** DFY = NeuronX managed, SaaS = Customer owned
- **Configuration:** DFY = NeuronX managed, SaaS = Customer self-service
- **Integration:** DFY = Direct managed, SaaS = Customer configured
- **Pricing:** DFY = Project-based, SaaS = Subscription-based

## E2E-05: Multi-Tenant Data Isolation

- **Related Stories:** STORY-03.01, STORY-03.02
- **Related REQs:** REQ-013, REQ-014

### Preconditions

- Multiple tenants configured in single database
- Tenant-specific configurations and data
- Row-level security active at database level

### Trigger

Lead ingested for Tenant A while Tenant B operations active

### Expected System Behavior

1. **Tenant Context Enforcement** (STORY-03.01)
   - All queries automatically filtered by tenant_id
   - No cross-tenant data access possible
   - Tenant-specific configurations applied

2. **Hierarchical Access Control** (STORY-03.02)
   - Company tokens provide agency-wide access
   - Location tokens restrict to specific sub-accounts
   - User permissions respect organizational hierarchy

### Expected Events & Audit Records

- `lead.ingested` event tagged with correct tenant_id
- `access.denied` events if cross-tenant access attempted
- `tenant.isolated` audit records for compliance

### Expected External Execution

- Tenant A's GHL account receives execution commands
- Tenant B's operations completely isolated
- No cross-contamination of customer data

## E2E-06: AI Safety Monitoring

- **Related Stories:** STORY-02.01, STORY-05.02
- **Related REQs:** REQ-006, REQ-016

### Preconditions

- Cipher safety layer active in monitor mode
- AI scoring models deployed
- Security token management operational

### Trigger

High-value lead processed through AI scoring pipeline

### Expected System Behavior

1. **AI Decision Execution** (STORY-02.01)
   - Lead processed through ML scoring model
   - Prediction results generated with confidence scores
   - Decision logged for audit and explainability

2. **Cipher Safety Monitoring**
   - All AI decisions monitored by Cipher layer
   - Decision safety validated against business policies
   - Anomalous decisions flagged for review

3. **Secure Result Handling** (STORY-05.02)
   - Scoring results stored with tenant isolation
   - Access tokens managed securely with refresh
   - No AI results cached in external systems

### Expected Events & Audit Records

- `ai.decision.made` event with model inputs and outputs
- `cipher.monitoring.active` event for safety validation
- `lead.scored` event with AI confidence and factors
- Complete audit trail of AI decision process

### Expected External Execution

- GHL contact tagged with scoring results
- Sales team notified based on AI routing decision
- No AI logic or models exposed to external systems
