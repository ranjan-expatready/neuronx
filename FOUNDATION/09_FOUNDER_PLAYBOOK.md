# Founder Playbook — Operating Manual

Version: v1.0
Owner: Antigravity (CTO)
Ratified By: Founder
Status: CANONICAL

---

## Purpose

This document is the "you never read code" operating manual for the Founder of Autonomous Engineering OS. It explains the daily 5-10 minute workflow, how to use the Approvals Queue, how to authorize Trae, and what to do when blocked.

**Key Principle**: Founder operates as board member, not engineer.

---

## What is SSOT Here?

The Single Source of Truth FOR the Founder is:

- **COCKPIT/artifacts/DAILY_BRIEF/BRIEF-YYYYMMDD.md** — Daily 5-10 minute view
- **COCKPIT/artifacts/APPROVALS_QUEUE/APPROVALS-YYYYMMDD.md** — Explicit YES/NO/DEFER decisions
- **GitHub Projects Board** — https://github.com/users/ranjan-expatready/projects/2 (visual state)
- **STATE/STATUS_LEDGER.md** — Current operational state (if needed)
- **RUNBOOKS/OPERATING_MANUAL.md** — Detailed operating procedures

No code reading required.

---

## Daily Workflow (5-10 Minutes)

### Morning (09:00 UTC / Local Time)

```mermaid
flowchart LR
    A[09:00 UTC] --> B[GitHub Actions<br/>Generates Brief]
    B --> C[COCKPIT/artifacts/DAILY_BRIEF/<br/>BRIEF-20260126.md]
    C --> D[Founder Reads<br/>5 min]
    D --> E[COCKPIT/artifacts/APPROVALS_QUEUE/<br/>APPROVALS-20260126.md]
    E --> F[Founder Decides]<br/>YES/NO/DEFER<br/>5 min</p>
    F --> G{Decisions = 0?}
    G -->|Yes| H[System Operates<br/>Autonomously]
    G -->|No| I[Factory Processes<br/>Decisions]
    I --> J[Work Continues]
```

### Step-by-Step

1. **Wait for Daily Brief** (09:00 UTC)
   - GitHub Actions auto-generates brief
   - Artifact: COCKPIT/artifacts/DAILY_BRIEF/BRIEF-YYYYMMDD.md
   - PR created with artifact links

2. **Review Daily Brief** (5 minutes)
   - Executive summary
   - Open PRs (with CI status)
   - Blocked items
   - Trae review requirements

3. **Review Approvals Queue** (5 minutes)
   - Items waiting for approval
   - Risk tier for each item
   - Action required

4. **Make Explicit Decisions** (YES/NO/DEFER)
   - YES: Approve and proceed
   - NO: Reject and stop
   - DEFER: Add to backlog, return to later

5. **System Operates** (if decisions=0)
   - Factory processes decisions automatically
   - Antigravity continues planning
   - Daily brief cycles again tomorrow

**Total time**: 5-10 minutes  
**Code reading**: 0 minutes  
**GitHub navigation**: 0 clicks (artifacts provide links)

---

## Using the Approvals Queue

### What is the Approvals Queue?

The Approvals Queue is a daily-generated artifact that lists all items requiring founder decision:

- Production deployments (T1)
- Budget approvals (GATE-2)
- Strategy changes
- Blocked items needing resolution
- Trae review requirements

**Location**: COCKPIT/artifacts/APPROVALS_QUEUE/APPROVALS-YYYYMMDD.md

### Format

```markdown
# Approvals Queue - 2026-01-26

## Trae Review Required (T1-T4)
- PR #42: Security policy update
  - Status: Waiting for Trae review
  - Action: Authorize Trae review
  - Your response: `/authorize-trae` on PR

## Waiting for Approval
1. **PR #41: Production deploy v1.2**
   - Risk: T1 (Critical)
   - Reason: Production deployment
   - Action: Approve/Deny
   - Your response: `/approve` or `/reject: reason`

2. **Issue #30: Payment processing redesign**
   - Risk: T2 (High)
   - Reason: Major change
   - Action: Approve/Deny/Defer
   - Your response: `/approve` or `/defer: reason`

## Blocked Items
- Issue #25: Database migration
  - Blocked by: Testing framework
  - Action: None (autonomous resolution)
```

