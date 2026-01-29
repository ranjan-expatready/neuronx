# Quality Gates — Staged Coverage and Testing Requirements

## Overview

This document defines the staged quality gates for the Autonomous Engineering OS. Quality gates ensure code quality through progressive coverage targets, testing requirements, and automated checks that scale with the project's maturity.

---

## STAGED COVERAGE POLICY

### Coverage Stages Overview

| Stage | Coverage Floor | Description | When to Use |
|-------|----------------|-------------|-------------|
| Stage 0 | Tests required for new features | Initial development, basic test coverage | Early development, prototyping |
| Stage 1 | 70% | Minimum viable coverage for production | MVP launch, early production |
| Stage 2 | 80% | Sustainable quality target | Production maturity |
| Stage 3 | 90% (optional/targeted) | High-reliability components | Critical paths, core infrastructure |

### Coverage Measurement

**New Code Coverage (Preferred)**:
- Measures coverage of only new/changed code in a PR
- Allows overall coverage to degrade gradually while improving new code
- Calculated via `diff-cover` or similar tools
- More suitable for brownfield projects with legacy code

**Global Coverage (Fallback)**:
- Measures coverage of entire codebase
- Used when new code coverage not available
- More strict but harder to maintain on established codebases
- Calculated via standard coverage tools (coverage.py, jest, etc.)

### Coverage Configuration

**For Python**:
```yaml
# .coveragerc
[report]
fail_under = 70  # Adjust based on current stage
omit =
    */tests/*
    */migrations/*
    */site-packages/*
    */__init__.py
```

**For JavaScript/TypeScript**:
```json
{
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 70,
      "lines": 70,
      "statements": 70
    }
  }
}
```

---

## STAGE 0: INITIAL DEVELOPMENT

### Coverage Requirement
- No explicit coverage percentage requirement
- **Tests required for new features**
- CI must pass green

### Testing Requirements

**For New Features** (APP/, PRODUCT/):
- Write at least 1 test per new function/module
- Test happy path (success case)
- Test at least 1 error case
- Document test scenarios in PR description

**For Bug Fixes**:
- Write regression test demonstrating the bug
- Verify fix by running test
- Explain in PR why test coverage is sufficient

**For Configuration/Documentation**:
- No tests required for configuration files
- No tests required for documentation updates
- CI validation sufficient (lint, formatting)

### CI Gates
- ✅ Linting passes
- ✅ Tests pass (if any exist)
- ✅ No syntax errors
- ✅ Build succeeds
- ✅ Security scan completes (pass/fail reported)

### Auto-Merge Eligibility
- Eligible for auto-merge in APP/, PRODUCT/, BACKLOG/, FRAMEWORK_KNOWLEDGE/, ARCHITECTURE/, RUNBOOKS/
- Requires CI to pass green
- Optional: Human review encouraged but not required

### Transition to Stage 1
Trigger when:
- Project reaches production-ready state
- MVP deployment planned
- Core features implemented
- Team decides to invest in quality infrastructure

---

## STAGE 1: MINIMUM VIABLE COVERAGE (70%)

### Coverage Requirement
- **70% coverage floor** on new code or global
- Coverage report must be visible in PR
- Failing coverage blocks merge

### Testing Requirements

**Core Areas** (must be well-tested):
- Business logic (APP/ features, controllers, services)
- Critical algorithms
- Data transformations
- API endpoints
- Database operations
- Authentication/authorization

**Acceptable to Have Lower Coverage**:
- Configuration files
- Data models (structs, schema definitions)
- Simple utility functions (trivial code)
- Migration scripts (legacy)
- UI components (if difficult to test)

### CI Gates
- ✅ All Stage 0 gates
- ✅ Coverage report generated
- ✅ Coverage ≥ 70% (enforced)
- ✅ Coverage trend report visible (increasing/stable)
- ✅ Codecov or similar coverage reporting configured

### Coverage Exclusions

