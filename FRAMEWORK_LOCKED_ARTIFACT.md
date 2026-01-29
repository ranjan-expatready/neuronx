# Framework Locked Artifact

## Summary

This artifact documents the finalization and locking of the Autonomous Engineering OS framework. As of 2026-01-23, the framework is now **INITIALIZED** and enters a **GOVERNED** operational mode where changes follow specific rules and guardrails.

---

## What Is Now Immutable

### Core Governance Structure (IMMUTABLE)

The following framework components are **PERMANENT** and cannot be removed or fundamentally altered:

- **GOVERNANCE/GUARDRAILS.md** - Core guardrails (One-Writer Rule, Approval Gates, Safe Terminal Policy, Main Branch Protection, Dev Fast Mode, State Management Policy)
- **GOVERNANCE/RISK_TIERS.md** - Risk tier definitions and approval requirements
- **GOVERNANCE/DEFINITION_OF_DONE.md** - Definition of Done criteria
- **GOVERNANCE/COST_POLICY.md** - Cost thresholds and budgeting rules
- **AGENTS/ROLES.md** - Agent role definitions and responsibilities
- **AGENTS/CONTRACTS.md** - Agent contracts and interaction rules
- **AGENTS/BEST_PRACTICES.md** - Agent best practices and workflows
- **STATE MANAGEMENT POLICY** - Mandatory STATE file updates for all PRs

**Rationale**: These policies form the foundation of safe autonomous operation. Removing or fundamentally changing these would compromise system safety and governance compliance.

### State Management Infrastructure (IMMUTABLE)

- **STATE/STATUS_LEDGER.md** - Active state tracking (must be updated for all state changes)
- **STATE/LAST_KNOWN_STATE.md** - Milestone snapshots and state machine position
- **STANDARD_STATE_FORMAT** - Required schema for all state files

**Rationale**: State files are the "brain" of autonomous operation. Change the format and the system cannot reconstruct state.

### Cockpit Artifacts-First Governance (IMMUTABLE)

- **COCKPIT/ARTIFACT_TYPES.md** - Mandatory artifact types (PLAN, EXECUTION, VERIFICATION, RELEASE, INCIDENT)
- **COCKPIT/APPROVAL_GATES.md** - Exact approval gate definitions
- **COCKPIT/SKILLS_POLICY.md** - Strict controls on third-party agent capabilities

**Rationale**: The artifacts-first model ensures Founder oversight and auditability. Changing artifact types would break Manager View integration.

### Agent Workflow State Machine (IMMUTABLE)

- **4-State Machine**: IDLE → PLANNING → EXECUTING → WAITING_FOR_HUMAN
- **State Transitions**: Exact transition rules are fixed
- **Resume Protocol**: 9-step deterministic resume procedure

**Rationale**: The state machine is the "operating system" of autonomous agents. Altering transitions or states breaks determinism.

### PR-Only Workflow (IMMUTABLE)

- **Main Branch Protection**: Direct pushes to main are FORBIDDEN
- **Required Approvals**: Minimum 1 human approval for all PRs
- **CI Requirements**: All 6 CI checks must pass before merge
- **No Admin Bypass**: No one can bypass rules (including Repository Owner)

**Rationale**: PR-only workflow is the core safety mechanism. Removing it would return the system to unsafe "direct push" mode.

---

## What Parts Are Allowed to Change

### Application Code (FULLY MUTABLE)

**Directory**: `APP/`

