# NeuronX Testing Guide

## Overview

NeuronX implements a comprehensive, FAANG-grade testing ecosystem designed for a multi-tenant SaaS platform with AI-driven features. This guide covers all testing types, tools, and best practices.

## Testing Pyramid

```
┌─────────────────┐  10% - User Journey Validation
│   E2E Tests     │  Playwright + Cypress
│                 │  Business Logic Verification
├─────────────────┤
│ Integration     │  20% - Component Interaction
│   Tests         │  API Contracts, Event Flows
├─────────────────┤
│   Unit Tests    │  60% - Function Isolation
│                 │  Vitest, 85%+ Coverage
└─────────────────┘
```

## Governance Guardrails

NeuronX enforces **zero-drift** between requirements, implementation, tests, and evidence through automated CI validations.

### Traceability Enforcement

Code changes in requirement-mapped modules require `docs/TRACEABILITY.md` updates:

```bash
npm run validate:traceability  # Check locally before commit
```

### Evidence Requirements

Integration work requires evidence artifacts:

```bash
npm run validate:evidence      # Check locally before commit
```

See `docs/GOVERNANCE_GUARDRAILS.md` for complete details.

## Quick Start

### Run All Tests

```bash
# Complete test suite with evidence capture
npm run test:all

# Quick test run (skip E2E and load tests)
npm run test:all -- --quick

# Unit tests only
npm run test:all -- --unit-only

# Skip evidence capture
npm run test:all -- --no-evidence
```

### Individual Test Suites

```bash
# Unit tests with coverage
npm run test:coverage

# E2E tests (Playwright)
npm run test:e2e

# E2E tests (Cypress)
npm run test:cypress

# Open Cypress UI
npm run test:cypress:open

# API tests (Postman)
npx newman run postman/NeuronX_API_Collection.postman_collection.json \
  --environment postman/NeuronX_Dev_Environment.postman_environment.json

# Load testing
node scripts/load-test-phase4c.js 15 2
```

## Test Types & Tools

### Unit Tests (Vitest)

**Framework**: Vitest - Fast, ESM-native testing with Jest compatibility
**Location**: `apps/core-api/src/**/__tests__/*.spec.ts`
**Coverage**: ≥85% required
**Execution**: `npm run test:coverage`

**Best Practices**:

- Test one function/method per test
- Mock external dependencies
- Use descriptive test names: `should return null when input is invalid`
- Aim for fast execution (< 100ms per test)

**Example**:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('AdvancedScoringService', () => {
  it('should calculate enhanced score correctly', async () => {
    const service = new AdvancedScoringService(mockConfig, mockCipher);
    const result = await service.calculateEnhancedScore(/* params */);

    expect(result.enhancedScore).toBeGreaterThan(result.originalScore);
    expect(result.confidence).toBeGreaterThan(0);
  });
});
```

### Integration Tests

**Framework**: Vitest + Newman
**Location**: `apps/core-api/test/**/*.spec.ts`
**Focus**: API endpoints, event flows, database interactions
**Execution**: Part of `npm run test:all`

**Contract Tests**:

- Validate adapter interfaces against implementations
- Test data transformation between layers
- Ensure external API compatibility

### E2E Tests

#### Playwright (Primary E2E Framework)

**Framework**: Playwright Test
**Location**: `e2e/**/*.spec.ts`
**Browsers**: Chromium, Firefox, WebKit
**Features**: Auto-wait, network interception, visual comparisons
**Execution**: `npm run test:e2e`

**Configuration**:

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
```

**Example**:

```typescript
import { test, expect } from '@playwright/test';

test('should complete lead qualification flow', async ({ page }) => {
  await page.goto('/leads');
  await page.getByRole('button', { name: /add lead/i }).click();

  // Fill form
  await page.getByLabel('First Name').fill('Test');
  await page.getByLabel('Email').fill('test@example.com');

  // Submit and verify
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(/qualified|scoring complete/i)).toBeVisible();
});
```

#### Cypress (Alternative E2E Framework)

**Framework**: Cypress
**Location**: `cypress/e2e/**/*.cy.ts`
**Focus**: UI-heavy flows, debugging-friendly
**Execution**: `npm run test:cypress`

