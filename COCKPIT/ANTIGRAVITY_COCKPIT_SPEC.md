# Antigravity Cockpit Specification

## Overview

The Founder Cockpit is defined as an **artifacts-first governance** system for the Autonomous Engineering OS. This cockpit provides real-time visibility into system state, active work, and approval requirements through a unified Manager View backed by in-repo artifacts stored in COCKPIT/, STATE/, and RUNBOOKS/.

---

## COCKPIT ARCHITECTURE

### Design Principle: Artifacts-First

**Founding Philosophy**: The cockpit is not a dashboard for display — it is the governance layer that the Founder uses to review, approve, and track all autonomous work. All decisions flow through artifacts, not informal channels.

**Three-Layer Governance**:
1. **Manager View (Antigravity Cockpit)**: The visual interface the Founder uses to review artifacts, approve work, and trigger workflows
2. **Artifact Layer (COCKPIT/**): In-repo documentation of work, artifacts, and governance contracts
3. **Execution Layer (Factory AGENTS/**): Autonomous agents that execute work based on approved artifacts and guardrails

**Data Flow**:
```
GitHub Issues/PRs/Projects → STATE/STATUS_LEDGER.md → Cockpit Manager View → Founder Review → Factory Execution
```

---

## COCKPIT PANELS

The cockpit must provide the following minimum panels. Each panel references specific in-repo data sources.

### Panel 1: STATUS

**Purpose**: Plain-English snapshot of current system state

**Data Sources**:
- STATE/STATUS_LEDGER.md (current objective, active issues/PRs, blockers)
- STATE/LAST_KNOWN_STATE.md (state machine position, work-in-progress)
- GitHub Issues API (active issues with labels)
- GitHub PR API (active PRs with CI status)

**Display Requirements**:
- Current objective and progress percentage
- Active issues count (grouped by priority: P0, P1, P2)
- Active PRs count (grouped by CI status: passing, failing, pending)
- Current blockers (severity: CRITICAL, HIGH, MEDIUM)
- State machine position (IDLE, PLANNING, EXECUTING, WAITING_FOR_HUMAN)
- Last GitHub sync timestamp

**Actions Available**:
- Refresh status (triggers STATUS template)
- View full STATUS_LEDGER.md

---

### Panel 2: ACTIVE WORK

**Purpose**: Track what work is currently in progress

**Data Sources**:
- STATE/STATUS_LEDGER.md (next actions, agent activity)
- GitHub Issues API (open issues with status)
- GitHub PR API (open PRs with review status)
- COCKPIT/ARTIFACT_TYPES.md (active artifacts and their status)

**Display Requirements**:
- In-progress items (from STATUS_LEDGER next actions)
- Active PRs (with links, CI status, review status)
- Active artifacts (with links to artifact files)
- Current agent activity (which agent is working on what)
- Work item priority (ordered list)

**Actions Available**:
- View full artifact (opens artifact file)
- Request update on specific work item
- Create new work item (creates GitHub Issue via Factory)

---

### Panel 3: APPROVALS

**Purpose**: Items requiring founder approval

**Data Sources**:
- STATE/STATUS_LEDGER.md (waiting for human input section)
- GOVERNANCE/GUARDRAILS.md (approval gates and requirements)
- GOVERNANCE/RISK_TIERS.md (risk tier assignments)
- GitHub Issues API (issues labeled "approval-required")
- GitHub PR API (PRs requiring review/approval)

**Display Requirements**:
- Pending approvals (grouped by risk tier: T1, T2, T3)
- Approval type (T1/T2 gate, prod deploy, cost threshold, etc.)
- Risk tier and required approvers
- How long waiting for approval (timestamp)
- Associated GitHub Issue/PR link
- Associated artifact link (if any)

**Actions Available**:
- Approve (adds comment with "APPROVED" label, updates STATUS_LEDGER)
- Reject (adds comment with rationale, blocks work)
- Request changes (adds comment with feedback, sends back to planning)
- View full artifact (opens artifact file for review)

---

### Panel 4: RISKS

**Purpose**: Track risk exposure and mitigation

**Data Sources**:
- GOVERNANCE/RISK_TIERS.md (current risk tier assignments)
- STATE/STATUS_LEDGER.md (current blockers, risk tier)
- GitHub Issues API (issues with risk labels)
- GOVERNANCE/GUARDRAILS.md (safety boundaries)

**Display Requirements**:
- Current overall risk level (LOW, MEDIUM, HIGH, CRITICAL)
- Active high-risk items (T1/T2/T3 breakdown)
- Risk categories (security, data loss, availability, etc.)
- mitigation strategies for active risks
- Risk trends (increasing, stable, decreasing)

**Actions Available**:
- View risk tier details (opens RISK_TIERS.md)
- Elevate risk tier (requires GitHub Issue)
- Request risk mitigation plan

---

### Panel 5: COSTS

**Purpose**: Track spending against budget and thresholds

**Data Sources**:
- GOVERNANCE/COST_POLICY.md (budget, thresholds, spending)
- STATE/STATUS_LEDGER.md (cost tracking section)
- GitHub Issues API (cost-related issues)

**Display Requirements**:
- Current budget and remaining
- Daily/weekly spending trend
- Current cost vs budget (percentage)
- Pending cost estimates (work awaiting cost approval)
- Cost threshold proximity (warning if approaching limit)

**Actions Available**:
- View cost policy (opens COST_POLICY.md)
- Request budget adjustment (requires GitHub Issue)

---

### Panel 6: RELEASES

**Purpose**: Track release readiness and deployment status

**Data Sources**:
- GOVERNANCE/DEFINITION_OF_DONE.md (DoD criteria)
- STATE/STATUS_LEDGER.md (CI/CD status)
- GitHub PR API (PRs targeting main branch)
- GitHub Releases API (past releases)
- RUNBOOKS/deployment-runbook.md (if exists)

**Display Requirements**:
- Release candidate PRs (with links, CI status)
- DoD compliance status (percentage complete)
- Release readiness status (READY, NEEDS_FIXES, NOT_READY)
- Last production deployment timestamp
- Rollback plan status (exists or missing)

**Actions Available**:
- View release checklist
- Approve production deployment (if T1 approval satisfied)
- Request release notes

---

## DATA SOURCES AND REFERENCES

### GitHub Integration

The cockpit must directly reference GitHub's native entities:

**GitHub Issues**:
- Source of truth for feature requests, bugs, tasks
- Linked to artifacts via issue comments or descriptions
- Status tracked via labels (in-progress, blocked, done)

**GitHub Pull Requests**:
- Source of truth for code changes under review
- CI status displayed per PR
- Approval status tracked via GitHub's review system

**GitHub Projects**:
- Optional: Use GitHub Projects for Kanban-style work tracking
- Issues and PRs can be organized in board view

### In-Repo Data References

The cockpit must read and display data from these files:

```
STATE/STATUS_LEDGER.md
- Current objective
- Active issues (with GitHub links)
- Active PRs (with GitHub links)
- Last completed artifact
- Current blockers
- Next actions (ordered)
- Current risk tier
- Quality gate status
- CI/CD status
- Agent activity
- Cost tracking
- Waiting for human input

STATE/LAST_KNOWN_STATE.md
- State machine position
- Active task details
- Work-in-progress items
- GitHub state (branch, commits, issues, PRs)
- CI/CD state

COCKPIT/ARTIFACT_TYPES.md
- Active artifacts and their types
- Artifact status (PLAN, EXECUTION, VERIFICATION, RELEASE, INCIDENT)
- Links to artifact files

COCKPIT/APPROVAL_GATES.md
- Pending approval items
- Approval gate requirements

COCKPIT/SKILLS_POLICY.md
- Approved agent skills list
- Skills under review

GOVERNANCE/*.md
- Guardrails, risk tiers, cost policy, quality gates, definition of done
- Referenced for governance context
```

---

## COCKPIT WORKFLOWS

### STATUS Request Triggers COCKPIT Refresh

**Command**: The Founder triggers a STATUS request (from AGENTS/PROMPT_TEMPLATES.md)

**Factory Execution**:
1. Factory executes STATUS template
2. Factory reads STATE/STATUS_LEDGER.md and STATE/LAST_KNOWN_STATE.md
3. Factory scans GitHub for current issues/PRs/CI
4. Factory compiles plain-English status report
5. Factory updates STATUS_LEDGER.md with fresh data
6. Cockpit displays updated STATUS panel

### RESUME Request Triggers State Reconstruction

**Command**: The Founder triggers a RESUME request (from AGENTS/PROMPT_TEMPLATES.md)

**Factory Execution**:
1. Factory executes resume protocol (RUNBOOKS/resume-protocol.md)
2. Factory reads all GOVERNANCE files
3. Factory reads STATE files
4. Factory scans GitHub
5. Factory reconstructs state and context
6. Factory begins executing next action
7. Cockpit displays updated status and moves to appropriate state

### DAILY_BRIEF Request Triggers Cockpit Refresh

**Command**: The Founder triggers a DAILY_BRIEF (from AGENTS/PROMPT_TEMPLATES.md)

**Factory Execution**:
1. Factory generates daily brief from STATUS_LEDGER, LAST_KNOWN_STATE, GitHub
2. Factory identifies approvals needed, blockers active, costs
3. Factory highlights items requiring founder attention
4. Cockpit displays brief in founder-ready format
5. Founder can take actions directly from brief

### APPROVAL Request Triggers Stop-Gate

**Command**: The Founder triggers APPROVAL request (from AGENTS/PROMPT_TEMPLATES.md)

**Factory Execution**:
1. Factory receives approval request with artifact details
2. Factory validates against GOVERNANCE/APPROVAL_GATES.md (or COCKPIT/APPROVAL_GATES.md)
3. Factory checks if risk tier and gate requirements are satisfied
4. Factory moves work to WAITING_FOR_HUMAN state
5. Cockpit displays item in APPROVALS panel
6. Founder reviews and approves/rejects

---

## COCKPIT REFRESH MECHANISM

### Automatic Refresh

The cockpit should automatically refresh:
- Every 5 minutes (configurable)
- When STATUS_LEDGER.md changes (detected via file watcher)
- When new GitHub events occur (webhooks or polling)

### Manual Refresh

The Founder can manually refresh:
- Via "Refresh Status" action on any panel
- Via STATUS/DAILY_BRIEF command
- Via COCKPIT_REFRESH template (Factory command)

### Refresh Process

1. Factory reads fresh STATE files
2. Factory queries GitHub API for current issues/PRs/CI
3. Factory reconciles differences
4. Factory updates cockpit display
5. Factory updates STATUS_LEDGER.md with reconcile results

---

## COCKPIT CONFIGURATION

### Required Configuration

To configure the Antigravity Cockpit for this repository:

1. **Connect Repository**: Authenticate GitHub API access for the repo
2. **Locate Artifacts**: Configure COCKPIT/ directory as artifact source
3. **Comment Workflow**: Enable GitHub webhook or polling for comment triggers
4. **Approval Workflow**: Configure how approvals are communicated (comments, labels)
5. **Trigger Keywords**: Configure STATUS, RESUME, DAILY_BRIEF keywords as Factory triggers

### Environment Variables

```
Factory Environment:
- GITHUB_TOKEN: GitHub personal access token for API access
- REPO_OWNER: Repository owner (e.g., "ranjan-expatready")
- REPO_NAME: Repository name (e.g., "autonomous-engineering-os")
- DEFAULT_BRANCH: Default branch (e.g., "main")
```

---

## COCKPIT CONTRACTS

### Founder Responsibilities

The Founder agrees to:
1. Review pending approvals in the APPROVALS panel
2. Approve or reject work items in a timely manner
3. Use STATUS and DAILY_BRIEF to stay informed
4. Follow the artifacts-first model (decisions via artifacts)
5. Report issues with cockpit views or workflows

### Factory Responsibilities

Factory agrees to:
1. Keep STATE files up-to-date with real-time data
2. Execute triggered commands (STATUS, RESUME, DAILY_BRIEF) deterministically
3. Follow all governance guardrails
4. Stop at all defined approval gates
5. Provide transparent, auditable status updates

---

## VERSION HISTORY

- v1.0 (Initial): Founder Cockpit specification with artifacts-first governance model

---

**Specification Version**: v1.0
**Last Updated**: 2026-01-23 by CTO Agent
