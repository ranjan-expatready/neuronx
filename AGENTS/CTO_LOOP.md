# CTO Loop — State Machine Definition

## Overview

This document defines the state machine for the CTO Agent in the Autonomous Engineering OS. The loop ensures autonomous operation while maintaining safety determinism and preventing infinite loops through clear transition rules and stop conditions.

---

## STATE MACHINE DIAGRAM

```
┌──────────────┐
│     IDLE     │ ◄─────────────────────────┐
└──────┬───────┘                          │
       │                                 │
       │ Trigger received                 │
       │                                 │
       ▼                                 │
┌──────────────┐                         │
│   PLANNING   │                         │
└──────┬───────┘                         │
       │ Plan complete                   │
       │                                 │
       ▼                                 │
┌──────────────┐                         │
│  EXECUTING   │ ──────────────────────┐ │
└──────┬───────┘                       │ │
       │                               │ │
       │ Need human input              │ │
       │ OR                             │ │
       │ Task complete                  │ │
       │                                │ │
       ▼                                │ │
┌──────────────┐                        │ │
│WAITING_FOR_  │                        │ │
│   HUMAN      │ ◄───────────────────────┘ │
└──────┬───────┘                          │
       │                                  │
       │ Input received / Aborted        │
       │                                  │
       │──────────────────────────────────│
       │                                  │
       ▼                                  │
   [Return to IDLE]                        │
                                          │
└──────────────────────────────────────────┘
```

---

## STATE DEFINITIONS

### STATE 1: IDLE

**Description**: Agent is not actively working. Awaiting trigger to begin work.

**Entry Conditions**:
- Initial startup (no existing work)
- Task completion (all work finished)
- Explicit return from other state
- Resume protocol execution

**Exit Conditions**:
- New task received from human
- Issue assigned from backlog
- Scheduled work triggered
- Resume command received

**Behavior**:
- Monitor for new work triggers
- Maintain system health
- Periodic state validation (every X minutes)

**Required Artifacts**:
- None (initial state)

**Stop Conditions**:
- System shutdown requested
- Manual override to stay idle

**Transition To**:
- PLANNING

---

### STATE 2: PLANNING

**Description**: Agent is planning how to execute a task. Assessing requirements, risks, costs, and creating execution plan.

**Entry Conditions**:
- Trigger received from IDLE
- New task assigned
- Resume protocol execution

**Exit Conditions**:
- Plan created and validated
- Unable to plan - requires human input
- Plan cancelled

**Behavior**:
1. Read task requirements
2. Assess risk tier (T0/T1/T2/T3)
3. Check cost impact
4. Determine approval requirements
5. Identify blockers
6. Create execution plan
7. Validate plan against guardrails
8. Present plan to human (if high-risk)

**Required Artifacts**:
- Task description (from backlog or human)
- Governance doctrine read
- Risk assessment completed
- Cost estimation completed
- Execution plan created
- STATUS_LEDGER updated with planning status

**Stop Conditions**:
- Task requirements unclear
- Risk assessment cannot be completed
- Cost estimation exceeds threshold without approval
- Guardrails violation

**Transition To**:
- EXECUTING (plan complete and valid)
- WAITING_FOR_HUMAN (needs approval input)
- IDLE (plan cancelled)

---

### STATE 3: EXECUTING

**Description**: Agent is actively executing work according to the plan.

**Entry Conditions**:
- Plan completed and validated
- Approval obtained (if required)
- Resume protocol execution with existing work

**Exit Conditions**:
- Task completed successfully
- Task blocked or failed
- Human requests pause
- New high-priority interrupt
- Resume protocol triggered (with state preservation)

**Behavior**:
1. Execute first atomic action from plan
2. Follow safe execution runbook:
   - Verify command safety
   - Check allowlist
   - Get approval if required
   - Execute with error handling
3. Monitor execution progress
4. Validate results
5. Update STATUS_LEDGER with progress
6. Update LAST_KNOWN_STATE on milestones
7. Repeat until task complete or blocked

**Required Artifacts**:
- Execution plan (from PLANNING)
- Safe execution runbook (RUNBOOKS/safe-execution.md)
- Guardrails active (GOVERNANCE/GUARDRAILS.md)
- STATUS_LEDGER (continuously updated)
- LAST_KNOWN_STATE (updated at milestones)

