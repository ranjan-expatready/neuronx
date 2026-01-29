# Operating Manual — Autonomous Engineering OS

## Overview

This manual is the single canonical reference for the Autonomous Engineering OS. It captures current progress, remaining work, and power-user defaults aligned with our doctrine of autonomous engineering.

**Last Updated**: 2026-01-24
**Status**: Framework Complete, Operational Phase

---

## What's Done

### Constitution & Governance ✓

**Files**: `GOVERNANCE/GUARDRAILS.md`, `GOVERNANCE/RISK_TIERS.md`, `GOVERNANCE/DEFINITION_OF_DONE.md`, `GOVERNANCE/COST_POLICY.md`

- ✅ One-Writer Rule: Only Factory writes to the repo; external AIs are advisors-only
- ✅ PR-Only Workflow: Direct pushes to main are forbidden
- ✅ Risk Tiers: T0-T3 classification with approval requirements
- ✅ Staged Coverage Policy: Quality gates increase with system maturity
- ✅ Approval Gates: Explicit stops at ambiguity, cost thresholds, production deployment, security risk

**Artifact**: `FRAMEWORK_LOCKED_ARTIFACT.md` (2026-01-23)

---

### Resume & State Management ✓

**Files**: `STATE/STATUS_LEDGER.md`, `STATE/LAST_KNOWN_STATE.md`, `RUNBOOKS/resume-protocol.md`

- ✅ 9-Step Deterministic Resume Protocol
- ✅ 4-State Machine: IDLE → PLANNING → EXECUTING → WAITING_FOR_HUMAN
- ✅ Continuous state tracking during operations
- ✅ Context preservation across sessions (mental state, file state, coordination state)
- ✅ Automatic blocker detection and validation

**Artifact**: `AUTO_RESUME_ARTIFACT.md` (2026-01-23)

---

### Cockpit Contracts ✓

**Files**: `COCKPIT/ARTIFACT_TYPES.md`, `COCKPIT/APPROVAL_GATES.md`, `COCKPIT/SKILLS_POLICY.md`, `RUNBOOKS/antigravity-setup.md`

- ✅ Mandatory artifact types: PLAN, EXECUTION, VERIFICATION, RELEASE, INCIDENT
- ✅ Antigravity Manager View configured (Factory dashboard integration)
- ✅ Approval gate definitions for Founder oversight
- ✅ Skills policy for third-party agent capabilities

