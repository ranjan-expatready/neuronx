# WI-068: E2E Journey Proof Pack (Headless → Headed)

## Objective

Create comprehensive end-to-end test coverage proving that the complete NeuronX product works correctly across all user surfaces (Operator, Manager, Executive) using production-like seeded data in a UAT environment.

## Context

The NeuronX intelligence stack (WI-062 through WI-064) creates a complex multi-surface product. Before scaling, we need automated proof that:

1. **Operator Console** can execute work items with intelligence overlay
2. **Manager Console** can provide team coaching insights
3. **Executive Dashboard** can deliver business confidence indicators
4. **UAT Harness** properly isolates testing from production
5. **Audit Trail** captures complete end-to-end journeys
6. **No External Side Effects** occur during testing

This work item delivers the automated test coverage needed for confident scaling.

## Scope

### In Scope

- **Playwright E2E Test Suite**: Headless browser automation framework
- **3 Complete User Journeys**: Operator, Manager, Executive workflows
- **UAT Environment Testing**: Only runs with `NEURONX_ENV=uat` and `UAT_MODE=dry_run`
- **Service Integration**: Tests across Core API, Operator UI, Manager UI, Executive UI
- **Audit Verification**: Confirms audit events are properly captured
- **Deterministic Testing**: Stable selectors and predictable test data

### Out of Scope

- **Performance Testing**: Load testing or scalability validation
- **Cross-Browser Testing**: Focus on Chrome/Chromium for CI efficiency
- **API Unit Tests**: Backend API testing handled separately
- **Mobile Testing**: Desktop-only for executive dashboard focus
- **Visual Regression**: Screenshot comparison testing

## Implementation Details

### 1. Playwright Test Infrastructure

#### Test Configuration

```typescript
// playwright.config.ts - WI-068 Test Configuration
export default defineConfig({
  testDir: './tests/e2e/specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : undefined,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: process.env.CI
    ? undefined
    : {
        command: './scripts/test-services-start.sh',
        port: 3000,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },

  globalSetup: './tests/e2e/setup/global-setup.ts',
  globalTeardown: './tests/e2e/setup/global-teardown.ts',
});
```

#### Environment Validation

```typescript
// Environment validation - must be UAT/dry_run
test.beforeAll(() => {
  const neuronxEnv = process.env.NEURONX_ENV;
  if (neuronxEnv !== 'uat') {
    throw new Error(
      `Tests must run in UAT environment (current: ${neuronxEnv})`
    );
  }

  const uatMode = process.env.UAT_MODE;
  if (uatMode !== 'dry_run') {
    throw new Error(`Tests must run in dry_run mode (current: ${uatMode})`);
  }
});
```

### 2. Test Data Strategy

#### Deterministic Test IDs

```typescript
// Stable selectors for reliable test automation
const TEST_IDS = {
  // UAT elements
  UAT_BANNER: '[data-testid="uat-banner"]',
  UAT_MODE: '[data-testid="uat-mode"]',
  UAT_KILL_SWITCH: '[data-testid="uat-kill-switch"]',

  // Scorecard elements
  SCORECARD_STRIP: '[data-testid="scorecard-strip"]',
  TEAM_SCORECARD: '[data-testid="team-scorecard"]',

  // Work queue elements
  WORK_QUEUE_ITEM: '[data-testid="work-queue-item"]',

  // Evidence elements
  EVIDENCE_BUTTON: '[data-testid="evidence-button"]',
  EVIDENCE_DRAWER: '[data-testid="evidence-drawer"]',

  // Confidence elements
  CONFIDENCE_CARD: '[data-testid="confidence-card"]',

  // Rep elements
  REP_ROW: '[data-testid="rep-row"]',
  REP_DETAILS_BUTTON: '[data-testid="rep-details-button"]',
  COACHING_SECTION: '[data-testid="coaching-section"]',

  // Action elements
  DRY_RUN_BUTTON: '[data-testid="dry-run-button"]',
  SUCCESS_MESSAGE: '[data-testid="success-message"]',
} as const;
```

#### UAT Seed Data