**Stop Conditions**:
- Execution blocked (requires unblock)
- Execution failed (requires fix or new plan)
- Guardrail violation (block and report)
- Human requests pause (immediate stop)
- Cost threshold exceeded (request approval or stop)
- CI failure (fix or wait)
- New high-priority task (interrupt current work)

**Transition To**:
- WAITING_FOR_HUMAN (blocked, needs input)
- PLANNING (new task or replan)
- IDLE (task complete)

---

### STATE 4: WAITING_FOR_HUMAN

**Description**: Agent is paused, awaiting human input, approval, or decision.

**Entry Conditions**:
- Task blocked and can't proceed
- Human input required for decision
- Approval needed for high-risk action
- Guardrail violation requires human review
- Human explicitly paused work

**Exit Conditions**:
- Human provides input/proceeds
- Human approves work
- Human cancels work
- Human requests different work
- Resume command received

**Behavior**:
1. Document why waiting
2. Present clear request to human
3. Provide alternatives if possible
4. Update STATUS_LEDGER with waiting reason
5. Update LAST_KNOWN_STATE
6. Wait for human response
7. Process human response when received

**Required Artifacts**:
- Waiting reason documented (STATUS_LEDGER)
- Clear request to human (presented)
- Alternatives considered (if any)
- Approval requirements documented
- LAST_KNOWN_STATE updated

**Stop Conditions**:
- Human doesn't respond within timeout (escalate)
- Emergency override received
- System shutdown requested

**Transition To**:
- EXECUTING (human proceeds)
- PLANNING (human cancels or changes direction)
- IDLE (human cancels all work)

---

## TRANSITION RULES

### Valid Transitions

| From | To | Condition |
|------|----|-----------|
| IDLE | PLANNING | Trigger received |
| IDLE | WAITING_FOR_HUMAN | Unresolved blocker on startup |
| PLANNING | EXECUTING | Plan complete and valid |
| PLANNING | WAITING_FOR_HUMAN | Needs approval/clarification |
| PLANNING | IDLE | Plan cancelled |
| EXECUTING | WAITING_FOR_HUMAN | Blocked, needs input, paused |
| EXECUTING | PLANNING | Replan or new task |
| EXECUTING | IDLE | Task completed |
| WAITING_FOR_HUMAN | EXECUTING | Human approves/proceeds |
| WAITING_FOR_HUMAN | PLANNING | Human changes direction |
| WAITING_FOR_HUMAN | IDLE | Human cancels all work |

### Invalid Transitions

**These transitions are NOT allowed**:
- EXECUTING → PLANNING (without completing or saving state)
- WAITING_FOR_HUMAN → IDLE (without human response or timeout)
- PLANNING → IDLE (without documenting cancellation)
- IDLE → EXECUTING (must go through PLANNING first)

---

## TRIGGERS

### Entry Triggers (Starting Work)

**External Triggers** (from Human):
- New task assigned
- Backlog item activated
- Explicit "start" command
- Resume command

**Internal Triggers** (from System):
- Scheduled maintenance
- Automated health check response
- Alert response
- Timer-based work

**Automatic Triggers** (from Monitoring):
- CI failure alert
- Performance degradation alert
- Security alert
- Cost threshold warning

---

## STOP CONDITIONS

### Immediate Stop Conditions

Stop immediately and transition to WAITING_FOR_HUMAN when:

1. **Critical Guardrail Violation**:
   - Security vulnerability detected
   - Credential compromise suspected
   - Unauthorized access attempt
   - Data corruption detected

2. **Resource Exhaustion**:
   - Cost threshold exceeded (not approved)
   - Rate limiting blocking
   - Infrastructure unavailable

3. **Human Interrupt**:
   - Explicit "STOP" command
   - Emergency override requested
   - System shutdown requested

4. **Unresolvable Conflict**:
   - Cannot reconcile state across sources
   - Git conflict cannot be resolved
   - Stakeholder disagreement

### Pause Conditions

Pause current work (continue context) and await input when:

1. **Approval Required**:
   - Risk tier T1/T2 work without approval
   - Governance changes without approval
   - Production-related changes

2. **Ambiguity Detected**:
   - Task requirements unclear
   - Decision requires human judgment
   - Multiple valid paths exist

3. **Dependency Blocked**:
   - Waiting for another agent/PR/issue
   - External dependency unavailable
   - Feature gate not yet opened

---

## REQUIRED ARTIFACTS PER STATE

### IDLE State

**Required**:
- None

**Optional**:
- STATUS_LEDGER (if exists from previous session)
- LAST_KNOWN_STATE (if needs validation)

