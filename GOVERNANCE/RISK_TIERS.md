# Risk Tiers — Classification and Required Controls

## Overview

This document defines the four-tier risk classification system used by the Autonomous Engineering OS. Every task and operation is assigned a risk tier that determines the required controls, approvals, and autonomy level.

---

## RISK TIERS OVERVIEW

| Tier | Name | Autonomy Level | Human Approval | Examples |
|------|------|----------------|----------------|----------|
| T1 | Critical | None | Always Required | Production deploy, security, payments |
| T2 | High | Limited | Required for Gates | Database changes, breaking changes |
| T3 | Medium | Conditional | Optional for Routine | Feature development, bug fixes |
| T4 | Low | High | Never Required | Documentation, formatting, small refactors |

---

## TIER 0: INFORMATIONAL

**Definition**: Read-only operations that cannot affect system state

**Characteristics:**
- No writes to system
- No irreversible actions
- No external API calls with side effects
- Zero cost impact

**Examples:**
- Reading files
- Viewing logs
- Analyzing code patterns
- Generating reports
- Reviewing test results

**Required Controls:**
- None (fully autonomous)

**Actions:**
- Execute freely without gates

---

## TIER 3: LOW RISK — High Autonomy

**Definition**: Operations that are reversible, have clear rollback paths, and minimal blast radius

**Characteristics:**
- Reversible actions
- Local scope (files, non-critical paths)
- No customer-facing impact
- Can be undone or rolled back
- Standard patterns

**Examples:**

**Code & Development:**
- Formatting and linting fixes
- Adding comments or documentation
- Small refactorings with test coverage
- Creating new feature branches
- Updating README files

**Testing:**
- Running existing test suites
- Writing new unit tests
- Mock implementations
- Test data setup

**Environment:**
- Development environment changes
- Staging deployment (most scenarios)
- Preview deployments
- Temporary feature flags

**Configuration:**
- Non-critical config updates
- Adding new config keys
- Environment variable documentation updates

**Required Controls:**
- Tests must pass (if applicable)
- No regression in existing functionality
- Documentation updated (if user-facing)

**Autonomy:**
- Full autonomy for execution
- No human approval typically required
- Proceed through gates automatically

**Gate Behavior:**
- GATE-1 (Entry): Auto-proceed
- GATE-8 (Deploy): Staging auto-proceed, production requires approval
- GATE-2 (Cost): Automatic check against thresholds

---

## TIER 2: HIGH RISK — Limited Autonomy

**Definition**: Operations with broader impact, requiring careful consideration and explicit approvals

**Characteristics:**
- Harder to reverse
- Broader blast radius
- May affect customers
- Cost considerations
- Integration complexity

**Examples:**

**Database Operations:**
- Schema migrations (tables, columns)
- Index changes
- Data migrations
- Performance-critical query changes
- Backup/restore operations

**API changes:**
- Breaking endpoint changes
- Removing deprecated endpoints
- Major version bumps
- Authentication flow changes

**Infrastructure:**
- Cloud resource scaling (significant)
- New cloud resources (cost impact)
- Network configuration
- CDN configuration changes

**Third-Party Integrations:**
- New API integrations (cost implications)
- Webhook additions/modifications
- Rate limiting changes

**Dependencies:**
- Major dependency upgrades
- Security patch updates (requires testing)
- Changing core libraries

**Required Controls:**
- Rollback plan documented and tested
- Impact assessment completed
- Tests passing (including integration tests)
- Staging deployment verified
- Security review (if applicable)
- Cost analysis documented

**Autonomy:**
- Autonomous planning and implementation
- Human approval required at key gates
- Stop and ask on ambiguity

**Gate Behavior:**
- GATE-1 (Entry): Auto-proceed
- GATE-2 (Cost): Must be under threshold OR approved
- GATE-4 (Migration): Require approval
- GATE-5 (Breaking): Require approval
- GATE-7 (External API): Require approval
- GATE-8 (Deploy): Staging autonomous, production requires approval

