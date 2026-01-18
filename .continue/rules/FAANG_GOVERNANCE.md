# FAANG Governance Rules

## Evidence Standards

### Repo-Backed Evidence Required

**Rule**: Every claim, finding, or recommendation must be backed by verifiable repository evidence.

**Implementation**:

- Use exact file paths and line numbers for all citations
- Include ripgrep commands to verify findings: `rg -n "pattern" path/to/file`
- Mark claims as `UNKNOWN` when evidence cannot be located
- Never make assumptions without repo-backed verification

**Example**:

```
✅ VERIFIED: Security vulnerability in apps/core-api/src/auth/jwt.ts:47
   Evidence: rg -n "process\.env\." apps/core-api/src/auth/jwt.ts
   Match count: 3

❌ UNKNOWN: Potential security issue in authentication module
   No evidence found - requires investigation
```

### NOT FOUND Verification

**Rule**: Every "NOT FOUND" or negative claim must include exact verification commands.

**Implementation**:

- Include `rg --count "pattern"` showing 0 matches
- Specify exact search scope (file, directory, or entire repo)
- Document search parameters and reasoning

**Example**:

```
NOT FOUND: Direct database queries in adapter layer
Verification: rg --count "prisma\.\w+\(" packages/adapters-ghl/
Match count: 0
Search scope: All TypeScript files in adapter packages
```

## Security & Privacy

### No Secrets in Outputs

**Rule**: Never expose secrets, credentials, or sensitive data in any output.

**Implementation**:

- Redact API keys, passwords, tokens, and private URLs
- Use placeholder values: `[REDACTED_API_KEY]`, `[REDACTED_URL]`
- Flag any accidental exposure as STOP-SHIP severity
- Verify outputs don't contain sensitive patterns before sharing

**Prohibited Patterns**:

- Raw JWT tokens or API keys
- Database connection strings with credentials
- Private repository URLs with tokens
- Personal identifiable information (PII)

## Patch Planning Standards

### Smallest Safe Patch Plans

**Rule**: Always prefer the minimal viable change that safely resolves the issue.

**Implementation**:

- Start with single-file, single-function fixes when possible
- Avoid sweeping architectural changes unless absolutely necessary
- Include clear rollback plans for all patches
- Test patches in isolation before integration

**Evaluation Criteria**:

- **Scope**: Does this change only what needs to be changed?
- **Risk**: What's the blast radius of this change?
- **Testability**: Can this change be thoroughly tested?
- **Revertibility**: How easily can this change be undone?

### Testing Standards

**Rule**: Follow comprehensive testing pyramid with quality requirements.

**Test Pyramid**:

- **Unit Tests (60%)**: Individual functions/methods, isolated, fast (< 100ms), high coverage
- **Integration Tests (20%)**: Component interactions, API endpoints, medium time (100ms-1s)
- **E2E Tests (10%)**: Complete user journeys, slow (1s-10s+), critical flows only
- **Contract Tests (5%)**: Interface validation, schema testing, API contracts
- **Performance Tests (3%)**: Load testing, stress testing, weekly execution
- **Security Tests (2%)**: Vulnerability scanning, compliance validation, monthly execution

**Coverage Requirements**:

- Unit tests: 80%+ line coverage
- Integration tests: 70%+ path coverage
- Critical business logic: 90%+ coverage
- New code: 100% coverage required

### Regression Test Requirements

**Rule**: Every patch plan must include comprehensive regression tests.

**Implementation**:

- **Unit Tests**: Cover the specific fix and edge cases
- **Integration Tests**: Validate component interactions
- **E2E Tests**: Verify critical user journeys remain functional
- **Load Tests**: Ensure performance characteristics are maintained

**Test Plan Structure**:

```typescript
describe('Patch Regression Tests', () => {
  it('fixes the original issue', () => {
    // Test the specific bug fix
  });

  it('maintains existing functionality', () => {
    // Test related features aren't broken
  });

  it('handles edge cases', () => {
    // Test boundary conditions
  });
});
```

## Architecture Compliance

### Single Source of Truth

**Rule**: Maintain canonical documentation hierarchy and prevent documentation drift.

**Canonical Documentation Hierarchy**:

