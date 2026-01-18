# Admin Control Plane Contract

**Version:** 1.0
**Status:** Canonical Contract (Enforceable)
**Authority:** WI-006 Admin Control Plane (Governance Only)
**Last Updated:** 2026-01-03
**Purpose:** Agent-executable admin control contracts defining safe enterprise operations without runtime implementation

## 1. Purpose & Scope

This contract establishes the Admin Control Plane for safe enterprise operations of the Sales OS. Admin actions are explicit, audited, time-bound operations that maintain system integrity while enabling necessary operational controls.

### Authority Model (Non-Negotiable)

- **Admin Authority is Limited:** Admins can control system operations but cannot fake business events
- **Sales OS Boundary Respected:** All admin actions terminate at VERIFIED_PAID → CaseOpened
- **Audit Everything:** Every admin action is fully auditable with actor attribution
- **Time-Bound Powers:** Emergency powers expire automatically (no permanent overrides)

### Admin Roles (Strict Separation)

**Platform Admin:** System infrastructure and tenant lifecycle management
**Support Admin:** Customer issue resolution and tenant assistance
**Automation Agent:** Scheduled maintenance and automated operations

### No Business Logic Changes

**CRITICAL:** Admin control plane defines WHAT admins can do, not HOW the system operates. No business logic, workflows, or runtime behavior is modified.

## 2. Admin Authority Boundaries

### What Admins CAN Do

| Category             | Actions                         | Authority      | Audit Level | Time Bounds            |
| -------------------- | ------------------------------- | -------------- | ----------- | ---------------------- |
| **Tenant Lifecycle** | Suspend/Resume tenants          | Platform Admin | Critical    | Manual review required |
| **Security**         | Rotate secrets, freeze access   | Platform Admin | Critical    | 24-72 hours max        |
| **Entitlements**     | Override limits (emergency)     | Platform Admin | High        | 24 hours max           |
| **Consent**          | Freeze consent changes          | Support Admin  | High        | 24 hours max           |
| **Usage**            | Freeze billing (disputes)       | Support Admin  | Medium      | 7 days max             |
| **Incidents**        | Kill switches, circuit breakers | Platform Admin | Critical    | Immediate rollback     |

### What Admins CANNOT Do

| Forbidden Action          | Reason                            | Consequence               | Alternative                      |
| ------------------------- | --------------------------------- | ------------------------- | -------------------------------- |
| **Fake Payments**         | Violates Sales OS boundary        | System integrity breach   | Manual payment reconciliation    |
| **Open Cases**            | Beyond VERIFIED_PAID → CaseOpened | Business logic corruption | Customer service coordination    |
| **Generate Usage**        | Manipulates billing data          | Revenue fraud risk        | Usage audit corrections          |
| **Bypass Consent**        | Legal liability                   | Compliance violations     | Consent audit and correction     |
| **Modify Business State** | Alters audit trails               | Data integrity violation  | State reconstruction procedures  |
| **Override Boundaries**   | Compromises system safety         | Enterprise risk           | Boundary-respecting alternatives |
| **Permanent Changes**     | No rollback capability            | Operational risk          | Time-bound emergency powers      |

### Admin Action Principles

- **Explicit Only:** No implicit admin powers or backdoors
- **Audited Always:** Every admin action creates permanent audit trail
- **Time-Bound:** Emergency powers expire automatically
- **Reversible:** All admin actions can be rolled back
- **Isolated:** Admin actions don't interfere with tenant operations

## 3. Admin-Controlled Entity Contracts

### Entity: TenantSuspension

**Purpose:** Controlled tenant suspension for security, compliance, or operational reasons

**Required Fields (MUST):**

