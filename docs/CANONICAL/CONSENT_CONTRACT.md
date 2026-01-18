# Consent Record Contract

**Version:** 1.0
**Status:** Canonical Contract (Enforceable)
**Authority:** WI-003 Consent, Compliance & Legal Safety
**Last Updated:** 2026-01-03
**Purpose:** Agent-executable consent contracts defining explicit, auditable consent as first-class data

## 1. Purpose & Scope

This contract defines ConsentRecord as first-class data within the Sales OS, establishing explicit consent requirements that protect NeuronX legally and block unsafe execution paths.

### Non-Negotiable Invariants

- **Consent as Data:** Consent is explicit, auditable data - never assumed or implicit
- **Denial by Default:** Absence of valid consent = hard denial of action
- **Auditable & Revocable:** All consent is timestamped, revocable, and fully auditable
- **Scoped & Specific:** Consent is granted for specific scopes only
- **Boundary Respected:** All consent contracts remain within Sales OS boundary (ends at VERIFIED PAID → CaseOpened)

### No Business Logic

**CRITICAL:** This contract defines consent data only. No business logic, validation rules, or enforcement mechanisms are included. Consent data exists independently of how it is used.

## 2. ConsentRecord Entity

**Unique ID Pattern:** `consent-{uuid}`  
**Purpose:** Canonical record of explicit consent granted by subjects for specific scopes within the Sales OS

### Required Fields (MUST)

| Field           | Type        | Validation                                       | Description                              |
| --------------- | ----------- | ------------------------------------------------ | ---------------------------------------- |
| `consentId`     | `string`    | UUID format, immutable                           | Primary key, unique identifier           |
| `tenantId`      | `string`    | Required, valid tenant UUID                      | Tenant scope for data isolation          |
| `subjectType`   | `enum`      | `lead \| contact`                                | Type of subject granting consent         |
| `subjectId`     | `string`    | Required, valid subject UUID                     | Reference to lead or contact             |
| `consentScope`  | `enum`      | `marketing \| communication \| voice \| payment` | Specific scope of granted consent        |
| `consentStatus` | `enum`      | `granted \| revoked \| expired`                  | Current status of consent                |
| `source`        | `enum`      | `form \| webhook \| api \| import`               | How consent was captured                 |
| `grantedAt`     | `timestamp` | ISO 8601 UTC, required                           | When consent was granted                 |
| `revokedAt`     | `timestamp` | ISO 8601 UTC, nullable                           | When consent was revoked (if applicable) |
| `jurisdiction`  | `string`    | Opaque string, max 100 chars                     | Jurisdiction identifier (no law logic)   |
| `evidenceRef`   | `string`    | Immutable reference, max 500 chars               | Reference to consent evidence            |
| `correlationId` | `string`    | Required, UUID                                   | Request correlation for audit trails     |
| `createdAt`     | `timestamp` | ISO 8601 UTC, immutable                          | Record creation timestamp                |
| `updatedAt`     | `timestamp` | ISO 8601 UTC, auto-updated                       | Record modification timestamp            |

### Field Validation Rules

- **consentId:** `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`
- **tenantId:** Must reference valid tenant, required for all operations
- **subjectId:** Must reference valid lead/contact within tenant scope
- **consentScope:** Enum validation, no expansion without ADR approval
- **consentStatus:** Status transition validation (granted → revoked/expired only)
- **grantedAt:** Must be past timestamp, cannot be future
- **revokedAt:** Must be after grantedAt when present, nullable otherwise
- **jurisdiction:** Opaque string, no validation logic, stored as-provided
- **evidenceRef:** Immutable once set, cannot be modified
- **correlationId:** Required for all consent operations

### Audit Trail Requirements

**Append-Only Audit Fields:**

- `auditTrail: json[]` - Array of audit entries, append-only
- Each entry contains: `timestamp`, `actorId`, `action`, `reason`, `correlationId`

**Audit Actions:**

- `consent.granted` - Initial consent creation
- `consent.revoked` - Consent revocation
- `consent.expired` - Consent expiration
- `consent.evidence.updated` - Evidence reference update (rare, with justification)

**Audit Invariants:**

- Audit trail cannot be modified or deleted
- All consent status changes are audited
- Actor attribution required for all changes
- Correlation ID required for all audit entries

## 3. Consent Scope Definitions

### marketing

**Scope:** Permission for marketing outreach and promotional communications
**Includes:** Email newsletters, promotional SMS, advertising targeting
**Excludes:** Sales communications, transactional messages

### communication

**Scope:** Permission for sales and support communications
**Includes:** Lead nurturing, follow-up sequences, appointment reminders
**Excludes:** Promotional marketing, third-party data sharing

