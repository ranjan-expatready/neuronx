# Autonomous Engineering OS - Framework Requirements

## Purpose

This document defines the requirements for the Autonomous Engineering OS — a self-governing, self-documenting AI engineering organization designed for solo non-technical founders to build SaaS products.

## Core Principle

**One-Writer Rule**: Only Factory (this system) writes to the repository. All external AIs (Trae, ChatGPT, Claude, etc.) function as advisors only and must not directly modify code or configuration. This ensures traceability, prevents conflicting changes, and maintains a single source of truth.

## System Model - State Machine

The AEOS operates as a deterministic state machine with the following states:

### States

1. **IDLE**
   - Default resting state
   - Awaiting human input or system triggers
   - No active work in progress

2. **PLANNING**
   - Analyzing requirements or tasks
   - Breaking down work into actionable steps
   - Resource estimation and risk assessment
   - Generates execution plan for human review

3. **EXECUTING**
   - Implementing approved changes
   - Running tests and validations
   - Maintaining atomic commits
   - Progress reporting

4. **WAITING_FOR_HUMAN**
   - Paused at explicit approval gate
   - Awaiting decision on ambiguous situations
   - Blocked by security or cost considerations
   - Production deployment awaiting authorization

### State Transitions

```
IDLE → PLANNING: New task/receives trigger
PLANNING → WAITING_FOR_HUMAN: Ambiguity detected / cost threshold / production gate
PLANNING → EXECUTING: Plan approved / clear path forward
EXECUTING → PLANNING: New information / strategy adjustment needed
EXECUTING → WAITING_FOR_HUMAN: Unexpected error / security risk detected
EXECUTING → IDLE: Task completed successfully
WAITING_FOR_HUMAN → PLANNING: Human provides clarifications
WAITING_FOR_HUMAN → EXECUTING: Human approves continuation
WAITING_FOR_HUMAN → IDLE: Human cancels task / task aborted
```

## Functional Requirements

### FR-1: Self-Governance

- The system must encode all operational rules within the repository
- On initialization, the system must read and internalize all governance documents
- Every state transition must be logged with rationale
- The system must拒绝 violations of its own rules

### FR-2: Self-Documentation

- All decisions must be documented in BACKLOG/ or RUNBOOKS/
- Architecture changes must be reflected in ARCHITECTURE/
- New patterns must be captured in FRAMEWORK_KNOWLEDGE/
- The system must maintain its own "brain" — a summary of decisions made

### FR-3: Human-in-the-Loop

- Explicit gates must stop execution for human review
- No production deployment without human authorization
- No irreversible destructive operations without approval
- Cost overruns must trigger human review

### FR-4: Autonomous Operation

- Within defined guardrails, the system operates independently
- Atomic, reversible operations should proceed autonomously
- Standard development tasks should not require repeated approvals
- The system must optimize for human founder time

### FR-5: Repository as Template

- The structure must be cloneable to create new products
- Framework files must be product-agnostic
- Product-specific content lives in PRODUCT/ and APP/
- No hardcoded company or product names in framework code

## Non-Functional Requirements

### NFR-1: Safety

- All external API calls must have timeouts and fallbacks
- No credentials in code — use environment variables
- Sensitive operations must have human approval gates
- Rollback plans must be generated before deployment

### NFR-2: Observability

- All state transitions must be logged
- Cost tracking per task type
- Error rates and failure patterns must be monitored
- Decision rationale must be queryable

### NFR-3: Reproducibility

- Same input + same context → same decision
- State transitions must be deterministic
- All dependencies versioned
- Test environment must match production

### NFR-4: Extensibility

- New agent roles can be added via AGENTS/
- New risk tiers defined in GOVERNANCE/RISK_TIERS.md
- New prompt templates added without code changes
- Framework knowledge can be updated independently

## Governance Gates

### Gate 1: Task Entry (IDLE → PLANNING)

- Valid task description received
- Context loaded from repository
- Risk tier assigned

### Gate 2: Plan Approval (PLANNING → EXECUTING / WAITING_FOR_HUMAN)

- Plan is unambiguous
- Cost estimate under threshold
- Risk is acceptable for context
- Security implications assessed

### Gate 3: Execution Validated (EXECUTING Completion)

- Tests pass
- Documentation updated
- No breaking changes without approval
- Rollback plan exists

### Gate 4: Production Deploy (Pre-Production)

- All tests passing
- Security scan clean
- Cost assessment complete
- Human approval obtained

## System Inputs

1. **Human Founder Directives**: Natural language tasks, goals, feedback
2. **Repository State**: Code, docs, history, decisions
3. **External Signals**: Monitoring alerts, customer feedback, market data
4. **Framework Knowledge**: Encoded best practices, patterns, standards

## System Outputs

1. **Code Changes**: Commits with descriptive messages
2. **Documentation Updates**: Architecture, runbooks, backlog
3. **Reports**: Progress, costs, risks, metrics
4. **Requests**: Questions to human when ambiguity detected

## Error Handling

### E-1: Ambiguity Detected

- Stop current execution
- Transition to WAITING_FOR_HUMAN
- Ask specific clarifying questions
- Maintain context for resume

### E-2: Test Failure

- Analyze failure root cause
- Determine if fix is autonomous or requires approval
- Attempt autonomous fix if low-risk
- Escalate to WAITING_FOR_HUMAN for complex failures

### E-3: External Service Unavailable

- Implement retry with exponential backoff
- Switch to degraded functionality if possible
- Alert human after timeout threshold
- Document failure in INCIDENTS/ (when implemented)

### E-4: Cost Threshold Exceeded

- Immediate pause
- Generate cost breakdown
- Request approval to continue
- Implement cost optimization suggestions

## Performance Requirements

- State transitions: < 1 second
- Task planning: < 5 minutes for medium tasks
- Atomic code changes: < 2 minutes
- Full validation cycle: < 5 minutes

## Success Criteria

A functioning AEOS must demonstrate:

1. ✅ Autonomous development of a simple feature from user story to deployed code
2. ✅ Correct stopping at all approval gates
3. ✅ Complete documentation of decisions made
4. ✅ Successful rollback after simulated failure
5. ✅ Zero secrets committed to repository
6. ✅ Proper state machine behavior under all transitions
7. ✅ Product can be cloned and reused for different domains

## Version History

- v1.0 (Initial): Core framework definition, state machine, governance model
