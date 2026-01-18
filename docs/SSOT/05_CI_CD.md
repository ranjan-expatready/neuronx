# NeuronX CI/CD Pipeline (SSOT)

**Source**: Extracted from .github/workflows/ci.yml, .github/workflows/pr-quality-checks.yml, .github/workflows/api-tests.yml
**Last Updated**: 2026-01-10
**Authority**: CI/CD Pipeline Specification

## Pipeline Overview

NeuronX uses GitHub Actions for automated testing, quality assurance, and deployment with multiple specialized workflows for different validation needs.

## Core CI Pipeline (ci.yml)

### Triggers

- **Push to main**: Full validation before production deployment
- **Pull Requests**: Quality gates for all changes to main

### Quality Gate Job

**Runtime**: <10 minutes
**Environment**: Ubuntu Latest, Node.js 20, pnpm

#### Code Quality Checks

- **Dependencies**: `pnpm install --frozen-lockfile`
- **Formatting**: `pnpm run format:check`
- **Linting**: `pnpm run lint`
- **Type Checking**: `pnpm run typecheck`
- **Traceability**: `scripts/validate-traceability.ts`
- **Evidence**: `scripts/validate-evidence.ts`

#### Testing Requirements

- **Test Execution**: `pnpm run test:coverage`
- **Coverage Threshold**: ≥85% line coverage enforced
- **Coverage Calculation**:
  ```bash
  COVERAGE=$(grep "lines" coverage/coverage-summary.json | grep -o '[0-9]\+\.[0-9]\+')
  if (( $(echo "$COVERAGE < 85" | bc -l) )); then exit 1; fi
  ```

## PR Quality Checks (pr-quality-checks.yml)

### Triggers

- **PR Opened/Synchronized/Reopened**: On main and develop branches

### Comprehensive Validation

**Runtime**: Variable based on test complexity

#### Core Quality Gates

- **TypeScript**: `npm run typecheck`
- **ESLint**: `npm run lint`
- **Traceability**: Evidence and documentation validation
- **Coverage**: ≥85% threshold with detailed reporting

#### Evidence System Validation

```bash
# Required evidence directory structure
if [ ! -d "docs/EVIDENCE" ]; then exit 1; fi
if [ ! -f "scripts/capture-evidence.js" ]; then exit 1; fi
```

#### Test Organization Validation

```bash
# Validate test file locations
NEW_TESTS=$(git diff --name-only HEAD~1 | grep -E '\.spec\.|\.test\.|\.cy\.')
INVALID_LOCATIONS=$(echo "$NEW_TESTS" | grep -v -E '(apps/core-api/src.*__tests__|apps/core-api/test|cypress|e2e)')

if [ -n "$INVALID_LOCATIONS" ]; then exit 1; fi
```

#### Security Scanning

- **Secret Detection**: Automated scanning for hardcoded credentials
- **Pattern Matching**: `grep -r -E "(password|secret|token|key).*['\"][^'\"]*(password|secret|token|key)"`

#### Performance Validation

- **Async Pattern Check**: Detection of synchronous operations in async contexts
- **Basic Performance Metrics**: Response time validation for critical paths

#### Automated PR Comments

- **Coverage Reporting**: Real-time coverage percentage display
- **Test Summary**: Detailed test execution results
- **Quality Checklist**: Visual validation status
- **Next Steps**: Actionable guidance for developers

## API Testing Pipeline (api-tests.yml)

### Triggers

- **Push to main/develop**: Automated API validation
- **Pull Requests**: API contract testing
- **Manual Dispatch**: On-demand API testing

### Test Infrastructure

**Services**:

- **PostgreSQL 15**: Test database with health checks
- **Redis 7**: Caching and session storage

#### Environment Setup

```bash
cp .env.example .env.test
echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/neuronx_test" >> .env.test
echo "REDIS_URL=redis://localhost:6379" >> .env.test
```

#### Database Preparation

- **Migrations**: `npm run db:migrate`
- **Test Data**: `npm run db:seed`
- **Application Startup**: `npm run start:test`

#### API Test Execution

