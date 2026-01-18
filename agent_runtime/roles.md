# Agent Runtime Roles

**Role Definitions** | **Execution Boundaries** | **Evidence-Based Coordination**

## Canonical References

**Canonical rules live in [/AGENTS.md](../AGENTS.md)**  
**SSOT index lives in [/docs/SSOT/index.md](../docs/SSOT/index.md)**  
**In conflicts, SSOT + AGENTS.md win.**

Defines the minimum viable set of specialized agent roles for NeuronX development, each with strict boundaries, capabilities, and coordination protocols.

## Role Architecture

### Core Principles

- **Specialization**: Each role has focused responsibilities
- **Coordination**: Roles hand off with evidence validation
- **Boundaries**: Strict separation of read/write capabilities
- **Auditability**: All actions logged with evidence chains

### Execution Flow

```
Planner → Implementer → Auditor
   ↓         ↓         ↓
Read      Write    Validate
```

## Role Definitions

### Planner / Architect

**Purpose**: Analysis, planning, and risk assessment for development tasks

**Capabilities**:
- Full read access to codebase, documentation, and requirements
- SSOT and ContextStream consumption for context awareness
- Risk classification and impact assessment
- Specification generation and architectural planning
- Evidence gathering and validation

**Allowed Actions**:
- Repository analysis and code exploration
- Documentation review and synthesis
- Risk assessment and classification
- Specification and plan generation
- Evidence collection and verification
- ContextStream queries for historical patterns

**Prohibited Actions**:
- Code modification or file creation
- CI/CD pipeline execution
- Production system access
- Security credential handling
- Direct repository commits

**Evidence Required Before Handoff**:
- Risk tier classification with justification
- Complete specification document
- Impact assessment and mitigation plan
- Evidence citations from SSOT and codebase
- Test coverage plan aligned with requirements

**Success Criteria**:
- Comprehensive understanding demonstrated
- Risk accurately classified per [AGENTS.md](../AGENTS.md) tiers
- Implementation plan validated against SSOT
- All evidence links verified and accessible

### Implementer

**Purpose**: Code implementation following established plans and governance

**Capabilities**:
- Write access to development files within boundaries
- Code generation and modification
- Test implementation and validation
- Documentation updates for implemented features
- Evidence artifact creation

**Allowed Actions**:
- Code file creation and modification
- Test file creation and updates
- Documentation updates (PRODUCT_LOG.md, ENGINEERING_LOG.md)
- Evidence artifact generation
- Local quality check execution (lint, format, typecheck)
- Traceability matrix updates

**Prohibited Actions**:
- Production deployment or execution
- CI/CD pipeline modifications
- Security configuration changes
- Database schema modifications
- External service integrations without approval
- Red-tier operations without explicit HITL approval

**Evidence Required Before Handoff**:
- All code changes with test coverage
- Local quality checks passing
- Traceability updates completed
- Evidence artifacts created and validated
- Risk mitigation implemented per plan
- Compliance with [CONTRIBUTING.md](../CONTRIBUTING.md)

**Success Criteria**:
- Code implements specification exactly
- All tests pass locally
- Quality gates satisfied
- Evidence complete and verified
- No architectural violations per SSOT

### Auditor

**Purpose**: Independent validation and compliance verification

**Capabilities**:
- Full read access to all artifacts and changes
- Validation command execution
- Evidence verification and completeness checks
- Compliance assessment against policies
- Quality gate verification

**Allowed Actions**:
- Repository analysis and change review
- Validation script execution
- Evidence completeness verification
- Policy compliance checking
- Quality metric assessment
- Audit trail generation

**Prohibited Actions**:
- Code modification or implementation
- File creation outside evidence directories
- CI/CD pipeline execution
- Production system access
- Override of established policies

**Evidence Required Before Completion**:
- Complete validation results with command outputs
- Evidence completeness verification
- Policy compliance assessment
- Quality metric validation
- Audit trail documentation

**Success Criteria**:
- All validation checks pass
- Evidence meets SSOT requirements
- Policy compliance verified
- Quality gates satisfied
- Audit trail complete and accessible

## Coordination Protocols

### Handoff Process

1. **Pre-Handoff Validation**: Previous role provides evidence checklist
2. **Evidence Verification**: Receiving role validates evidence completeness
3. **Acceptance Criteria**: Clear success criteria must be met
4. **Failure Handling**: Unmet criteria trigger rollback or replanning

### Escalation Paths

- **Policy Violations**: Immediate escalation to human oversight
- **Evidence Gaps**: Request evidence generation from previous role
- **Risk Reclassification**: Planner re-evaluation for changed conditions
- **Quality Failures**: Auditor blocks progression until resolved

### Session Management

- **State Preservation**: Role transitions maintain context
- **Evidence Continuity**: Audit trails link across role handoffs
- **Failure Recovery**: Clear rollback procedures for failed transitions
- **Progress Tracking**: Session state updated in SSOT memory

## Risk Mitigation

### Boundary Enforcement

- **Read/Write Separation**: Planner/Implementer roles have different permissions
- **Validation Gates**: Auditor role prevents progression with issues
- **Evidence Requirements**: All handoffs require verifiable evidence
- **Policy Compliance**: Runtime enforcement of SSOT policies

### Quality Assurance

- **Independent Validation**: Auditor role provides separation of concerns
- **Evidence-Based**: All decisions backed by verifiable evidence
- **Audit Trails**: Complete chain of custody for all changes
- **Rollback Capability**: Clear procedures for error correction

---

**Design Only**: This defines role boundaries and coordination. Implementation in Phase 3.
**See Also**: [AGENTS.md](../AGENTS.md) | [agent_runtime/policy.md](policy.md) | [agent_runtime/tools.md](tools.md)