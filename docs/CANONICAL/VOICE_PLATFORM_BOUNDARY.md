# Voice Platform Boundary Contract

**Version:** 1.0
**Status:** Canonical Contract (Enforceable)
**Authority:** WI-004 Voice Platform Boundary Hardening
**Last Updated:** 2026-01-03
**Purpose:** Agent-executable boundary contracts ensuring voice platforms remain execution-only systems

## 1. Purpose & Scope

This contract establishes immutable boundaries for voice platforms (Twilio, Aircall, custom AI voice agents) within the NeuronX Sales OS. Voice platforms are locked as non-authoritative, stateless executors that cannot make business decisions, bypass safety gates, or mutate NeuronX state.

### Authority Model (Non-Negotiable)

- **NeuronX = Sole Authority:** All decisions, state changes, and business logic reside exclusively in NeuronX
- **Voice Platforms = Execution-Only:** Voice systems execute NeuronX commands but cannot decide, reason, or act autonomously
- **Zero Decision Rights:** Voice platforms have no authority over eligibility, consent, payment, case opening, or retry logic

### Boundary Scope

- **In Scope:** All voice interactions (phone calls, AI voice agents, voice recordings, voice AI processing)
- **Out of Scope:** Non-voice communication channels (email, SMS, chat, video)
- **Sales OS Boundary:** All voice contracts terminate at VERIFIED PAID → CaseOpened event

## 2. Hard Execution Gates (ALL REQUIRED)

Voice platform execution requires ALL THREE gates to be satisfied:

### Gate 1: Consent Validation

**Requirement:** Valid ConsentRecord with `consentScope = "voice"`
**Validation:**

- ConsentRecord.status = "granted"
- ConsentRecord.consentScope = "voice"
- ConsentRecord.subjectId matches the call recipient
- ConsentRecord.tenantId matches the tenant context
  **Default:** ❌ DENY (no consent = no voice execution)

### Gate 2: Payment Verification

**Requirement:** PaymentRecord.status = "VERIFIED_PAID"
**Validation:**

- PaymentRecord.leadId matches the call recipient
- PaymentRecord.status = "PAID" (verified by NeuronX)
- PaymentRecord.currency and amount validated
- PaymentRecord.tenantId matches tenant context
  **Default:** ❌ DENY (no verified payment = no voice execution)

### Gate 3: Case Boundary

**Requirement:** Opportunity.state = "CASE_OPENED"
**Validation:**

- CaseOpenedEvent.leadId matches the call recipient
- CaseOpenedEvent.opportunityId is valid
- CaseOpenedEvent.openedAt timestamp exists
- CaseOpenedEvent.status = "OPENED"
  **Default:** ❌ DENY (pre-case voice = blocked)

### Gate Logic

- **AND Logic:** All three gates must pass
- **No Overrides:** Gates cannot be bypassed or inferred
- **No Fallbacks:** Missing gate data = hard denial
- **Audit Required:** All gate checks must be logged

## 3. Allowed vs Forbidden Capabilities

### What Voice Platforms MAY Do

| Capability               | Description                                | Authority                          | Audit Required |
| ------------------------ | ------------------------------------------ | ---------------------------------- | -------------- |
| **Execute Commands**     | Receive and execute NeuronX voice commands | NeuronX (command source)           | Yes            |
| **Provide Status**       | Report call status, duration, recordings   | Voice Platform (factual reporting) | Yes            |
| **Handle Connectivity**  | Manage phone network connectivity          | Voice Platform (infrastructure)    | No             |
| **Generate Transcripts** | Create call transcripts from audio         | Voice Platform (processing)        | Yes            |
| **Store Recordings**     | Temporarily store call audio               | Voice Platform (infrastructure)    | Yes            |

### What Voice Platforms MUST NEVER Do

| Forbidden Action            | Reason                                           | Consequence | Audit Trigger |
| --------------------------- | ------------------------------------------------ | ----------- | ------------- |
| **Decide Eligibility**      | Only NeuronX decides who can receive voice calls | Hard deny   | Critical      |
| **Bypass Consent**          | Consent validation is NeuronX-only               | Hard deny   | Critical      |
| **Bypass Payment**          | Payment verification is NeuronX-only             | Hard deny   | Critical      |
| **Open Cases**              | Case opening is NeuronX boundary event           | Hard deny   | Critical      |
| **Retry Autonomously**      | Retry logic is NeuronX-controlled                | Hard deny   | Critical      |
| **Mutate Business State**   | All state changes go through NeuronX events      | Hard deny   | Critical      |
| **Cache NeuronX Logic**     | No tenant-specific logic storage                 | Hard deny   | Critical      |
| **Make Business Decisions** | All decisions are NeuronX-only                   | Hard deny   | Critical      |
| **Override Gates**          | Gate validation is NeuronX-only                  | Hard deny   | Critical      |
| **Maintain Memory**         | Stateless execution only                         | Hard deny   | Critical      |

## 4. Retry & Failure Semantics

### Retry Authority

- **NeuronX Owns Retry Logic:** Only NeuronX decides retry attempts, timing, and conditions
- **Voice Platforms Report Only:** Voice systems report failures but do not retry autonomously
- **No Provider Retry:** Voice platforms must not implement automatic retry mechanisms