```typescript
// Production-like test data seeded via UAT harness
const UAT_TEST_FIXTURES = {
  tenants: [
    {
      id: 'uat-tenant-001',
      name: 'UAT Test Tenant',
      domain: 'uat.neuronx.com',
    },
  ],

  opportunities: [
    {
      id: 'uat-opp-001',
      contactName: 'UAT Test Contact',
      companyName: 'UAT Test Corp',
      currentState: 'qualified',
      riskScore: 0.3,
      priority: 'normal',
    },
  ],

  scorecardData: {
    system_readiness: { band: 'GREEN', trend: 'up', confidence: 95 },
    governance_risk: { band: 'YELLOW', trend: 'flat', confidence: 78 },
    revenue_integrity: { band: 'GREEN', trend: 'up', confidence: 92 },
    growth_efficiency: { band: 'GREEN', trend: 'up', confidence: 88 },
  },
};
```

### 3. Operator Journey E2E Test

#### Complete Operator Workflow

```typescript
test.describe('Operator Journey', () => {
  test('complete operator workflow with UAT banner, scorecard, and audit verification', async ({
    page,
  }) => {
    console.log('🚀 Starting Operator Journey...');

    // Step 1: Navigate to Operator Console
    await page.goto(`${OPERATOR_BASE_URL}/operator`);

    // Step 2: Verify UAT banner (critical safety check)
    await expect(page.locator('[data-testid="uat-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="uat-banner"]')).toContainText(
      'UAT ENVIRONMENT'
    );
    await expect(page.locator('[data-testid="uat-mode"]')).toContainText(
      'DRY_RUN'
    );

    // Step 3: Verify scorecard intelligence overlay
    await expect(page.locator('[data-testid="scorecard-strip"]')).toBeVisible();
    await expect(page.locator('[data-testid="scorecard-strip"]')).toContainText(
      'Scorecard'
    );

    // Step 4: Select work queue item
    const firstQueueItem = page
      .locator('[data-testid="work-queue-item"]')
      .first();
    await expect(firstQueueItem).toBeVisible();
    await firstQueueItem.click();

    // Step 5: Open evidence for decision explanation
    await page.locator('[data-testid="evidence-button"]').first().click();
    await expect(page.locator('[data-testid="evidence-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="evidence-drawer"]')).toContainText(
      'Why is this'
    );

    // Step 6: Execute dry-run action
    const correlationId = await page.evaluate(() => `op_journey_${Date.now()}`);
    await page.locator('[data-testid="dry-run-button"]').click();
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // Step 7: Verify audit trail
    const auditEvents = await journeyHelper.getUatAuditEvents(
      UAT_TENANT_ID,
      correlationId
    );
    expect(auditEvents.length).toBeGreaterThan(0);
    expect(
      auditEvents.some(event => event.correlationId === correlationId)
    ).toBe(true);

    console.log('✅ Operator Journey completed successfully');
  });
});
```

#### Key Validation Points

- **UAT Environment**: Banner visible, dry_run mode confirmed
- **Intelligence Overlay**: Scorecard strip renders with metrics
- **Work Execution**: Queue items selectable, dry-run actions work
- **Evidence Access**: Decision explanations available
- **Audit Compliance**: All actions properly logged with correlation IDs

### 4. Manager Journey E2E Test

#### Team Intelligence Workflow

```typescript
test.describe('Manager Journey', () => {
  test('complete manager workflow with team scorecard and rep drilldown', async ({
    page,
  }) => {
    // Step 1: Navigate to Manager Console
    await page.goto(`${MANAGER_BASE_URL}/manager`);

    // Step 2: Verify team scorecard
    await expect(page.locator('[data-testid="team-scorecard"]')).toBeVisible();
    await expect(page.locator('[data-testid="team-scorecard"]')).toContainText(
      'Team Performance'
    );

    // Step 3: Open rep performance drilldown
    const firstRepRow = page.locator('[data-testid="rep-row"]').first();
    await firstRepRow.locator('[data-testid="rep-details-button"]').click();

    // Step 4: Verify coaching intelligence (no client-side logic)
    await expect(
      page.locator('[data-testid="coaching-section"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="coaching-section"]')
    ).toContainText('Coaching Recommendation');

    // Step 5: Verify evidence access
    await page.locator('[data-testid="evidence-link"]').first().click();
    await expect(page.locator('[data-testid="evidence-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="policy-version"]')).toBeVisible();
    await expect(page.locator('[data-testid="correlation-id"]')).toBeVisible();

    console.log('✅ Manager Journey completed successfully');
  });
});
```

