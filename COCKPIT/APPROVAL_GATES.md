# Approval Gates — Stop-Gates for Founder Approval

## Overview

This document defines the exact gates that must stop autonomous execution and request Founder approval. These gates serve as safety checkpoints that ensure the Founder has visibility and control over high-impact work.

---

## GATE PHILOSOPHY

### Stop-Gate Principle

**Definition**: A gate is a condition that, when triggered, MUST halt autonomous execution and WAIT FOR HUMAN approval before proceeding.

**Purpose**: Gates protect the system from unintended consequences, ensure alignment with business objectives, and provide auditability for high-impact decisions.

**Strict Enforcement**: Gates are MANDATORY stop conditions. Factory must STOP at EVERY gate that triggers, regardless of Dev Fast Mode settings or other circumstances.

**Gate Override**: Gates CANNOT be overridden by agents, skills, or automation. Only the Founder can approve work past a gate.

---

## MANDATORY APPROVAL GATES

### Gate 1: T1 Risk Tier Gate

**Trigger Condition**: Work is classified as T1 risk tier.

**Risk Tier Definition** (from GOVERNANCE/RISK_TIERS.md):
- **T1 (Highest Risk)**: Work that affects production reliability, critical data, user accounts, payments, or involves major architectural changes that cannot be easily rolled back.

**Examples of T1 Work**:
- Production database schema changes
- Changes to authentication system
- Payment processing modifications
- User data deletion/migration
- Major infrastructure changes

**Stop Condition**:
```
IF risk_tier == "T1":
    STOP executing
    CREATE APPROVAL artifact
    TRANSITION to WAITING_FOR_HUMAN state
    DISPLAY in Cockpit APPROVALS panel
    WAIT for Founder approval
```

**Approval Required**:
- Founder approval MANDATORY
- Approval must be explicit in GitHub Issue comment or Cockpit vote

**After Approval**:
- Founder comments "APPROVED" or approves in Cockpit
- Factory resumes execution
- STATUS_LEDGER updated with approval timestamp

---

### Gate 2: T2 Risk Tier Gate

**Trigger Condition**: Work is classified as T2 risk tier.

**Risk Tier Definition** (from GOVERNANCE/RISK_TIERS.md):
- **T2 (Medium-High Risk)**: Work that affects user-facing features, significant refactoring, or involves multiple components that could impact system behavior.

**Examples of T2 Work**:
- New user-facing features
- Significant refactoring across multiple files
- API changes (backward compatible)
- Performance optimization work
- External API integrations

**Stop Condition**:
```
IF risk_tier == "T2":
    STOP executing
    CREATE APPROVAL artifact
    TRANSITION to WAITING_FOR_HUMAN state
    DISPLAY in Cockpit APPROVALS panel
    WAIT for Founder approval
```

**Approval Required**:
- Founder approval MANDATORY
- Approval must be explicit in GitHub Issue comment or Cockpit vote

**After Approval**:
- Founder comments "APPROVED" or approves in Cockpit
- Factory resumes execution
- STATUS_LEDGER updated with approval timestamp

---

### Gate 3: Production Deployment Gate

**Trigger Condition**: Work is ready to deploy to production environment.

**Applicable To**: All releases targeting production.

**Stop Condition**:
```
IF release_type == "PRODUCTION":
    STOP before deployment
    CREATE RELEASE artifact with all verification results
    TRANSITION to WAITING_FOR_HUMAN state
    DISPLAY in Cockpit APPROVALS panel
    WAIT for Founder approval to deploy
```

**Approval Required**:
- Founder approval MANDATORY (even for T3/T4 releases)
- Production deployment is ALWAYS a gate
- Cannot be auto-approved even if Dev Fast Mode enabled

**Pre-Approval Checklist** (Factory validates before asking approval):
- [ ] VERIFICATION artifact shows PASS status
- [ ] All acceptance criteria verified
- [ ] All tests passing
- [ ] CI/CD all checks green
- [ ] Rollback plan documented
- [ ] Monitoring plan documented