### Backoff Ownership

- **NeuronX Controls Backoff:** Exponential backoff, jitter, and timing controlled by NeuronX
- **Provider Neutral:** Voice platforms do not implement backoff algorithms
- **Configurable Limits:** Max attempts defined in NeuronX configuration per tenant

### Failure Handling

- **Mandatory Audit:** Every voice failure must be audited with correlationId
- **Failure Reporting:** Voice platforms report failures to NeuronX immediately
- **No Autonomous Action:** Voice platforms do not attempt recovery or alternative actions
- **State Preservation:** NeuronX maintains all retry state and attempt counts

### Retry Limits

- **Max Attempts:** Configurable per tenant (default: 3 attempts)
- **Time Windows:** Retry windows defined by NeuronX (default: 24 hours)
- **Entitlement Based:** Retry limits respect tenant entitlements
- **Audit Trail:** All retry attempts fully auditable

## 5. AI Voice Agents (Special Constraints)

### Authority Restrictions

- **No Autonomy:** AI voice agents have zero decision-making authority
- **No Reasoning:** AI agents cannot reason about eligibility, consent, or payment status
- **No Memory:** AI agents cannot maintain tenant-specific logic or state
- **No Learning:** AI agents cannot learn from or adapt to tenant patterns

### Execution Boundaries

- **Command-Driven:** AI agents execute only explicit NeuronX commands
- **Stateless Operation:** Each interaction is independent with no context carryover
- **No Inference:** AI agents cannot infer consent, payment, or eligibility from conversation
- **No Overrides:** AI agents cannot bypass or override NeuronX gates

### Data Restrictions

- **No Business Data:** AI agents cannot access or cache NeuronX business data
- **No Tenant Logic:** AI agents cannot store tenant-specific decision rules
- **No Historical Context:** AI agents cannot reference past interactions for decisions
- **No Pattern Learning:** AI agents cannot learn from tenant conversation patterns

### Audit Requirements

- **Command Audit:** Every AI command execution must be audited
- **Decision Audit:** Any AI-inferred action must be rejected and audited
- **Context Audit:** AI context usage must be logged and reviewed
- **Boundary Audit:** All boundary violations must trigger critical alerts

## 6. Voice Platform Integration Patterns

### Command-Response Pattern

```
NeuronX → Voice Command → Voice Platform → Execution Result → NeuronX
```

### Gate Validation Flow

```
1. NeuronX validates all three gates (consent + payment + case)
2. NeuronX sends voice command with correlationId
3. Voice platform executes command (no validation)
4. Voice platform returns result with correlationId
5. NeuronX processes result and updates state
```

### Error Handling Pattern

```
1. Voice platform encounters error
2. Voice platform reports error to NeuronX (no retry)
3. NeuronX decides retry action based on configuration
4. NeuronX sends new command or marks as failed
5. All steps are fully audited
```

## 7. Security & Compliance Boundaries

### Data Isolation

- **Tenant Data:** Voice platforms cannot access NeuronX tenant data
- **Business Logic:** Voice platforms cannot execute tenant-specific logic
- **State Changes:** Voice platforms cannot initiate NeuronX state changes
- **Audit Access:** Voice platforms cannot access NeuronX audit trails

### Authentication Boundaries

- **Command Authentication:** NeuronX authenticates all voice commands
- **Result Verification:** NeuronX verifies all voice platform responses
- **No Provider Auth:** Voice platforms do not authenticate NeuronX users
- **Correlation Security:** correlationId provides secure request tracing

### Compliance Isolation

- **Regulatory Logic:** Voice platforms have no knowledge of regulatory requirements
- **Consent Logic:** Voice platforms do not validate or check consent
- **Payment Logic:** Voice platforms do not verify payment status
- **Audit Responsibility:** NeuronX owns all compliance audit requirements

## 8. Monitoring & Alerting Boundaries

### Alert Triggers

- **Boundary Violations:** Any attempt to bypass gates triggers critical alert
- **Autonomous Actions:** Any autonomous retry or decision triggers alert
- **State Mutations:** Any attempt to mutate NeuronX state triggers alert
- **Consent Bypass:** Any consent validation bypass triggers alert

### Monitoring Scope

- **NeuronX Monitors:** All voice interactions monitored by NeuronX
- **Provider Reporting:** Voice platforms report factual metrics only
- **No Provider Monitoring:** Voice platforms do not monitor NeuronX behavior
- **Audit Completeness:** 100% of voice interactions must be auditable

---

**Voice Boundary Status:** ✅ HARD-LOCKED
**Authority Model:** ✅ NEURONX = SOLE AUTHORITY
**Execution Gates:** ✅ ALL THREE REQUIRED (CONSENT + PAYMENT + CASE)
**AI Agents:** ✅ FULLY CONSTRAINED
**Retry Logic:** ✅ NEURONX-OWNED ONLY
**Sales OS Boundary:** ✅ RESPECTED (ENDS AT CASEOPENED)
**Zero Business Logic:** ✅ IN VOICE PLATFORMS