---

## TIER 1: CRITICAL — No Autonomy

**Definition**: Operations with significant potential for harm, requiring explicit human authorization

**Characteristics:**
- Irreversible or hard to reverse
- Direct customer impact
- Security implications
- Financial impact
- Reputation risk
- Regulatory/compliance implications

**Examples:**

**Production Deployment:**
- Deploying to production environment
- Production infrastructure changes
- Production configuration updates
- Production database operations

**Security & Compliance:**
- Authentication/authorization system changes
- Encryption key rotation
- Compliance-related code changes
- PCI/GDPR/other regulatory changes
- Vulnerability fixes (deployment)

**Financial:**
- Payment processing changes
- Billing system modifications
- Subscription logic changes
- Refund processing changes
- Pricing changes

**Data:**
- Production data deletion or modification
- Data export/transfer operations
- PII handling changes
- Data retention policy changes

**Reputation:**
- Customer-incidenting changes
- Publicly-visible product changes
- Marketing-landing page changes

**System Critical:**
- Load balancer configuration
- DNS changes
- SSL certificate management
- Core infrastructure scaling

**Required Controls:**
- Explicit human authorization before execution
- Production rollback plan tested and ready
- Incident response plan documented
- Change request prepared
- Stakeholder notification (if applicable)
- Security review completed
- Compliance review completed
- Monitoring/alerting configured
- Post-deployment verification plan

**Autonomy:**
- Zero autonomy for execution
- Can plan and present options
- Can prepare implementation
- Cannot execute without explicit human command

**Gate Behavior:**
- ALL GATES: Require human approval
- GATE-8 (Deploy): Production deploy requires explicit approval
- GATE-3 (Production Deploy): Always requires approval

---

## RISK ASSESSMENT FLOW

### Step 1: Identify Operation Type

Is this operation:
1. Read-only? → Tier 0
2. Write/modify? → Continue to Step 2

### Step 2: Determine Blast Radius

- Local to single file/function? → Tier 3 candidate
- Affects multiple components? → Tier 2 candidate
- System-wide or customer-facing? → Tier 1 candidate

### Step 3: Assess Reversibility

- Can easily roll back? → Tier 3 or lower
- Rollback requires migration/script? → Tier 2
- Rollback difficult or impossible? → Tier 1

### Step 4: Check Special Categories

- Production environment? → Tier 1 (minimum)
- Security/credentials? → Tier 1
- Payment/financial? → Tier 1
- Database schema? → Tier 2
- Breaking API change? → Tier 2

### Step 5: Final Assignment

Assign the highest applicable tier based on the above analysis.

---

## RISK TIER ELEVATION

### Automatic Elevation

Operations automatically elevate to higher tier if:

1. **Time Pressure**: Urgent deployment for hotfix → Tier 1
2. **Recent Failures**: Similar operations recently failed → +1 tier
3. **System Load**: Operating under high load → +1 tier
4. **Customer Impact**: Known customer-impacting issue → Tier 1
5. **Recent Releases**: Multiple recent production releases → +1 tier

### Manual Elevation

Human can elevate operation to higher tier at any time with explicit request:
```
"Factory, elevate this to Tier 1 due to [reason]"
```

---

## RISK DOCUMENTATION

### Required per Operation

For Tier 2 and Tier 1, must document:

1. Risk Tier with justification
2. Potential impacts (positive and negative)
3. Mitigation strategies
4. Rollback plan
5. Monitoring/alerting plan
6. Alternative approaches considered

### Location

- Per-task: Documented in BACKLOG/ item
- Per-commit: In commit message rationale
- Per-deployment: In deployment notes

---

## RISK TIER EXCEPTION HANDLING

### When Risk Tier is Unclear

If classification is ambiguous:
1. Assign higher tier (safety-first principle)
2. Document uncertainty
3. Request human clarification