**After Approval**:
- Founder approves deployment in Cockpit
- Factory triggers deployment
- Factory monitors deployment
- Factory confirms deployment success or rollback

---

### Gate 4: Cost Threshold Gate

**Trigger Condition**: Estimated cost exceeds threshold OR actual cost exceeds budget.

**Cost Thresholds** (from GOVERNANCE/COST_POLICY.md):
- Warning threshold: $50
- Approval threshold: $100
- Daily budget: $200

**Stop Condition A (Pre-Execution)**:
```
IF estimated_cost.total >= $100:
    STOP before starting work
    CREATE APPROVAL artifact with cost breakdown
    TRANSITION to WAITING_FOR_HUMAN state
    DISPLAY in Cockpit APPROVALS panel
    WAIT for Founder approval to proceed
```

**Stop Condition B (During Execution)**:
```
IF actual_cost.total >= $100 AND not previously approved:
    STOP execution
    CREATE APPROVAL artifact with actual cost
    TRANSITION to WAITING_FOR_HUMAN state
    DISPLAY in Cockpit APPROVALS panel
    WAIT for Founder approval to continue
```

**Stop Condition C (Daily Budget)**:
```
IF daily_spend_total >= $200:
    STOP all new work
    CREATE APPROVAL artifact for budget increase
    TRANSITION to WAITING_FOR_HUMAN state
    DISPLAY in Cockpit APPROVALS panel
    WAIT for Founder approval for additional budget
```

**Approval Required**:
- Founder approval required for any work costing ≥ $100
- Founder approval required for budget increase
- Approval must reference cost explicitly

**After Approval**:
- Founder comments "APPROVED - COST_OK" or approves in Cockpit
- Factory resumes execution (or continues with increased budget)
- STATUS_LEDGER updated with cost approval timestamp

---

### Gate 5: Authentication/Billing/Security Gate

**Trigger Condition**: Work affects authentication, billing, account management, or security mechanisms.

**Scope**: Any work modifying or affecting:
- User authentication (login, signup, password reset)
- Account management (role changes, permissions)
- Billing and payments (charges, refunds, subscriptions)
- Security mechanisms (encryption, secrets, access control)
- PII handling / GDPR compliance

**Examples**:
- Changing password hashing algorithm
- Modifying OAuth flow
- Adding new user role or permission
- Changing billing calculation logic
- Implementing new encryption
- Modifying PII storage or access

**Stop Condition**:
```
IF affects_auth OR affects_billing OR affects_account OR affects_security:
    STOP executing
    CREATE APPROVAL artifact with security impact assessment
    TRANSITION to WAITING_FOR_HUMAN state
    DISPLAY in Cockpit APPROVALS panel
    WAIT for Founder approval
```

**Required Assessment for Approval**:
- Security impact analysis
- Data retention implications
- GDPR/compliance implications
- PII handling changes
- Risk assessment for user accounts

**Approval Required**:
- Founder approval MANDATORY
- Security review recommended (if available)
- Explicit documentation of security implications

**After Approval**:
- Founder approves with security acknowledgment
- Factory proceeds with implementation
- Security tests must be included

---

### Gate 6: Schema Changes Gate

**Trigger Condition**: Work involves database schema changes.

**Scope**: Any changes to database schemas:
- CREATE TABLE, ALTER TABLE, DROP TABLE
- Adding, modifying, or deleting columns
- Adding, modifying, or deleting indexes
- Changing column types or constraints
- Migration scripts

**Stop Condition**:
```
IF involves_database_schema_changes AND target == production:
    STOP before running migrations
    CREATE APPROVAL artifact with schema diff and migration plan
    TRANSITION to WAITING_FOR_HUMAN state
    DISPLAY in Cockpit APPROVALS panel
    WAIT for Founder approval to run migrations
```

**Required Assessment for Approval**:
- Schema diff (what is changing)
- Migration plan (steps to execute)
- Rollback plan (how to revert if needed)
- Data impact (will data be lost or transformed?)
- Downtime required (yes/no, how long?)
- Risk assessment (T1/T2 based on impact)

