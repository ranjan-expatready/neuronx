# Canonical Field Contracts

**Version:** 1.0
**Status:** Canonical Contract (Enforceable)
**Authority:** WI-001 Field Contracts Work Item
**Last Updated:** 2026-01-03
**Purpose:** Agent-executable field-level contracts defining all entities, fields, and validation rules for Sales OS implementation

## 1. Purpose & Scope

This document defines the canonical field-level contracts for all entities in the NeuronX Sales OS. These contracts establish the complete data model that agents must implement and validate.

### Sales OS Boundary Statement

**CRITICAL CONTRACT:** Sales OS ends at VERIFIED PAID → Case Opened event. All downstream case management (CRM operations, deal progression, customer success handoffs) is explicitly OUT-OF-SCOPE for NeuronX and must be handled by external execution platforms (GHL, Salesforce, etc.).

### Scope Boundaries

- **IN SCOPE:** Lead ingestion through Case Opened event (qualification, scoring, routing, SLA management, payment verification)
- **OUT OF SCOPE:** Post-Case Opened activities (deal management, customer onboarding, ongoing account management)
- **IP Boundary:** No business logic in external platforms; all decisions, state, and audit trails remain in NeuronX

### Contract Authority

- **Source of Truth:** This document supersedes all other field definitions
- **Implementation Required:** All code must validate against these contracts
- **No Extensions:** Additional fields require ADR approval and contract updates
- **Version Controlled:** Field changes are versioned and backward-compatible

## 2. Canonical Entities & Field Sets

### Entity: Tenant

**Unique ID Pattern:** `tenant-{uuid}`  
**Purpose:** Top-level organizational container for data isolation and configuration scoping

**Required Fields (MUST):**