**Can Exclude** (with documented rationale):
```
# Configuration and initialization
*/config/*
*/__init__.py

# Generated code
*/generated/*
*/dist/*

# Test files
*/tests/*

# Third-party integrations (if testing requires external services)
*/integrations/external/*
```

### Auto-Merge Eligibility
- Eligible for auto-merge in APP/, PRODUCT/, BACKLOG/
- Requires 70%+ coverage on new code
- Requires CI to pass green

### Transition to Stage 2
Trigger when:
- Project has proven production stability
- Team velocity allows for additional testing effort
- Critical bugs are rare (low failure rate in production)
- Monthly recurring bugs below threshold (e.g., < 5 per month)

### Metrics to Track
- Overall coverage trend
- Coverage by module/feature
- Test execution time
- Flaky test count
- Coverage-driven bug fixes (bugs caught by tests post-merge)

---

## STAGE 2: SUSTAINABLE QUALITY (80%)

### Coverage Requirement
- **80% coverage floor** on new code or global
- Stricter coverage requirements for critical paths
- Coverage quality assessments (not just quantity)

### Testing Requirements

**Additional Testing Layer**:
- Integration tests for key workflows
- End-to-end tests for critical user journeys
- Contract tests for external APIs
- Performance benchmarks for hot paths

**Critical Path Testing** (90%+ coverage):
- Authentication/authorization flow
- Payment processing
- Data integrity operations
- Core business logic
- API contract compliance

### CI Gates
- ✅ All Stage 1 gates
- ✅ Coverage ≥ 80% (enforced)
- ✅ Integration tests pass
- ✅ Performance benchmarks within thresholds
- ✅ No slow tests (> 5 seconds per test)

### Coverage Quality Assessments

**Coverage Quality Metrics**:
1. **Line Coverage**: Lines of code executed
2. **Branch Coverage**: Conditional branches taken
3. **Function Coverage**: Functions called
4. **Statement Coverage**: Code statements executed

**Minimum Targets** (Stage 2):
- Line Coverage: 80%
- Branch Coverage: 75%
- Function Coverage: 80%

### Auto-Merge Eligibility
- Eligible for auto-merge in APP/, PRODUCT/ only
- Requires 80%+ coverage on new code
- Requires all integration tests to pass
- GOVERNANCE/, AGENTS/, .github/workflows/ always require human approval

### Transition to Stage 3
Optional trigger when:
- High-reliability requirements (SLA 99.9%+ uptime)
- Regulatory/compliance requirements
- Customer demands for higher reliability
- Critical infrastructure components identified

---

## STAGE 3: HIGH RELIABILITY (90%) - OPTIONAL/TARGETED

### Coverage Requirement
- **90% coverage floor** on critical paths (targeted)
- Global coverage 80%+ maintained
- Quality gate focused on risk-based coverage

### Testing Requirements

**Critical Path Focus**:
- 90%+ coverage on critical infrastructure
- Chaos testing for resilience
- Load testing for performance under stress
- Security penetration testing
- Disaster recovery testing

**Reliability Requirements**:
- SLA monitoring and alerting
- Error budget management
- Failure injection testing
- Circuit breaker validation
- Graceful degradation testing

### CI Gates
- ✅ All Stage 2 gates
- ✅ Critical path coverage ≥ 90% (enforced)
- ✅ Performance tests under target load
- ✅ Security scanning clean (no critical/high vulnerabilities)
- ✅ Compliance checks pass

Coverage Quality Targets (Stage 3):
- Line Coverage: 90% (critical paths), 80% (overall)
- Branch Coverage: 85% (critical paths), 75% (overall)
- Function Coverage: 90% (critical paths), 80% (overall)

### Auto-Merge Eligibility
- NOT applicable for critical paths
- Auto-merge disabled for critical infrastructure changes
- Requires rigorous human review and approval

### When to Use Stage 3
- Payment processing systems
- Security-sensitive components
- Customer data handling
- Regulatory compliance requirements
- High-availability services (SLA 99.99%+)

---

## QUALITY GATE ESCALATION

### Coverage Degradation

