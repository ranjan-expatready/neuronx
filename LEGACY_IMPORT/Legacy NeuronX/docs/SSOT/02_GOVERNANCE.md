# NeuronX Governance Model (SSOT)

**Source**: Extracted from docs/ENGINEERING_PLAYBOOK.md, .cursor/rules/50_no_drift_policy.mdc, .cursor/rules/60_vendor_boundary_policy.mdc
**Last Updated**: 2026-01-10
**Authority**: Engineering Governance Framework

## Single Source of Truth Hierarchy

### Canonical Documents (Enforceable)

1. **`docs/REQUIREMENTS.md`** - Product requirements, scope boundaries, user personas
2. **`docs/TRACEABILITY.md`** - Feature-to-test verification matrix ensuring complete test coverage
3. **`docs/ARCHITECTURE.md`** - System architecture, module boundaries, data flow definitions
4. **`docs/DECISIONS/`** - Architecture decisions with context and rationale
5. **`docs/PRODUCT_LOG.md`** - User-visible changes, milestones, feature decisions
6. **`docs/ENGINEERING_LOG.md`** - Technical changes, architectural rationale, engineering decisions

### Governance Enforcement

- All product decisions must be traceable to REQUIREMENTS.md
- All features must have traceability rows before development begins
- No code changes without corresponding documentation updates
- PR template enforces governance checklist compliance

## No-Drift Policy

### Purpose

Eliminates confusion and drift between documentation and implementation through enforceable single source of truth.

### Update Requirements

#### Before Development Starts

- [ ] Feature defined in REQUIREMENTS.md with acceptance criteria
- [ ] Row added to TRACEABILITY.md with test coverage plan
- [ ] Acceptance criteria written using ACCEPTANCE_CRITERIA.md template

#### During Development

- [ ] Tests written according to TEST_STRATEGY.md pyramid
- [ ] Code follows ARCHITECTURE.md boundaries
- [ ] Any architectural decisions documented as ADRs

#### Before Merge

- [ ] All governance checkboxes in PR template completed
- [ ] TRACEABILITY.md updated with actual test file paths
- [ ] PRODUCT_LOG.md or ENGINEERING_LOG.md updated
- [ ] ADR created/updated if architectural decision made

### Enforcement Mechanisms

- Cursor rules prevent architectural violations
- PR template enforces governance checklist
- CI/CD requires test coverage and documentation updates

## Vendor Boundary Policy

### Purpose

Enforces strict architectural boundaries between NeuronX core intelligence and external vendor platforms.

### Core Principles

#### Intelligence Layer Purity

- **NeuronX Owns Business Logic**: All sales intelligence, scoring algorithms, and orchestration logic resides exclusively in NeuronX core
- **No Business Logic in Adapters**: Adapter layers contain only protocol translation and data transformation
- **Platform Agnosticism**: Core logic must work with any execution platform (GHL, Salesforce, custom)

#### Adapter-Only Pattern

- **Adapters Are Stateless**: No persistent state or decision logic in adapter components
- **Single Responsibility**: Adapters handle one external system integration
- **Protocol Translation**: Convert NeuronX commands to vendor-specific API calls
- **Error Isolation**: Vendor failures don't corrupt NeuronX business logic

### Forbidden Patterns

#### Business Logic in Adapters

```typescript
// FORBIDDEN: Business logic in GoHighLevel adapter
if (lead.score > 0.8 && lead.industry === 'tech') {
  // Complex scoring logic in adapter - VIOLATION
  ghl.createCampaign('high-value-tech-lead');
}
```

#### Vendor-Specific Decision Logic

```typescript
// FORBIDDEN: GHL-specific logic in core
if (usingGHL) {
  // GHL-specific workflow - VIOLATION
  triggerGHLWorkflow('custom-workflow-123');
}
```

#### Data Model Coupling

```typescript
// FORBIDDEN: Direct vendor data model usage
const ghlLead = {
  ghl_custom_field_1: lead.companySize, // VIOLATION
  ghl_custom_field_2: lead.industry,
};
```

