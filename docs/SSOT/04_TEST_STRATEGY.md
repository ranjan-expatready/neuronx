# NeuronX Test Strategy (SSOT)

**Source**: Extracted from docs/TEST_STRATEGY.md
**Last Updated**: 2026-01-10
**Authority**: Testing Framework Specification

## Test Pyramid

```
     ┌─────────────┐  (1-3 tests)
    ╱    E2E      ╲  Critical flows only
   ╱   Smoke       ╲
  ╱  Tests          ╲
 ┌─────────────────────┐
 │    Contract Tests   │  (10-20 tests)
 │  Adapter Boundaries │  External integrations
 └─────────────────────┘
        ┌─────────────┐
       ╱  Unit Tests ╲  (100+ tests)
      ╱  Core Logic  ╲  Business rules & algorithms
     ╱               ╲
    └─────────────────┘
```

## Test Types & Responsibilities

### Unit Tests (Fastest, Most Numerous)

**What**: Core business logic, algorithms, state machines, validation rules
**Where**: `tests/unit/`
**Examples**:

- Lead scoring algorithms (`scoring-engine.test.ts`)
- Workflow rule engines (`workflow-engine.test.ts`)
- Data validation logic (`validation-rules.test.ts`)
- State transition logic (`state-machine.test.ts`)

**Characteristics**:

- No external dependencies (mocks/stubs for all I/O)
- Sub-millisecond execution per test
- 100% code coverage target for core logic
- Pure function testing where possible

### Contract Tests (Medium Speed, Boundary Focused)

**What**: External integrations, API contracts, adapter interfaces
**Where**: `tests/contract/`
**Examples**:

- GoHighLevel API adapter contracts (`ghl-adapter-contract.test.ts`)
- CRM integration interfaces (`crm-integration-contract.ts`)
- Communication service adapters (`email-sms-contract.test.ts`)
- External API response validation (`api-response-contract.test.ts`)

**Characteristics**:

- Tests component boundaries, not internal logic
- Uses test doubles for external services
- Validates data contracts and schemas
- Catches integration breakage early

### E2E Tests (Slowest, Critical Path Only)

**What**: Complete user journeys through real system components
**Where**: `tests/e2e/`
**Examples**:

- Lead intake to opportunity creation (`lead-to-opportunity-flow.test.ts`)
- Automated workflow execution (`workflow-execution-flow.test.ts`)
- Multi-channel communication sequence (`communication-sequence-flow.test.ts`)

**Characteristics**:

- Maximum 3 tests to keep CI fast (< 3 minutes total)
- Tests real database, network calls, external services
- Catches integration and configuration issues
- Requires test environment provisioning

## Test Execution Strategy

### CI/CD Pipeline Integration

```yaml
# Fast Feedback (Unit + Contract)
- Unit Tests: < 30 seconds
- Contract Tests: < 2 minutes
- Total Fast Pipeline: < 3 minutes

# Slow Validation (E2E)
- E2E Tests: < 3 minutes
- Total Pipeline: < 6 minutes
```

### Parallel Execution

- Unit tests run in parallel across CPU cores
- Contract tests run sequentially (external service limits)
- E2E tests run in isolated environments

### Test Environment Strategy

- **Unit/Contract**: In-memory databases, mocked external services
- **E2E**: Dedicated test environment with real external service sandboxes

## Definition of Done (for Features)

A feature is complete when:

1. **Traceability Updated**: Row added to `docs/TRACEABILITY.md` with acceptance criteria
2. **Tests Implemented**: Unit, contract, and E2E (if critical flow) tests written
3. **Tests Passing**: All tests pass in CI/CD pipeline
4. **Documentation Updated**: PRODUCT_LOG.md or ENGINEERING_LOG.md updated
5. **Code Reviewed**: PR approved with governance checklist complete

## Test Data Management

### Test Data Strategy

- **Unit Tests**: Minimal, focused data sets
- **Contract Tests**: Realistic payloads matching external APIs
- **E2E Tests**: Production-like data volumes and scenarios

### Data Cleanup

- Automatic cleanup after each test run
- Idempotent test execution (can run multiple times)
- No test data pollution between runs

## Quality Metrics

### Coverage Targets

- **Unit Tests**: > 85% code coverage for core business logic
- **Contract Tests**: 100% coverage of external API contracts
- **E2E Tests**: 100% coverage of critical user journeys

### Performance Targets

- **Unit Tests**: < 100ms per test
- **Contract Tests**: < 500ms per test
- **E2E Tests**: < 60 seconds per test

### Reliability Targets

- **Flaky Test Rate**: < 1% (tests that fail intermittently)
- **Test Maintenance**: < 5% of development time

## Test Organization

```
tests/
├── unit/           # Business logic tests
│   ├── scoring-engine.test.ts
│   ├── workflow-engine.test.ts
│   └── ...
├── contract/       # Integration boundary tests
│   ├── ghl-adapter-contract.test.ts
│   ├── crm-integration-contract.test.ts
│   └── ...
├── e2e/           # Critical flow tests
│   ├── lead-scoring-flow.test.ts
│   ├── workflow-execution-flow.test.ts
│   └── ...
├── setup.ts       # Shared test configuration
└── test-helpers/  # Test utilities and fixtures
```

## Tooling & Frameworks

- **Unit/Contract**: Vitest (fast, modern, TypeScript native)
- **E2E**: Playwright (reliable, fast, cross-browser)
- **Coverage**: Built-in Vitest coverage reporting
- **CI Integration**: GitHub Actions with parallel execution
- **Mocking**: Native Vitest mocking for external dependencies

## Exception Handling

### When to Skip Tests

- **Legacy Code**: Add tests during refactoring
- **External Dependencies**: Use contract tests instead of full integration
- **Performance-Critical**: Document why test is excluded

### Test Debt Management

- Track test debt in `ENGINEERING_LOG.md`
- Address in next sprint if blocking development
- Regular test maintenance sprints

## Continuous Improvement

### Metrics Tracking

- Test execution time trends
- Coverage percentage over time
- Flaky test identification and resolution
- Manual testing effort reduction

### Process Refinement

- Monthly test strategy review
- Update based on pain points and feedback
- Adopt new tools that improve efficiency