**Custom Commands**:

```typescript
// cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.request('POST', '/api/auth/login', { email, password }).then(
      response => {
        window.localStorage.setItem('authToken', response.body.token);
      }
    );
  });
});
```

### API Testing (Postman + Newman)

**Framework**: Postman Collections + Newman CLI
**Location**: `postman/`
**Execution**: CI automated or manual via Newman

**Collection Structure**:

- Authentication flows
- Lead management APIs
- Integration endpoints
- Webhook testing

**Running Collections**:

```bash
# Install Newman
npm install -g newman

# Run collection
newman run postman/NeuronX_API_Collection.postman_collection.json \
  --environment postman/NeuronX_Dev_Environment.postman_environment.json \
  --reporters cli,json
```

### Load Testing

**Framework**: Custom Node.js script
**Location**: `scripts/load-test-phase4c.js`
**Focus**: Performance validation under load
**Execution**: `node scripts/load-test-phase4c.js [leads/min] [duration]`

**Metrics Captured**:

- P95 latency
- Success rate
- Throughput
- Resource usage
- Cipher performance

## Evidence Capture

### Automatic Evidence Collection

All test runs automatically capture evidence in `docs/EVIDENCE/`:

```
docs/EVIDENCE/
├── unit/           # Unit test coverage reports
├── integration/    # API response logs, contract validations
├── e2e/           # Screenshots, videos, traces
├── api/           # Newman test results, performance data
├── load/          # Performance benchmarks, resource metrics
└── security/      # Vulnerability scans, compliance checks
```

### Evidence Scripts

```bash
# Capture evidence for current test run
node scripts/capture-evidence.js [test-type] [run-id]

# Generate evidence summary
node scripts/capture-evidence.js summary
```

### Evidence Quality Standards

- **Completeness**: Include all artifacts (logs, screenshots, traces)
- **Context**: Environment details, configuration, timestamps
- **Analysis**: Automated analysis with recommendations
- **Retention**: 6 months for regular tests, indefinite for critical issues

## Writing Tests

### Test File Organization

```
apps/core-api/src/
├── feature/
│   ├── feature.service.ts
│   ├── feature.controller.ts
│   └── __tests__/
│       ├── feature.service.spec.ts      # Unit tests
│       ├── feature.controller.spec.ts   # Unit tests
│       └── feature.integration.spec.ts  # Integration tests

apps/core-api/test/
├── e2e/                                 # E2E tests
├── integration/                         # Cross-service tests
└── contract/                           # Contract validation
```

### Test Naming Conventions

```typescript
// Unit tests
describe('FeatureService', () => {
  describe('processData', () => {
    it('should return processed data when input is valid', () => {
      // Test implementation
    });

    it('should throw error when input is invalid', () => {
      // Test implementation
    });
  });
});

// E2E tests
test.describe('Lead Management Flow', () => {
  test('should create and qualify lead successfully', async ({ page }) => {
    // Test implementation
  });
});
```

### Mocking Strategy

```typescript
// External dependencies
const mockCipherService = {
  checkDecision: vi.fn().mockResolvedValue({
    allowed: true,
    action: 'allow',
    reason: 'Test decision',
  }),
};

// Database operations
const mockRepository = {
  findOne: vi.fn(),
  save: vi.fn(),
  create: vi.fn(),
};
```

### Test Data Management

```typescript
// Test fixtures
const testLead = {
  id: 'test-lead-001',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  score: 75,
};

// Factory functions
function createTestLead(overrides = {}) {
  return { ...testLead, ...overrides };
}

// Cleanup utilities
afterEach(async () => {
  await cleanupTestData();
});
```

## CI/CD Integration

### GitHub Actions Workflows

- **Unit Tests**: Run on every push/PR
- **Integration Tests**: Run on PR creation
- **E2E Tests**: Run on merge to main
- **API Tests**: Run on API changes
- **Load Tests**: Run weekly and before releases
- **Security Tests**: Run on security changes

### Quality Gates