### How to Respond

**On the Daily Brief PR** (comment):

```markdown
Factory, responses for today:

1. PR #41 production deploy: **YES** — authorize deploy
2. Issue #30 payment redesign: **DEFER** — low priority
3. Issue #25 database migration: **DEFER** — blocked by testing framework, revisit in 1 week
```

**Factory processes automatically**:
- Factory reads PR comments
- Updates PR status
- Resumes work based on decisions

---

## Authorizing Trae

### When Trae Review is Required

Trae review is required for:
- T1-T4 PRs (protected paths or high risk)
- Security changes (GOVERNANCE/, AGENTS/, .github/workflows/)
- Production deployments

### How to Authorize

**Method 1: Via Daily Brief**

In Daily Brief PR comment:
```markdown
Factory, **authorize Trae review** for:
- PR #42: Security policy update
```

**Method 2: Direct PR Comment**

On the actual PR:
```markdown
/authorize-trae
```

Factory then:
- Invokes Trae external reviewer
- Waits for Trae verdict
- Creates TRAE_REVIEW artifact
- Machine Board validates

### Trae Review Outcomes

| Trae Verdict | Founder Action | Result |
|--------------|----------------|--------|
| APPROVE | None | Merge allowed |
| REJECT | Fix issues | Factory addresses, re-request |
| REQUEST_CHANGES | Monitor | Can merge with warning |
| EMERGENCY_OVERRIDE | Review post-merge | Rarely needed |

**Founder does not review code** — Trae handles technical review.

---

## What to Do When Blocked

### Types of Blockers

| Blocker Type | Symptom | Founder Action |
|--------------|---------|----------------|
| **CI Failure** | PR failing checks | Check error message, may need expert input |
| **Cost Threshold** | Budget exceeded | Approve increase or defer |
| **T1 Gate** | Production deploy stopped | Explicit authorization |
| **Ambiguity** | Unclear requirements | Clarify in PR comment |
| **External Dependency** | Waiting on third party | Wait or escalate |

### Blocker Resolution Flow

```mermaid
flowchart LR
    A[Blocked Item] --> B{Type?}

    B -->|CI Failure| C[Factory Investigates<br/>Ask: Why failed?]
    B -->|Cost| D[Decide: Approve/Budget]<br/>YES/NO/DEFER</p>
    B -->|T1 Gate| E[Authorize Production]<br/>Explicit</p>
    B -->|Ambiguity| F[Clarify Requirements]<br/>Comment instructions</p>

    C --> G{Resolved?}
    G -->|Yes| H[Resume Work]
    G -->|No| I[Escalate/Developer Input]

    D --> H
    E --> H
    F --> H
```

### How to Resolve

**On the Daily Brief PR** (comment):

```markdown
Factory, resolutions for blockers:

1. **PR #41 CI failure**: Ask DevOps to investigate build issue
2. **Cost threshold exceeded (PR #50)**: **YES** — approve budget increase
3. **T1 Gate (PR #55 production deploy)**: **YES** — authorize deployment
4. **Ambiguity (Issue #30)**: Clarify requirement X
```

Factory processes decisions, resolves blockers, continues work.

---

## Founder Commands

### Available Commands (Comment on PR)

| Command | Meaning | Action |
|---------|---------|--------|
| `/approve` | Approve item | Proceed with execution |
| `/reject: [reason]` | Reject item | Stop, do not proceed |
| `/defer: [reason]` | Defer to later | Add to backlog, revisit |
| `/authorize-trae` | Authorize Trae review | Invoke external reviewer |
| `/request-changes: [feedback]` | Request changes | Modify item, continue |
| `/status` | Request status report | Factory provides update |
| `/resume` | Resume autonomous work | Resume if paused |
| `/brief` | Request daily brief | Generate brief on demand |

