# NeuronX Quality Bar (SSOT)

**Source**: Extracted from docs/TEST_STRATEGY.md, .github/workflows/ci.yml, .github/workflows/pr-quality-checks.yml
**Last Updated**: 2026-01-10
**Authority**: Quality Assurance Framework

## Definition of Done (DoD)

A feature is complete when ALL of the following are satisfied:

### 1. Traceability Complete

- [ ] Row added to `docs/TRACEABILITY.md` with acceptance criteria
- [ ] Acceptance criteria mapped to test coverage plan
- [ ] Requirements traceability verified before development begins

### 2. Tests Implemented & Passing

- [ ] Unit tests for all business logic (>85% coverage)
- [ ] Contract tests for all external boundaries
- [ ] E2E test if it's a critical user flow
- [ ] All tests passing in CI/CD pipeline

### 3. Documentation Updated

- [ ] `PRODUCT_LOG.md` updated for user-visible changes
- [ ] `ENGINEERING_LOG.md` updated for architectural changes
- [ ] ADR created for any architectural decisions

### 4. Code Quality Verified

- [ ] Code follows ARCHITECTURE.md boundaries
- [ ] No architectural violations detected
- [ ] PR approved with governance checklist complete

## CI/CD Quality Gates

### Required Status Checks (All Must Pass)

#### Code Quality Gate

- **Formatting**: `pnpm run format:check` passes
- **Linting**: `pnpm run lint` passes
- **Type Checking**: `pnpm run typecheck` passes
- **Traceability**: `scripts/validate-traceability.ts` passes
- **Evidence**: `scripts/validate-evidence.ts` passes

#### Testing Gate

- **Unit Tests**: `pnpm run test:coverage` passes
- **Coverage Threshold**: ≥85% line coverage enforced
- **Test Results**: All tests deterministic and reliable
- **Flaky Test Rate**: <1% failure rate

#### Security Gate

- **Dependency Review**: No moderate/high severity vulnerabilities
- **Secret Scanning**: No secrets or credentials leaked
- **CodeQL Analysis**: Automated security analysis passes

### CI Pipeline Performance

- **Fast Feedback**: <3 minutes for unit + contract tests
- **Full Pipeline**: <6 minutes including E2E tests
- **Parallel Execution**: CPU cores utilized for test parallelism

## Test Pyramid Requirements

### Unit Tests (Fastest, 70% of Tests)

**Coverage**: >85% code coverage for core business logic
**Execution**: <100ms per test
**Scope**: Business logic, algorithms, state machines, validation rules
**Location**: `tests/unit/`
**Examples**:

- Lead scoring algorithms
- Workflow rule engines
- Data validation logic
- State transition logic

### Contract Tests (Medium Speed, 20% of Tests)

**Coverage**: 100% of external API contracts
**Execution**: <500ms per test
**Scope**: External integrations, API boundaries, adapter interfaces
**Location**: `tests/contract/`
**Examples**:

- GHL API adapter contracts
- CRM integration interfaces
- Webhook payload schemas

### E2E Tests (Slowest, <10% of Tests)

**Coverage**: 100% of critical user journeys
**Execution**: <60 seconds per test
**Scope**: Complete workflows through real system components
**Location**: `tests/e2e/`
**Examples**:

- Lead intake to opportunity creation
- SLA escalation workflows
- Multi-channel communication sequences

## Coverage Metrics

### Unit Test Coverage

- **Business Logic**: >85% line coverage
- **Critical Paths**: >90% branch coverage
- **New Features**: 100% coverage required
- **Legacy Code**: Coverage improvement required during refactoring

### Integration Coverage

- **API Contracts**: 100% coverage
- **Data Flows**: 100% critical path coverage
- **Error Conditions**: 100% error handling coverage

### End-to-End Coverage

- **Critical Journeys**: 100% coverage
- **Happy Path**: 100% coverage
- **Error Scenarios**: 80% coverage
- **Edge Cases**: 60% coverage

## Performance Benchmarks

### Test Execution Times

- **Unit Tests**: <30 seconds total execution
- **Contract Tests**: <2 minutes total execution
- **E2E Tests**: <3 minutes total execution
- **Full Pipeline**: <6 minutes from commit to deploy

### Application Performance

- **API Response Time**: P95 <200ms for core APIs
- **Orchestration Latency**: <5 seconds for critical paths
- **Database Queries**: P95 <100ms for tenant-scoped queries
- **Memory Usage**: <512MB per service instance

## Security Requirements

### Code Security

- **No Secrets**: Automated scanning for credentials
- **Dependency Security**: No high/moderate vulnerabilities
- **CodeQL Clean**: Static analysis passes
- **Input Validation**: 100% of external inputs validated

### Data Security

- **Tenant Isolation**: Row-level security enforced
- **Encryption**: Sensitive data encrypted at rest/transit
- **Access Control**: RBAC enforced for all operations
- **Audit Trail**: Complete event logging maintained

## Quality Metrics Tracking

### Weekly Metrics

- **Test Pass Rate**: >99% (excluding known flaky tests)
- **Coverage Percentage**: Trending upward, ≥85% maintained
- **Build Success Rate**: >95% for main branch
- **Time to Merge**: Average <2 days for compliant PRs

### Monthly Reviews

- **Flaky Test Analysis**: Root cause and remediation
- **Coverage Gap Analysis**: Prioritized test coverage improvements
- **Performance Regression**: Response time and throughput trends
- **Security Incidents**: Vulnerability response and prevention

## Exception Handling

### When Tests Can Be Skipped

- **Legacy Code**: Must add tests during refactoring
- **External Dependencies**: Use contract tests instead
- **Performance Critical**: Document why test is excluded
- **Third-party Code**: Integration tests sufficient

### Technical Debt Management

- **Test Debt**: Tracked in ENGINEERING_LOG.md
- **Coverage Debt**: Prioritized in sprint planning
- **Performance Debt**: Monitored with alerts
- **Security Debt**: Immediate remediation required

## Branch Protection Rules

### Main Branch Requirements

- **Required Reviews**: ≥1 approving review
- **Status Checks**: All quality gates pass
- **PR Required**: All changes via pull request
- **Conversations Resolved**: All discussions addressed
- **Admin Enforcement**: Rules apply to administrators

### Emergency Bypass

- **Administrator Only**: Repository admins only
- **Documentation Required**: Post-mortem and remediation plan
- **Time Limited**: Maximum 24-hour bypass window
- **Review Required**: Engineering leadership review

## Continuous Improvement

### Quality Process Refinement

- **Monthly Reviews**: Quality metrics and process effectiveness
- **Tool Updates**: Test frameworks and CI/CD improvements
- **Training**: Team skill development for quality practices
- **Automation**: Additional automated quality checks

### Success Metrics

- **Defect Detection**: % of defects caught by automated tests
- **Time to Feedback**: Average time from commit to quality results
- **Quality Confidence**: Team confidence in release quality
- **Customer Impact**: Production defect rates and severity
