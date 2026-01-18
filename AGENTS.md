# NeuronX Agent Operating Rules

**Canonical Agent Governance** | **Single Source of Truth** | **Evidence-Based Development**

This document consolidates all governance rules for AI agents (Cursor, Continue, and future agents) working on NeuronX. It serves as the single entry point for agent behavior, linking to detailed SSOT documents without duplicating content.

## Operating Principles

### No-Drift Policy
All changes must maintain consistency between documentation, implementation, and evidence. See [docs/SSOT/02_GOVERNANCE.md](docs/SSOT/02_GOVERNANCE.md) for complete architectural boundaries and vendor separation rules.

### Evidence-Gated Claims
Every technical claim, recommendation, or change proposal must be backed by verifiable repository evidence. Use `rg -n "pattern" path/to/file` commands for verification. Mark claims as `UNKNOWN` when evidence cannot be located.

### Vendor Boundary Enforcement
NeuronX owns all business logic; adapters contain only protocol translation. No business logic in external platform workflows. See [docs/SSOT/02_GOVERNANCE.md](docs/SSOT/02_GOVERNANCE.md) lines 64-109 for forbidden patterns.

### Spec Mode Discipline
- **Requirement**: Spec Mode (Shift+Tab) required when touching >2 files, auth/security changes, or architectural modifications
- **Reference**: See [FACTORY_PLAYBOOK.md](FACTORY_PLAYBOOK.md) Power User Setup for details

## Testing + Quality Gates

### Test Pyramid Requirements
- **Unit Tests (70%)**: Business logic, algorithms, state machines (>85% coverage)
- **Contract Tests (20%)**: External API boundaries and adapter interfaces
- **E2E Tests (10%)**: Critical user journeys only

See [docs/SSOT/04_TEST_STRATEGY.md](docs/SSOT/04_TEST_STRATEGY.md) for detailed test organization and [docs/TESTING_GUIDE.md](docs/TESTING_GUIDE.md) for implementation guides.

### CI/CD Quality Gates
All changes must pass:
- Code formatting and linting
- TypeScript type checking
- 85%+ code coverage
- Traceability validation
- Evidence completeness
- Security scanning (secrets, dependencies, CodeQL)

See [docs/SSOT/03_QUALITY_BAR.md](docs/SSOT/03_QUALITY_BAR.md) for complete quality requirements.

## Agent Memory Policy

### Session Management
All agents must:
1. Read `docs/SSOT/10_AGENT_MEMORY.md` at session start
2. Update memory surface after any work (even read-only analysis)
3. Maintain deterministic resumption across agent interactions

### Progress Tracking
- Update `docs/PRODUCT_LOG.md` for user-visible changes
- Update `docs/ENGINEERING_LOG.md` for technical changes
- Add evidence links to `docs/TRACEABILITY.md`
- Create evidence artifacts in `docs/EVIDENCE/`

See [docs/SSOT/10_AGENT_MEMORY.md](docs/SSOT/10_AGENT_MEMORY.md) for memory management rules.

## Pull Request Requirements

### Governance Checklist
All PRs must complete the checklist in [`.github/pull_request_template.md`](.github/pull_request_template.md), including:
- Traceability updates in `docs/TRACEABILITY.md`
- Test coverage mapping
- Documentation updates
- ADR creation for architectural decisions
- SSOT compliance verification

### Branch Protection
Changes require:
- ≥1 approving code review
- All CI quality gates passing
- Code owner approval for critical files
- Resolved conversations

See [docs/SSOT/11_GITHUB_GOVERNANCE.md](docs/SSOT/11_GITHUB_GOVERNANCE.md) for complete PR and branch protection rules.

## Risk Tiers & HITL Requirements

### Green Tier (Low Risk)
- Documentation updates
- Test additions
- Non-critical bug fixes
- **HITL Required**: Code review only

### Yellow Tier (Medium Risk)
- New features with comprehensive tests
- API changes with backward compatibility
- Configuration updates
- **HITL Required**: Code review + product approval

### Red Tier (High Risk)
- Database schema changes
- Authentication/security modifications
- Breaking API changes
- Infrastructure alterations
- **HITL Required**: Code review + security review + product approval + manual testing

## Definition of Done

A feature is complete when ALL of the following are satisfied:

- [ ] Row added to `docs/TRACEABILITY.md` with acceptance criteria
- [ ] Acceptance criteria mapped to test coverage plan
- [ ] Unit tests implemented (>85% coverage for business logic)
- [ ] Contract tests for external boundaries
- [ ] E2E tests for critical user flows (if applicable)
- [ ] All tests passing in CI/CD pipeline
- [ ] `PRODUCT_LOG.md` updated for user-visible changes
- [ ] `ENGINEERING_LOG.md` updated for technical changes
- [ ] ADR created for architectural decisions
- [ ] Code follows `docs/ARCHITECTURE.md` boundaries
- [ ] PR approved with governance checklist complete
- [ ] Evidence artifacts created in `docs/EVIDENCE/`
- [ ] Session evidence captured in `docs/SSOT/10_AGENT_MEMORY.md`

See [docs/SSOT/03_QUALITY_BAR.md](docs/SSOT/03_QUALITY_BAR.md) lines 8-35 for complete DoD checklist.

## Implementation Guidelines

### Smallest Safe Patches
Propose only minimal necessary changes that:
- Fix the specific issue without side effects
- Include comprehensive regression tests
- Respect architectural boundaries
- Maintain all quality gates

### No Code Changes Unless Requested
- Read-only analysis by default
- Code changes require explicit user request
- All changes must include comprehensive tests
- Architecture compliance required

### Emergency Bypass
Administrator-only bypass allowed for:
- Maximum 24-hour window
- Business justification documented
- Post-mortem and remediation plan required
- Audit trail maintained

---

**Navigation**: Start with [docs/SSOT/index.md](docs/SSOT/index.md) for complete documentation overview.
**Evidence**: All claims backed by SSOT documents with file:line citations.
**Updates**: Changes to this file require SSOT updates first.