- `id: string` - UUID, primary key, immutable
- `tenantId: string` - Foreign key to tenant, required, immutable
- `reason: enum` - SECURITY|COMPLIANCE|PAYMENT|OPERATIONAL, required
- `severity: enum` - WARNING|SUSPEND|TERMINATE, required
- `suspendedBy: string` - Admin actor UUID, required, immutable
- `suspendedAt: timestamp` - Suspension timestamp, required, immutable
- `expiresAt: timestamp` - Automatic expiry, nullable (24-72 hours max)
- `correlationId: string` - Operation correlation ID, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `description: string` - Suspension reason details, max 1000 chars
- `evidence: json` - Supporting evidence for suspension
- `rollbackPlan: string` - Plan for resumption, max 500 chars

**Allowed Transitions:**

- `ACTIVE → WARNING` (notification only)
- `ACTIVE → SUSPEND` (full suspension)
- `SUSPEND → TERMINATE` (permanent)
- `Any → ACTIVE` (resumption)

**Audit Requirements:** Critical audit trail, executive notification for TERMINATE actions

---

### Entity: SecretRotationEvent

**Purpose:** Secure rotation of tenant secrets and API credentials

**Required Fields (MUST):**

- `id: string` - UUID, primary key, immutable
- `tenantId: string` - Foreign key to tenant, required, immutable
- `secretType: enum` - API_KEY|WEBHOOK_SECRET|OAUTH_TOKEN, required
- `rotationReason: enum` - COMPROMISED|EXPIRY|POLICY, required
- `rotatedBy: string` - Admin actor UUID, required, immutable
- `rotatedAt: timestamp` - Rotation timestamp, required, immutable
- `effectiveAt: timestamp` - When rotation takes effect, required
- `correlationId: string` - Operation correlation ID, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `oldSecretHash: string` - Hash of old secret for audit (never stores actual secret)
- `notificationSent: boolean` - Whether tenant was notified
- `rollbackWindow: integer` - Hours available for rollback (max 24)

**Allowed Transitions:**

- `PENDING → ACTIVE` (rotation takes effect)
- `ACTIVE → ROLLED_BACK` (emergency rollback within window)
- `ROLLED_BACK → EXPIRED` (rollback window closed)

**Audit Requirements:** Critical audit trail, secret hashes only (no actual secrets in audit)

---

### Entity: EntitlementOverride

**Purpose:** Emergency entitlement overrides for critical tenant operations

**Required Fields (MUST):**

- `id: string` - UUID, primary key, immutable
- `tenantId: string` - Foreign key to tenant, required, immutable
- `entitlementType: enum` - LEADS|SCORING|ROUTING|VOICE|API, required
- `originalLimit: integer` - Original entitlement value, required, immutable
- `overrideLimit: integer` - Temporary override value, required
- `overrideReason: enum` - EMERGENCY|INCIDENT|COMPLIANCE, required
- `overrideBy: string` - Admin actor UUID, required, immutable
- `overrideAt: timestamp` - Override timestamp, required, immutable
- `expiresAt: timestamp` - Automatic expiry (24 hours max), required
- `correlationId: string` - Operation correlation ID, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `businessImpact: string` - Expected business impact, max 500 chars
- `rollbackInstructions: string` - How to restore normal limits, max 500 chars

**Validation Rules:**

- `overrideLimit > originalLimit` (only increases allowed)
- `expiresAt <= 24 hours from overrideAt`
- `overrideReason` must be documented with evidence

**Audit Requirements:** High audit trail, automatic expiry enforcement

---

### Entity: ConsentFreeze

**Purpose:** Emergency freeze of consent modifications during security incidents

**Required Fields (MUST):**

- `id: string` - UUID, primary key, immutable
- `tenantId: string` - Foreign key to tenant, required, immutable
- `freezeScope: enum` - ALL|MARKETING|COMMUNICATION|VOICE|PAYMENT, required
- `freezeReason: enum` - SECURITY_INCIDENT|LEGAL_HOLD|COMPLIANCE_REVIEW, required
- `frozenBy: string` - Admin actor UUID, required, immutable
- `frozenAt: timestamp` - Freeze timestamp, required, immutable
- `expiresAt: timestamp` - Automatic expiry (24 hours max), required
- `correlationId: string` - Operation correlation ID, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `affectedSubjects: integer` - Number of subjects impacted
- `unfreezePlan: string` - Plan for resuming consent changes, max 500 chars