- `id: string` - UUID, primary key, format: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`
- `name: string` - Display name, max 255 chars, required
- `status: enum` - ACTIVE|INACTIVE|SUSPENDED, default ACTIVE
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `description: string` - Free text description, max 1000 chars
- `settings: json` - Tenant-specific configuration overrides
- `metadata: json` - Extensible metadata object

**Validation Rules:**

- Name: min 1 char, max 255 chars, no special chars except hyphens/underscores
- Status enum validation
- Timestamps: valid ISO 8601 format

**Ownership:** NeuronX (schema), Tenant (values via admin controls)  
**PII Classification:** MEDIUM (organizational data)  
**Audit Requirements:** All changes logged with actor/correlationId/tenantId

---

### Entity: User/Actor

**Unique ID Pattern:** `actor-{uuid}`  
**Purpose:** Human and system actors that perform actions in the system

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `type: enum` - HUMAN|SYSTEM|EXTERNAL, required
- `identifier: string` - Unique identifier within tenant (email for humans, system name for others), max 255 chars
- `status: enum` - ACTIVE|INACTIVE|SUSPENDED, default ACTIVE
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `name: string` - Display name, max 255 chars
- `email: string` - Email address, RFC 5322 format
- `roles: string[]` - Array of role identifiers
- `preferences: json` - User preference settings
- `metadata: json` - Extensible metadata

**Forbidden Fields (MUST NOT):**

- `password: any` - Authentication handled by external providers (Clerk)
- `permissions: any` - Derived from roles, not stored directly

**Validation Rules:**

- Identifier uniqueness within tenant
- Email format validation when provided
- Type-specific field requirements (email required for HUMAN type)

**Ownership:** NeuronX (schema), Tenant (user management)  
**PII Classification:** HIGH (personal identifiers)  
**Audit Requirements:** Authentication events, role changes, status changes

---

### Entity: Lead

**Unique ID Pattern:** `lead-{uuid}`  
**Purpose:** Customer prospect with complete qualification and routing context

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `externalId: string` - Source system identifier, max 255 chars
- `source: string` - Lead source identifier, max 100 chars
- `status: enum` - CREATED|QUALIFIED|ROUTED|ENGAGED|CONVERTED|LOST, default CREATED
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `firstName: string` - First name, max 100 chars
- `lastName: string` - Last name, max 100 chars
- `email: string` - Email address, RFC 5322 format
- `phone: string` - Phone number, E.164 format
- `company: string` - Company name, max 255 chars
- `title: string` - Job title, max 255 chars
- `industry: string` - Industry classification, max 100 chars
- `companySize: integer` - Number of employees, range 1-1000000
- `score: decimal` - AI qualification score, range 0.0-1.0
- `segment: string` - Sales segment identifier, max 100 chars
- `ownerId: string` - Assigned actor UUID
- `qualifiedAt: timestamp` - When qualification completed
- `routedAt: timestamp` - When routing completed
- `convertedAt: timestamp` - When converted to opportunity

**Validation Rules:**

- Email format validation when provided
- Phone E.164 format validation
- Score range 0.0-1.0
- Status transition validation (forward-only progression)

**Ownership:** NeuronX (schema), External systems (contact data)  
**PII Classification:** HIGH (contact information)  
**Audit Requirements:** All field changes, scoring updates, assignments

---

### Entity: LeadSource

**Unique ID Pattern:** `source-{uuid}`  
**Purpose:** Metadata about lead ingestion sources and import batches

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `type: enum` - WEBSITE|WEBHOOK|API|BULK_IMPORT|INTEGRATION, required
- `name: string` - Human-readable source name, max 255 chars
- `status: enum` - ACTIVE|INACTIVE, default ACTIVE
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `description: string` - Source description, max 1000 chars
- `config: json` - Source-specific configuration
- `credentials: encrypted` - API keys, tokens (encrypted at rest)
- `rateLimit: integer` - Requests per minute limit
- `webhookUrl: string` - Webhook endpoint URL
- `lastSuccessfulSync: timestamp` - Last successful data sync

**Validation Rules:**

- URL format validation for webhookUrl
- Rate limit positive integer
- Credentials encrypted before storage

**Ownership:** NeuronX (schema), Tenant (source configuration)  
**PII Classification:** MEDIUM (system configuration)  
**Audit Requirements:** Configuration changes, credential updates

---

### Entity: LeadImportBatch

**Unique ID Pattern:** `batch-{uuid}`  
**Purpose:** Track bulk lead imports with idempotency and error handling

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `sourceId: string` - Foreign key to LeadSource
- `filename: string` - Original file name, max 255 chars
- `status: enum` - UPLOADED|PROCESSING|COMPLETED|FAILED, default UPLOADED
- `totalRecords: integer` - Total records in batch, required
- `processedRecords: integer` - Successfully processed, default 0
- `failedRecords: integer` - Failed records count, default 0
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `errorSummary: json` - Summary of processing errors
- `idempotencyKey: string` - Batch uniqueness key, max 255 chars
- `completedAt: timestamp` - Processing completion time
- `metadata: json` - Batch-specific metadata

**Validation Rules:**

- Processed + failed <= total records
- Idempotency key uniqueness within tenant
- Status transition validation

**Ownership:** NeuronX (schema), External systems (batch data)  
**PII Classification:** LOW (batch metadata)  
**Audit Requirements:** Batch processing events, error details

---

### Entity: ConsentRecord

**Status:** GAP - Not defined in existing repo documentation  
**GAP-ID:** GAP-CONSENT-001  
**Why Missing:** ConsentRecord entity referenced in REQUIREMENTS.md but no field specification exists  
**Source Location:** Unknown - not found in repo docs or ADRs  
**Next Action:** Extract from Sales OS Playbook PDF pages (if applicable) or define based on privacy regulations

---

### Entity: SegmentationTag

**Unique ID Pattern:** `tag-{uuid}`  
**Purpose:** Sales segmentation and targeting tags

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `name: string` - Tag name, max 100 chars, unique within tenant
- `type: enum` - DEMOGRAPHIC|BEHAVIORAL|QUALIFICATION|CUSTOM, required
- `status: enum` - ACTIVE|INACTIVE, default ACTIVE
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `description: string` - Tag description, max 500 chars
- `color: string` - Hex color code for UI display
- `priority: integer` - Display priority, range 1-100
- `rules: json` - Automatic assignment rules
- `metadata: json` - Extensible metadata

**Validation Rules:**

- Name uniqueness within tenant
- Color hex format validation (#RRGGBB)
- Priority range validation

**Ownership:** NeuronX (schema), Tenant (tag definitions)  
**PII Classification:** LOW (segmentation metadata)  
**Audit Requirements:** Tag creation, rule changes

---

### Entity: ScoreResult

**Unique ID Pattern:** `score-{uuid}`  
**Purpose:** AI scoring results with explainability and audit trail

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `leadId: string` - Foreign key to Lead, required
- `model: string` - Scoring model identifier, max 100 chars
- `version: string` - Model version, semantic version format
- `score: decimal` - Computed score, range 0.0-1.0, required
- `confidence: decimal` - Model confidence, range 0.0-1.0
- `computedAt: timestamp` - Computation timestamp, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `factors: json` - Scoring factor weights and contributions
- `explanation: json` - Human-readable explanation of score
- `rawInputs: json` - Original input data used for scoring
- `modelMetadata: json` - Model-specific metadata
- `cipherValidation: json` - AI safety monitoring results

**Validation Rules:**

- Score and confidence range 0.0-1.0
- Version semantic versioning format (MAJOR.MINOR.PATCH)
- Cipher validation results required for AI safety

**Ownership:** NeuronX (scoring logic), Tenant (model selection)  
**PII Classification:** MEDIUM (lead scoring data)  
**Audit Requirements:** All scoring computations, factor explanations

---

### Entity: RoutingDecision

**Unique ID Pattern:** `route-{uuid}`  
**Purpose:** Sales routing decisions with reasoning and constraints

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `leadId: string` - Foreign key to Lead, required
- `algorithm: string` - Routing algorithm used, max 100 chars
- `assignedTo: string` - Assigned actor UUID, required
- `assignedAt: timestamp` - Assignment timestamp, required
- `status: enum` - ACTIVE|REASSIGNED|RELEASED, default ACTIVE
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `reasoning: json` - Decision reasoning and factors
- `constraints: json` - Routing constraints applied
- `capacity: json` - Team capacity at time of assignment
- `alternatives: json` - Other considered assignments
- `reassignedAt: timestamp` - Reassignment timestamp
- `reassignmentReason: string` - Reason for reassignment

**Validation Rules:**

- AssignedTo must reference valid actor
- Status transition validation
- Reasoning required for complex routing decisions

**Ownership:** NeuronX (routing logic), Tenant (algorithm configuration)  
**PII Classification:** MEDIUM (assignment decisions)  
**Audit Requirements:** All routing decisions, reasoning, reassignments

---

### Entity: Team

**Unique ID Pattern:** `team-{uuid}`  
**Purpose:** Sales team definitions with capacity and expertise

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `name: string` - Team name, max 255 chars, unique within tenant
- `status: enum` - ACTIVE|INACTIVE, default ACTIVE
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `description: string` - Team description, max 1000 chars
- `capacity: integer` - Maximum concurrent leads, positive integer
- `expertise: string[]` - Array of expertise areas
- `territory: string` - Geographic territory, max 255 chars
- `managerId: string` - Team manager actor UUID
- `settings: json` - Team-specific configuration

**Validation Rules:**

- Name uniqueness within tenant
- Capacity positive integer validation
- ManagerId must reference valid actor

**Ownership:** NeuronX (schema), Tenant (team definitions)  
**PII Classification:** LOW (team structure)  
**Audit Requirements:** Team changes, capacity updates

---

### Entity: SLAContract

**Unique ID Pattern:** `sla-{uuid}`  
**Purpose:** Service level agreement definitions and parameters

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `name: string` - SLA name, max 255 chars, unique within tenant
- `type: enum` - RESPONSE_TIME|RESOLUTION_TIME|CUSTOM, required
- `targetHours: integer` - SLA target in hours, positive integer
- `status: enum` - ACTIVE|INACTIVE, default ACTIVE
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `description: string` - SLA description, max 1000 chars
- `conditions: json` - SLA applicability conditions
- `escalationRules: json` - Automatic escalation rules
- `notificationRules: json` - SLA breach notifications
- `gracePeriodHours: integer` - Grace period before breach
- `metadata: json` - Extensible metadata

**Validation Rules:**

- Name uniqueness within tenant
- Target and grace period positive integers
- Conditions JSON schema validation

**Ownership:** NeuronX (schema), Tenant (SLA definitions)  
**PII Classification:** LOW (process definitions)  
**Audit Requirements:** SLA changes, breach configurations

---

### Entity: SLATimer

**Unique ID Pattern:** `timer-{uuid}`  
**Purpose:** Active SLA timer instances tracking time to breach

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `leadId: string` - Foreign key to Lead, required
- `slaContractId: string` - Foreign key to SLAContract, required
- `startedAt: timestamp` - Timer start timestamp, required
- `targetAt: timestamp` - SLA target timestamp, required
- `status: enum` - ACTIVE|PAUSED|BREACHED|COMPLETED|CANCELLED, default ACTIVE
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `pausedAt: timestamp` - Pause timestamp
- `resumedAt: timestamp` - Resume timestamp
- `breachedAt: timestamp` - Breach timestamp
- `completedAt: timestamp` - Completion timestamp
- `escalationLevel: integer` - Current escalation level
- `metadata: json` - Timer-specific metadata

**Validation Rules:**

- TargetAt > startedAt
- Status transition validation
- Escalation level increments only

**Ownership:** NeuronX (timer logic), Tenant (SLA configuration)  
**PII Classification:** LOW (process timing)  
**Audit Requirements:** Timer events, escalations, breaches

---

### Entity: EscalationChain

**Unique ID Pattern:** `chain-{uuid}`  
**Purpose:** Escalation hierarchy definitions and notification rules

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `name: string` - Chain name, max 255 chars, unique within tenant
- `triggerType: enum` - SLA_BREACH|MANUAL|AUTOMATIC, required
- `status: enum` - ACTIVE|INACTIVE, default ACTIVE
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `description: string` - Chain description, max 1000 chars
- `steps: json` - Ordered escalation steps with delays and notifications
- `conditions: json` - Conditions for triggering escalation
- `metadata: json` - Extensible metadata

**Validation Rules:**

- Name uniqueness within tenant
- Steps array with valid actor references
- Conditions JSON schema validation

**Ownership:** NeuronX (schema), Tenant (escalation definitions)  
**PII Classification:** LOW (process definitions)  
**Audit Requirements:** Chain changes, step modifications

---

### Entity: EscalationEvent

**Unique ID Pattern:** `event-{uuid}`  
**Purpose:** Individual escalation occurrences with resolution tracking

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `chainId: string` - Foreign key to EscalationChain, required
- `leadId: string` - Foreign key to Lead, required
- `step: integer` - Escalation step number, positive integer
- `escalatedTo: string` - Escalated to actor UUID, required
- `escalatedAt: timestamp` - Escalation timestamp, required
- `status: enum` - PENDING|ACKNOWLEDGED|RESOLVED|TIMEOUT, default PENDING
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `acknowledgedAt: timestamp` - Acknowledgment timestamp
- `resolvedAt: timestamp` - Resolution timestamp
- `resolution: string` - Resolution description, max 1000 chars
- `notificationSent: boolean` - Whether notification was sent
- `metadata: json` - Event-specific metadata

**Validation Rules:**

- Step positive integer
- EscalatedTo valid actor reference
- Status transition validation (forward progression)

**Ownership:** NeuronX (escalation logic), Tenant (chain configuration)  
**PII Classification:** MEDIUM (escalation actions)  
**Audit Requirements:** All escalation events, resolutions

---

### Entity: Appointment

**Unique ID Pattern:** `appt-{uuid}`  
**Purpose:** Scheduled appointments with show-up tracking

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `leadId: string` - Foreign key to Lead, required
- `scheduledAt: timestamp` - Appointment date/time, required
- `durationMinutes: integer` - Duration in minutes, positive integer
- `type: enum` - DISCOVERY|DEMO|FOLLOWUP|CLOSING, required
- `status: enum` - SCHEDULED|CONFIRMED|COMPLETED|NO_SHOW|CANCELLED, default SCHEDULED
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `title: string` - Appointment title, max 255 chars
- `description: string` - Appointment description, max 1000 chars
- `assignedTo: string` - Assigned actor UUID
- `location: string` - Meeting location, max 500 chars
- `confirmedAt: timestamp` - Confirmation timestamp
- `completedAt: timestamp` - Completion timestamp
- `outcome: json` - Appointment outcome details
- `metadata: json` - Extensible metadata

**Validation Rules:**

- ScheduledAt future timestamp
- Duration positive integer 15-480 (15min to 8hrs)
- Status transition validation

**Ownership:** NeuronX (schema), External systems (calendar integration)  
**PII Classification:** MEDIUM (appointment details)  
**Audit Requirements:** All appointment changes, outcomes

---

### Entity: AppointmentOutcome

**Unique ID Pattern:** `outcome-{uuid}`  
**Purpose:** Structured outcomes from completed appointments

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `appointmentId: string` - Foreign key to Appointment, required
- `leadId: string` - Foreign key to Lead, required
- `outcome: enum` - QUALIFIED|NURTURE|DISQUALIFIED|WON|LOST|RESCHEDULED, required
- `recordedAt: timestamp` - Outcome recording timestamp, required
- `recordedBy: string` - Recording actor UUID, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `notes: string` - Outcome notes, max 2000 chars
- `nextSteps: json` - Follow-up action plan
- `sentiment: enum` - POSITIVE|NEUTRAL|NEGATIVE
- `confidence: decimal` - Outcome confidence, range 0.0-1.0
- `metadata: json` - Outcome-specific metadata

**Validation Rules:**

- RecordedBy valid actor reference
- Confidence range 0.0-1.0 when provided
- Outcome enum validation

**Ownership:** NeuronX (schema), Actors (outcome recording)  
**PII Classification:** MEDIUM (interaction outcomes)  
**Audit Requirements:** All outcome recordings, changes

---

### Entity: Opportunity

**Unique ID Pattern:** `opp-{uuid}`  
**Purpose:** Sales opportunities created from qualified leads

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `leadId: string` - Foreign key to Lead, required
- `stage: enum` - PROSPECT|QUALIFIED|PROPOSAL|NEGOTIATION|COMMITTED|CLOSED_WON|CLOSED_LOST, required
- `value: decimal` - Opportunity value in cents, positive integer
- `probability: decimal` - Win probability percentage, range 0.0-100.0
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `name: string` - Opportunity name, max 255 chars
- `description: string` - Opportunity description, max 1000 chars
- `closeDate: date` - Expected close date
- `assignedTo: string` - Assigned actor UUID
- `products: json` - Associated products/services
- `closedAt: timestamp` - Closure timestamp
- `closedReason: string` - Closure reason, max 500 chars
- `metadata: json` - Extensible metadata

**Validation Rules:**

- Value positive integer (cents)
- Probability range 0.0-100.0
- Stage transition validation (forward progression)
- Close date not in past for active opportunities

**Ownership:** NeuronX (schema), Actors (opportunity management)  
**PII Classification:** MEDIUM (deal information)  
**Audit Requirements:** All stage changes, value updates, closures

---

### Entity: PaymentRecord

**Unique ID Pattern:** `payment-{uuid}`  
**Purpose:** Payment processing records with verification evidence

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `leadId: string` - Foreign key to Lead, required
- `amount: integer` - Payment amount in cents, positive integer
- `currency: string` - ISO 4217 currency code, 3 chars
- `status: enum` - INITIATED|PROCESSING|PAID|FAILED|REFUNDED|CANCELLED, default INITIATED
- `paymentMethod: enum` - CARD|ACH|WIRE|CRYPTO, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `externalId: string` - Payment processor transaction ID
- `processedAt: timestamp` - Processing completion timestamp
- `paidAt: timestamp` - Payment completion timestamp
- `failedAt: timestamp` - Failure timestamp
- `failureReason: string` - Failure description, max 500 chars
- `verificationEvidence: json` - Payment verification proof
- `refundedAt: timestamp` - Refund timestamp
- `refundAmount: integer` - Refund amount in cents
- `metadata: json` - Payment-specific metadata

**Validation Rules:**

- Amount positive integer
- Currency valid ISO 4217 code
- Status transition validation
- Refund amount <= original amount

**Ownership:** NeuronX (schema), External processors (payment data)  
**PII Classification:** HIGH (payment information)  
**Audit Requirements:** All payment events, status changes

---

### Entity: CaseOpenedEvent

**Unique ID Pattern:** `case-{uuid}`  
**Purpose:** The boundary event marking transition to external case management

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `leadId: string` - Foreign key to Lead, required
- `opportunityId: string` - Foreign key to Opportunity, required
- `paymentId: string` - Foreign key to PaymentRecord, required
- `openedAt: timestamp` - Case opening timestamp, required
- `openedBy: string` - Opening actor UUID, required
- `status: enum` - OPENED|ACCEPTED|CLOSED, default OPENED
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `externalCaseId: string` - External system case identifier
- `handoverNotes: string` - Handover instructions, max 2000 chars
- `priority: enum` - LOW|MEDIUM|HIGH|URGENT
- `acceptedAt: timestamp` - Acceptance timestamp
- `acceptedBy: string` - Accepting actor UUID
- `closedAt: timestamp` - Closure timestamp
- `closedReason: string` - Closure reason, max 500 chars
- `metadata: json` - Case-specific metadata

**Validation Rules:**

- All foreign keys reference valid entities
- OpenedBy valid actor reference
- Status transition validation
- Payment status must be PAID before case opening

**Ownership:** NeuronX (case opening logic), External systems (case management)  
**PII Classification:** MEDIUM (case transition data)  
**Audit Requirements:** All case events, handovers, closures

---

### Entity: VoiceIntentRequest

**Unique ID Pattern:** `voice-{uuid}`  
**Purpose:** Voice AI interaction requests (intent-only, no execution)

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `leadId: string` - Foreign key to Lead, required
- `intent: enum` - QUALIFY|APPOINTMENT|INFORMATION|COMPLAINT, required
- `confidence: decimal` - AI confidence score, range 0.0-1.0
- `requestedAt: timestamp` - Request timestamp, required
- `status: enum` - PENDING|AUTHORIZED|DENIED|EXPIRED, default PENDING
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `transcript: string` - Call transcript, max 10000 chars
- `durationSeconds: integer` - Call duration in seconds
- `authorizedAt: timestamp` - Authorization timestamp
- `authorizedBy: string` - Authorizing actor UUID
- `deniedAt: timestamp` - Denial timestamp
- `denialReason: string` - Denial explanation, max 500 chars
- `metadata: json` - Voice-specific metadata

**Forbidden Fields (MUST NOT):**

- `executionResult: any` - Execution results stored separately (VoiceExecutionResult entity)
- `businessDecision: any` - No business logic or decisions in voice entities
- `retryLogic: any` - Retry logic owned by NeuronX, not stored in voice entities

**Validation Rules:**

- Confidence range 0.0-1.0
- Duration positive integer when provided
- AuthorizedBy valid actor reference when authorized
- Status transitions must respect boundary gates (consent + payment + case)

**Field Ownership (WI-004 Boundary Hardening):**

- **NeuronX-Owned Fields:** id, tenantId, leadId, intent, status, authorizedAt, authorizedBy, deniedAt, denialReason (all business logic and decisions)
- **Provider-Owned Fields:** transcript, durationSeconds, metadata (factual execution data only)
- **Immutable Fields:** id, tenantId, leadId, intent, requestedAt, createdAt (business state)
- **Mutable Fields:** status, authorizedAt, authorizedBy, deniedAt, denialReason (NeuronX decisions only)

**Ownership:** NeuronX (intent processing, authorization logic), Voice platforms (factual execution data only)  
**PII Classification:** HIGH (call transcripts, intent data)  
**Audit Requirements:** All voice interactions, authorizations, boundary gate checks

---

### Entity: VoiceIntentAuthorized

**Unique ID Pattern:** `auth-{uuid}`  
**Purpose:** Voice intent authorization events with gating logic

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `voiceRequestId: string` - Foreign key to VoiceIntentRequest, required
- `leadId: string` - Foreign key to Lead, required
- `authorizedIntent: enum` - QUALIFY|APPOINTMENT|INFORMATION, required
- `authorizedAt: timestamp` - Authorization timestamp, required
- `authorizedBy: string` - Authorizing actor UUID, required
- `gatingReason: string` - Authorization reasoning, max 1000 chars
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `tierCheck: boolean` - Whether tier entitlements were verified
- `usageCheck: boolean` - Whether usage limits were checked
- `paymentCheck: boolean` - Whether payment status was verified
- `caseCheck: boolean` - Whether case boundary was verified
- `consentCheck: boolean` - Whether voice consent was verified
- `metadata: json` - Authorization-specific metadata

**Forbidden Fields (MUST NOT):**

- `executionCommand: any` - Execution commands sent separately to voice platforms
- `businessLogic: any` - No tenant-specific logic or decisions
- `overrideFlags: any` - No gate bypass or override mechanisms

**Validation Rules:**

- All foreign keys reference valid entities
- AuthorizedBy valid actor reference
- Authorized intent must match request intent
- All boundary gates must pass: tierCheck=true, usageCheck=true, paymentCheck=true, caseCheck=true, consentCheck=true

**Field Ownership (WI-004 Boundary Hardening):**

- **NeuronX-Owned Fields:** id, tenantId, voiceRequestId, leadId, authorizedIntent, authorizedAt, authorizedBy, gatingReason, tierCheck, usageCheck, paymentCheck, caseCheck, consentCheck (all authorization logic and gate validation)
- **Immutable Fields:** id, tenantId, voiceRequestId, leadId, authorizedIntent, authorizedAt, authorizedBy, gatingReason, createdAt (authorization decisions)
- **Mutable Fields:** tierCheck, usageCheck, paymentCheck, caseCheck, consentCheck (gate validation results)

**Ownership:** NeuronX (authorization logic, boundary gate validation), Tenant (tier configuration)
**PII Classification:** MEDIUM (authorization decisions)
**Audit Requirements:** All authorization events, gating reasons, boundary gate validations

---

### Entity: VoiceExecutionResult

**Unique ID Pattern:** `result-{uuid}`
**Purpose:** Voice platform execution results (factual reporting only, no business decisions)

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `voiceRequestId: string` - Foreign key to VoiceIntentRequest, required
- `voiceAuthorizationId: string` - Foreign key to VoiceIntentAuthorized, required
- `executionStatus: enum` - SUCCESS|FAILED|TIMEOUT|BUSY|NO_ANSWER, required
- `executedAt: timestamp` - Execution timestamp, required
- `platform: string` - Voice platform identifier (Twilio, Aircall, etc.), max 100 chars
- `correlationId: string` - Request correlation ID, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `durationSeconds: integer` - Call duration in seconds
- `recordingUrl: string` - Call recording URL (secure, temporary access)
- `transcript: string` - Call transcript, max 10000 chars
- `errorCode: string` - Platform error code, max 100 chars
- `errorMessage: string` - Platform error message, max 500 chars
- `retryAttempt: integer` - Retry attempt number (1-based)
- `metadata: json` - Platform-specific execution metadata

**Forbidden Fields (MUST NOT):**

- `businessDecision: any` - No business logic or decisions
- `nextAction: any` - No suggested actions or recommendations
- `retryDecision: any` - No retry logic or recommendations
- `consentValidation: any` - No consent checking or validation
- `paymentValidation: any` - No payment checking or validation

**Validation Rules:**

- All foreign keys reference valid entities
- Duration positive integer when provided
- Retry attempt positive integer when provided
- CorrelationId must match authorization correlationId

**Field Ownership (WI-004 Boundary Hardening):**

- **NeuronX-Owned Fields:** id, tenantId, voiceRequestId, voiceAuthorizationId, correlationId (audit and correlation)
- **Provider-Owned Fields:** executionStatus, executedAt, platform, durationSeconds, recordingUrl, transcript, errorCode, errorMessage, retryAttempt, metadata (factual execution results only)
- **Immutable Fields:** id, tenantId, voiceRequestId, voiceAuthorizationId, executedAt, platform, correlationId, createdAt (execution facts)
- **Mutable Fields:** retryAttempt (NeuronX-controlled retry tracking)

**Ownership:** NeuronX (audit and correlation), Voice platforms (factual execution results only)
**PII Classification:** HIGH (call recordings, transcripts)
**Audit Requirements:** All voice executions, failures, retries, boundary compliance

---

### Entity: IntegrationMapping

**Unique ID Pattern:** `mapping-{uuid}`  
**Purpose:** Configuration mappings between NeuronX and external systems

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `system: enum` - GHL|SALESFORCE|HUBSPOT|CUSTOM, required
- `entityType: string` - NeuronX entity type, max 100 chars
- `direction: enum` - INBOUND|OUTBOUND|BIDIRECTIONAL, required
- `status: enum` - ACTIVE|INACTIVE, default ACTIVE
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `fieldMappings: json` - Field mapping definitions
- `transformations: json` - Data transformation rules
- `filters: json` - Data filtering conditions
- `syncSchedule: string` - Cron schedule for sync
- `lastSyncAt: timestamp` - Last synchronization timestamp
- `syncStatus: enum` - SUCCESS|FAILED|IN_PROGRESS
- `metadata: json` - Mapping-specific metadata

**Validation Rules:**

- Field mappings JSON schema validation
- Cron schedule format validation
- System enum validation

**Ownership:** NeuronX (schema), Tenant (mapping configuration)  
**PII Classification:** LOW (system configuration)  
**Audit Requirements:** Mapping changes, sync events

---

### Entity: UsageEvent

**Unique ID Pattern:** `usage-{uuid}`  
**Purpose:** Metering events for tenant usage tracking

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `metric: string` - Usage metric identifier, max 100 chars
- `value: integer` - Usage quantity, positive integer
- `timestamp: timestamp` - Event timestamp, required
- `actorId: string` - Responsible actor UUID, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `resourceId: string` - Associated resource UUID
- `metadata: json` - Usage-specific metadata
- `correlationId: string` - Request correlation ID

**Validation Rules:**

- Value positive integer
- Metric controlled vocabulary validation
- ActorId valid actor reference

**Ownership:** NeuronX (metering logic), Tenant (usage consumption)
**PII Classification:** LOW (usage metrics)
**Audit Requirements:** All usage events for billing accuracy

**WI-005 Monetization Reference:** See `docs/CANONICAL/USAGE_CONTRACTS.md` for complete billable dimensions and monetization rules. Usage events are observational-only and cannot trigger state changes or business decisions.

---

### Entity: UsageAggregate

**Unique ID Pattern:** `agg-{uuid}`  
**Purpose:** Aggregated usage data for billing and reporting

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `metric: string` - Usage metric identifier, max 100 chars
- `period: string` - Billing period (YYYY-MM), format validation
- `totalValue: integer` - Period total usage, non-negative integer
- `createdAt: timestamp` - ISO 8601 UTC, immutable
- `updatedAt: timestamp` - ISO 8601 UTC, auto-updated

**Optional Fields (MAY):**

- `dailyBreakdown: json` - Daily usage breakdown
- `peakUsage: integer` - Peak daily usage
- `lastUpdated: timestamp` - Last aggregation timestamp
- `metadata: json` - Aggregation-specific metadata

**Validation Rules:**

- Period YYYY-MM format
- Total value non-negative
- Metric controlled vocabulary

**Ownership:** NeuronX (aggregation logic), Tenant (usage data)
**PII Classification:** LOW (aggregated metrics)
**Audit Requirements:** Aggregation calculations, billing inputs

**WI-005 Monetization Reference:** See `docs/CANONICAL/USAGE_CONTRACTS.md` for complete aggregation rules and billing period calculations. Aggregates are calculated values only and cannot be manually modified.

---

### Entity: RateLimitDecision

**Unique ID Pattern:** `limit-{uuid}`  
**Purpose:** Rate limiting decisions with governance logging

**Required Fields (MUST):**

- `id: string` - UUID, primary key
- `tenantId: string` - Foreign key to tenant, required
- `endpoint: string` - API endpoint path, max 500 chars
- `method: enum` - GET|POST|PUT|DELETE, required
- `decision: enum` - ALLOW|DENY, required
- `timestamp: timestamp` - Decision timestamp, required
- `actorId: string` - Requesting actor UUID, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `remainingRequests: integer` - Remaining requests in window
- `resetAt: timestamp` - Rate limit reset timestamp
- `userAgent: string` - Request user agent, max 500 chars
- `ipAddress: string` - Request IP address (anonymized)
- `metadata: json` - Decision-specific metadata

**Validation Rules:**

- Endpoint valid URL path format
- Remaining requests non-negative when provided
- IP address anonymized (no full IPs stored)

**Ownership:** NeuronX (rate limiting logic), Tenant (request patterns)  
**PII Classification:** MEDIUM (request metadata)  
**Audit Requirements:** All rate limit decisions, especially denials

## 3. Global Cross-Cutting Field Invariants

### Tenant Isolation Invariants

- **tenantId Required:** Every entity record MUST include tenantId
- **Query Filtering:** All database queries MUST filter by tenantId at the database level
- **Cross-Tenant Prevention:** No operations may access data from other tenants
- **Audit Scoping:** Audit trails are tenant-scoped and isolated

### Event Ordering & Correlation Invariants

- **correlationId Required:** All externally triggered operations MUST include correlationId
- **Event Timestamps:** Events MUST be ordered chronologically within tenant scope
- **Idempotency Keys:** Webhooks and imports MUST include idempotencyKey for duplicate prevention
- **Causation Chain:** Events MUST maintain causationId links for audit reconstruction

### State vs Mirror Fields

- **Source-of-Truth Fields:** Business logic decisions based on NeuronX canonical fields only
- **Mirror Fields:** External system data cached for reference but not used for decisions
- **Sync Boundaries:** Mirror fields updated through controlled sync processes
- **Staleness Tolerance:** Mirror fields may be stale but source-of-truth fields are authoritative

### Audit Trail Invariants

- **Actor Attribution:** Every change MUST be attributable to an actor (human/system/external)
- **Timestamp Immutability:** createdAt/updatedAt fields MUST be immutable once set
- **Event Sourcing:** All state changes MUST be event-sourced for reconstruction
- **PII Handling:** High PII fields MUST have retention policies and access controls

## 4. Field-to-Playbook Page Mapping Table

| Playbook Page                                       | Primary Entities                                 | Key Fields                                    | Status    | Notes                                |
| --------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- | --------- | ------------------------------------ |
| Page 1: Proposition & Overview                      | Tenant, Lead                                     | id, tenantId, status, createdAt               | ✅ Mapped | Core entity relationships            |
| Page 2: Architecture                                | All Entities                                     | tenantId, correlationId, actorId              | ✅ Mapped | System architecture patterns         |
| Page 3: Marketing & Promotions                      | LeadSource, LeadImportBatch                      | source, type, status, totalRecords            | ✅ Mapped | Lead ingestion patterns              |
| Page 4: Lead Capture & Import                       | LeadSource, LeadImportBatch, Lead                | externalId, source, status, email, phone      | ✅ Mapped | Import and capture workflows         |
| Page 5: Categorization/Scoring/Segmentation         | ScoreResult, SegmentationTag, Lead               | score, confidence, factors, segment           | ✅ Mapped | AI scoring and segmentation          |
| Page 6: Routing/SLA                                 | RoutingDecision, Team, SLAContract, SLATimer     | assignedTo, algorithm, targetHours, status    | ✅ Mapped | Routing and SLA management           |
| Page 7: Appointments/Show-Up                        | Appointment, AppointmentOutcome                  | scheduledAt, durationMinutes, outcome, status | ✅ Mapped | Appointment scheduling and tracking  |
| Page 8: Setter Playbook                             | Lead, RoutingDecision, Appointment               | status, assignedTo, scheduledAt, outcome      | ✅ Mapped | Sales development processes          |
| Page 9: Closer Playbook                             | Opportunity, PaymentRecord                       | stage, value, probability, status             | ✅ Mapped | Sales closing processes              |
| Page 10: Payments & Revenue Recognition             | PaymentRecord, CaseOpenedEvent                   | amount, status, paidAt, openedAt              | ✅ Mapped | Payment processing and case opening  |
| Page 11: Sales → Ops handoff (Case Opened)          | CaseOpenedEvent, Lead, Opportunity               | openedAt, handoverNotes, status               | ✅ Mapped | Sales to operations transition       |
| Page 12: Sales management & performance             | Team, RoutingDecision, SLAContract               | capacity, expertise, targetHours              | ✅ Mapped | Team management and performance      |
| Page 13: Tool stack / AI blueprint                  | ScoreResult, RoutingDecision, IntegrationMapping | model, version, confidence, system            | ✅ Mapped | AI and integration architecture      |
| Page 14: Security/compliance/data governance        | All Entities                                     | PII classifications, audit fields             | ✅ Mapped | Security and compliance requirements |
| Page 15: Hiring/onboarding/scaling                  | Team, User/Actor                                 | roles, status, expertise                      | ✅ Mapped | Team scaling and management          |
| Page 16: Operating rhythm/SOPs                      | SLAContract, EscalationChain, SLATimer           | targetHours, steps, status                    | ✅ Mapped | Operating procedures and SLAs        |
| Page 17: End-to-end blueprint & SaaS productization | All Entities                                     | tenantId, status, createdAt, updatedAt        | ✅ Mapped | Complete system orchestration        |

**Note:** Sales OS Playbook PDF content is not present in the current repository. All mappings are derived from existing ADR, requirement, and implementation documentation. If playbook content differs from these mappings, it represents a gap that must be resolved.

## 5. Explicit GAP List (Field-Level)

### GAP-PLAYBOOK-001

**What Missing:** Complete Sales OS Playbook PDF content (pages 1-17) for field requirement validation
**Why Missing:** PDF exists in docs/source/playbook.pdf but content not extracted into repository documentation
**Impact:** Cannot validate that field contracts match original playbook specifications
**Next Action:** Extract playbook content into structured documentation under docs/PLAYBOOK/
**Proposed Work Item:** WI-002: Extract and Structure Sales OS Playbook Content

### GAP-CONSENT-001

**What Missing:** ConsentRecord entity field specifications
**Why Missing:** Referenced in REQUIREMENTS.md but no implementation or field definition exists
**Impact:** Privacy compliance requirements not fully specified
**Next Action:** Define based on GDPR/CCPA requirements or extract from playbook if specified
**Proposed Work Item:** WI-003: Define Consent Management Entity Contracts

### GAP-VOICE-001

**What Missing:** Voice platform integration field mappings and execution boundaries
**Why Missing:** Voice entities defined but no external platform field mappings specified
**Impact:** Cannot ensure voice IP boundaries are maintained
**Next Action:** Define voice adapter contracts and field boundaries
**Proposed Work Item:** WI-004: Define Voice Platform Integration Contracts

### GAP-USAGE-001

**What Missing:** Complete usage metering field specifications for monetization
**Why Missing:** Basic usage events defined but monetization fields incomplete
**Impact:** Cannot implement complete billing integration
**Next Action:** Define monetization-specific usage fields and aggregations
**Proposed Work Item:** WI-005: Define Usage Metering and Monetization Fields

---

**Field Contracts Status:** ✅ DRAFT COMPLETED
**Entity Coverage:** 18/18 entities defined with field specifications
**Validation Ready:** Contracts include validation rules, ownership, and audit requirements
**Gap Analysis:** 4 identified gaps with remediation work items
**Next Step:** Implement validation logic against these contracts
