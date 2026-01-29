# Sales/GTM Public API Contracts

**Version:** 1.0
**Status:** Canonical Contract (Enforceable)
**Authority:** WI-007 Sales/GTM Public API Contracts
**Last Updated:** 2026-01-03
**Purpose:** Agent-executable API contracts defining the Sales OS public surface for lead management, qualification, routing, appointments, payments, and status queries

## 1. Purpose & Scope

This contract defines the canonical public API surface for the NeuronX Sales OS. These APIs provide programmatic access to Sales/GTM operations while maintaining strict adherence to:

- Sales OS boundary (starts at lead ingestion, ends at VERIFIED_PAID → CaseOpened)
- Consent contracts (explicit consent required for applicable actions)
- Usage contracts (billable actions emit usage events)
- Voice platform boundaries (no execution APIs for voice)
- Admin control plane separation (no admin APIs included)

### API Principles

- **Tenant-Isolated:** All operations scoped by tenantId
- **Idempotent:** Duplicate requests produce same business outcome
- **Auditable:** All operations fully traceable with correlationId
- **Rate-Limited:** All endpoints subject to tenant-specific rate limits
- **Consent-Gated:** Actions requiring consent explicitly check ConsentRecord
- **Usage-Emitting:** Billable operations generate UsageEvent records

### Scope Boundaries

**IN SCOPE (7 API Categories):**

1. Lead ingestion (manual + bulk/import reference)
2. Lead qualification & scoring trigger
3. Routing trigger
4. Appointment creation/update (no scheduling logic)
5. Payment initiation (NOT verification)
6. Read-only Sales OS status queries
7. Webhook subscription registration (outbound only)

**OUT OF SCOPE:**

- Voice execution APIs (handled by voice platform boundaries)
- Admin control APIs (defined in WI-006)
- Case management APIs (beyond Sales OS boundary)
- Billing/invoicing APIs (usage is observational only)
- Analytics/reporting APIs (future WI)
- UI-specific endpoints

## 2. Global API Contract Requirements

### Required Headers (All Endpoints)

```
X-Tenant-Id: string (UUID format, tenant isolation)
X-Correlation-Id: string (UUID format, request tracing)
X-Idempotency-Key: string (UUID format, duplicate prevention)
Authorization: Bearer <token> (tenant-specific authentication)
Content-Type: application/json
```

### Response Envelope (All Endpoints)

