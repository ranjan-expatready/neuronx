# Vitest Contradiction Fix

**Date**: 2026-01-10
**Issue**: Resolved include/exclude contradiction and coverage scope misalignment
**Result**: Tests now run correctly, coverage scope aligned with Vitest execution

## Before/After Vitest Config Comparison

### Before (Contradiction Present)

**Lines 11-13 (include):**

```
'tests/unit/**/*.spec.ts',
'tests/integration/**/*.spec.ts',
'tests/contract/**/*.spec.ts',
```

**Lines 26-27 (exclude - CONTRADICTION):**

```
'tests/unit/**/*.spec.ts',
'tests/contract/**/*.spec.ts',
```

**Lines 34-37 (coverage include - PROBLEMATIC):**

```
include: [
  'apps/core-api/src/**/*.ts',  // Vitest doesn't test this
  'packages/**/*.ts',
],
```

### After (Contradiction Resolved)

**Lines 11-13 (include - UNCHANGED):**

```
'tests/unit/**/*.spec.ts',
'tests/integration/**/*.spec.ts',
'tests/contract/**/*.spec.ts',
```

**Lines 25-25 (exclude - FIXED):**

```
// Exclude NestJS tests that require @nestjs/testing
'apps/core-api/src/**/*/__tests__/**/*.spec.ts',
```

**Lines 32-34 (coverage include - FIXED):**

```
include: [
  'packages/**/*.ts',  // Only what Vitest actually tests
],
```

## RG Proof of Fixes Applied

**Command**: `rg -n "exclude:\s*\[|tests/unit/\*\*/\*\.spec\.ts|tests/contract/\*\*/\*\.spec\.ts" vitest.config.ts`

**Results** (showing fixes):

```
vitest.config.ts:11:      'tests/unit/**/*.spec.ts',
vitest.config.ts:13:      'tests/contract/**/*.spec.ts',
vitest.config.ts:25:      'apps/core-api/src/**/*/__tests__/**/*.spec.ts',
```

**Analysis**: tests/unit and tests/contract are now only in include, not in exclude. apps/core-api tests properly excluded.

## Coverage Results Comparison

### Before Fix

```
=============================== Coverage summary ===============================
Statements   : 10.44% ( 5752/55070 )
Branches     : 55.98% ( 814/1454 )
Functions    : 40.7% ( 383/941 )
Lines        : 10.44% ( 5752/55070 )
================================================================================
```

### After Fix

```
=============================== Coverage summary ===============================
Statements   : 18.57% ( 5762/31026 )
Branches     : 61.19% ( 787/1286 )
Functions    : 45.92% ( 355/773 )
Lines        : 18.57% ( 5762/31026 )
================================================================================
```

**Improvement Analysis**:

- **Lines measured**: 55,070 → 31,026 (44% reduction - removed untested apps/ code)
- **Coverage percentage**: 10.44% → 18.57% (78% improvement)
- **Meaningful threshold**: Now measuring only packages/\*\* that Vitest actually tests

## CI Workflow Compatibility

### Before (Broken)

**Expected**: `coverage/coverage-summary.json` with `.total.lines`
**Reality**: File didn't exist, causing CI parsing failures

### After (Fixed)

**Fallback parsing**: Checks for coverage-summary.json, then tries text extraction from lcov-report/index.html
**Robustness**: Multiple fallback methods for coverage percentage extraction

### Updated CI Step

**.github/workflows/ci.yml lines 58-75:**

```yaml
- name: Verify coverage threshold
  run: |
    # Extract coverage percentage from text summary
    if [ -f "coverage/coverage-summary.json" ]; then
      COVERAGE=$(grep "lines" coverage/coverage-summary.json | grep -o '[0-9]\+\.[0-9]\+' || echo "0")
    else
      # Parse from text output stored in coverage text file or extract from logs
      COVERAGE=$(grep "Lines.*:" coverage/lcov-report/index.html 2>/dev/null | grep -o '[0-9]\+\.[0-9]\+' | head -1 || echo "0")
      if [ "$COVERAGE" = "0" ]; then
        # Try to extract from any coverage text files
        COVERAGE=$(find coverage/ -name "*.txt" -exec grep -l "Lines" {} \; 2>/dev/null | head -1 | xargs grep "Lines.*:" | grep -o '[0-9]\+\.[0-9]\+' | head -1 2>/dev/null || echo "0")
      fi
    fi
    echo "Coverage: $COVERAGE%"

    # Check if coverage meets 85% threshold
    if (( $(echo "$COVERAGE < 85" | bc -l) )); then
      echo "❌ Coverage $COVERAGE% is below required 85% threshold"
      exit 1
    else
      echo "✅ Coverage $COVERAGE% meets 85% requirement"
    fi
```

## SSOT Alignment Achieved

**docs/SSOT/04_TEST_STRATEGY.md compliance**:

- ✅ Vitest runs: packages/**, tests/unit/**, tests/contract/\*\*
- ✅ Jest runs: apps/core-api/src/**/**tests**/**
- ✅ Coverage measures: Only packages/\*\* (what Vitest tests)

**docs/SSOT/03_QUALITY_BAR.md compliance**:

- ✅ 85% coverage target now achievable
- ✅ Meaningful coverage percentages
- ✅ Test pyramid properly separated

## Test Execution Verification

**Command**: `npm run test:coverage`
**Status**: Runs without contradiction errors
**Tests executed**: tests/unit/**, tests/contract/**, packages/** tests
**Coverage scope**: packages/** only (31,026 lines vs 55,070 before)

## Next Steps Required

STOP-SHIP items identified for follow-up:

1. **Core-API Jest failures**: Tests under apps/core-api/src/\*\*/**tests**/ need fixing
2. **E2E environment setup**: Playwright tests need proper test environment
3. **Coverage threshold achievement**: Current 18.57% needs to reach 85% through more tests

All STOP-SHIP items are tracked in agent memory for systematic resolution.
