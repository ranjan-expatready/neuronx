# Resume Protocol — Deterministic State Reconstruction

## Overview

This runbook defines the exact step-by-step procedure that the CTO Agent follows when resuming work after an interruption (reboot, manual pause, etc.). The protocol ensures deterministic reconstruction of state from repository, GitHub, and CI without human intervention.

---

## ARTIFACTS-FIRST GOVERNANCE MODEL

### Cockpit Integration

The resume protocol operates within an **artifacts-first governance model**. All work is represented as artifacts in COCKPIT/artifacts/ that the Founder can review, approve, and track via the Antigravity Cockpit Manager View.

**Three-Layer Governance**:
1. **Manager View (Antigravity Cockpit)**: Founder's interface for reviewing artifacts, approving work, and monitoring progress
2. **Artifact Layer (COCKPIT/)**: Complete auditable records of work (PLAN, EXECUTION, VERIFICATION, RELEASE, INCIDENT)
3. **Execution Layer (Factory AGENTS/**): Autonomous agents executing work based on approved artifacts and guardrails

**How Resume Protocol Uses Cockpit Artifacts**:

During resume, the protocol:
- Reads COCKPIT/APPROVAL_GATES.md to understand what requires founder approval
- Reads COCKPIT/ARTIFACT_TYPES.md to understand artifact structure and status
- Reads COCKPIT/ARTIFACT_INDEX.md to locate current active artifacts
- Checks COCKPIT/artifacts/ for pending approvals (WAITING_FOR_HUMAN state)
- Updates STATUS_LEDGER.md which feeds back to Cockpit panels

**Founder's Review Layer**:

When Factory resumes work, the Founder can:
1. View Cockpit STATUS panel for current state (refreshed via `/status` or `/refresh`)
2. Review Cockpit APPROVALS panel for pending approval artifacts
3. Review active artifacts directly (PLAN, EXECUTION, VERIFICATION, etc.)
4. Approve or reject work items via Cockpit or GitHub comments (`/approve`, `/reject`)
5. Review COSTS panel for spending and approval thresholds
6. Review RELEASES panel for deployment status

**Resume Protocol Transparency**:

All resume activities are visible in Cockpit:
- State machine position is displayed in STATUS panel
- Active artifacts and their status are displayed in ACTIVE WORK panel
- Items awaiting founder approval are displayed in APPROVALS panel
- Cost tracking is visible in COSTS panel
- Any incidents are displayed in RISKS panel

---

## WHEN TO RUN RESUME PROTOCOL

Run this protocol whenever:

1. **System Initialization**: Starting the CTO Agent after system reboot
2. **Manual Pause**: Human explicitly paused work with "STOP"
3. **Crash Recovery**: Unexpected termination occurred
4. **Handoff**: Different agent taking over CTO role
5. **State Drift Detection**: Inconsistent state detected across sources
6. **Explicit Resume Command**: Human pastes the RESUME template

---

## RESUME PROTOCOL STEPS

### STEP 1: Read Governance Doctrine

**Purpose**: Understand the rules, constraints, and quality requirements governing operations.

**Read in Order**:
1. **GOVERNANCE/GUARDRAILS.md**
   - Main Branch Protection Policy
   - Dev Stage Fast Mode (auto-merge rules by directory)
   - Approval Gates (gate triggers and requirements)
   - SAFE TERMINAL POLICY (allowed/prohibited commands)
   - Documentation Sources Policy

2. **GOVERNANCE/RISK_TIERS.md**
   - Current risk tier assignments
   - Approval requirements by tier
   - Directory-based approval override (if Dev Fast Mode enabled)
   - Reviewer requirements

3. **GOVERNANCE/COST_POLICY.md**
   - Cost thresholds
   - Pre-execution cost estimation requirements
   - Current budget and spending

4. **GOVERNANCE/QUALITY_GATES.md**
   - Current quality gate stage (Stage 0/1/2/3)
   - Coverage requirements
   - Approval requirements by stage

5. **GOVERNANCE/DEFINITION_OF_DONE.md**
   - Definition of Done criteria

**Output**: Internalized understanding of:
- What requires human approval
- What can be auto-merged
- Current quality requirements
- Cost constraints and thresholds

**Stop Condition**: If governance files conflict or are unclear, STOP and ask for clarification.

---

### STEP 2: Read Current State

**Purpose**: Understand the current position in the work cycle and what was last being done.

**Read**:
1. **STATE/STATUS_LEDGER.md**
   - Current objective
   - Active issues (with links)
   - Active PRs (with links)
   - Last completed artifact
   - Current blockers
   - Next actions (ordered)
   - Current risk tier and required gates
   - Quality gate status
   - CI/CD status
   - Dev Fast Mode status
   - Agent activity
   - Cost tracking
   - Waiting for human input

2. **STATE/LAST_KNOWN_STATE.md**
   - State machine position (IDLE/PLANNING/EXECUTING/WAITING_FOR_HUMAN)
   - Active task details
   - Work-in-progress items
   - GitHub state (branch, commits, issues, PRs)
   - CI/CD state (last run, job results)
   - Risk assessment and gates
   - Quality state (coverage, tests)
   - Governance compliance
   - Agent coordination state
   - Blockers
   - Next actions
   - Context preservation
   - Resume path

**Output**: Current state fully understood:
- Where we are in the work cycle
- What was last being done
- What's next
- What are the blockers

**Stop Condition**: If STATE files don't exist or are incomplete, STOP and initialize.

---

### STEP 3: Scan GitHub Repository State

**Purpose**: Verify local state matches GitHub remote state and gather fresh information.

**Check** (in order):

1. **Repository Status**:
   ```bash
   git status
   git remote -v
   git rev-parse --abbrev-ref HEAD
   ```

2. **Current Branch**:
   ```bash
   git log --oneline -5
   git branch -a
   ```

3. **Main Branch State**:
   ```bash
   git checkout main
   git pull origin main
   git log --oneline -1
   ```

4. **Unmerged PRs** (via GitHub CLI):
   ```bash
   gh pr list --state open --repo ranjan-expatready/autonomous-engineering-os
   ```

5. **Open Issues** (via GitHub CLI):
   ```bash
   gh issue list --state open --repo ranjan-expatready/autonomous-engineering-os
   ```

6. **Recent Actions** (via GitHub API or UI):
   - Check last merged PR
   - Check last CI run status
   - Check recent commits

**Output**: Up-to-date GitHub state:
- Current branch and its status
- Open PRs with their CI status
- Open issues with their priority
- Recent activity on repository

**Stop Condition**: If git conflicts exist or cannot be resolved, STOP and ask for intervention.

---

### STEP 4: Check CI Status for Active Work

**Purpose**: Verify CI status for any active PRs or work in progress.

**Check**:

1. **For Each Open PR**:
   - Check CI status: `gh pr view <PR#> --json number,headRefName,statusCheckRollup`
   - Verify all required checks passing
   - Note any failing checks

2. **For Current Branch** (if applicable):
   - Check if CI is running: `gh run list --branch <branch>`
   - Check last CI run status
   - Note any failures

3. **For Main Branch**:
   - Verify last CI run: `gh run list --branch main --limit 1`
   - Check if main is in good state

**Output**: CI status for all relevant branches and PRs:
- Which checks are passing
- Which checks are failing
- Which PRs are merge-ready
- Which PRs need fixes

**Stop Condition**: If critical CI failures on main branch exist and block progress, STOP and report.

---

### STEP 5: Determine Next Priority Action

**Purpose**: Decide what to do next based on current state, blockers, and priorities.

**Decision Process**:

1. **Check for Blocking Issues**:
   - Are there unblocking tasks?
   - If YES: Execute unblocking tasks first

2. **Check for Active PRs**:
   - Do any PRs have failing CI that need fixes?
   - If YES: Fix failing CI PRs
   - Do any PRs need human approval?
   - If YES: Wait for approval (transition to WAITING_FOR_HUMAN)

3. **Check Next Actions from STATUS_LEDGER**:
   - Are next actions defined?
   - If YES: Execute first unblocked next action
   - If NO: Generate next actions based on context

4. **Check New Work**:
   - Is new work needed based on objectives?
   - If YES: Transition to PLANNING state

**Output**: Single atomic next action to execute

**Decision Framework**:
```
Priority Order:
1. Unblock critical blockers (severity: CRITICAL)
2. Fix failing CI on merge-ready PRs (severity: HIGH)
3. Complete partially finished tasks (severity: MEDIUM)
4. Start highest priority new task (severity: LOW)
```

---

### STEP 6: Verify No Blockers

**Purpose**: Ensure the chosen action can be executed without blocking.

**Verify**:

1. **Human Approval Required?**
   - Check risk tier
   - Check directory (GOVERNANCE/, AGENTS/, workflows/)
   - Check if Dev Fast Mode allows auto-merge
   - If human approval required: Transition to WAITING_FOR_HUMAN

2. **CI Required?**
   - Check if all CI checks passing or will pass
   - If CI failing and blocks action: Fix CI or wait

3. **Cost Constraints?**
   - Check if within current budget
   - Check if within threshold
   - If cost exceeds threshold: Request approval or defer

4. **Quality Gates?**
   - Check if coverage requirements met
   - Check if quality gates passed
   - If failing: Fix quality issues first

5. **Dependencies Met?**
   - Check if all prerequisites completed
   - If dependencies not met: Complete dependencies first

**Output**: Can Execute = [YES / NO]

**If NO**:
- Identify missing requirement
- Identify alternative action
- Transition to appropriate state

**Stop Condition**: If action blocked and no workaround exists, STOP and request human input.

---

### STEP 7: Reconstruct Context from Saved State

**Purpose**: Reconstruct all necessary context to resume work seamlessly.

**Reconstruct**:

1. **Objective Context**:
   - What are we trying to achieve?
   - What is the current sprint goal?
   - What is the success criterion?

2. **Work Context**:
   - What was last being worked on?
   - What was completed?
   - What is incomplete?
   - What was the next step?

3. **Decision Context**:
   - What decisions were made?
   - What trade-offs were considered?
   - What assumptions were made?

4. **File Context**:
   - Which files are being modified?
   - What changes are pending?
   - What changes need to be reverted?

5. **Coordination Context**:
   - Which agent is currently in control?
   - Is there a handoff pending?
   - Are other agents waiting?

6. **Mental State**:
   - What was the train of thought?
   - What was being considered?
   - What was about to be executed?

**Output**: Fully reconstructed context, ready to continue

**Validation**:
```bash
[ ] Objective understood
[ ] Work-in-progress identified
[ ] Decisions recalled
[ ] File state verified
[ ] Coordination clear
[ ] Mental state recovered
```

**Stop Condition**: If critical context cannot be recovered, STOP and ask for human summary.

---

### STEP 8: Transition to Appropriate State

**Purpose**: Move to the correct state machine position based on action type and context.

**State Transition Logic**:

**If**: New work needs to be started (no active context)
- **Transition To**: PLANNING
- **Entry Action**: Create plan, assess risk, estimate cost

**If**: Work is already in progress and can continue
- **Transition To**: EXECUTING
- **Entry Action**: Continue from stopped position

**If**: Work is in progress but requires waiting
- **Transition To**: WAITING_FOR_HUMAN
- **Entry Action**: Request human input, document waiting reason

**If**: All work completed and ready for new work
- **Transition To**: IDLE
- **Entry Action**: Update STATUS_LEDGER, await new trigger

**Transition Validation**:
```bash
[ ] Source state: [STATE]
[ ] Target state: [STATE]
[ ] Transition condition met: [YES/NO]
[ ] Context preserved: [YES/NO]
[ ] STATE files updated: [YES/NO]
```

**Stop Condition**: If transition is invalid or context not preserved, STOP and correct state.

---

### STEP 9: Execute First Next Action

**Purpose**: Begin executing the determined next atomic action.

**Execution**:

1. **Prepare Execution Environment**:
   ```bash
   git checkout <correct-branch>
   git pull origin <correct-branch>
   pwd  # Verify in repo root
   ```

2. **Execute Action**:
   - If planning: Create plan, assess risk
   - If coding: Implement changes with tests
   - If governance: Update documents, assess impact
   - If review: Review PR, provide feedback

3. **Monitor Execution**:
   - Watch for errors
   - Track progress
   - Check compliance with guardrails

4. **Update State**:
   - Update STATUS_LEDGER.md with progress
   - Update LAST_KNOWN_STATE.md with new milestone reached

**Output**: Action completed successfully OR action blocked

**If Blocked**:
- Identify blocker
- Update STATUS_LEDGER.md with blocker
- Transition to WAITING_FOR_HUMAN or appropriate state
- STOP

**If Successful**:
- Complete action
- Update STATUS_LEDGER.md
- Return to STEP 5 for next action

---

## RESUME SUCCESS CRITERIA

### Resume is Successful When:

1. [ ] Governance doctrine fully read and understood
2. [ ] Current state (STATUS_LEDGER, LAST_KNOWN_STATE) read and validated
3. [ ] GitHub state scanned and verified
4. [ ] CI status checked and validated
5. [ ] Next priority action determined
6. [ ] No blockers preventing execution
7. [ ] Context fully reconstructed from saved state
8. [ ] Transferred to appropriate state machine position
9. [ ] First action successfully started or completed
10. [ ] STATE files updated accurately

### Resume Completion Checklist:

```bash
[ ] Step 1: Read governance doctrine - COMPLETE
[ ] Step 2: Read current state - COMPLETE
[ ] Step 3: Scan GitHub state - COMPLETE
[ ] Step 4: Check CI status - COMPLETE
[ ] Step 5: Determine next action - COMPLETE
[ ] Step 6: Verify no blockers - COMPLETE
[ ] Step 7: Reconstruct context - COMPLETE
[ ] Step 8: Transition to state - COMPLETE
[ ] Step 9: Execute action - COMPLETE / IN PROGRESS
```

---

## RESUME FAILURE HANDLING

### Common Resume Failures

**Failure 1: State Files Missing or Corrupted**
- **Symptom**: STATUS_LEDGER.md or LAST_KNOWN_STATE.md don't exist or are invalid
- **Recovery**: Initialize new STATE files from scratch
- **Action**: Start from IDLE state, accept that previous context is lost
- **Owner**: CTO Agent

**Failure 2: Conflicting State Across Sources**
- **Symptom**: STATUS_LEDGER, LAST_KNOWN_STATE, and GitHub show different states
- **Recovery**: Determine source of truth (usually GitHub is authoritative)
- **Action**: Reconcile state, create STATE snapshot after reconciliation
- **Owner**: CTO Agent (with human input if ambiguous)

**Failure 3: Cannot Resolve Git Conflict**
- **Symptom**: git status shows conflict, cannot auto-resolve
- **Recovery**: Stop and request human intervention
- **Action**: Document conflict, transition to WAITING_FOR_HUMAN
- **Owner**: Human

**Failure 4: Critical CI Failure on Main**
- **Symptom**: Main branch has failing CI that blocks all work
- **Recovery**: Fix failing CI or wait for human intervention
- **Action**: Prioritize CI fix, transition to EXECUTING (CI fix)
- **Owner**: CTO Agent

**Failure 5: Context Cannot Be Recovered**
- **Symptom**: Saved state is incomplete or ambiguous
- **Recovery**: Ask human for context summary
- **Action**: Transition to WAITING_FOR_HUMAN, request manual state update
- **Owner**: Human

---

## STOP CONDITIONS

### When to Immediately STOP During Resume

**STOP immediately and WAIT FOR HUMAN when**:

1. **Critical Security Issue Detected**:
   - Security vulnerability found in repository
   - Suspicious activity detected
   - Credential compromise suspected

2. **Data Corruption Detected**:
   - Repository files corrupted or missing
   - Git history integrity issue
   - STATE files corrupted

3. **Unresolvable Conflict**:
   - Git merge conflict cannot be auto-resolved
   - State conflict cannot be reconciled
   - Stakeholder disagreement

4. **Critical Governance Violation**:
   - Guardrails being violated
   - Unauthorized access detected
   - Compliance breach suspected

5. **Resource Exhaustion**:
   - Cost threshold exceeded and not approved
   - Rate limiting blocking progress
   - Infrastructure unavailable

**Stop Protocol**:
1. Update STATUS_LEDGER.md with stop reason
2. Transition to WAITING_FOR_HUMAN
3. Document stop condition in LAST_KNOWN_STATE.md
4. Stop execution
5. Wait for human RESUME command

---

## RESUME PERFORMANCE METRICS

### Track Resume Success

**Metrics to Track**:
- Resume success rate: [X%]
- Average resume time: [X minutes]
- Context recovery rate: [X%]
- State drift rate: [X%]
- Resume failures by category: [List and count]

**Quality Goals**:
- Resume success rate: ≥ 95%
- Average resume time: ≤ 5 minutes
- Context recovery rate: ≥ 95%
- State drift rate: ≤ 5%

---

## RESUME TEMPLATES

### RESUME Command (From PROMPT_TEMPLATES.md)

The human can paste this single command to trigger resume:

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

### STATUS Command (From PROMPT_TEMPLATES.md)

The human can request a status report:

```
Factory, please provide a status report.

Report on:
1. Current objective and progress
2. Active issues and PRs
3. Current blockers
4. Next actions (ordered by priority)
5. What needs human approval (if anything)
```

---

## RELATED FILES

### Required Files for Resume

**Governance**:
- GOVERNANCE/GUARDRAILS.md
- GOVERNANCE/RISK_TIERS.md
- GOVERNANCE/COST_POLICY.md
- GOVERNANCE/QUALITY_GATES.md
- GOVERNANCE/DEFINITION_OF_DONE.md

**State**:
- STATE/STATUS_LEDGER.md
- STATE/LAST_KNOWN_STATE.md

**Agents**:
- AGENTS/CTO_LOOP.md (state machine)
- AGENTS/ROLES.md (CTO role definition)

**Runbooks**:
- RUNBOOKS/safe-execution.md (safe command execution)

---

## VERSION HISTORY

- v1.0 (Initial): Resume protocol with 9-step procedure, validation, failure handling

---

**Protocol Version**: v1.0
**Last Updated**: [YYYY-MM-DD HH:MM UTC] by [Agent Name]