### Required Patterns

#### Clean Interface Contracts

```typescript
// Core exports execution commands
interface ExecutionCommand {
  action: string;
  parameters: Record<string, any>;
  metadata: {
    tenantId: string;
    correlationId: string;
  };
}

// Adapters implement execution
interface Adapter {
  execute(command: ExecutionCommand): Promise<ExecutionResult>;
}
```

## Architecture Decision Records (ADRs)

### When Required

- Any architectural or significant technical decision
- Changes to system boundaries or module responsibilities
- Technology stack modifications
- Security or performance architecture changes

### ADR Process

1. Draft ADR following template in docs/DECISIONS/
2. Technical review by qualified reviewers
3. Approval and merge to establish precedent
4. Implementation follows ADR specifications

## Evidence-Based Governance

### Evidence Requirements

- **Code Evidence**: Line-number citations for all claims
- **Test Evidence**: Test coverage verification with file paths
- **Documentation Evidence**: Links to canonical docs with sections
- **Compliance Evidence**: Security/privacy attestations with verification steps

### Evidence Verification

- Every claim must include exact file paths and line numbers
- Use `rg -n "pattern" --count` commands for verification
- Mark UNKNOWN for unverifiable claims
- Include evidence timestamps and verification steps

## Pull Request Governance

### PR Template Checklist

- [ ] Feature defined in REQUIREMENTS.md
- [ ] TRACEABILITY.md updated with test coverage
- [ ] Tests implemented and passing
- [ ] Documentation updated (PRODUCT_LOG.md or ENGINEERING_LOG.md)
- [ ] ADR created if architectural decision made
- [ ] Code follows ARCHITECTURE.md boundaries

### Branch Protection

- Required reviews: At least 1 approving review
- Status checks: All CI quality gates must pass
- Conversation resolution: All PR conversations must be resolved
- Admin enforcement: Rules apply to administrators

## Quality Gates

### Automated Checks

- **Code Quality**: Formatting, linting, type checking
- **Testing**: Unit tests, coverage threshold (85%), integration tests
- **Security**: Dependency review, secret scanning, CodeQL analysis
- **Documentation**: Traceability validation, evidence completeness

### Manual Reviews

- Code reviews check against canonical documents
- Architecture reviews validate against ARCHITECTURE.md
- Product reviews validate against REQUIREMENTS.md

## Exception Process

### Valid Exceptions

- Performance-critical optimizations (documented and time-bound)
- Vendor-specific required features (with abstraction plan)
- Legacy system migrations (with remediation timeline)

### Exception Requirements

- ADR documenting business justification
- Technical mitigation plan
- Time-bound remediation schedule
- Regular review checkpoints

## Continuous Improvement

### Metrics Tracking

- Documentation completeness percentage
- Time-to-merge for properly documented PRs
- Defect rates for well-documented features
- Test coverage trends and flaky test rates

### Process Refinement

- Monthly governance effectiveness reviews
- Updates to documentation templates as needed
- Team training on governance requirements

## Consequences of Violations

### Minor Violations

- PR rejection with documentation requirements
- Required updates before merge approval

### Major Violations

- Feature rollback if shipped without proper documentation
- Process review and remediation requirements
- Potential escalation to engineering leadership

## AI Agent Governance

### SSOT-First Requirement

- All AI agents must read docs/SSOT/\* files first
- Evidence requirements: path+lines+excerpt with `rg` verification
- No secrets in outputs or evidence citations
- Update ledger/index after completed implementations

### Evidence-Only Citations

- Code references: `file:line: excerpt`
- NOT FOUND requires `rg + match count 0`
- Test evidence: coverage reports with file paths
- Documentation evidence: canonical doc sections with verification

### Smallest Safe Patches

- Minimal changes that fix the issue
- Always include regression tests
- Architecture boundary compliance
- Evidence-backed justifications