```yaml
# PR Quality Checks
- name: Test Coverage
  run: npm run test:coverage
  # Require >=85% coverage

- name: Lint Check
  run: npm run lint

- name: Type Check
  run: npm run typecheck

- name: Evidence Validation
  run: node scripts/validate-evidence.js
```

## Debugging Tests

### Playwright Debugging

```bash
# Run with UI mode
npm run test:e2e:ui

# Debug specific test
npm run test:e2e -- --debug --grep "lead qualification"

# View traces
npx playwright show-trace test-results/trace.zip
```

### Cypress Debugging

```bash
# Open Cypress UI
npm run test:cypress:open

# Run with video recording
npm run test:cypress -- --record
```

### Vitest Debugging

```bash
# Watch mode
npm run test:watch

# Debug specific file
npm run test -- apps/core-api/src/sales/advanced-scoring.service.spec.ts
```

## Performance Testing

### Load Test Scenarios

```bash
# Basic load test (15 leads/min for 2 min)
node scripts/load-test-phase4c.js 15 2

# Stress test (50 leads/min for 5 min)
node scripts/load-test-phase4c.js 50 5

# Spike test (100 leads/min for 30 sec)
node scripts/load-test-phase4c.js 100 0.5
```

### Performance Thresholds

- **P95 Latency**: <500ms
- **Success Rate**: >99.5%
- **Throughput**: >10 leads/min
- **Memory Usage**: <100MB per instance

### Profiling Integration

```bash
# Performance profiling in CI
npm run test:performance

# Memory leak detection
npm run test:memory

# CPU profiling
npm run test:cpu
```

## Security Testing

### Security Test Categories

- **Authentication**: Invalid credentials, session management
- **Authorization**: Role-based access, privilege escalation
- **Input Validation**: SQL injection, XSS, CSRF
- **API Security**: Rate limiting, CORS, headers
- **Data Protection**: Encryption, PII handling

### Security Test Examples

```typescript
// Authentication testing
test('should reject invalid login attempts', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'invalid@example.com', password: 'wrong' });

  expect(response.status).toBe(401);
});

// Rate limiting
test('should enforce rate limits', async () => {
  // Make multiple requests rapidly
  const requests = Array(100)
    .fill()
    .map(() => request(app).get('/api/leads'));

  const responses = await Promise.all(requests);
  const rateLimited = responses.filter(r => r.status === 429);

  expect(rateLimited.length).toBeGreaterThan(0);
});
```

## Best Practices

### Code Quality

- **Test First**: Write tests before implementation (TDD)
- **Single Responsibility**: Each test validates one behavior
- **Independent Tests**: Tests don't depend on each other
- **Fast Feedback**: Tests run quickly for rapid development

### Maintenance

- **Regular Updates**: Keep tests in sync with code changes
- **Refactor Tests**: Improve test readability and maintainability
- **Remove Obsolete Tests**: Delete tests for removed features
- **Document Complex Tests**: Explain business logic in comments

### Troubleshooting

- **Flaky Tests**: Identify and fix intermittent failures
- **Slow Tests**: Optimize or move to appropriate level
- **False Positives**: Ensure tests fail only on real issues
- **Coverage Gaps**: Identify and test uncovered code paths

## Contributing

### Adding New Tests

1. **Identify Test Type**: Unit, integration, or E2E
2. **Follow Conventions**: Naming, structure, and organization
3. **Add Evidence**: Ensure evidence capture works
4. **Update Documentation**: Add to traceability and guides
5. **CI Validation**: Ensure tests pass in CI environment

### Test Coverage Requirements

- **New Features**: 100% coverage required
- **Bug Fixes**: Include regression test
- **Critical Paths**: 90%+ coverage
- **Overall Project**: 85%+ maintained

## Support

### Getting Help

- **Test Failures**: Check CI logs and evidence files
- **Evidence Issues**: Run `node scripts/capture-evidence.js`
- **Performance Issues**: Review load test reports
- **New Test Types**: Consult this guide and team standards

### Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Cypress Documentation](https://docs.cypress.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Postman Learning Center](https://learning.postman.com/)
- [Testing Pyramid](https://martinfowler.com/bliki/TestPyramid.html)