**Validation Rules:**

- Freeze cannot prevent consent revocation (GDPR requirement)
- Freeze scope must be specific (not ALL unless critical)
- Expires automatically (no permanent freezes)

**Audit Requirements:** High audit trail, legal review for SECURITY_INCIDENT freezes

---

### Entity: UsageFreeze

**Purpose:** Emergency freeze of usage generation during billing disputes

**Required Fields (MUST):**

- `id: string` - UUID, primary key, immutable
- `tenantId: string` - Foreign key to tenant, required, immutable
- `freezeScope: enum` - ALL|BILLABLE|NON_BILLABLE, required
- `freezeReason: enum` - BILLING_DISPUTE|AUDIT_INVESTIGATION|SYSTEM_MAINTENANCE, required
- `frozenBy: string` - Admin actor UUID, required, immutable
- `frozenAt: timestamp` - Freeze timestamp, required, immutable
- `expiresAt: timestamp` - Automatic expiry (7 days max), required
- `correlationId: string` - Operation correlation ID, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `disputeReference: string` - Billing dispute case number, max 100 chars
- `expectedResolution: timestamp` - Expected dispute resolution date

**Validation Rules:**

- Freeze does not stop business operations (only usage generation)
- Freeze scope limited to prevent complete tenant lockdown
- Automatic expiry prevents permanent freezes

**Audit Requirements:** Medium audit trail, billing team notification

---

### Entity: EmergencyKillSwitch

**Purpose:** System-wide emergency shutdown during critical incidents

**Required Fields (MUST):**

- `id: string` - UUID, primary key, immutable
- `scope: enum` - TENANT|SYSTEM_WIDE, required
- `tenantId: string` - Target tenant (null for system-wide), optional
- `killReason: enum` - SECURITY_BREACH|DATA_CORRUPTION|SYSTEM_FAILURE, required
- `activatedBy: string` - Admin actor UUID, required, immutable
- `activatedAt: timestamp` - Activation timestamp, required, immutable
- `autoRollbackAt: timestamp` - Automatic rollback (1 hour max), required
- `correlationId: string` - Operation correlation ID, required
- `createdAt: timestamp` - ISO 8601 UTC, immutable

**Optional Fields (MAY):**

- `affectedServices: string[]` - List of impacted services
- `rollbackInstructions: string` - Emergency recovery procedures, max 1000 chars

**Validation Rules:**

- Kill switches are last resort (all other options exhausted)
- Auto-rollback prevents permanent system damage
- Requires executive approval for system-wide activation

**Audit Requirements:** Critical audit trail, executive notification, incident response team activation

## 4. Admin Ops API Surface (Declarative Only)

### Tenant Management APIs

```
POST /admin/tenants/{tenantId}/suspend
  - Body: { reason, severity, description, expiresAt }
  - Authority: Platform Admin only
  - Audit: Critical

POST /admin/tenants/{tenantId}/resume
  - Body: { correlationId, reason }
  - Authority: Platform Admin only
  - Audit: Critical

POST /admin/tenants/{tenantId}/rotate-secret
  - Body: { secretType, rotationReason, effectiveAt }
  - Authority: Platform Admin only
  - Audit: Critical
```

### Entitlement Management APIs

```
POST /admin/tenants/{tenantId}/override-entitlement
  - Body: { entitlementType, overrideLimit, overrideReason, expiresAt }
  - Authority: Platform Admin only
  - Audit: High

DELETE /admin/tenants/{tenantId}/entitlement-override/{overrideId}
  - Authority: Platform Admin only
  - Audit: High
```

### Emergency Control APIs