### voice

**Scope:** Permission for voice-based interactions and AI voice agents
**Includes:** Phone calls, voice recordings, voice AI processing
**Excludes:** Text-based communications, email interactions

### payment

**Scope:** Permission for payment processing and financial transactions
**Includes:** Payment method storage, transaction processing, payment communications
**Excludes:** Marketing communications, general data processing

## 4. Action → Consent Blocking Matrix

This declarative matrix defines which consent scopes are required for specific actions. **This is data-only - no enforcement logic.**

| Action                     | Required Consent Scope | Blocking Condition                               |
| -------------------------- | ---------------------- | ------------------------------------------------ |
| Marketing email send       | `marketing`            | No valid marketing consent = block               |
| Promotional SMS send       | `marketing`            | No valid marketing consent = block               |
| Lead nurturing sequence    | `communication`        | No valid communication consent = block           |
| Appointment reminder       | `communication`        | No valid communication consent = block           |
| Voice intent authorization | `voice`                | No valid voice consent = block                   |
| AI voice processing        | `voice`                | No valid voice consent = block                   |
| Payment link generation    | `payment`              | No valid payment consent = block                 |
| Payment processing         | `payment`              | No valid payment consent = block                 |
| CaseOpened emission        | `payment`              | Already enforced by boundary (post-payment only) |

### Matrix Rules

- **AND Logic:** All required scopes must have valid consent
- **Status Check:** Only `granted` status counts as valid consent
- **Expiration:** `expired` status = invalid consent
- **Revocation:** `revoked` status = invalid consent
- **Scope Specificity:** Consent must match exact scope required

## 5. Ownership & Data Governance

### Ownership Rules

- **NeuronX Owns Schema:** Consent record structure, validation, relationships
- **Tenant Owns Data:** Specific consent records, evidence references
- **Subject Owns Rights:** Right to revoke, access, data portability (per jurisdiction)

### PII Classification

- **HIGH PII:** Subject identification, consent evidence references
- **MEDIUM PII:** Consent scope and status, jurisdiction identifiers
- **LOW PII:** Audit timestamps, correlation IDs

### Retention Guidance

- **Active Consent:** Retain while status = `granted`
- **Revoked/Expired:** Retain 7 years minimum (compliance requirement)
- **Evidence References:** Retain as long as consent record exists
- **Audit Trail:** Retain indefinitely (immutable)

### Data Isolation

- **Tenant Scoping:** All consent records filtered by tenantId at database level
- **Subject Scoping:** Consent records scoped to specific subject (lead/contact)
- **Scope Isolation:** Consent for one scope does not imply consent for others

## 6. Consent Status Lifecycle

### Valid Transitions

```
granted → revoked (manual revocation)
granted → expired (time-based expiration)
revoked → granted (new consent)
expired → granted (renewal)
```

### Invalid Transitions

```
revoked → expired (not allowed)
expired → revoked (not allowed)
```

### Status Validation

- **granted:** Has grantedAt, no revokedAt, not expired
- **revoked:** Has grantedAt and revokedAt, revokedAt > grantedAt
- **expired:** Has grantedAt, current time > expiration logic (external)

## 7. Evidence Reference Requirements

### Evidence Types

- **Form Submissions:** Form ID + timestamp + IP address
- **Webhook Payloads:** Webhook ID + signature verification
- **API Calls:** Request ID + authentication token
- **Import Batches:** Batch ID + record position

### Evidence Immutability

- **Once Set:** evidenceRef cannot be modified after creation
- **External Storage:** Evidence may be stored externally, referenced by immutable ID
- **Audit Trail:** Evidence updates (rare) must be fully audited

## 8. Correlation & Audit Integration

### Correlation Requirements

- **Request Scoping:** Every consent operation must have correlationId
- **Event Linking:** Consent events linked to business events via correlationId
- **Audit Chain:** Complete audit trail from consent to action

### Audit Integration

- **Event Sourcing:** Consent changes generate immutable events
- **Actor Attribution:** All consent changes attributed to actors
- **Compliance Trail:** Audit trail supports legal compliance requirements

---

**Consent Contract Status:** ✅ DATA DEFINITION ONLY
**Legal Protection:** ✅ EXPLICIT CONSENT REQUIRED
**No Business Logic:** ✅ ENFORCEMENT DEFERRED TO FUTURE WI
**Sales OS Boundary:** ✅ RESPECTED (ENDS AT CASEOPENED)
**Agent-Enforceable:** ✅ CONTRACT READY FOR IMPLEMENTATION