### Command Examples

**Approve production deploy**:
```markdown
/approve production deployment v1.2
Rollout to 10% first, then 100% if metrics OK.
```

**Reject item**:
```markdown
/reject: Not aligned with current sprint goals
Defer to Q2 planning.
```

**Defer item**:
```markdown
/defer: Testing framework not ready
Revisit in 2 weeks when testing framework deployed.
```

**Authorize Trae**:
```markdown
/authorize-trae
Please invoke Trae external reviewer for security changes.
```

---

## Founder Do's and Don'ts

### ✅ DO

- ⚡ Review Daily Brief daily (5-10 minutes)
- ⬜ Make explicit YES/NO/DEFER decisions
- 🗣️ Clarify ambiguous requirements via comments
- ✅ Authorize T1 production deployments
- 💰 Approve budget increases when needed
- ⏸️ Trust the system when decisions=0

### ❌ DON'T

- ⛔ Read code (Trae handles technical review)
- ⛔ Write code (Factory handles implementation)
- ⛔ Manual GitHub navigation (use Daily Brief + Approvals Queue)
- ⛔ Bypass governance gates (system enforces automatically)
- ⛔ Approve without understanding risk tier
- ⛔ Micro-manage Factory (Antigravity provides direction)

---

## Emergency Procedures

### When System is Unresponsive

**Symptom**: No Daily Brief generated, no responses from Factory

**Actions**:
1. Check GitHub Actions status: `gh workflow view daily-brief`
2. Manually trigger workflow: `gh workflow run daily-brief.yml`
3. Check GitHub Projects board status: `gh project view 2`
4. If still unresponsive: Contact support or Antigravity diagnostics

### When Trae is Unavailable

**Symptom**: Trae review timeout, blocking critical deploy

**Actions**:
1. Check emergency override protocol (RUNBOOKS/trae-review.md)
2. Comment on PR: `#emergency-override reason: critical security fix`
3. Factory creates EMERGENCY_OVERRIDE artifact
4. Machine Board allows merge
5. **Post-merge**: Mandatory Trae review when service restored

### When Founder is Unavailable

**Symptom**: Founder cannot review Daily Brief for extended period

**Actions**:
1. System continues with `decisions=1` (deferred until founder returns)
2. Autonomous work continues (T3 items)
3. T1 items blocked until founder returns
4. Upon return: Review accumulated Briefs + Approvals Queue

---

## Metrics and Monitoring

### What to Track

| Metric | How to Track | Target |
|--------|--------------|--------|
| **Daily Brief Time** | Clock time | < 10 minutes |
| **Approvals Queue Size** | Count items | < 5 items/day |
| **Blocked Items** | Count items | 0 |
| **CI Failures** | PR status | 0 |
| **Trae Review Time** | Trae artifact age | < 1 day |

### How to Check

```bash
# Check current system state
git checkout main
cat STATE/STATUS_LEDGER.md | head -50

# Check GitHub Projects status
gh project view 2

# Check today's brief
ls COCKPIT/artifacts/DAILY_BRIEF/ | tail -1
```

---

## How to Verify

```bash
# Check Daily Brief
cat COCKPIT/artifacts/DAILY_BRIEF/*.md | head -30

# Check Approvals Queue
cat COCKPIT/artifacts/APPROVALS_QUEUE/*.md

# Check system status
cat STATE/STATUS_LEDGER.md | head -50

# Access Projects board
open https://github.com/users/ranjan-expatready/projects/2
```

**Verification Links**:
- COCKPIT/artifacts/DAILY_BRIEF/ — Daily briefs
- COCKPIT/artifacts/APPROVALS_QUEUE/ — Approvals queue
- STATE/STATUS_LEDGER.md — Current state
- GitHub Projects Board — Kanban view

---

## Version History

- v1.0 (2026-01-26): Initial Founder Playbook

---

**Document Version**: v1.0
**Last Updated**: 2026-01-26
**Status**: CANONICAL