**Approval Required**:
- Founder approval MANDATORY for production schema changes
- Schema review required (CTO or technical reviewer)
- Explicit approval of migration plan

**After Approval**:
- Founder approves with explicit reference to migration plan
- Factory runs migrations in staging first (if applicable)
- Factory runs production migrations during approved window
- Factory verifies migration success

---

### Gate 7: Out-of-Scope Work Gate

**Trigger Condition**: Work falls outside the defined scope of the repository or Autonomous Engineering OS.

**Scope Boundaries** (what IS in scope):
- APP/ directory (application code)
- GOVERNANCE/ directory (governance documents)
- AGENTS/ directory (agent definitions and prompts)
- RUNBOOKS/ directory (operational runbooks)
- COCKPIT/ directory (cockpit and artifact documents)
- STATE/ directory (state tracking)

**Out-of-Scope Examples** (what requires this gate):
- Work affecting external systems not controlled by this repo
- Work requiring changes to external dependencies without version control
- Work requiring coordination with other teams/repositories
- Work requiring manual intervention or approvals outside this repo
- Work affecting infrastructure owned by other teams

**Stop Condition**:
```
IF work_outside_defined_scope:
    STOP executing
    CREATE APPROVAL artifact with scope explanation and impact
    TRANSITION to WAITING_FOR_HUMAN state
    DISPLAY in Cockpit APPROVALS panel
    WAIT for Founder approval AND external coordination confirmation
```

**Required Assessment for Approval**:
- Clear explanation of why work is out of scope
- Impact assessment on external systems
- Required coordination steps
- Approval scope (this repo approval only, or external approvals needed)
- Risk assessment for external dependencies

**Approval Required**:
- Founder approval MANDATORY
- May require external approvals (documented in approval)
- Confirmation that external coordination is complete or agreed

**After Approval**:
- Founder approves with external coordination confirmation
- Factory proceeds with documented dependencies
- Factory tracks external coordination status

---

### Gate 8: Incident Response Gate

**Trigger Condition**: An INCIDENT artifact is created with HIGH or CRITICAL severity.

**Scope**: Any incident with severity HIGH or CRITICAL.

**Stop Condition**:
```
IF incident_created AND incident.severity IN ["HIGH", "CRITICAL"]:
    STOP all routine work
    CREATE INCIDENT artifact with full impact assessment
    TRANSITION to INCIDENT_RESPONSE state
    DISPLAY in Cockpit APPROVALS panel (Incidents section)
    WAIT for Founder incident response plan approval
```

**Required Assessment**:
- Incident severity confirmed
- Impact assessment (users, business, systems)
- Root cause investigation status
- Proposed resolution plan
- Escalation status (if applicable)

**Approval Required**:
- Founder acknowledgment of incident
- Founder approval of response plan (or directive to escalate)
- May require external coordination

**After Approval**:
- Founder acknowledges incident and approves response plan
- Factory executes incident response
- Factory updates INCIDENT artifact with progress
- Factory monitors resolution

---

## GATE TRIGGERING MECHANISM

### How Factory Detects Gates

Factory checks for gate triggers in this order:

1. **Pre-Planning Gates** (before creating PLAN):
   - Out-of-Scope gate
   - Cost threshold gate (estimated)

2. **Planning Gates** (after creating PLAN, before execution):
   - T1/T2 risk tier gates
   - Authentication/Billing/Security gate
   - Cost threshold gate (refined estimate)

3. **Execution Gates** (during execution):
   - Schema changes gate (before running migrations)
   - Cost threshold gate (actual costs)

4. **Pre-Release Gates** (before deploying):
   - Production deployment gate
   - Cost threshold gate (cumulative actual)

5. **Incident Gates** (independent):
   - Incident response gate (triggers immediately)

### Gate Checking Algorithm