**Artifact**: Antigravity Cockpit Integration (PR #4, 2026-01-23)

---

### MCP Installation ✓

**File**: `ARABOLD_MCP_INSTALLATION_ARTIFACT.md`

- ✅ Model Context Protocol infrastructure installed
- ✅ Arabold MCP server configured and validated
- ✅ Source priority for context injection into agent prompts
- ✅ MCP server available at `arabold-mcp://localhost:3000`

**Artifact**: `ARABOLD_MCP_INSTALLATION_ARTIFACT.md` (2026-01-24)

---

### Machine Board Governance ✓

**Files**: `.github/workflows/governance-validator.yml`, `scripts/governance_validator.py`

- ✅ Machine Board of Directors mode activated (no human approvals)
- ✅ Automated governance enforcement via CI
- ✅ Secret detection blocks PRs with credentials
- ✅ Protected path artifacts required for GOVERNANCE/, AGENTS/, etc.
- ✅ Risk tier validation (T1/T2 require rollback + verification proof)
- ✅ Proof test: PR #7 merged with 0 human approvals (2026-01-24)

**Artifacts**: `PR5_MERGE_ARTIFACT.md`, `MACHINE_BOARD_ACTIVATION_ARTIFACT.md` (2026-01-24)

---

### CI/CD Infrastructure ✓

**Files**: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

- ✅ 6-job CI workflow: lint, test-unit, test-integration, security, build, summary
- ✅ Release workflow: Staging → production with approval gates
- ✅ GitHub Actions configured and validated

---

## What's Remaining

**Execution Order (Do Not Reorder)**

### 1. Machine Board Activation

**Next Immediate Step**

- **Task**: Configure and activate machine board mode in production
- **Prerequisites**: None (governance-validator workflow merged)
- **Estimated Time**: ~15-30 minutes
- **Risk Tier**: T0 (infrastructure configuration)
- **Owner**: CTO/Founder
- **Reference**: `RUNBOOKS/repo-governance.md` (Section: Machine Board Activation)
- **Deliverable**: Machine board fully operational, auto-validating PRs without human approvals

---

### 2. GitHub Projects Board

**After Machine Board Activation**

- **Task**: Create and configure GitHub Project v2 (Kanban Board) for live SDLC tracking
- **Prerequisites**: Machine board activated
- **Estimated Time**: ~30-45 minutes
- **Risk Tier**: T0 (tooling setup)
- **Owner**: Founder/CTO
- **Reference**: `GITHUB_PROJECT_SDLC_ARTIFACT.md`
- **Deliverable**: Kanban board with Type, Risk Tier, Owner, and Release fields; items synced to repo state

---

### 3. End-to-End SDLC Simulation

**After GitHub Projects Board**

- **Task**: Full cycle simulation of autonomous work from backlog to deploy
- **Prerequisites**: GitHub Projects board operational
- **Estimated Time**: ~2-4 hours
- **Risk Tier**: T1 (first production run)
- **Owner**: CTO + Code Agent
- **Reference**: `RUNBOOKS/safe-execution.md`
- **Deliverable**: Complete SDLC cycle demonstrated and validated (artifact for each stage)

---

### 4. MVP Kickoff

**After SDLC Simulation Validated**

- **Task**: Begin actual development of first MVP feature
- **Prerequisites**: SDLC simulation successful
- **Estimated Time**: Ongoing
- **Risk Tier**: T2-T3 (feature development)
- **Owner**: Product + Code Agents
- **Reference**: `PRODUCT/` (to be populated)
- **Deliverable**: First working MVP feature deployed to staging

---

## Power User Defaults

### Spec Mode

**Purpose**: For ambiguous tasks, multi-step work, or when multiple approaches exist.

**Usage**:
1. Agent enters spec mode proactively when requirements are unclear
2. Creates concrete implementation plan with alternatives if applicable
3. Presents plan to Founder for approval before coding
4. Only exits spec mode with explicit approval or user instruction

**When NOT to Use**:
- Single straightforward tasks
- Pure information gathering
- Tasks with clear, unambiguous requirements

---

### Auto-Run LOW/MEDIUM Risk

**Principle**: Autonomy increases as risk decreases (T2-T3 work).

**Default Behavior**:

| Risk Tier | Autonomy | Auto-Run | Approval Required |
|-----------|----------|----------|-------------------|
| T0 | None | ❌ No | Never (infrastructure only) |
| T1 | None | ❌ No | Always required |
| T2 | Limited | ⚠️ Conditional | Optional for routine |
| T3 | Medium | ✅ Yes | Never required |
| T4 | High | ✅ Yes | Never required |

**Auto-Run Conditions** (T2-T3):
- ✅ Feature implementation (T3)
- ✅ Bug fixes in non-critical paths (T3)
- ✅ Refactoring with tests present (T3)
- ✅ Documentation updates (T4)
- ✅ Formatting and code style (T4)
- ⚠️ Breaking changes (T2) — requires rollback plan before auto-run

---

### Code Review Workflow

**Default Process** (for all non-framework code):

1. **Code Agent**: Implements feature, writes tests
2. **Reliability Agent**: Runs tests, validates quality gates
3. **CI Pipeline**: Automatically runs all 6 CI jobs
4. **Machine Board**: Validates governance (secrets, protected paths, risk tier)
5. **Auto-Merge**: If all green → automatic merge for T3/T4 work
6. **Manual Review**: Required for T1/T2 work or failed gates

**Framework Code**:
- ❌ No auto-merge
- ✅ Founder approval required for all GOVERNANCE/, AGENTS/, .github/workflows/**
- ✅ Additional validation via MACHINE_BOARD_GOVERNANCE.md

---

### Agent Readiness Weekly KPI

**Tracking** (every Friday at end of sprint):

| Agent | KPI | Target | Measurement |
|-------|-----|--------|-------------|
| Product | User stories defined | 5+ per week | BACKLOG/ count |
| Code | Features completed | 3+ per week | PRs merged / artifact count |
| Reliability | Test coverage | 80%+ | Coverage reports |
| Knowledge | Documentation updated | 100% | Documentation completeness |
| Advisor | External research | As needed | Counsel artifacts created |

**System-Level KPI**:
- State consistency: 100% (STATE files always match reality)
- Resume success rate: 100% (resume works deterministically)
- Blocker handling: < 4 hours average time to resolve

---

### MCP Source Priority

**Context Injection Order** (most to least important):

1. **FRAMEWORK_LOCKED_ARTIFACT.md** — Immutability rules and governance
2. **STATE/STATUS_LEDGER.md** — Current operational state
3. **GOVERNANCE/GUARDRAILS.md** — Core safety rules
4. **GOVERNANCE/RISK_TIERS.md** — Risk classification
5. **RUNBOOKS/resume-protocol.md** — How to reconstruct state
6. **AGENTS/ROLES.md** — Agent responsibilities
7. **COCKPIT/ARTIFACT_TYPES.md** — Output requirements
8. **COCKPIT/APPROVAL_GATES.md** — Stop conditions
9. **FRAMEWORK_KNOWLEDAGE/** — Engineering standards and best practices

**Note**: MCP server injects this context into every agent prompt to maintain consistency.

---

### Postpone: Hooks, Droid-Exec, Slack, Linear

**Status**: NOT CURRENTLY CONFIGURED — POSTPONE TO AFTER MVP

**Reasoning**:
- **Factory Hooks**: Fine-grained command interception — useful for advanced workflows, not needed for initial MVP
- **droid-exec**: Custom droid execution capabilities — add when specific automation patterns emerge
- **Slack Integration**: Team communication — solo founder environment, no team yet
- **Linear Integration**: Issue tracking — GitHub Projects v2 provides sufficient tracking for now

**Revisit After**: MVP launch + first team member hire

---

## Daily Founder Workflow

**Board Member View (5-10 Minutes Daily) — Antigravity Board Member Loop**

The Founder now acts as a board member reviewing auto-generated daily artifacts. The system generates operational briefs and approvals queues automatically via CI, requiring minimal manual GitHub navigation.

---

### Overview

**Generated Daily Artifacts** (automated via CI, run daily at 09:00 UTC):
- **DAILY_BRIEF (`COCKPIT/artifacts/DAILY_BRIEF/BRIEF-YYYYMMDD.md`)**: System overview, open PRs, project status, Trae review requirements
- **APPROVALS_QUEUE (`COCKPIT/artifacts/APPROVALS_QUEUE/APPROVALS-YYYYMMDD.md`)**: Explicit YES/NO/DEFER decisions needed

**Access Method**:
- Review the daily-brief PR that CI creates automatically
- OR manually view artifacts in `COCKPIT/artifacts/` directory

---

### Step 1: Read Daily Brief (2-3 Minutes)

**File**: `COCKPIT/artifacts/DAILY_BRIEF/BRIEF-YYYYMMDD.md`

**What to Look For**:
- **Executive Summary**: Quick stats (open PRs, issues, blocked items)
- **Trae Required**: T1-T2 PRs waiting for Trae review
- **Open PRs**: All active pull requests with CI status
- **Project Items**: SDLC project status (Waiting for Approval, Blocked, In Review)

**Quick Scan**: Green if:
- ✅ No Trae reviews missing for T1-T2
- ✅ No blocked items
- ✅ CI checks passing on all PRs
- ✅ "System operating autonomously" in Approvals Queue summary

---

### Step 2: Act on Approvals Queue (3-5 Minutes)

**File**: `COCKPIT/artifacts/APPROVALS_QUEUE/APPROVALS-YYYYMMDD.md`

**Decision Format**:
For each item, respond by commenting on the daily-brief PR:
- **YES** — Approve the action (allow merge, unblock, etc.)
- **NO** — Reject or request defer (explain briefly)
- **EMERGENCY_OVERRIDE** — Force proceed (document reason for accountability)

**Decision Categories**:

1. **Trae Review Required** (T1-T2 PRs):
   - **Missing Trae Artifact**: YES = authorize Trae invocation | NO = defer
   - **Trae APPROVED**: YES = authorize merge | NO = defer
   - **Trae REJECT/REQUEST_CHANGES**: YES = request re-review | NO = defer

2. **Waiting for Approval** (Project Items):
   - YES = authorize proceeding with work
   - NO = defer until next cycle
   - EMERGENCY_OVERRIDE = force proceed (document reason)

3. **Blocked Items**:
   - YES = unblock item
   - NO = keep blocked

4. **CI Failing PRs**:
   - YES = approve retry after fix
   - NO = let author fix first

**Decision Automation**: Factory agents automatically process your PR comments and take actions.

---

### Step 3: Review Artifacts (Optional, 1-2 Minutes)

**Location**: Various artifact directories and files

**What to Review** (if interested):
- Recent PLAN, EXECUTION, VERIFICATION artifacts in project
- Any INCIDENT artifacts requiring attention
- Trae review artifacts (`COCKPIT/artifacts/TRAE_REVIEW/`)

**Cockpit View**: Use Antigravity Manager View (`RUNBOOKS/antigravity-setup.md`) for visual artifact tracking if detailed review needed.

---

### Step 4: Resume Autonomous Work (If Paused, Optional)

**Command**: `Factory, please resume autonomous work.`

**When to Use**:
- System was paused by a gate (unlikely with daily brief system)
- Want to trigger next work item immediately
- After addressing a blocker

**Expectation**: System reconstructs state automatically, continues where it left off, respects your daily decisions.

---

### Quick Daily Summary

```
[ ] DAILY_BRIEF — reviewed, no surprises
[ ] APPROVALS_QUEUE — all decisions made (or decisions=0)
[ ] Artifacts — optional quick review (if needed)
[ ] RESUME — trigger if work paused, otherwise system runs autonomously
```

**No Action Required**: If Approvals Queue summary shows "Total Decisions Required: 0", the system is operating fully autonomously today. No action needed.

**Weekly Ritual**: Fridays — Agent Readiness KPI review, sprint planning, backlog refinement.

---

### Manual Trigger (Optional)

**Trigger Daily Brief Manually**:
```bash
gh workflow run daily-brief.yml
```

Or via GitHub UI: `.github/workflows/daily-brief.yml` → Run workflow → Run workflow

**Dry Run Mode** (test generation without creating PR):
- In workflow run UI, enable `dry_run` checkbox
- Artifacts generated but no PR created

---

## Quick Reference Commands

### Resume Autonomous Work

```
Factory, please resume autonomous work.

Reconstruct:
1. Current governance state (all guardrails, risk tiers, quality gates)
2. Current system state (last known state, active tasks, blockers)
3. GitHub repository state (issues, PRs, CI status)
4. Determine next priority action
5. Reconstruct all context needed to continue
6. Begin executing

Resume from: [IDLE / PLANNING / EXECUTING / WAITING_FOR_HUMAN]
```

### Check System State

```bash
# Read status ledger
cat STATE/STATUS_LEDGER.md

# Check GitHub issues
gh issue list

# Check GitHub PRs
gh pr list

# Check CI status
gh run list --limit 5
```

### Review Recent Work

```bash
# Last commits
git log --oneline -10

# Recent artifacts
ls -lt *.md | head -10

# Agent activity
grep -r "STATUS_LEDGER" AGENTS/
```

---

**End of Operating Manual**

For questions on specific topics:
- Governance: `GOVERNANCE/`
- Agent behavior: `AGENTS/`
- Operational procedures: `RUNBOOKS/`
- Architecture and decisions: `STATE/`
- Factory capabilities: https://docs.factory.ai/factory-docs-map.md
