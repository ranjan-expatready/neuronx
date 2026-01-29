# FAILURE INDEX - GATE 1 INTEGRATION TESTS

**Test Suites**: 1 passed, 1 failed
**Tests**: 9 failed, 31 total (22 passed)
**Exit Code**: 1

## Failing Test Suite

- **File**: `apps/core-api/src/rate-limit/__tests__/webhook-ordering.spec.ts`
- **Suite**: "Webhook Security Ordering - Signature Before Rate Limit"
- **Tests Failed**: 9/9 (all tests in this suite)

## Failure Categories

### 1. Promise/Async Issues (6 tests)

**Error**: `expect(received).rejects.toThrow()` - "received value must be a promise or a function returning a promise"
**Affected Tests**:

- GHL Webhook Controller Ordering: should reject invalid signature before rate limiting is called
- GHL Webhook Controller Ordering: should reject rate limited requests after valid signature
- Payment Webhook Controller Ordering: should reject invalid signature before rate limiting is called
- Payment Webhook Controller Ordering: should reject rate limited requests after valid signature

**Root Cause**: Tests expect controller methods to return promises, but they return `undefined`

### 2. Mock Not Called (2 tests)

**Error**: `expect(jest.fn()).toHaveBeenCalledWith()` - Expected calls: 0, Received calls: 0
**Affected Tests**:

- GHL Webhook Controller Ordering: should call rate limiting after valid signature verification
- Payment Webhook Controller Ordering: should call rate limiting after valid signature verification

**Root Cause**: `mockRateLimitService.enforceWebhookRateLimit` is not being called when expected

### 3. Undefined Variable (2 tests)

**Error**: `ReferenceError: validHeaders is not defined`
**Affected Tests**:

- Security Guarantees: should prevent unauthenticated spam from consuming rate limit quota
- Security Guarantees: should only consume rate limit quota for authenticated requests

**Root Cause**: `validHeaders` variable is not defined in the test scope

## First Stack Trace Analysis

- **File**: `apps/core-api/src/rate-limit/__tests__/webhook-ordering.spec.ts:150`
- **Error**: Matcher error - received value must be a promise
- **Line**: `).rejects.toThrow(UnauthorizedException);`

This suggests the controller methods are not returning promises as expected by the async test assertions.