- **REQUIREMENTS.md**: Definitive product requirements, scope boundaries, user personas
- **TRACEABILITY.md**: Feature-to-test verification matrix ensuring complete test coverage
- **ARCHITECTURE.md**: System architecture, module boundaries, data flow definitions
- **DECISIONS/**: Architecture decisions with context and rationale
- **PRODUCT_LOG.md**: User-visible changes, milestones, feature decisions
- **ENGINEERING_LOG.md**: Technical changes, architectural rationale, engineering decisions

**Update Requirements**:

- Feature defined in REQUIREMENTS.md with acceptance criteria before development
- Row added to TRACEABILITY.md with test coverage plan before development
- Code follows ARCHITECTURE.md boundaries during development
- Documentation updated before merge

### Vendor Boundary Policy

**Rule**: Maintain strict separation between NeuronX core intelligence and external vendor platforms.

**Implementation**:

- **NeuronX Owns Business Logic**: All sales intelligence, scoring algorithms, and orchestration logic resides exclusively in NeuronX core
- **No Business Logic in Adapters**: Adapter layers contain only protocol translation and data transformation
- **Platform Agnosticism**: Core logic must work with any execution platform
- **Adapters Are Stateless**: No persistent state or decision logic in adapter components
- **Single Responsibility**: Adapters handle one external system integration
- **Error Isolation**: Vendor failures don't corrupt NeuronX business logic

**Enforcement**:

- Reference `ARCHITECTURE.md` for vendor boundary definitions
- Validate adapter contracts against architectural boundaries
- Prohibit vendor-specific decision logic in core modules

## Code Change Policies

### Explicit Authorization Required

**Rule**: NO CODE CHANGES unless explicitly requested by user.

**Implementation**:

- Only provide code patches when specifically asked
- Use "PATCH PLAN" format for proposing changes
- Include clear implementation steps and verification commands
- Never modify files without explicit user approval

**Response Format for Change Proposals**:

````
## Proposed Patch Plan

### Changes Required
1. Modify `file.ts:line` - [brief description]
2. Add test in `test-file.spec.ts`

### Implementation
```diff
// Only show diffs, never full file rewrites
````

### Verification

- Run: `npm test`
- Manual check: [steps to verify]

```

## Quality Assurance

### Architecture Compliance
**Rule**: All recommendations must respect documented architecture boundaries.

**Verification**:
- Reference `ARCHITECTURE.md` for module boundaries
- Check `TRACEABILITY.md` for test coverage requirements
- Validate against `REQUIREMENTS.md` scope
- Respect adapter patterns and vendor boundaries

### Documentation Updates
**Rule**: Code changes may require documentation updates.

**Required Updates**:
- `ARCHITECTURE.md`: For architectural changes
- `TRACEABILITY.md`: For new test coverage
- `PRODUCT_LOG.md`: For user-visible changes
- `ENGINEERING_LOG.md`: For technical changes

## Communication Standards

### Severity Classification
**Rule**: Use consistent severity levels for all findings.

**Severity Ladder**:
- 🔴 **STOP-SHIP**: Prevents deployment (security, data loss, crashes)
- 🟡 **FIX-BEFORE-MERGE**: Blocks merge (bugs, performance, reliability)
- 🟢 **ADDRESS-IN-SPRINT**: Address this sprint (technical debt, improvements)
- 📋 **NICE-TO-HAVE**: Optional improvements (optimizations, cleanup)

### Evidence Citations
**Rule**: All technical claims require specific evidence citations.

**Citation Format**:
```

File: path/to/file.ext:line_number
Context: [2-3 lines of surrounding code]
Evidence: rg command that found this
Verification: Date/time of verification

````

## Tool Usage Standards

### Ripgrep Commands
**Rule**: Use consistent ripgrep patterns for evidence gathering.

**Standard Commands**:
```bash
# Count matches across directory
rg --count "pattern" path/

# Find with line numbers
rg -n "pattern" path/to/file

# Case-insensitive search
rg -i "pattern"

# Search specific file types
rg "pattern" -g "*.{ts,tsx}"

# Exclude directories
rg "pattern" --glob "!node_modules/**"
````

### Verification Workflows

**Rule**: Document verification steps for all findings.

**Workflow Template**:

1. **Search**: `rg -n "pattern" scope`
2. **Verify**: Manual inspection of results
3. **Document**: Citation with file:line references
4. **Timestamp**: Include verification timestamp

## Continuous Improvement

### Feedback Integration

**Rule**: Governance rules evolve based on lessons learned.

**Improvement Process**:

- Review effectiveness quarterly
- Update rules based on false positives/negatives
- Add new patterns as they're discovered
- Maintain backward compatibility

### Training Requirements

**Rule**: All team members must understand governance standards.

**Training Elements**:

- Evidence gathering techniques
- Severity classification
- Patch planning principles
- Security and privacy standards