```
FOREACH gate IN approval_gates:
    IF gate.trigger_condition_met():
        IF gate.approval_not_already_granted():
            STOP execution
            CREATE approval artifact
            DISPLAY in Cockpit
            TRANSITION to WAITING_FOR_HUMAN
            BREAK # Stop after first unapproved gate
```

### Conditional Gates

Some gates only trigger under specific conditions:

| Gate | Condition |
|------|-----------|
| T1/T2 Gates | Work has risk tier T1 or T2 |
| Production Deployment Gate | Only for production releases |
| Cost Threshold Gate | Only when cost exceeds threshold |
| Auth/Billing/Security Gate | Only when work affects these areas |
| Schema Changes Gate | Only for database schema changes |
| Out-of-Scope Gate | Only for work outside repo scope |
| Incident Response Gate | Only for HIGH/CRITICAL incidents |

---

## APPROVAL WORKFLOW

### Factory's Approval Request Process

When a gate triggers, Factory:

1. **Stops Execution**: Halts current work immediately
2. **Creates Approval Artifact**: Documents what needs approval and why
3. **Updates STATE Files**: Updates STATUS_LEDGER with waiting status
4. **Updates Cockpit**: Displays item in APPROVALS panel
5. **Waits for Approval**: Enters WAITING_FOR_HUMAN state

### Founder's Approval Process

The Founder:

1. **Reviews Approval in Cockpit**: Opens APPROVALS panel
2. **Reads Artifact Details**: Views the full artifact document
3. **Sees Risk and Impact**: Understands what's being approved
4. **Approves or Rejects**: Takes action in Cockpit or via GitHub comment
5. **Documents Reason** (if rejecting): Explains why work is rejected or needs changes

### Approval Actions

**Approve**:
- Comment "APPROVED" on GitHub Issue
- Or vote "APPROVE" in Cockpit
- Factory resumes execution

**Reject**:
- Comment "REJECTED: [reason]" on GitHub Issue
- Or select "REJECT" in Cockpit with reason
- Factory stops work and transitions to appropriate state

**Request Changes**:
- Comment "REQUEST_CHANGES: [feedback]" on GitHub Issue
- Or select "REQUEST CHANGES" in Cockpit with feedback
- Factory updates artifact and resubmits for approval

**Escalate**:
- If unsure or blocked, Founder can escalate
- Factory logs escalation and awaits further direction

---

## APPROVAL ARTIFACT FORMAT

When a gate triggers, Factory creates an approval artifact:

```yaml
APPROVAL_ARTIFACT

artifact_id: "APPROVAL-{timestamp}-{gate_type}"
created_at: "YYYY-MM-DD HH:MM UTC"
created_by: "CTO Agent"

gate_type: "T1_GATE" | "T2_GATE" | "PROD_DEPLOY" | "COST_THRESHOLD" | "AUTH_BILLING_SECURITY" | "SCHEMA_CHANGES" | "OUT_OF_SCOPE" | "INCIDENT_RESPONSE"

# FOUNDER SUMMARY
founder_summary: |
  Plain-English summary of what needs approval.
  Example: "Production deployment of user profile upload feature (T3). All tests passing. Rollback plan ready."

# WHAT NEEDS APPROVAL
approval_request:
  gate_type: "PROD_DEPLOY"
  trigger_reason: "Work ready to deploy to production"
  related_artifact: "COCKPIT/artifacts/REL-20260123-004.md"
  related_github_pr: "https://github.com/owner/repo/pull/42"

# RISK ASSESSMENT
risk_tier: "T3"
risk_categories:
  - "data_loss": "LOW"
  - "availability": "LOW"
  - "security": "MEDIUM"

# COST ASSESSMENT
estimated_cost: "$15"
actual_cost: "$12"
cost_exceeds_threshold: false

# VERIFICATION STATUS
verification_passed: true
acceptance_criteria_met: true
tests_passing: true
ci_checks_green: true

# ROLLBACK PLAN
rollback_available: true
rollback_plan: "git revert abc123 && redeploy v1.2.2"
rollback_time_estimate: "< 5 minutes"

# AWAITING APPROVAL SINCE
waiting_since: "2026-01-23 15:00 UTC"

# STATUS
status: "WAITING_FOR_HUMAN"

# ACTIONS FOUND
action_taken_by: "[Founder username]"
action_taken_at: "[timestamp when action]"
action_type: "APPROVED" | "REJECTED" | "REQUEST_CHANGES"
comments: "Any comments from Founder"
```