**Creation**: None

**Update**: None (minimal)

---

### PLANNING State

**Required (to enter)**:
- Task trigger (issue, command, or resume)

**Required (to exit successfully)**:
- Risk assessment (T0/T1/T2/T3)
- Cost estimation
- Execution plan
- Approval obtained (if T1/T2)

**Artifacts Created**:
- PLAN.md (in project directory) - detailed execution plan

**Artifacts Updated**:
- STATUS_LEDGER.md
  - Current objective
  - Active task
  - Risk tier
  - Next actions
- LAST_KNOWN_STATE.md
  - State machine position: PLANNING

---

### EXECUTING State

**Required (to enter)**:
- Valid execution plan
- Approvals obtained (if required)
- STATUS_LEDGER updated with task

**Required (during execution)**:
- STATUS_LEDGER updated (progress tracked)
- LAST_KNOWN_STATE updated (at milestones)

**Artifacts Created**:
- Various artifacts during execution (code, docs, PRs, etc.)

**Artifacts Updated**:
- STATUS_LEDGER.md (continuous)
- LAST_KNOWN_STATE.md (milestones)
- Relevant project files (APP/, GOVERNANCE/, etc.)

---

### WAITING_FOR_HUMAN State

**Required (to enter)**:
- Clear reason for waiting documented
- Request presented to human

**Required (to exit)**:
- Human response received

**Artifacts Created**:
- None (waiting state)

**Artifacts Updated**:
- STATUS_LEDGER.md
  - Waiting for human status
  - Reason for waiting
  - Request presented
- LAST_KNOWN_STATE.md
  - State machine position: WAITING_FOR_HUMAN

---

## INFINITE LOOP PREVENTION

### Loop Prevention Mechanisms

**1. State Machine Constraints**:
- States have clear entry and exit conditions
- Cannot stay in EXECUTING indefinitely (must complete or block)
- Cannot self-transition without condition check
- Cannot bypass required states

**2. Iteration Limits**:
- Maximum actions per task: [100] (prevent runaway work)
- Maximum time in EXECUTING: [60 minutes] (then check in with human)
- Maximum retries on failure: [3] (then escalate)
- Maximum time in WAITING_FOR_HUMAN: [24 hours] (then escalate)

**3. Progress Tracking**:
- Task progress must increase
- Must complete milestones (not loop infinitely)
- Must advance state machine (not cycle without reason)

**4. State Validation**:
- Validate state consistency across sources (GitHub, local files)
- Conflict detection and resolution
- Drift detection (state mismatches)

**5. Stop Conditions**:
- Always check stop conditions before action
- Always update STATUS_LEDGER after action
- Always check for new high-priority work

---

### Detecting Infinite Loops

**Loop Detection Rules**:

**Rule 1: No Progress**
- If executed > 10 actions without task progress → STOP
- If executed > 100 actions total → STOP

**Rule 2: Same Action Repeated**
- If same action executed > 3 times with same result → STOP
- If same error occurs > 5 times → STOP

**Rule 3: State Cycling**
- If state machine cycles without advancement → STOP
- If transition EXECUTING → PLANNING without progress → STOP

**Rule 4: Time-Based**
- If in EXECUTING > 60 minutes without milestone → CHECK
- If in WAITING_FOR_HUMAN > 24 hours → ESCALATE

**Rule 5: Escalation**
- If loop detected → Transition to WAITING_FOR_HUMAN
- Document loop detection in STATUS_LEDGER
- Present to human with context and alternatives

---

### Recovery from Loop Detection

**When Loop Detected**:

1. **Stop Execution**: Immediately halt current action
2. **Document Detection**: Record in STATUS_LEDGER:
   - Which loop detection rule triggered
   - State at detection
   - What was being executed
   - How many times/long it was looping
3. **Save State**: Write LAST_KNOWN_STATE.md with loop detection timestamp
4. **Transition**: Move to WAITING_FOR_HUMAN
5. **Present to Human**: Show:
   - What was happening
   - Why it stopped
   - Alternatives:
     - Approve continued execution
     - Cancel and replan
     - Manual intervention

---

## LOOP MONITORING METRICS

### Track Loop Indicators

**Metrics**:
- Actions per task count
- Execution time per task
- State transition frequency
- Same-action repetition count
- Same-error repetition count
- Milestone completion rate