- **Tool**: Newman (Postman CLI runner)
- **Collection**: `postman/NeuronX_API_Collection.postman_collection.json`
- **Environment**: `postman/NeuronX_Dev_Environment.postman_environment.json`
- **Configuration**:
  - Timeout: 30 seconds per request
  - Delay: 1 second between requests
  - Reporters: CLI and JSON output

#### Evidence Capture

- **Test Results**: JSON export with full execution details
- **Performance Metrics**: Response times, success rates, assertion results
- **Evidence Storage**: `docs/EVIDENCE/api-tests/` with timestamped artifacts

#### Failure Handling

```bash
FAILED_REQUESTS=$(jq '.run.stats.requests.failed' api-test-results.json)
FAILED_ASSERTIONS=$(jq '.run.stats.assertions.failed' api-test-results.json)

if [ "$FAILED_REQUESTS" -gt 0 ] || [ "$FAILED_ASSERTIONS" -gt 0 ]; then exit 1; fi
```

## Specialized Test Pipelines

### E2E Testing (e2e-tests.yml)

- **Browser Testing**: Playwright-based end-to-end validation
- **Critical User Journeys**: Complete workflow testing
- **Cross-browser Compatibility**: Multiple browser environments

### Load Testing (load-tests.yml)

- **Performance Validation**: High-load scenario testing
- **Scalability Assessment**: Resource utilization under stress
- **Bottleneck Identification**: Performance regression detection

### Redis Testing (redis-tests.yml)

- **Cache Layer Validation**: Redis-specific functionality testing
- **Data Persistence**: Cache invalidation and recovery testing
- **Performance Benchmarking**: Redis operation latency measurement

## Pipeline Performance Targets

### Execution Times

- **Unit Tests**: <30 seconds
- **Contract Tests**: <2 minutes
- **E2E Tests**: <3 minutes
- **Full Pipeline**: <6 minutes
- **API Tests**: <5 minutes

### Reliability Metrics

- **Success Rate**: >95% pipeline success rate
- **Flaky Test Rate**: <1% intermittent failures
- **False Positives**: <0.1% incorrect failures

## Branch Protection Rules

### Main Branch Requirements

- **Required Reviews**: ≥1 approving review
- **Status Checks**: All CI quality gates pass
- **PR Required**: All changes via pull request
- **Conversation Resolution**: All discussions addressed
- **Admin Enforcement**: Rules apply to administrators

### Concurrency Control

- **Group**: `${{ github.workflow }}-${{ github.ref }}`
- **Cancel In Progress**: Automatic cancellation of redundant runs

## Artifact Management

### Test Artifacts

- **Coverage Reports**: Detailed coverage analysis with trend tracking
- **Test Results**: JUnit XML format for external integration
- **Evidence Artifacts**: Timestamped evidence files for audit trails

### Retention Policy

- **Success Runs**: 30 days retention
- **Failed Runs**: 90 days retention for debugging
- **Critical Evidence**: Permanent retention for compliance

## Failure Handling & Recovery

### Automatic Retry Logic

- **Transient Failures**: Automatic retry for network timeouts
- **Service Dependencies**: Retry logic for external service unavailability
- **Race Conditions**: Detection and retry for timing-dependent failures

### Manual Intervention

- **Emergency Bypass**: Administrator override for critical fixes
- **Rollback Procedures**: Automated rollback for failed deployments
- **Incident Response**: Escalation procedures for pipeline failures

## Continuous Improvement

### Metrics Collection

- **Pipeline Performance**: Execution time trends and bottleneck analysis
- **Quality Metrics**: Coverage trends, defect detection rates
- **Developer Experience**: PR cycle time and feedback quality

### Process Optimization

- **Parallel Execution**: CPU core utilization for faster feedback
- **Caching Strategy**: Dependency and build artifact caching
- **Incremental Testing**: Smart test selection based on changes

## Integration Points

### External Systems

- **GitHub**: Issue tracking, project management integration
- **Slack**: Notification and alerting for pipeline status
- **Monitoring**: Application performance and error tracking
- **Security**: Automated security scanning and vulnerability assessment

### Development Workflow

- **Local Testing**: Pre-commit validation matching CI requirements
- **Branch Strategy**: Feature branches with automated validation
- **Release Process**: Automated versioning and publishing workflows