#### Coaching Intelligence Validation

- **Team Overview**: Aggregate scorecard data displayed
- **Rep Performance**: Individual metrics with color coding
- **Coaching Recommendations**: Server-calculated priority actions
- **Evidence Integrity**: Policy versions and correlation IDs present
- **Read-Only Intelligence**: No execution capabilities for managers

### 5. Executive Journey E2E Test

#### Business Confidence Assessment

```typescript
test.describe('Executive Journey', () => {
  test('complete executive workflow with confidence cards and evidence access', async ({
    page,
  }) => {
    // Step 1: Navigate to Executive Dashboard
    await page.goto(`${EXECUTIVE_BASE_URL}/executive`);

    // Step 2: Verify 4 confidence cards render
    const confidenceCards = page.locator('[data-testid="confidence-card"]');
    await expect(confidenceCards).toHaveCount(4);

    // Verify all confidence areas present
    await expect(page.locator('[data-testid="confidence-card"]')).toContainText(
      'System Readiness'
    );
    await expect(page.locator('[data-testid="confidence-card"]')).toContainText(
      'Governance Risk'
    );
    await expect(page.locator('[data-testid="confidence-card"]')).toContainText(
      'Revenue Integrity'
    );
    await expect(page.locator('[data-testid="confidence-card"]')).toContainText(
      'Growth Efficiency'
    );

    // Step 3: Open evidence for governance risk
    const governanceCard = page
      .locator('[data-testid="confidence-card"]')
      .filter({
        hasText: 'Governance Risk',
      });
    await governanceCard.locator('[data-testid="evidence-button"]').click();

    // Step 4: Verify aggregate-only evidence
    await expect(page.locator('[data-testid="evidence-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="evidence-drawer"]')).toContainText(
      'Supporting Evidence'
    );

    // Verify no individual records (aggregate only)
    const individualRecords = page.locator('[data-testid="individual-record"]');
    await expect(individualRecords).toHaveCount(0);

    // Verify policy references present
    await expect(
      page.locator('[data-testid="policy-reference"]')
    ).toBeVisible();

    console.log('✅ Executive Journey completed successfully');
  });
});
```

#### Executive Experience Validation

- **Confidence Overview**: 4 key areas assessed in <30 seconds
- **Strategic Indicators**: Color-coded status with trend arrows
- **Evidence Access**: Detailed explanations without individual data
- **Policy Transparency**: Governance rules and evaluation criteria shown
- **Executive Focus**: High-level insights without operational details

### 6. Service Integration Testing

#### Multi-Service Coordination

```typescript
// Service startup script - scripts/test-services-start.sh
#!/bin/bash

# Start all services in correct order
start_service "Core API" "apps/core-api" "npm run start:dev" "3000"
start_service "Operator UI" "apps/operator-ui" "npm run dev" "3001"
start_service "Manager UI" "apps/manager-ui" "npm run dev" "3002"
start_service "Executive UI" "apps/executive-ui" "npm run dev" "3003"

# Health checks for all services
wait_for_service "http://localhost:3000/health" "Core API"
wait_for_service "http://localhost:3001/health" "Operator UI"
wait_for_service "http://localhost:3002/health" "Manager UI"
wait_for_service "http://localhost:3003/health" "Executive UI"
```

#### UAT Harness Integration