### When Rapid Response is Required

Critical incidents (outages, security breaches):
1. Elevate to Tier 1
2. Incident response mode activated
3. Human approval may be given proactively
4. Document decisions made under pressure

---

## RISK TIER AUDIT

### Tracking

Maintain log of:
- Operation performed
- Risk Tier assigned
- Human approvals obtained
- Actual outcome
- Lessons learned

### Review

- Weekly: Tier 2 operations review
- Monthly: Tier 1 operations review
- Quarterly: Tier classification criteria review

---

## EXAMPLE RISK TIER ASSIGNMENTS

| Operation | Initial Tier | Rationale |
|-----------|--------------|-----------|
| Fix typo in README | T3 | Low risk, reversible, local |
| Add new API endpoint | T3 | Standard feature dev |
| Modify API response structure | T2 | Breaking change, customer impact |
| Update database column | T2 | Migration requires rollback plan |
| Deploy to staging | T3 | Non-production |
| Deploy to production | T1 | Production environment |
| Add payment processing | T1 | Financial, security, compliance |
| Change auth library | T2 | Security, requires testing |
| Update SSL certificate | T1 | Production, security, customer-facing |
| Refactor utility function | T3 | Tests cover, reversible |
| Delete unused database table | T2 | Data loss risk, migration needed |

---

## APPROVAL REQUIREMENTS BY RISK TIER

### Approval Matrix

| Risk Tier | Human Approval | CI Required | Rollback Required | Auto-Merge Eligible |
|-----------|----------------|-------------|-------------------|---------------------|
| T0 (Informational) | No | No | N/A | Yes |
| T3 (Low Risk) | No (per Dev Fast Mode) | Yes | Yes | Yes (if CI passes) |
| T2 (High Risk) | Yes (1 reviewer min) | Yes | Yes (tested) | No |
| T1 (Critical) | Yes (explicit auth) | Yes | Yes (tested + ready) | Never |

**Definition of Columns**:
- **Human Approval**: Whether human review is required before merge
- **CI Required**: Whether automated checks must pass (lint, tests, security)
- **Rollback Required**: Whether rollback plan must be documented/tested
- **Auto-Merge Eligible**: Whether PR can merge automatically when CI passes

---

### Directory-Based Approval Override (Dev Fast Mode)

When `Dev Stage Fast Mode` is enabled (see GOVERNANCE/GUARDRAILS.md), approval requirements override standard risk tier rules:

**Auto-Merge with CI Only** (No Human Review Required):
- `APP/**` features, bug fixes, refactors
- `PRODUCT/**` specifications, requirements, user stories
- `BACKLOG/**` task definitions, tickets
- `FRAMEWORK_KNOWLEDGE/**` technical knowledge
- `ARCHITECTURE/**` architecture documentation
- `RUNBOOKS/**` operational procedures

**Human Approval Required** (1 Reviewer Minimum):
- `GOVERNANCE/**` governance policies (Founder/CTO approval)
- `AGENTS/**` agent contracts, roles, behaviors
- `.github/workflows/**` CI/CD workflows and automation

**Important**: Risk tier T1/T2 ALWAYS require human approval regardless of directory.

---

### Approval Workflow by Tier

#### Tier 0 (Informational): No Approval
1. Execute operation
2. Log action (optional)
3. No gates or checks

**Example**: Read file, view logs, generate report

---

#### Tier 3 (Low Risk): CI-Only or Optional Review
**Standard Workflow**:
1. Create feature branch
2. Make changes
3. Commit and push
4. Open PR (optional)
5. CI runs automatically
6. If CI passes:
   - Dev Fast Mode enabled: Auto-merge (no review)
   - Dev Fast Mode disabled: Optional human review
7. Merge and continue

**When Review is Required** (T3 in GOVERNANCE/, AGENTS/):
1. Follow standard workflow through step 5
2. Request human review (1 reviewer minimum)
3. Obtain approval
4. Merge

