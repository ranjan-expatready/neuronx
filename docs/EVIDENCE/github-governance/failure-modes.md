# GitHub Governance Failure Modes & Consequences

**Date**: 2026-01-10
**Status**: DOCUMENTED
**Source**: docs/SSOT/11_GITHUB_GOVERNANCE.md, docs/SSOT/03_QUALITY_BAR.md, docs/SSOT/05_CI_CD.md

## Failure Mode: Coverage <85% Threshold

### Detection

**Source**: `.github/workflows/ci.yml` lines 58-79, `.github/workflows/pr-quality-checks.yml` lines 43-53

- **CI Job**: `Verify coverage threshold` in ci.yml
- **Coverage Command**: `jq '.total' coverage/coverage-summary.json`
- **Threshold Check**: `if (( $(echo "$COVERAGE < 85" | bc -l) ))`
- **Failure Action**: `exit 1` (pipeline fails)

### Consequences

- **PR Status**: ❌ Red "X" on coverage check
- **Merge Block**: Cannot merge until coverage ≥85%
- **Branch Protection**: Status check failure prevents merge
- **Notification**: Slack alert for coverage regression
- **Rollback Required**: Coverage must be restored before merge

### Remediation Steps

1. **Identify Gaps**: Run `npm run test:coverage` locally
2. **Add Tests**: Create unit tests for uncovered lines
3. **Exclude Legitimately Untestable Code**: Update coverage configuration
4. **Re-run CI**: Push fixes and verify coverage threshold
5. **Document Exceptions**: Update ENGINEERING_LOG.md for coverage waivers

## Failure Mode: Agent Memory Not Updated

### Detection

**Source**: `.github/workflows/ci.yml` lines 52-53, `scripts/validate-agent-memory.ts`

- **CI Job**: `Validate agent memory updates`
- **Validation Script**: `npx tsx scripts/validate-agent-memory.ts`
- **Checks**: Last Updated timestamp, session evidence completeness
- **Failure Action**: Pipeline fails if memory surface is stale

### Consequences

- **PR Status**: ❌ Red "X" on memory validation check
- **Merge Block**: Cannot merge until memory is updated
- **Evidence Loss**: Session context not preserved for future agents
- **Audit Gap**: Missing traceability for changes made

### Remediation Steps

1. **Read Current Memory**: Check `docs/SSOT/10_AGENT_MEMORY.md`
2. **Update Timestamps**: Set Last Updated to current UTC
3. **Document Session Outcomes**: Add Short-Term status updates
4. **Add Evidence Links**: Reference any docs/EVIDENCE/ artifacts
5. **Update STOP-SHIP Ledger**: Mark resolved items, add new findings

## Failure Mode: Evidence System Missing

### Detection

**Source**: `.github/workflows/ci.yml` lines 49-50, `.github/workflows/pr-quality-checks.yml` lines 55-69

- **CI Job**: `Validate evidence requirements`
- **Validation Script**: `npx tsx scripts/validate-evidence.ts`
- **Directory Check**: `[ ! -d "docs/EVIDENCE" ] && exit 1`
- **Script Check**: `[ ! -f "scripts/capture-evidence.js" ] && exit 1`

### Consequences

- **PR Status**: ❌ Red "X" on evidence validation
- **Merge Block**: Cannot merge without evidence system
- **Compliance Gap**: No audit trail for changes
- **Future Debugging**: Evidence needed for incident response

### Remediation Steps

1. **Verify Evidence Directory**: Ensure `docs/EVIDENCE/` exists
2. **Check Evidence Script**: Confirm `scripts/capture-evidence.js` is present
3. **Create Missing Evidence**: Run evidence capture for current changes
4. **Update Traceability**: Add evidence links to `docs/TRACEABILITY.md`
5. **Categorize Artifacts**: Store in proper `docs/EVIDENCE/` subdirectories

## Failure Mode: Traceability Validation Fails

### Detection

**Source**: `.github/workflows/ci.yml` lines 46-47, `scripts/validate-traceability.ts`

- **CI Job**: `Validate traceability integrity`
- **Validation Script**: `npx tsx scripts/validate-traceability.ts`
- **Checks**: TRACEABILITY.md completeness, acceptance criteria mapping
- **Failure Action**: Pipeline fails if traceability is incomplete

### Consequences

- **PR Status**: ❌ Red "X" on traceability check
- **Merge Block**: Cannot merge without complete traceability
- **Requirements Drift**: Risk of building untested features
- **Audit Issues**: Missing test-to-requirement mapping