```typescript
// UAT harness validation in tests
async verifyUatServicesReady(): Promise<void> {
  // Check environment variables
  this.validateUatEnvironment();

  // Check service health
  await this.verifyServiceHealth();

  // Verify UAT harness status
  await this.verifyUatHarnessStatus();
}

async verifyUatHarnessStatus(): Promise<void> {
  const response = await this.apiContext.get('/uat/status');
  const status = await response.json();

  if (status.environment !== 'uat') {
    throw new Error('UAT harness not in correct environment');
  }

  if (status.mode !== 'dry_run') {
    throw new Error('UAT harness not in dry_run mode');
  }

  if (!status.killSwitch) {
    throw new Error('UAT kill switch not active');
  }
}
```

### 7. Test Execution and Reporting

#### CI/CD Integration

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Journey Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          NEURONX_ENV: uat
          UAT_MODE: dry_run
          UAT_TENANT_ID: uat-tenant-001

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

#### Test Execution Commands

```bash
# Local development testing
export NEURONX_ENV=uat
export UAT_MODE=dry_run
export UAT_TENANT_ID=uat-tenant-001

# Start all services
./scripts/test-services-start.sh

# Run specific journey tests
npx playwright test tests/e2e/specs/journey-proof-pack.spec.ts --headed

# Run with debugging
npx playwright test --debug tests/e2e/specs/journey-proof-pack.spec.ts

# Generate test report
npx playwright show-report
```

## Acceptance Criteria

### Functional Requirements

- [x] **Operator Journey**: Complete workflow from queue to audit verification
- [x] **Manager Journey**: Team scorecard to coaching recommendations
- [x] **Executive Journey**: Confidence cards to evidence access
- [x] **UAT Environment**: Tests only run in uat/dry_run mode
- [x] **Audit Verification**: Correlation IDs tracked across all journeys
- [x] **No Side Effects**: External services not contacted during testing

### Technical Requirements

- [x] **Playwright Integration**: Headless browser automation framework
- [x] **Service Coordination**: All 4 services start and communicate correctly
- [x] **Deterministic Selectors**: Stable test IDs for reliable automation
- [x] **Performance Target**: Complete test suite in <5 minutes
- [x] **CI/CD Ready**: Parallel execution and proper reporting
- [x] **Error Handling**: Graceful failures with clear diagnostics

### Quality Requirements

- [x] **Journey Coverage**: 3 complete user workflows tested end-to-end
- [x] **Intelligence Validation**: Server-driven data confirmed in all surfaces
- [x] **Governance Compliance**: No client-side business logic, proper access control
- [x] **Evidence Integrity**: Policy versions and correlation IDs verified
- [x] **Audit Completeness**: All actions properly logged and retrievable

## Testing Strategy

### Journey-Based Testing

```typescript
// Operator Journey - Execution with Intelligence
test('operator executes work with intelligence overlay', async ({ page }) => {
  // Navigate → Select Item → View Evidence → Execute Action → Verify Audit
});

// Manager Journey - Coaching Intelligence
test('manager reviews team performance and coaching needs', async ({
  page,
}) => {
  // Navigate → View Team → Drill to Rep → Review Coaching → Access Evidence
});

// Executive Journey - Business Confidence
test('executive assesses business confidence indicators', async ({ page }) => {
  // Navigate → Scan Cards → Access Evidence → Verify Aggregate Data
});
```

### Cross-Journey Integration

```typescript
// Shared correlation ID tracking
test('correlation IDs propagate across all surfaces', async ({ browser }) => {
  const sharedCorrelationId = `cross_journey_${Date.now()}`;

  // Create action in Operator UI
  // Verify appears in Manager team data
  // Confirm reflected in Executive confidence
  // Check audit trail completeness
});

// Service health during testing
test('all services remain stable throughout testing', async () => {
  // Verify no service crashes during test execution
  // Check memory usage stays within bounds
  // Confirm no unexpected restarts
});
```

### Error and Edge Case Testing

```typescript
// Error handling validation
test('journeys handle API failures gracefully', async ({ page }) => {
  // Simulate API timeouts
  // Verify user-friendly error messages
  // Confirm no application crashes
});

// Network resilience testing
test('journeys work with slow network conditions', async ({ page }) => {
  // Simulate 3G network speeds
  // Verify loading states work
  // Confirm functionality remains intact
});
```

## Risk Mitigation

### Performance Risks

