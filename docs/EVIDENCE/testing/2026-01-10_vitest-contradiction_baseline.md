# Vitest Contradiction Baseline

**Date**: 2026-01-10
**Issue**: Vitest config has include/exclude contradiction for tests/unit and tests/contract
**Baseline Coverage**: 10.44% lines, 40.7% functions, 55.98% branches, 10.44% statements

## Vitest Config Contradiction Proof

**Command**: `rg -n "tests/unit/\*\*/\*\.spec\.ts|tests/contract/\*\*/\*\.spec\.ts" vitest.config.ts`

**Results**:

```
vitest.config.ts:11:      'tests/unit/**/*.spec.ts',
vitest.config.ts:13:      'tests/contract/**/*.spec.ts',
vitest.config.ts:26:      'tests/unit/**/*.spec.ts',
vitest.config.ts:27:      'tests/contract/**/*.spec.ts',
```

**Contradiction**: Same patterns appear in both include (lines 11, 13) and exclude (lines 26, 27) arrays.

## Coverage Include/Exclude Analysis

**Current Coverage Include** (lines 34-37):

```
include: [
  'apps/core-api/src/**/*.ts',
  'packages/**/*.ts',
],
```

**Issue**: Coverage includes `apps/core-api/src/**/*.ts` but Vitest doesn't run those tests (Jest does). This inflates coverage denominator with untested code, making 85% threshold impossible.

## Coverage Output Baseline

**Command**: `npm run test:coverage 2>&1 | tail -60`

**Key Results**:

```
=============================== Coverage summary ===============================
Statements   : 10.44% ( 5752/55070 )
Branches     : 55.98% ( 814/1454 )
Functions    : 40.7% ( 383/941 )
Lines        : 10.44% ( 5752/55070 )
================================================================================
ERROR: Coverage for lines (10.44%) does not meet global threshold (85%)
ERROR: Coverage for functions (40.7%) does not meet global threshold (85%)
ERROR: Coverage for statements (10.44%) does not meet global threshold (85%)
ERROR: Coverage for branches (55.98%) does not meet global threshold (85%)
```

**Analysis**: 55,070 lines in denominator but only 5,752 covered. This suggests coverage is measuring untested code (apps/core-api) against Vitest-executed tests (packages only).

## SSOT Alignment Check

Per docs/SSOT/04_TEST_STRATEGY.md:

- Vitest: packages/**, tests/unit/**, tests/contract/\*\*
- Jest: apps/core-api/src/**/**tests**/**
- Coverage should align with actual test execution scope

**Gap**: Coverage includes apps/core-api but excludes the tests that would cover it.
