# SSOT Bootstrap Rule - Continue Agent Governance

## Hard Requirements for All Continue Agents

### SSOT-First Principle

**MANDATORY**: All Continue agent interactions MUST begin by reading and internalizing `docs/SSOT/*` files as the single source of truth for:

- **01_MISSION.md**: Core mission, business value, architectural independence
- **02_GOVERNANCE.md**: Governance model, no-drift policy, vendor boundaries
- **03_QUALITY_BAR.md**: Quality gates, test pyramid, CI/CD requirements
- **04_TEST_STRATEGY.md**: Testing approach, coverage targets, evidence standards
- **05_CI_CD.md**: Pipeline configuration, validation gates, performance targets
- **06_RELEASES_AND_TAGS.md**: Versioning strategy, release process, changesets
- **07_PROGRESS_LEDGER.md**: Current status, milestones, success metrics
- **08_EPICS_INDEX.md**: Epic definitions, work item mapping, dependencies
- **09_EVIDENCE_INDEX.md**: Evidence standards, validation methods, completeness
- **10_AGENT_MEMORY.md**: Persistent memory surface for deterministic agent sessions

### Evidence-Only Citations

**MANDATORY**: Every claim, recommendation, or change proposal MUST be backed by evidence citations:

- **Code Evidence**: `path/to/file.ts:line_number: "exact excerpt"`
- **Test Evidence**: Coverage reports with file paths and percentages
- **Documentation Evidence**: Canonical doc references with section links
- **Performance Evidence**: Benchmark results with timestamps and conditions

**PROHIBITED**: Claims without evidence citations. Use `UNKNOWN` for unverifiable statements.

**VERIFICATION**: Include `rg -n "pattern" --count` commands showing match counts > 0
**NOT FOUND Discipline**: Every NOT FOUND claim must include the exact `rg` command + `--count` output = 0 (or empty output)

### No Secrets in Outputs

**MANDATORY**: Never include actual secrets, API keys, credentials, or sensitive data in any output, even when redacted.

### Ledger/Index Updates

**MANDATORY**: After completing any implementation work (even if the agent didn't perform it), the agent MUST:

1. Update `docs/PRODUCT_LOG.md` for user-visible changes
2. Update `docs/ENGINEERING_LOG.md` for technical/architectural changes
3. Update `docs/TRACEABILITY.md` with new test coverage mappings
4. Create evidence artifacts in `docs/EVIDENCE/` with proper validation
5. Update work item status in `docs/WORK_ITEMS/` if applicable

### Smallest Safe Patches

**MANDATORY**: Propose only the minimal necessary changes that:

- Fix the specific issue without side effects
- Include comprehensive regression tests
- Respect architectural boundaries from `docs/SSOT/02_GOVERNANCE.md`
- Maintain all quality gates from `docs/SSOT/03_QUALITY_BAR.md`

### No Code Changes Unless Explicitly Requested

**MANDATORY**: NO CODE CHANGES unless explicitly requested by the user.
**MANDATORY**: If code changes are requested, require a patch plan per docs/SSOT/02_GOVERNANCE.md + comprehensive tests per docs/SSOT/04_TEST_STRATEGY.md.

### Agent Memory Management

**MANDATORY**: Always read `docs/SSOT/10_AGENT_MEMORY.md` at the start of any work session.
**MANDATORY**: Always update `docs/SSOT/10_AGENT_MEMORY.md` at the end of any work (even read-only audits).
**MANDATORY**: Update "Short-term" section with current work status and "STOP-SHIP Ledger" with any critical findings.

### Cline Memory Bank Requirements

**MANDATORY**: Continue agents must maintain `.continue/memory-bank.json` with these fields:

- `session_state`: Current focus, session type, timestamps
- `short_term`: Active tasks, immediate priorities
- `stop_ship_ledger`: Critical, high, medium priority issues
- `evidence_links`: Links to evidence artifacts
- `governance_compliance`: SSOT adherence tracking
- `last_sync`: Timestamp of last SSOT synchronization

**MANDATORY**: Memory bank must reference `docs/SSOT/10_AGENT_MEMORY.md` as authority.
**MANDATORY**: Sync memory bank with SSOT before every work session.

### Session Close Enforcement

**MANDATORY**: Every Continue run must end by running SESSION_CLOSE and committing updated docs/SSOT/10_AGENT_MEMORY.md.
**MANDATORY**: If any files were changed or evidence was generated, memory must be updated in the same commit.
**MANDATORY**: CI will fail if memory validation script detects missing updates.
**MANDATORY**: Update `.continue/memory-bank.json` with session results and sync timestamps.

### Governance Compliance

**MANDATORY**: All proposals must comply with:

- **No-Drift Policy**: References must resolve to canonical documents
- **Vendor Boundary Rules**: No business logic in adapters
- **Architecture Constraints**: Respect module boundaries and interfaces
- **Evidence Standards**: All changes require evidence artifacts

## Agent Behavior Standards

### Response Format Requirements

- **Structured Output**: Use clear sections with descriptive headers
- **Evidence Citations**: Every technical claim backed by file:line references
- **Verification Commands**: Include ripgrep commands for evidence validation
- **Impact Assessment**: Risk level, blast radius, breaking changes analysis

### Quality Assurance Integration

- **Test Coverage**: Propose tests for all code changes
- **Evidence Collection**: Generate evidence artifacts during implementation
- **Documentation Updates**: Update canonical docs for any changes
- **Traceability**: Map all work to requirements and test coverage

### Error Handling

- **Unknown Claims**: Mark as `UNKNOWN` with specific investigation path
- **Missing Evidence**: Request evidence collection before proceeding
- **Architecture Violations**: Block proposals that violate established boundaries
- **Quality Gate Failures**: Address all CI/CD quality checks before merge

## Integration with Cursor Agents

### Cross-Agent Consistency

- **Shared SSOT**: Use identical `docs/SSOT/` files as Cursor agents
- **Evidence Standards**: Maintain consistent evidence citation formats
- **Governance Rules**: Apply same architectural and quality constraints
- **Progress Tracking**: Update shared logs and traceability matrices

### Escalation Paths

- **Architecture Decisions**: Route to ADR process for boundary changes
- **Quality Concerns**: Escalate through established governance channels
- **Security Issues**: Immediate escalation with evidence preservation
- **Performance Regressions**: Document and address with benchmark evidence

## Continuous Improvement

### Feedback Integration

- **Success Metrics**: Track completion rates and quality outcomes
- **Process Refinement**: Update SSOT files based on proven improvements
- **Evidence Evolution**: Enhance evidence collection based on pain points
- **Governance Adaptation**: Modify rules based on validated effectiveness

### Learning Integration

- **Pattern Recognition**: Learn from successful evidence-backed implementations
- **Risk Assessment**: Build knowledge of common failure modes
- **Efficiency Optimization**: Streamline processes while maintaining quality
- **Knowledge Preservation**: Document lessons learned in evidence artifacts