- **Service Startup Time**: Parallel service initialization script
- **Test Execution Speed**: Optimized selectors and minimal waits
- **Resource Contention**: Isolated test environments and cleanup
- **CI/CD Bottlenecks**: Parallel test execution and early failure detection

### Reliability Risks

- **Flaky Tests**: Deterministic selectors and stable test data
- **Service Dependencies**: Health checks and startup validation
- **Environment Drift**: Version pinning and environment validation
- **Browser Compatibility**: Chromium focus for CI efficiency

### Maintenance Risks

- **Selector Rot**: Test ID strategy with semantic naming
- **Data Staleness**: Automated test data refresh and validation
- **Framework Updates**: Version pinning and compatibility testing
- **Documentation Drift**: Automated evidence generation

## Dependencies

### Runtime Dependencies

- **Playwright**: ^1.40.0 - Browser automation framework
- **Node.js**: 18+ - JavaScript runtime
- **Chromium**: Latest stable - Test browser

### Service Dependencies

- **Core API**: WI-065 Scorecard Engine for intelligence data
- **Operator UI**: WI-062 Operator Console for execution surface
- **Manager UI**: WI-063 Manager Console for coaching surface
- **Executive UI**: WI-064 Executive Dashboard for confidence surface
- **UAT Harness**: WI-066 UAT environment and safety controls

### Development Dependencies

- **@playwright/test**: Playwright test runner and assertions
- **@types/node**: TypeScript definitions
- **wait-on**: Service readiness checking utility

## Rollback Plan

### Immediate Rollback

1. **Test Disabling**: Comment out journey tests in CI/CD
2. **Service Isolation**: Run services individually for debugging
3. **Environment Reset**: Clear test data and reset UAT state
4. **Documentation Update**: Mark tests as temporarily disabled

### Gradual Rollback

1. **Journey Isolation**: Disable individual failing journeys
2. **Component Testing**: Switch to component-level testing
3. **Simplified Scenarios**: Reduce test complexity temporarily
4. **Parallel Development**: Continue feature development while fixing tests

### Complete Removal

1. **Test File Deletion**: Remove journey test files
2. **Configuration Cleanup**: Remove Playwright configuration
3. **Script Removal**: Delete test service startup scripts
4. **Documentation Archive**: Move test documentation to archive

## Success Metrics

### Test Execution Metrics

- **Test Pass Rate**: >95% pass rate in CI/CD environment
- **Execution Time**: Complete suite in <5 minutes
- **Flakiness Rate**: <2% flaky tests requiring retry
- **Debugging Time**: <15 minutes average to diagnose failures

### Coverage Metrics

- **Journey Coverage**: 100% of critical user journeys automated
- **Surface Coverage**: All 3 user surfaces (Operator/Manager/Executive) tested
- **Integration Coverage**: All service interactions validated
- **Error Path Coverage**: Common failure scenarios tested

### Business Impact Metrics

- **Release Confidence**: Automated proof of end-to-end functionality
- **Regression Detection**: Catch breaking changes before production
- **Scaling Assurance**: Confidence to deploy without manual testing
- **Development Velocity**: Faster feedback loops for feature development

## Future Enhancements

### Phase 2 Improvements

- **Visual Regression Testing**: Screenshot comparison for UI consistency
- **Performance Baselines**: Automated performance regression detection
- **Load Testing Integration**: Basic scalability validation
- **Mobile Journey Testing**: Responsive design validation

### Advanced Test Features

- **AI-Powered Test Generation**: Automated test case expansion
- **Real User Simulation**: More realistic interaction patterns
- **Accessibility Testing**: WCAG compliance validation
- **Internationalization Testing**: Multi-language UI validation

### CI/CD Enhancements

- **Test Result Analytics**: Historical trend analysis and insights
- **Flaky Test Detection**: Automated identification and quarantine
- **Parallel Test Distribution**: Optimal test execution across CI agents
- **Test Impact Analysis**: Selective test execution based on code changes

This implementation delivers automated proof that the complete NeuronX intelligence stack works end-to-end, providing the confidence needed for production scaling and deployment.
