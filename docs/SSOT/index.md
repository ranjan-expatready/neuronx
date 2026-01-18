# NeuronX Single Source of Truth (SSOT) Index

**Canonical Documentation Hub** | **Evidence-Based Governance** | **No-Drift Policy**

This index provides navigation to all NeuronX SSOT (Single Source of Truth) documents. These documents define our mission, governance, quality standards, and operational procedures.

## Core Foundation

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [01_MISSION.md](01_MISSION.md) | Core mission, business value, architectural independence, and success metrics | 2026-01-10 |
| [02_GOVERNANCE.md](02_GOVERNANCE.md) | No-drift policy, vendor boundary enforcement, ADR process, evidence requirements | 2026-01-10 |
| [03_QUALITY_BAR.md](03_QUALITY_BAR.md) | Definition of Done, CI/CD quality gates, test pyramid, coverage requirements | 2026-01-10 |
| [04_TEST_STRATEGY.md](04_TEST_STRATEGY.md) | Testing approach, coverage targets, evidence standards, test organization | 2026-01-10 |

## Operations & Delivery

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [05_CI_CD.md](05_CI_CD.md) | CI/CD pipeline configuration, validation gates, performance targets | 2026-01-10 |
| [06_RELEASES_AND_TAGS.md](06_RELEASES_AND_TAGS.md) | Versioning strategy, release process, changesets, deployment procedures | 2026-01-10 |
| [11_GITHUB_GOVERNANCE.md](11_GITHUB_GOVERNANCE.md) | Branch protection rules, PR requirements, review processes, emergency bypass | 2026-01-10 |

## Progress Tracking & Evidence

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [07_PROGRESS_LEDGER.md](07_PROGRESS_LEDGER.md) | Current project status, milestones, success metrics, blockers | 2026-01-10 |
| [08_EPICS_INDEX.md](08_EPICS_INDEX.md) | Epic definitions, work item mapping, dependencies, prioritization | 2026-01-10 |
| [09_EVIDENCE_INDEX.md](09_EVIDENCE_INDEX.md) | Evidence standards, validation methods, completeness requirements | 2026-01-10 |
| [10_AGENT_MEMORY.md](10_AGENT_MEMORY.md) | Persistent agent memory surface for deterministic AI interactions | 2026-01-12 |

## Strategic Planning

| Document | Description | Last Updated |
|----------|-------------|--------------|
| [20M_TRANSFORMATION_PLAN.md](20M_TRANSFORMATION_PLAN.md) | Long-term transformation strategy and roadmap to $20M revenue | 2026-01-10 |

## Quick Start Navigation

### For New Contributors
1. Start with [01_MISSION.md](01_MISSION.md) - understand what NeuronX does
2. Read [02_GOVERNANCE.md](02_GOVERNANCE.md) - learn architectural boundaries
3. Review [03_QUALITY_BAR.md](03_QUALITY_BAR.md) - understand quality requirements
4. Check [04_TEST_STRATEGY.md](04_TEST_STRATEGY.md) - learn testing approach

### For AI Agents
1. Read [AGENTS.md](../../AGENTS.md) - canonical agent operating rules
2. Review [10_AGENT_MEMORY.md](10_AGENT_MEMORY.md) - current session state
3. Check [07_PROGRESS_LEDGER.md](07_PROGRESS_LEDGER.md) - current project status

### For CI/CD Changes
1. Review [05_CI_CD.md](05_CI_CD.md) - pipeline configuration
2. Check [11_GITHUB_GOVERNANCE.md](11_GITHUB_GOVERNANCE.md) - branch protection rules
3. Verify [03_QUALITY_BAR.md](03_QUALITY_BAR.md) - quality gate requirements

## Governance Rules

- **SSOT-First Principle**: All changes must update SSOT documents before implementation
- **Evidence-Only Citations**: Every claim backed by `file:line` excerpts with `rg` verification
- **No-Drift Policy**: Documentation and implementation must remain synchronized
- **Agent Memory Updates**: All agents must update [10_AGENT_MEMORY.md](10_AGENT_MEMORY.md) after work

## Maintenance

- **Authority**: Each SSOT document specifies its authority and update process
- **Evidence**: All claims include file path citations and verification commands
- **Updates**: Changes require evidence justification and approval per governance rules
- **Validation**: Automated scripts verify SSOT compliance in CI/CD

---

**Navigation**: Use [AGENTS.md](../../AGENTS.md) for agent-specific rules | **Evidence**: All descriptions verified against document headers | **Updates**: Modify this index when adding/removing SSOT files