**Alert Thresholds**:
- Actions per task > 50 → Warning
- Actions per task > 100 → Stop
- Execution time > 45min → Warning
- Execution time > 60min → Check
- Same action > 2 repeats → Warning
- Same action > 3 repeats → Stop

---

## STATE MACHINE IMPLEMENTATION

### Loop Execution Algorithm

**Pseudocode**:

```python
# STATE MACHINE MAIN LOOP

state = IDLE
while system_running:

  # STATE: IDLE
  if state == IDLE:
    check_for_triggers()
    if trigger_received:
      state = PLANNING
    else:
      sleep(check_interval)
      continue

  # STATE: PLANNING
  elif state == PLANNING:
    read_governance()
    read_task_requirements()
    risk_tier = assess_risk()
    cost_est = estimate_cost()
    plan = create_plan()
    
    if (not plan.valid) or (needs_approval):
      update_status_ledger(WAITING_FOR_HUMAN)
      update_last_known_state(WAITING_FOR_HUMAN)
      state = WAITING_FOR_HUMAN
    elif plan.cancelled:
      state = IDLE
    else:
      update_status_ledger(EXECUTING)
      update_last_known_state(EXECUTING)
      state = EXECUTING

  # STATE: EXECUTING
  elif state == EXECUTING:
    action = get_next_action_from_plan()
    
    # Check loop prevention
    if loop_detected():
      state = WAITING_FOR_HUMAN
      update_status_ledger(LOOP_DETECTED)
      continue
    
    # Check stop conditions
    if stop_condition_met():
      state = WAITING_FOR_HUMAN
      update_status_ledger(STOPPED)
      continue
    
    # Execute action
    execute_action_safely(action)
    update_status_ledger(progress)
    
    # Check if task complete
    if task_complete():
      state = IDLE
      update_status_ledger(TASK_COMPLETE)
    elif blocked():
      state = WAITING_FOR_HUMAN
      update_status_ledger(BLOCKED)
    else:
      continue  # Stay in EXECUTING

  # STATE: WAITING_FOR_HUMAN
  elif state == WAITING_FOR_HUMAN:
    present_request_to_human()
    wait_for_human_response()
    
    if human_proceeds():
      update_status_ledger(EXECUTING)
      state = EXECUTING
    elif human_cancels():
      update_status_ledger(IDLE)
      state = IDLE
    elif timeout_escalation():
      alert_human()
      state = WAITING_FOR_HUMAN

  # Update last known state periodically
  if milestone_reached():
    update_last_known_state()
```

---

## RESUME PROTOCOL INTEGRATION

### Resume and State Machine

The **resume protocol** (RUNBOOKS/resume-protocol.md) is the mechanism that reconstructs the state machine position after interruption.

**Resume Steps**:
1. Read governance doctrine
2. Read STATUS_LEDGER and LAST_KNOWN_STATE
3. Scan GitHub state
4. Check CI status
5. Determine correct state position
6. Reconstruct context
7. Continue from stopped position

**Resume State Determination**:
```python
resumed_state = determine_state_from_ledger()

if resumed_state == EXECUTING:
  # Have work in progress, can continue
  continue_executing()
elif resumed_state == WAITING_FOR_HUMAN:
  # Were waiting for input, continue waiting
  continue_waiting()
elif resumed_state == PLANNING:
  # Were planning, check if plan complete
  if plan_complete:
    proceed_to_execution()
  else:
    restart_planning()
else:
  # IDLE or unknown, check for new work
  scan_for_triggers()
```

---

## STATE MACHINE VALIDATION

### Validation Checks

**Run Periodically** (every X executions or time interval):

1. **State Consistency**:
   - Is current state valid?
   - Can current state transition to expected next state?

2. **Artifact Integrity**:
   - Do STATUS_LEDGER and LAST_KNOWN_STATE exist?
   - Are they consistent with each other?
   - Are they consistent with GitHub state?

3. **Progress Made**:
   - Is progress being made?
   - Are milestones being reached?
   - Are tasks completing?

4. **Loop Prevention**:
   - Are loop indicators within thresholds?
   - No excessive repetitions detected?

5. **Guardrail Compliance**:
   - Are all guardrails being followed?
   - Are risk assessments current?
   - Are costs within thresholds?

---

## VERSION HISTORY

- v1.0 (Initial): State machine definition with 4 states, transition rules, stop conditions, loop prevention

---

**Loop Version**: v1.0
**Last Updated**: [YYYY-MM-DD HH:MM UTC] by [Agent Name]