---

## DEV FAST MODE AND GATES

### Dev Fast Mode Behavior

Dev Fast Mode (from GOVERNANCE/GUARDRAILS.md) allows auto-merge for certain directories. HOWEVER:

**Gates are ALWAYS in effect, regardless of Dev Fast Mode:**
- T1/T2 gates: Always require Founder approval
- Production Deployment gate: Always requires Founder approval
- Cost Threshold gate: Always requires Founder approval
- Auth/Billing/Security gate: Always requires Founder approval
- Schema Changes gate: Always requires Founder approval
- Out-of-Scope gate: Always requires Founder approval
- Incident Response gate: Always requires Founder approval

**What Dev Fast Mode Affects**:
- Dev Fast Mode can allow auto-merge for T3/T4 risk tier work in certain directories
- Dev Fast Mode DOES NOT override any approval gate
- Dev Fast Mode DOES NOT allow production deployment auto-approval

### Dev Fast Mode + Gate Interaction

```
IF Dev Fast Mode enabled:
    IF work in auto-merge directory AND risk_tier == "T3" OR "T4":
        May auto-merge after CI passes (no gate triggers)
    ELSE IF any gate triggers:
        STOP and wait for Founder approval (Dev Fast Mode ignored)
```

---

## GATE AUDIT TRAIL

### Recording Approvals

All approvals are recorded:

1. **GitHub Comment**: Founder's approval comment on Issue
2. **STATUS_LEDGER**: Updated with approval timestamp
3. **Artifact**: Approval action documented in artifact
4. **Cockpit**: Approval status in APPROVALS panel

### Audit Trail Query

To audit all approvals:

```bash
# Find all approval artifacts
find COCKPIT/artifacts -name "APPROVAL-*.md"

# Check STATUS_LEDGER for approval events
grep -A 5 "APPROVAL" STATE/STATUS_LEDGER.md

# Check GitHub for approval comments
gh issue list --limit 100 | xargs -I {} gh issue view {} --json comments
```

---

## GATE FAILURE HANDLING

### If Factory Misses a Gate

If Factory executes work without stopping at a required gate:

1. **Detection**: Cockpit or Founder detects gate was missed
2. **Incident Create**: Create INCIDENT artifact for governance failure
3. **Rollback**: Roll back the unauthorized change if possible
4. **Review**: Review why gate was missed
5. **Process Fix**: Update gate detection logic to prevent recurrence

### If Founder Rejects Approval

If Founder rejects an approval request:

1. **Factory Stops**: Factory halts the gated work
2. **Reason Documented**: Rejection reason recorded in artifact
3. **Next Steps**:
   - If REQUEST_CHANGES: Factory updates work and resubmits
   - If REJECTED: Factory abandons work or requests new direction
   - Status updated in STATUS_LEDGER

---

## GATE CONFIGURATION

### Adding New Gates

To add a new approval gate:

1. **Define Gate**: Add gate definition to this document
2. **Update Factory**: Update code/instructions to detect gate
3. **Update Cockpit**: Ensure cockpits displays approval artifacts
4. **Test**: Test gate triggers with appropriate work

### Modifying Existing Gates

To modify an existing gate:

1. **Document Changes**: Update gate definition with "Change Log" section
2. **Update Factory**: Update gate detection logic
3. **Update Cockpit**: Ensure updated gate information is displayed
4. **Communicate**: Notify Founder of gate changes

---

## VERSION HISTORY

- v1.0 (Initial): Eight mandatory approval gates with trigger conditions and approval workflows

---

**Document Version**: v1.0
**Last Updated**: 2026-01-23 by CTO Agent