**Example**: Refactor function, fix typo, add documentation

---

#### Tier 2 (High Risk): Human Approval Required
**Required for T2**:
- At least 1 human reviewer approval
- All CI checks must pass
- Rollback plan documented and tested
- Impact assessment completed
- Staging deployment verified

**Approval Workflow**:
1. Create feature branch
2. Implement with rollback plan
3. Document impact and risks
4. Open PR with "high-risk" label
5. Request review from appropriate reviewers (1+)
6. CI runs automatically
7. Reviewer (or Founder) assesses:
   - Rollback plan viability
   - Risk mitigation strategies
   - Potential customer impact
8. Obtain explicit approval ("LGTM" or approved)
9. Merge when approved and CI passing

**Example**: Database schema change, breaking API modification, major dependency upgrade

---

#### Tier 1 (Critical): Explicit Authorization Required
**Required for T1**:
- Explicit human authorization before ANY execution
- Can plan and present, but cannot execute without command
- All CI checks must pass
- Production rollback plan tested and ready
- Incident response plan documented
- Stakeholder notification (if applicable)
- Security and compliance reviews completed
- Monitoring/alerting configured

**Authorization Workflow**:
1. Agent identifies operation as T1
2. STOP and present to human:
   - Operation description
   - Risk tier with justification
   - Rollback plan
   - Impact assessment
   - Monitoring plan
3. Human explicitly authorizes:
   ```
   "Factory, approved: execute [operation]"
   ```
   OR
   ```
   "Factory, proceed with [operation] as T1, here's the authorization"
   ```
4. Agent executes with explicit authorization present
5. Post-execution verification and documentation

**Example**: Production deployment, security credential usage, payment processing changes

---

### Reviewer Requirements

#### Who Approves What?

**Tier 3** (Low Risk):
- Dev Fast Mode enabled: No approval required (auto-merge)
- Dev Fast Mode disabled: Any team member with write access
- Optional: Peer review encouraged but not required

**Tier 2** (High Risk):
- Any team member with write access AND relevant expertise
- Database changes: Database owner or senior engineer
- API changes: Backend team lead or API owner
- Infrastructure changes: DevOps engineer or infrastructure owner
- External integrations: Integration specialist or security reviewer

**Tier 1** (Critical):
- Repository Owner (Founder) or designated approver
- Production deployment: Founder/CTO approval required
- Security changes: Security reviewer + Founder approval
- Payment changes: Finance owner + Founder approval
- Compliance changes: Compliance officer + Founder approval

**Governance Directories** (GOVERNANCE/, AGENTS/, .github/workflows/):
- GOVERNANCE/ changes: Founder/CTO approval required (always)
- AGENTS/ changes: Agent behavior impact review + Founder approval
- .github/workflows/ changes: DevOps review + Founder approval

---

### CODEOWNERS Integration

When `.github/CODEOWNERS` file exists, approval requirements are enforced via:

**Example CODEOWNERS Configuration**:
```
# Governance requires Founder approval
GOVERNANCE/** @ranjan-expatready

# Agents require Founder review
AGENTS/** @ranjan-expatready

# CI/CD requires DevOps review
.github/workflows/** @devops-team

# Database changes require DB owner
**/*.sql @database-team

# Payment processing requires security + finance
**/payment/** @security-team @finance-team @ranjan-expatready

# All application code requires any team member review (optional, for coverage)
APP/** *
```

**CODEOWNERS + Risk Tier**:
- CODEOWNERS requirements ADD to risk tier requirements
- If T1 but CODEOWNERS doesn't list anyone → Explicit founder approval still required
- If T3 but CODEOWNERS lists specific owners → Those owners must approve

---

## VERSION HISTORY

- v1.1 (Approval Mapping): Added approval requirements by tier and directory
- v1.0 (Initial): Four-tier classification system, assessment flow, examples
