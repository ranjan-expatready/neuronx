# Jest Core-API Fix Plan

## Problem Analysis

From evidence in `02_first_run_failures.txt`, the failures fall into these categories:

**BUCKET 1: Module Resolution Issues (PRIMARY - 45+ failures)**

- Root Cause: Missing dependencies and Jest configuration conflicts
- Impact: ~90% of test suites failing to start

**BUCKET 2: Missing Environment Variables (SECONDARY - 5-10 failures)**

- Root Cause: Config validator process.exit(1) when env vars missing
- Impact: Configuration validation tests failing

## Root Cause Analysis

1. **Missing @nestjs/schedule dependency**
   - Evidence: `Cannot find module '@nestjs/schedule'` in webhook.dispatcher.ts
   - Impact: webhook-delivery.spec.ts and related tests fail

2. **Jest Configuration Conflicts**
   - Root jest.config.js has `roots: ['<rootDir>/apps/core-api/src']`
   - Package jest config has `"rootDir": "src"`
   - Result: Import paths like `../../eventing` resolve incorrectly

3. **Missing tsconfig.json for core-api**
   - Evidence: No tsconfig.json in apps/core-api/
   - Impact: TypeScript path resolution fails for relative imports

4. **Environment Variable Requirements**
   - Config validator exits with code 1 when required env vars missing
   - Tests don't set up proper test environment

## Minimal Safe Patch Plan

### Fix 1: Add Missing Dependencies (Smallest Impact)

**File:** `apps/core-api/package.json`
**Change:** Add @nestjs/schedule to dependencies

```json
"dependencies": {
  "@nestjs/schedule": "^4.0.0",
  // ... existing deps
}
```

**Rationale:** Missing dependency causing module resolution failures

### Fix 2: Create Missing tsconfig.json (Path Resolution)

**File:** `apps/core-api/tsconfig.json` (NEW)
**Content:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Rationale:** Enables proper TypeScript path resolution for imports

### Fix 3: Update Jest Configuration (Resolve Conflicts)

**File:** `apps/core-api/package.json`
**Change:** Remove conflicting rootDir from jest config

```json
"jest": {
  "moduleFileExtensions": ["js", "json", "ts"],
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

**Rationale:** Remove conflicting rootDir setting, let root jest.config.js handle paths

### Fix 4: Add Test Environment Setup (Minimal)

**File:** `apps/core-api/src/setup-jest.ts` (NEW)
**Content:**

```typescript
// Set minimal test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
```

**Rationale:** Prevent config validator from exiting during tests

## Expected Outcomes

### After Fix 1 (@nestjs/schedule):

- ~5 webhook-related test suites should start running
- Expected: 5-10 fewer "Cannot find module" errors

### After Fix 2 (tsconfig.json):

- Path resolution for `../../eventing` imports should work
- Expected: 15-20 fewer module resolution failures

### After Fix 3 (Jest config cleanup):

- Import path conflicts resolved
- Expected: All remaining eventing imports work

### After Fix 4 (Test environment):

- Config validator stops process.exit(1)
- Expected: 5-10 configuration tests start running

## Verification Commands

```bash
# Install new dependency
npm install

# Run tests with coverage
npm run test:cov -- --runInBand

# Check specific problematic tests
npm test -- src/webhooks/__tests__/webhook-delivery.spec.ts
npm test -- src/voice/__tests__/voice-gating.spec.ts
npm test -- src/config/__tests__/config.persistence.spec.ts
```

## Success Criteria

- Module resolution failures reduced by 80%+
- At least 20 test suites start executing
- No more process.exit(1) from config validation
- Coverage report generates successfully

## Rollback Plan

- If issues arise, revert individual fixes one by one
- Each fix is isolated and can be reverted independently
- No database or production configuration changes