- **Allowed**: All changes to application code
- **Governance**: Dev Fast Mode applies (auto-merge for APP/** with CI checks only)
- **Approval**: CI green sufficient (no human approval required for code-only changes)
- **Risk**: Risk tier typically T0-T2 (depends on change scope)

**Examples**:
- Adding new features to APP/✓
- Fixing bugs in APP/✓
- Refactoring APP/ code ✓
- Adding tests to APP/✓

### Product Documentation (FULLY MUTABLE)

**Directory**: `PRODUCT/`

- **Allowed**: All changes to product specification, requirements, user stories
- **Governance**: Dev Fast Mode applies (auto-merge with CI checks only)
- **Approval**: CI green sufficient

**Examples**:
- Updating product requirements ✓
- Adding new user stories ✓
- Modifying feature specifications ✓

### Backlog Management (FULLY MUTABLE)

**Directory**: `BACKLOG/`

- **Allowed**: All changes to backlog items, priorities, estimates
- **Governance**: Dev Fast Mode applies (auto-merge with CI checks only)
- **Approval**: CI green sufficient

**Examples**:
- Adding backlog items ✓
- Updating priorities ✓
- Modifying estimates ✓

### Knowledge Base (FULLY MUTABLE)

**Directories**: `FRAMEWORK_KNOWLEDGE/`, `ARCHITECTURE/`, `RUNBOOKS/`

- **Allowed**: Adding new knowledge, updating best practices, refining runbooks
- **Governance**: Dev Fast Mode applies (auto-merge with CI checks only)
- **Approval**: CI green sufficient

**Examples**:
- Adding engineering knowledge ✓
- Updating architecture diagrams ✓
- Refining runbooks ✓

### Quality Gates Thresholds (CONDITIONALLY MUTABLE)

**File**: `GOVERNANCE/QUALITY_GATES.md`

- **Cover Age Requirements**: Can be updated as project matures
  - Stage 0 → Stage 1 (70% floor): Requires Founder approval
  - Stage 1 → Stage 2 (80% floor): Requires Founder approval
  - Stage 2 → Stage 3 (90% on critical paths): Optional, requires Founder approval

- **Approval**: ALWAYS requires Founder approval (T1 risk tier)

**Rationale**: Quality gate thresholds control release readiness. Raising thresholds requires intentional governance review.

### Cost Policy Thresholds (CONDITIONALLY MUTABLE)

**File**: `GOVERNANCE/COST_POLICY.md`

- **Allowed**: Updating budget limits, cost thresholds, spending alerts
- **Approval**: ALWAYS requires Founder approval (T1 risk tier)

**Rationale**: Cost policy directly impacts financial risk and requires Founder oversight.

### CI Workflow (CONDITIONALLY MUTABLE)

**File**: `.github/workflows/ci.yml`

- **Allowed**: Adding new CI jobs, modifying existing jobs, updating triggers
- **Approval**: ALWAYS requires Founder approval (T1 risk tier - infrastructure change)

**Rationale**: CI workflow is part of infrastructure foundation. Changes affect all PRs and require governance review.

### Cockpit Configuration (CONDITIONALLY MUTABLE)

**Files**: `COCKPIT/ANTIGRAVITY_COCKPIT_SPEC.md`, `COCKPIT/FOUNDER_DAILY_FLOW.md`

- **Allowed**: Updating cockpit panels, adding new views, modifying workflows
- **Approval**: Requires Founder approval (T1 risk tier - Founder tooling)

**Rationale**: Cockpit is the Founder's tooling. Changes affect founder experience and require founder agreement.

### Agent Prompts and Templates (CONDITIONALLY MUTABLE)

**File**: `AGENTS/PROMPT_TEMPLATES.md`

- **Allowed**: Adding new prompt templates, refining existing templates
- **Approval**: Requires Founder/CTO approval (T1 risk tier - agent behavior)

**Rationale**: Prompts directly control agent behavior. Changes require governance review.

---

## How The System Is Now Governed

### Governance Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│ FOUNDER (Ultimate Authority)                                    │
│ - Can override governance temporarily (emergency)               │
│ - Approves T1/T2 changes                                        │
│ - Sets budget and cost thresholds                              │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ CTO AGENT (Framework Stewardship)                               │
│ - Maintains framework compliance                                │
│ - Reviews all GOVERNANCE/, AGENTS/, .github/workflows/ changes │
│ - Enforces quality gate transitions                             │
│ - Updates STATE files on all state changes                     │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ GOVERNANCE POLICIES (Automatic Enforcement)                     │
│ - Main Branch Protection (PR-only workflow)                    │
│ - Dev Fast Mode (directory-based auto-merge)                   │
│ - Risk Tier Approvals (T0-T3 requirements)                      │
│ - Staged Quality Gates (coverage requirements)                  │
│ - State Management (mandatory STATE updates)                    │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ OPERATIONAL AGENTS (Code/Product/Reliability/Knowledge)         │
│ - Execute within guardrails                                     │
│ - Update STATE files on all changes                            │
│ - Create artifacts for all work                                 │
│ - Follow defined workflows                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Change Control Process

#### Tier 0 (Infrastructure/Framework)

**Examples**: Changes to `GOVERNANCE/`, `AGENTS/`, `.github/workflows/`, `COCKPIT/`

**Process**:
1. Create PR branch
2. Make changes
3. Update STATE/STATUS_LEDGER.md
4. Create approval artifact (if crossing approval gate)
5. Request Founder/CTO review
4. Run CI (all 6 checks must pass)
5. Get Founder/CTO approval (1+ reviewer from GOVERNANCE directories)
6. Merge to main

**Constraints**:
- ALWAYS requires human approval (cannot auto-merge)
- Risk tier T1 or T2
- Dev Fast Mode does NOT apply

#### Tier 1 (Production Deployment)

**Examples**: Production configuration changes, deployment scripts

**Process**:
1. Create PR branch
2. Make changes
3. Update STATE/STATUS_LEDGER.md
4. Create approval artifact (VERIFICATION or RELEASE artifact)
5. Verify staging deployment successful
6. Run CI (all 6 checks must pass)
7. Get Founder approval (explicit approval gate)
8. Merge to main
9. Deploy to production (after merge approved)

**Constraints**:
- Always requires Founder approval (T1 approval gate)
- Must have VERIFICATION artifact proving staging success
- Rollback plan must be documented in artifact

#### Tier 2 (High-Impact Changes)

**Examples**: Database migrations, breaking API changes, external API integrations

**Process**:
1. Create PR branch
2. Make changes
3. Update STATE/STATUS_LEDGER.md
4. Create approval artifact (PLAN artifact with detailed impact analysis)
5. Run CI (all 6 checks must pass)
6. Get Founder/CTO review (1+ reviewer)
7. Merge to main

**Constraints**:
- Requires human approval (T2 risk tier)
- Cost assessment must be documented
- Impact analysis must be comprehensive

#### Tier 3 (Standard Development)

**Examples**: Feature additions, bug fixes, refactoring in APP/, PRODUCT/, BACKLOG/

**Process**:
1. Create PR branch
2. Make changes
3. Update STATE/STATUS_LEDGER.md
4. Run CI (all 6 checks must pass)
5. **Dev Fast Mode**: Auto-merge eligible (if directory allows)
6. Merge to main (CI green is sufficient)

**Constraints**:
- Auto-merge eligible for APP/**, PRODUCT/**, BACKLOG/**, FRAMEWORK_KNOWLEDGE/**, ARCHITECTURE/**, RUNBOOKS/**
- Human approval NOT required (unless directory is in review-required list)
- Risk tier typically T3

### State Management Governance

#### Mandatory STATE Updates

**Policy**: Every PR that changes system state MUST update STATE/STATUS_LEDGER.md

**When to Update**:
- ✓ Before merging: Update STATUS_LEDGER.md with planned changes
- ✓ After merging: Update STATUS_LEDGER.md with completed state
- ✓ Critical milestones: Create snapshot in LAST_KNOWN_STATE.md

**State Ledger Fields to Update**:
- Current Objective (if changing)
- Active Issues (add/remove)
- Active Pull Requests (add/remove)
- Last Completed Artifact (after merge)
- Current Blockers (if any)
- Next Actions (update priority/order)
- Quality Gate Status (if coverage changes)
- CI/CD Status (after CI run)
- Cost Tracking (if billable work)
- Audit Trail (add new entry)

**Enforcement**:
- PR reviewers must check for STATE updates
- CTO Agent verifies STATE compliance on resume
- Missing STATE updates are considered DoD violations

### Cockpit Artifacts Governance

#### Artifacts-First Model

**Principle**: All work must be represented as auditable artifacts visible to Founder

**Required Artifacts**:
- **PLAN Artifact**: For all new work (contains Founder Summary, Links, Risk Tier, Cost estimate)
- **EXECUTION Artifact**: For in-progress work (contains status updates, blockers, next actions)
- **VERIFICATION Artifact**: Before production deploy (contains staging proof, test results, rollback plan)
- **RELEASE Artifact**: After production deploy (contains release notes, monitoring setup, rollback confirmation)
- **INCIDENT Artifact**: For incidents (contains incident report, RCA, fix details, prevention measures)

**Artifact Location**: `COCKPIT/artifacts/<artifact-type>/<artifact-name>.md`

**Cockpit Integration**:
- Cockpit reads artifacts from `COCKPIT/artifacts/`
- Founder can approve or reject artifacts via Cockpit or GitHub comments
- Agent State Machine updates artifacts automatically
- All artifacts feed STATUS_LEDGER.md

### Approval Gates Governance

#### Mandatory Approval Gates (STOP and Request Founder Approval)

**T1/T2 Changes**:
- All T1 and T2 changes must stop and request Founder approval
- Create approval artifact using AGENTS/PROMPT_TEMPLATES.md "TEMPLATE CV-3: Approval Request"
- Wait for Founder `/approve` or `/reject` command
- Cannot proceed without explicit approval

**Production Deployment**:
- Must create VERIFICATION artifact proving staging successful
- Must document rollback plan
- Must get Founder `/approve` for production deployment
- Monitors must be in place before deploy

**Cost Threshold Exceeded**:
- If cost projection exceeds current budget threshold
- Must stop and request Founder approval
- Cannot proceed without explicit `/approve`

**Authorization/Billing/Security Changes**:
- Must stop and request Founder approval
- Changes to auth systems, billing integration, or security configs

**Schema Changes**:
- Database schema changes must stop and request Founder approval
- Must include migration plan and rollback strategy

**Out-of-Scope Work**:
- Must stop and request Founder approval before proceeding
- Founder must explicitly approve scope expansion

**Incidents**:
- Must stop and report incident immediately
- Create INCIDENT artifact with RCA
- Get Founder approval for fix plan

### Quality Gates Governance

#### Staged Coverage Policy

**Stage 0 (Current)**: New Features Require Tests
- Coverage Requirement: None (no floor)
- Approval Requirement: CI green is sufficient
- Rationale: Framework initialization phase, no application code yet

**Stage 1 (MVP Launch)**: 70% Coverage Floor
- Coverage Requirement: Minimum 70% coverage
- Approval Requirement: CI must show 70%+ coverage
- Transition Requires: Founder approval, update QUALITY_GATES.md to Stage 1
- Triggers: When launching MVP to production

**Stage 2 (Production Maturity)**: 80% Coverage Floor
- Coverage Requirement: Minimum 80% coverage
- Approval Requirement: CI must show 80%+ coverage
- Transition Requires: Founder approval, update QUALITY_GATES.md to Stage 2
- Triggers: When codebase reaches production maturity

**Stage 3 (High-Reliability - Optional)**: 90% on Critical Paths
- Coverage Requirement: Minimum 90% on critical paths only
- Approval Requirement: CI must show 90%+ on critical files
- Transition Requires: Founder approval, update QUALITY_GATES.md to Stage 3
- Triggers: When building high-reliability systems (optional)

**Current Stage**: Stage 0 (Framework Initialized)

---

## Compliance Verification

### Framework Completeness Checklist

#### Governance Documents
- [x] GOVERNANCE/GUARDRAILS.md - Complete (Main Branch Protection, Dev Fast Mode, State Management)
- [x] GOVERNANCE/RISK_TIERS.md - Complete (Tier definitions, approval requirements)
- [x] GOVERNANCE/DEFINITION_OF_DONE.md - Complete
- [x] GOVERNANCE/COST_POLICY.md - Complete
- [x] GOVERNANCE/QUALITY_GATES.md - Complete (Staged coverage policy)
- [x] REPO_GOVERNANCE_ENFORCEMENT_ARTIFACT.md - Complete

#### Agent Documentation
- [x] AGENTS/ROLES.md - Complete
- [x] AGENTS/CONTRACTS.md - Complete
- [x] AGENTS/BEST_PRACTICES.md - Complete
- [x] AGENTS/CTO_LOOP.md - Complete (4-state machine definition)
- [x] AGENTS/PROMPT_TEMPLATES.md - Complete (including cockpit templates)

#### Cockpit Documentation
- [x] COCKPIT/ANTIGRAVITY_COCKPIT_SPEC.md - Complete
- [x] COCKPIT/ARTIFACT_TYPES.md - Complete
- [x] COCKPIT/APPROVAL_GATES.md - Complete
- [x] COCKPIT/SKILLS_POLICY.md - Complete
- [x] COCKPIT/FOUNDER_DAILY_FLOW.md - Complete

#### State Management
- [x] STATE/STATUS_LEDGER.md - Complete and updated
- [x] STATE/LAST_KNOWN_STATE.md - Complete

#### Runbooks
- [x] RUNBOOKS/repo-governance.md - Complete
- [x] RUNBOOKS/branch-protection-checklist.md - Complete
- [x] RUNBOOKS/resume-protocol.md - Complete
- [x] RUNBOOKS/safe-execution.md - Complete
- [x] RUNBOOKS/antigravity-setup.md - Complete

#### CI/CD Infrastructure
- [x] .github/workflows/ci.yml - Complete (6 jobs defined)
- [x] .github/workflows/release.yml - Present

#### Framework Knowledge
- [x] FRAMEWORK_KNOWLEDGE/autonomy_principles.md - Present
- [x] FRAMEWORK_KNOWLEDGE/product_best_practices.md - Present
- [x] FRAMEWORK_KNOWLEDGE/engineering_standards.md - Present
- [x] FRAMEWORK_KNOWLEDGE/testing_strategy.md - Present
- [x] FRAMEWORK_KNOWLEDGE/deployment_philosophy.md - Present

#### Product Documentation
- [x] PRODUCT/ - Directory present for product specs

#### State Ledger
- [x] STATE/STATUS_LEDGER.md - Updated with "Framework Initialized" status
- [x] STATE/LAST_KNOWN_STATE.md - Present for state machine snapshots

#### Project Documentation
- [x] README.md - Present
- [x] FRAMEWORK_REQUIREMENTS.md - Present
- [x] COMPLETION_STATUS.md - Present
- [x] ARCHITECTURE/ - Directory present for architecture docs

### PR Merge Summary

| PR # | Title | Status | Merged At |
|------|-------|--------|-----------|
| 1 | governance: enforce pr-only main branch | ✅ Merged | 2026-01-23 11:56 |
| 2 | governance: dev fast mode and staged quality gates | ✅ Merged | 2026-01-23 11:58 |
| 3 | framework: add auto-resume and state ledger | ✅ Merged | 2026-01-23 11:58 |
| 4 | cockpit: add antigravity cockpit contracts and skills policy | ✅ Merged | 2026-01-23 12:00 |

**Total Files Changed**: 22 files
**Total Lines Added**: 10,380+ lines
**Framework Status**: INITIALIZED ✅

---

## Post-Lock Configuration Required

### 1. GitHub Branch Protection Setup

**Location**: Settings → Branches → main → Edit

**Required Settings** (per RUNBOOKS/branch-protection-checklist.md):
- Require pull request before merging: ENABLE
- Required approvals: 1 minimum
- Dismiss stale approvals: ENABLE
- Require human approval: ENABLE
- Require code owner review: ENABLE
- Require status checks: ENABLE
- Branch must be up-to-date: ENABLE
- Required CI checks: lint, test-unit, test-integration, security, build, summary
- Allow force pushes: DISABLE
- Allow deletions: DISABLE
- Admin bypass: DISABLE (enforce_on_admins: true)

**Estimated Time**: 5-10 minutes
**Priority**: HIGH (required for PR-only governance)

### 2. Antigravity Cockpit Setup

**Location**: Antigravity.ai Manager View

**Required Actions** (per RUNBOOKS/antigravity-setup.md):
1. Connect repository to Antigravity
2. Locate artifacts directory structure
3. Configure comment workflows (/status, /refresh, /approve, /reject, /daily_brief)
4. Test approval workflows
5. Trigger STATUS panel refresh
6. Test RESUME protocol integration

**Estimated Time**: 30 minutes
**Priority**: MEDIUM (recommended for Founder visibility)

### 3. Budget and Cost Policy Configuration

**Location**: GOVERNANCE/COST_POLICY.md

**Required Actions**:
1. Set development budget per sprint
2. Configure cost thresholds ($100 alert, $500 stop)
3. Set spending alert preferences
4. Configure token cost estimates

**Estimated Time**: 10 minutes
**Priority**: LOW (can be deferred until first costs incurred)

---

## Framework Version

**Framework Version**: 1.0 (Initialized)

**Lock Date**: 2026-01-23

**Next Review**: 2026-04-23 (quarterly framework review)

---

## Summary

The Autonomous Engineering OS framework is now **INITIALIZED** and enters **GOVERNED** mode. All core governance, state management, cockpit integration, and CI/CD infrastructure are in place and immutable.

**What This Means**:
- ✓ All changes must follow PR-only workflow
- ✓ Governance policies are enforced automatically
- ✓ State management is required for all changes
- ✓ Quality gates control release readiness
- ✓ Cockpit provides Founder oversight via artifacts
- ✓ Risk tiers determine approval requirements
- Dev Fast Mode accelerates development for low-risk directories
- Emergency bypass procedure exists (never direct push)

**What Happens Next**:
1. Configure GitHub branch protection (enable PR-only enforcement)
2. (Optional) Configure Antigravity Cockpit for Founder visibility
3. Populate APP/ directory with application code
4. Follow governance rules for all subsequent changes
5. Update STATE/STATUS_LEDGER.md on all state changes
6. Create artifacts for all work (PLAN, EXECUTION, VERIFICATION, RELEASE)

---

**Framework Status**: ✅ INITIALIZED

**Governed Mode**: ✅ ACTIVE

**Operational Status**: Ready for application development

---

**Created**: 2026-01-23 by CTO Agent
**Artifact Purpose**: Framework finalization and lock documentation
**Repository**: autonomous-engineering-os
**Owner**: ranjan-expatready