### Remediation Steps

1. **Check TRACEABILITY.md**: Verify feature has corresponding row
2. **Add Missing Row**: Create traceability entry with acceptance criteria
3. **Map Test Coverage**: Link unit/contract/E2E tests to requirements
4. **Validate Acceptance Criteria**: Ensure criteria are measurable and testable
5. **Update Work Item Status**: Mark as "Tested" with evidence links

## Failure Mode: Code Quality Gates Fail

### Detection

**Source**: `.github/workflows/ci.yml` lines 37-44

- **Formatting**: `pnpm run format:check` fails
- **Linting**: `pnpm run lint` fails
- **Type Checking**: `pnpm run typecheck` fails

### Consequences

- **PR Status**: ❌ Red "X" on quality gate checks
- **Merge Block**: Cannot merge with code quality issues
- **Technical Debt**: Accumulation of linting/type errors
- **Maintainability**: Reduced code readability and reliability

### Remediation Steps

1. **Run Local Checks**: Execute failing commands locally
2. **Fix Formatting**: Run `pnpm run format` to auto-fix
3. **Fix Linting Issues**: Address ESLint violations
4. **Fix Type Errors**: Resolve TypeScript compilation issues
5. **Test Locally**: Verify all quality gates pass before pushing

## Failure Mode: Security Vulnerabilities Detected

### Detection

**Source**: `.github/workflows/dependency-review.yml`, `.github/workflows/codeql.yml`, `.github/workflows/secret-scan.yml`

- **Dependency Review**: High/moderate severity vulnerabilities
- **CodeQL Analysis**: Security vulnerabilities in code
- **Secret Scanning**: Hardcoded secrets or credentials

### Consequences

- **PR Status**: ❌ Red "X" on security checks
- **Merge Block**: Cannot merge with security issues
- **Security Risk**: Potential vulnerabilities in production
- **Compliance Issues**: May violate security standards
- **Incident Response**: May require immediate remediation

### Remediation Steps

1. **Review Security Alerts**: Check specific vulnerabilities found
2. **Update Dependencies**: Upgrade to secure versions
3. **Fix Code Issues**: Address CodeQL findings
4. **Remove Secrets**: Replace hardcoded secrets with environment variables
5. **Security Review**: Request security team review for complex issues

## Failure Mode: Test Organization Violations

### Detection

**Source**: `.github/workflows/pr-quality-checks.yml` lines 71-94

- **Test Location Check**: `INVALID_LOCATIONS=$(echo "$NEW_TESTS" | grep -v -E '(apps/core-api/src.*__tests__|apps/core-api/test|cypress|e2e)')`
- **Failure Condition**: `[ -n "$INVALID_LOCATIONS" ] && exit 1`

### Consequences

- **PR Status**: ❌ Red "X" on test organization check
- **Merge Block**: Cannot merge with improperly organized tests
- **CI Maintenance**: Tests run in wrong environments
- **Test Reliability**: Integration tests may not run properly

### Remediation Steps

1. **Check Test Locations**: Verify test files are in correct directories
2. **Move Unit Tests**: Place in `apps/core-api/src/**/__tests__/*.spec.ts`
3. **Move Integration Tests**: Place in `apps/core-api/test/**/*.spec.ts`
4. **Move E2E Tests**: Place in `e2e/**/*.spec.ts` or `cypress/**/*.cy.ts`
5. **Update CI Configuration**: Ensure new locations are included in CI

## Emergency Bypass Procedures

### When to Use Bypass

**Source**: docs/SSOT/11_GITHUB_GOVERNANCE.md lines 28-32

- **Critical Production Issues**: Security vulnerabilities requiring immediate fix
- **Infrastructure Failures**: CI/CD system unavailable
- **Time-Sensitive Deployments**: Business-critical deadlines with leadership approval

### Bypass Process

1. **Obtain Approval**: Engineering leadership sign-off required
2. **Document Justification**: Add to ENGINEERING_LOG.md with business impact
3. **Time Limit**: Maximum 24-hour bypass window
4. **Post-Mortem**: Incident review within 48 hours
5. **Restore Protections**: Immediately re-enable after bypass

### Bypass Consequences

- **Audit Trail**: All bypasses tracked in ENGINEERING_LOG.md
- **Review Required**: Engineering leadership review mandatory
- **Process Improvement**: Identify why bypass was needed and prevent recurrence

---

**Evidence**: This document outlines all failure modes and their consequences, ensuring predictable governance enforcement and clear remediation paths.