```
POST /admin/tenants/{tenantId}/freeze-consent
  - Body: { freezeScope, freezeReason, expiresAt }
  - Authority: Support Admin only
  - Audit: High

POST /admin/tenants/{tenantId}/freeze-usage
  - Body: { freezeScope, freezeReason, expiresAt }
  - Authority: Support Admin only
  - Audit: Medium

POST /admin/incidents/{incidentId}/kill-switch
  - Body: { scope, tenantId, killReason, autoRollbackAt }
  - Authority: Platform Admin only (executive approval required)
  - Audit: Critical
```

### Audit & Monitoring APIs

```
GET /admin/tenants/{tenantId}/admin-actions
  - Query: { fromDate, toDate, actionType }
  - Authority: Platform Admin + Support Admin
  - Audit: Medium

GET /admin/system/health
  - Authority: Platform Admin + Support Admin
  - Audit: Low
```

## 5. Admin Action Governance

### Time Bounds & Automatic Expiry

- **Emergency Overrides:** Maximum 24 hours
- **Consent Freezes:** Maximum 24 hours
- **Usage Freezes:** Maximum 7 days
- **Kill Switches:** Maximum 1 hour
- **Secret Rotations:** Immediate effect, 24-hour rollback window

### Approval Requirements

- **System-Wide Actions:** Executive approval required
- **Tenant Termination:** Executive approval required
- **Kill Switch Activation:** Executive approval required
- **Entitlement Overrides >50%:** Manager approval required

### Audit & Notification Requirements

- **Critical Actions:** Executive notification within 15 minutes
- **High Actions:** Manager notification within 1 hour
- **Medium Actions:** Logged for weekly review
- **All Actions:** Permanent audit trail with full context

### Rollback & Recovery

- **Automatic Rollback:** All temporary actions expire automatically
- **Manual Rollback:** Emergency rollback procedures documented
- **Recovery Testing:** Rollback procedures tested quarterly
- **Impact Assessment:** Pre-rollback impact analysis required

## 6. Role-Based Access Control

### Platform Admin (System Infrastructure)

**Allowed Actions:**

- Tenant suspension/resumption
- Secret rotation
- Entitlement overrides
- System monitoring
- Kill switch activation

**Prohibited Actions:**

- Direct business data modification
- Consent manipulation
- Usage generation

### Support Admin (Customer Operations)

**Allowed Actions:**

- Consent freezes
- Usage freezes
- Customer issue investigation
- Support ticket escalation

**Prohibited Actions:**

- Tenant suspension/termination
- Secret rotation
- System infrastructure changes

### Automation Agent (Scheduled Operations)

**Allowed Actions:**

- Automated health checks
- Scheduled maintenance notifications
- Automated audit report generation

**Prohibited Actions:**

- Any manual admin actions
- Emergency overrides
- Customer data access

## 7. Incident Response Integration

### Incident Severity Levels

- **Critical:** Immediate admin action required (kill switch consideration)
- **High:** Admin action within 1 hour (consent/usage freezes)
- **Medium:** Admin action within 24 hours (entitlement overrides)
- **Low:** Admin monitoring only (audit review)

### Admin Action Triggers

- **Security Breach:** Automatic secret rotation + consent freeze
- **Data Corruption:** Usage freeze + system isolation
- **Payment Issues:** Entitlement override consideration
- **Compliance Violation:** Consent freeze + audit investigation

### Post-Incident Review

- **Action Effectiveness:** Review of admin actions taken
- **Process Improvement:** Updates to admin procedures
- **Training Updates:** Admin training based on incident lessons
- **Audit Completeness:** Verification of all admin actions audited

---

**Admin Control Plane Status:** ✅ ESTABLISHED
**Authority Boundaries:** ✅ ENFORCED
**Time-Bound Powers:** ✅ AUTOMATIC EXPIRY
**Audit Everything:** ✅ PERMANENT TRAIL
**Sales OS Boundary:** ✅ RESPECTED (ENDS AT CASEOPENED)
**No Business Logic:** ✅ ADMIN CONTROL ONLY