**When coverage decreases**:
- PR blocked if coverage falls below current stage threshold
- Required: Add tests to restore coverage
- Required: Explain degradation in PR
- Optional: Request temporary waiver (Founder approval required)

**Temporary Waiver Process**:
1. Document why coverage cannot be met
2. Provide remediation plan with timeline
3. Obtain Founder approval
4. Track remediation deadline
5. Follow up and close when resolved

### Test Failures

**When tests fail**:
- PR blocked until tests pass
- Flaky tests disabled and tracked for fixes
- Critical failures require immediate attention
- Non-critical failures may be temporarily waived

---

## QUALITY GATE MONITORING

### Metrics Dashboard

Track monthly:
1. Coverage percentage (overall and by module)
2. Test execution time trends
3. Flaky test count and resolution rate
4. Coverage-driven bug count
5. PR failure rate (coverage, tests, lint)
6. Auto-merge success rate vs. manual review rate

### Alerts

Trigger notifications when:
- Coverage drops below stage threshold
- Test execution time increases significantly (> 20%)
- Flaky test rate > 5% of total tests
- Coverage degradation not remediated within 2 weeks

---

## IMPLEMENTATION CHECKLIST

### Stage 0 → Stage 1 Transition
- [ ] Choose coverage measurement tool (pytest-cov, coverage.py, jest, etc.)
- [ ] Configure coverage reporting in CI
- [ ] Set 70% coverage threshold
- [ ] Update documentation (this file)
- [ ] Train team on coverage requirements
- [ ] Communicate policy change

### Stage 1 → Stage 2 Transition
- [ ] Increase coverage threshold to 80%
- [ ] Add integration test suite
- [ ] Set up performance benchmarks
- [ ] Configure coverage quality metrics (branch, function coverage)
- [ ] Implement coverage trend reporting
- [ ] Update auto-merge policies

### Stage 2 → Stage 3 Transition (Optional)
- [ ] Identify critical paths requiring 90% coverage
- [ ] Implement chaos testing framework
- [ ] Set up load testing infrastructure
- [ ] Configure security scanning in CI
- [ ] Define SLA monitoring
- [ ] Update quality gate requirements

---

## QUALITY GATE REFERENCES

### Related Documents
- **GOVERNANCE/GUARDRAILS.md** - Dev Stage Fast Mode (auto-merge rules by directory)
- **GOVERNANCE/RISK_TIERS.md** - Approval requirements by risk tier
- **GOVERNANCE/COST_POLICY.md** - Cost thresholds for testing infrastructure
- **FRAMEWORK_KNOWLEDGE/testing_strategy.md** - General testing approach

### CI Workflow
- **.github/workflows/ci.yml** - Coverage reporting and enforcement
- Coverage reporting step integrated into test-unit job

### PR Requirement Checklist

Before merging to `main`, ensure:

**For All PRs**:
- [ ] All CI checks pass (lint, test-unit, test-integration, security, build)
- [ ] PR description includes rationale and changes
- [ ] Code follows existing patterns and conventions
- [ ] No breaking changes without explicit approval

**For New Features/Code Changes** (APP/, PRODUCT/):
- [ ] Tests written for new functionality (Stage 0+)
- [ ] Coverage meets current stage threshold (if Stage 1+)
- [ ] Edge cases considered and tested
- [ ] Regression risks assessed

**For Governance Changes** (GOVERNANCE/, AGENTS/, .github/workflows/):
- [ ] Human approval obtained (Founder/CTO for GOVERNANCE/)
- [ ] Impact on operations reviewed
- [ ] Rollback plan documented if applicable
- [ ] Reference to related governance documents

**For High-Risk Changes** (Tier 2+):
- [ ] Rollback plan tested and documented
- [ ] Impact assessment completed
- [ ] Stakeholder notification (if applicable)
- [ ] Monitoring/alerting configured

---

## VERSION HISTORY

- v1.0 (Initial): Staged coverage policy (Stage 0-3), testing requirements, quality gate monitoring, PR checklist