```json
{
  "data": {}, // Endpoint-specific response data
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-01-03T10:30:00Z",
    "correlationId": "uuid",
    "processingTimeMs": 150
  },
  "links": {
    "self": "/api/v1/leads/123",
    "status": "/api/v1/leads/123/status"
  }
}
```

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR|CONSENT_DENIED|RATE_LIMITED|USAGE_EXCEEDED",
    "message": "Human-readable error description",
    "details": {
      "field": "email",
      "reason": "Invalid RFC 5322 format"
    }
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-01-03T10:30:00Z",
    "correlationId": "uuid"
  }
}
```

### Rate Limiting

- **Class Reference:** All endpoints use tenant-specific rate limits
- **Headers Returned:**
  - `X-RateLimit-Limit: 1000` (requests per window)
  - `X-RateLimit-Remaining: 950`
  - `X-RateLimit-Reset: 1640995200` (Unix timestamp)
- **429 Response:** Rate limit exceeded with retry-after header

### Idempotency Rules

- **Key Generation:** Client provides X-Idempotency-Key
- **Window:** 24 hours (business day boundary)
- **Scope:** Per tenant + endpoint + idempotency key
- **Behavior:** Identical requests within window return cached response

## 3. API Endpoint Contracts

### 3.1 Lead Ingestion API

**Endpoint:** `POST /api/v1/leads`
**Purpose:** Create new leads in the Sales OS (manual entry)

**Request Schema:**

```json
{
  "lead": {
    "externalId": "string", // Required, unique within tenant
    "source": "string", // Required, controlled vocabulary
    "firstName": "string", // Optional, max 100 chars
    "lastName": "string", // Optional, max 100 chars
    "email": "string", // Optional, RFC 5322 format
    "phone": "string", // Optional, E.164 format
    "company": "string", // Optional, max 255 chars
    "title": "string", // Optional, max 100 chars
    "industry": "string", // Optional, max 100 chars
    "companySize": "integer", // Optional, 1-1000000
    "metadata": {} // Optional, extensible object
  },
  "consent": {
    "scope": "marketing|communication|voice|payment", // Required
    "granted": true, // Required, must be true
    "source": "api", // Required, fixed value
    "evidenceRef": "string" // Optional, reference to consent evidence
  }
}
```

**Response Schema:**

```json
{
  "data": {
    "leadId": "uuid",
    "status": "CREATED",
    "createdAt": "2026-01-03T10:30:00Z",
    "nextActions": ["QUALIFY", "SCORE"]
  }
}
```

**Consent Scope Required:** Based on lead data provided (marketing for email, communication for phone, etc.)
**Usage Dimension Emitted:** `lead.ingestion` (BILLABLE, 1 count per lead)
**Rate Limit Class:** `lead_ingestion` (higher limit for bulk operations)
**Idempotency:** Based on tenantId + externalId combination

**Forbidden Behaviors:**

- Cannot create leads without explicit consent
- Cannot bypass duplicate detection
- Cannot set scoring/routing fields directly
- Cannot create leads beyond Sales OS boundary

---

### 3.2 Lead Qualification & Scoring Trigger API

**Endpoint:** `POST /api/v1/leads/{leadId}/qualify`
**Purpose:** Trigger AI scoring and qualification for an existing lead

**Request Schema:**

```json
{
  "qualification": {
    "priority": "HIGH|MEDIUM|LOW", // Optional, default MEDIUM
    "forceRescore": false, // Optional, default false
    "modelOverride": "string" // Optional, controlled vocabulary
  }
}
```

**Response Schema:**

```json
{
  "data": {
    "leadId": "uuid",
    "qualificationId": "uuid",
    "status": "PROCESSING|COMPLETED",
    "score": 0.85, // Only if completed
    "segment": "ENTERPRISE", // Only if completed
    "computedAt": "2026-01-03T10:30:00Z", // Only if completed
    "nextActions": ["ROUTE"]
  }
}
```

**Consent Scope Required:** None (scoring is internal processing)
**Usage Dimension Emitted:** `lead.scoring` (BILLABLE, 1 count per scoring operation)
**Rate Limit Class:** `scoring_operations`
**Idempotency:** Based on leadId + request parameters

**Forbidden Behaviors:**

- Cannot override scoring results directly
- Cannot bypass scoring entitlements
- Cannot trigger scoring without valid lead
- Cannot access scoring models or training data

---

### 3.3 Routing Trigger API

**Endpoint:** `POST /api/v1/leads/{leadId}/route`
**Purpose:** Trigger sales routing assignment for a qualified lead

**Request Schema:**

```json
{
  "routing": {
    "algorithm": "string", // Optional, controlled vocabulary
    "constraints": {
      "teamIds": ["uuid"], // Optional, team restrictions
      "expertise": ["string"], // Optional, expertise requirements
      "territory": "string" // Optional, geographic restrictions
    },
    "priority": "URGENT|HIGH|NORMAL|LOW" // Optional, default NORMAL
  }
}
```

**Response Schema:**

```json
{
  "data": {
    "leadId": "uuid",
    "routingId": "uuid",
    "status": "ROUTED|QUEUED|PENDING",
    "assignedTo": "uuid", // Actor ID if routed
    "assignedAt": "2026-01-03T10:30:00Z", // If routed
    "reasoning": {}, // Routing decision factors
    "nextActions": ["APPOINTMENT", "ENGAGE"]
  }
}
```

**Consent Scope Required:** None (routing is internal assignment)
**Usage Dimension Emitted:** `routing.execution` (BILLABLE, 1 count per routing operation)
**Rate Limit Class:** `routing_operations`
**Idempotency:** Based on leadId (only one active routing per lead)

**Forbidden Behaviors:**

- Cannot override routing assignments directly
- Cannot bypass routing entitlements
- Cannot route unqualified leads
- Cannot access routing algorithms or team capacity data

---

### 3.4 Appointment Creation/Update API

**Endpoint:** `POST /api/v1/leads/{leadId}/appointments`
**Purpose:** Create or update appointments (no scheduling logic, just record management)

**Request Schema:**

```json
{
  "appointment": {
    "type": "DISCOVERY|DEMO|FOLLOWUP|CLOSING", // Required
    "title": "string", // Optional, max 255 chars
    "description": "string", // Optional, max 1000 chars
    "scheduledAt": "2026-01-03T14:00:00Z", // Required, future timestamp
    "durationMinutes": 60, // Required, 15-480
    "location": "string", // Optional, max 500 chars
    "assignedTo": "uuid", // Optional, valid actor ID
    "metadata": {} // Optional, extensible
  }
}
```

**Response Schema:**

```json
{
  "data": {
    "appointmentId": "uuid",
    "leadId": "uuid",
    "status": "SCHEDULED",
    "createdAt": "2026-01-03T10:30:00Z",
    "nextActions": ["REMIND", "COMPLETE"]
  }
}
```

**Consent Scope Required:** `communication` (appointment communications)
**Usage Dimension Emitted:** `appointment.scheduled` (BILLABLE, 1 count per appointment created)
**Rate Limit Class:** `appointment_operations`
**Idempotency:** Based on leadId + scheduledAt + type combination

**Forbidden Behaviors:**

- Cannot implement calendar scheduling logic
- Cannot send appointment notifications directly
- Cannot modify appointment outcomes (separate endpoint)
- Cannot create appointments without communication consent
- Cannot bypass appointment entitlements

---

### 3.5 Payment Initiation API

**Endpoint:** `POST /api/v1/leads/{leadId}/payments/initiate`
**Purpose:** Initiate payment processing (NOT verification - that's webhook-driven)

**Request Schema:**

```json
{
  "payment": {
    "amount": 29900, // Required, cents (integer)
    "currency": "USD", // Required, ISO 4217
    "description": "Immigration Consultation", // Required, max 500 chars
    "paymentMethod": "CARD|ACH|WIRE", // Required
    "metadata": {
      "serviceType": "CONSULTATION",
      "urgency": "NORMAL"
    }
  },
  "successUrl": "https://client-site.com/payment/success", // Required
  "cancelUrl": "https://client-site.com/payment/cancelled" // Required
}
```

**Response Schema:**

```json
{
  "data": {
    "paymentId": "uuid",
    "leadId": "uuid",
    "status": "INITIATED",
    "checkoutUrl": "https://payment-provider.com/checkout/123",
    "expiresAt": "2026-01-03T11:30:00Z",
    "nextActions": ["REDIRECT_TO_CHECKOUT"]
  }
}
```

**Consent Scope Required:** `payment` (payment processing consent)
**Usage Dimension Emitted:** `payment.processed` (NON-BILLABLE, 1 count per payment initiation)
**Rate Limit Class:** `payment_operations`
**Idempotency:** Based on leadId + amount + currency + timestamp window

**Forbidden Behaviors:**

- Cannot verify payments (webhook only)
- Cannot access payment method details
- Cannot process payments directly
- Cannot bypass payment consent
- Cannot emit CaseOpened events (webhook-driven)

---

### 3.6 Sales OS Status Query API

**Endpoint:** `GET /api/v1/leads/{leadId}/status`
**Purpose:** Read-only query of lead status within Sales OS boundary

**Request Schema:** None (query parameters only)

```
GET /api/v1/leads/{leadId}/status?include=score,routing,appointment,payment
```

**Response Schema:**

```json
{
  "data": {
    "leadId": "uuid",
    "status": "QUALIFIED|ROUTED|ENGAGED|CONVERTED",
    "stage": "LEAD|OPPORTUNITY|COMMITTED",
    "lastUpdated": "2026-01-03T10:30:00Z",
    "components": {
      "scoring": {
        "score": 0.85,
        "segment": "ENTERPRISE",
        "computedAt": "2026-01-03T09:00:00Z"
      },
      "routing": {
        "assignedTo": "uuid",
        "assignedAt": "2026-01-03T09:15:00Z",
        "status": "ACTIVE"
      },
      "appointment": {
        "appointmentId": "uuid",
        "scheduledAt": "2026-01-03T14:00:00Z",
        "status": "CONFIRMED"
      },
      "payment": {
        "paymentId": "uuid",
        "status": "INITIATED",
        "amount": 29900,
        "initiatedAt": "2026-01-03T10:00:00Z"
      }
    }
  }
}
```

**Consent Scope Required:** None (status queries are read-only)
**Usage Dimension Emitted:** `api.request` (BILLABLE, 1 count per API call)
**Rate Limit Class:** `read_operations` (higher limits for status queries)
**Idempotency:** N/A (read-only)

**Forbidden Behaviors:**

- Cannot modify any status or data
- Cannot access data beyond Sales OS boundary
- Cannot include case management status
- Cannot access audit trails (separate admin API)
- Cannot access usage/billing data

---

### 3.7 Webhook Subscription Registration API

**Endpoint:** `POST /api/v1/webhooks/subscriptions`
**Purpose:** Register outbound webhook subscriptions for Sales OS events

**Request Schema:**

```json
{
  "subscription": {
    "name": "Lead Status Updates", // Required, max 255 chars
    "url": "https://client-app.com/webhooks/leads", // Required, valid HTTPS URL
    "events": [
      "lead.created",
      "lead.scored",
      "lead.routed",
      "appointment.scheduled",
      "payment.completed",
      "case.opened"
    ], // Required, controlled vocabulary
    "secret": "webhook-secret-123", // Required, client-generated
    "active": true, // Required, default true
    "metadata": {} // Optional
  }
}
```

**Response Schema:**

```json
{
  "data": {
    "subscriptionId": "uuid",
    "status": "ACTIVE",
    "createdAt": "2026-01-03T10:30:00Z",
    "testEndpoint": "/api/v1/webhooks/test/{subscriptionId}"
  }
}
```

**Consent Scope Required:** None (webhook configuration)
**Usage Dimension Emitted:** None (infrastructure setup)
**Rate Limit Class:** `configuration_operations`
**Idempotency:** Based on tenantId + url + events combination

**Forbidden Behaviors:**

- Cannot subscribe to events beyond Sales OS boundary
- Cannot access webhook delivery history
- Cannot modify webhook secrets after creation
- Cannot create subscriptions without valid HTTPS URLs
- Cannot subscribe to admin or internal events

## 4. API Security & Compliance

### Authentication

- **Bearer Token:** Tenant-specific JWT tokens
- **Token Scope:** Limited to Sales OS operations
- **Expiration:** Tokens expire within business hours
- **Revocation:** Immediate token revocation capability

### Authorization

- **Tenant Isolation:** All operations filtered by X-Tenant-Id
- **Actor Attribution:** All operations attributed to authenticated actor
- **Permission Checks:** Operations validated against actor permissions
- **Consent Validation:** Applicable operations check ConsentRecord status

### Data Protection

- **PII Handling:** Personal data encrypted at rest and in transit
- **Retention:** Data retained according to consent and legal requirements
- **Deletion:** Right to be forgotten implemented via admin APIs
- **Audit Trail:** All data access and modifications fully audited

## 5. API Evolution & Versioning

### Versioning Strategy

- **URL Versioning:** `/api/v1/` prefix for current version
- **Backward Compatibility:** New fields are additive only
- **Deprecation Notice:** 90 days for breaking changes
- **Sunset Period:** 180 days for deprecated endpoints

### Contract Evolution

- **Additive Changes:** New optional fields allowed without version bump
- **Required Changes:** New required fields require new version
- **Breaking Changes:** Schema changes require new version
- **Documentation:** All changes documented in API changelog

## 6. Implementation Guidance (Contracts Only)

### Contract Enforcement

- **Schema Validation:** All requests validated against JSON schemas
- **Business Rule Validation:** Domain rules enforced at API boundary
- **Entitlement Checking:** Usage limits validated before operation
- **Consent Verification:** Applicable operations check consent status

### Error Handling

- **Validation Errors:** 400 Bad Request with field-level details
- **Authorization Errors:** 403 Forbidden with specific reason
- **Rate Limit Errors:** 429 Too Many Requests with retry guidance
- **System Errors:** 500 Internal Server Error with correlation ID

### Monitoring & Observability

- **Request Tracing:** All requests traced with correlation ID
- **Usage Metrics:** All operations emit appropriate usage events
- **Performance Monitoring:** Response times and error rates tracked
- **Business Metrics:** Conversion rates and funnel metrics collected

---

**API Contract Status:** ✅ CONTRACTS DEFINED
**Endpoint Coverage:** ✅ 7 API Categories Complete
**Boundary Compliance:** ✅ Sales OS Boundary Respected
**Consent Integration:** ✅ All Applicable Actions Gated
**Usage Integration:** ✅ Billable Actions Metered
**Security Foundations:** ✅ Authentication & Authorization Defined
**Implementation Ready:** ✅ Agent-Executable Contracts
