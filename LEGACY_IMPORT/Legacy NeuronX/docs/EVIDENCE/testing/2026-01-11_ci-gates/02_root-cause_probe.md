# PHASE 1 - ROOT CAUSE PROBE

## Failing Test File Analysis

**File**: `apps/core-api/src/rate-limit/__tests__/webhook-ordering.spec.ts`

### Issue 1: GHL Controller Bug - Invalid Response Usage

**Location**: `apps/core-api/src/integrations/ghl/ghl-webhook.controller.ts:129`
**Code**:

```typescript
return res.status(HttpStatus.OK).json({
  status: 'processed',
  eventId: result.event?.metadata.correlationId,
  processingTime,
});
```

**Problem**: Method tries to use `res` (response object) but it's not in the method signature. Controllers should return objects directly, not manipulate response objects.

**Evidence**:

```bash
$ rg -n "return res\." apps/core-api/src/integrations/ghl/ghl-webhook.controller.ts
129:      return res.status(HttpStatus.OK).json({
```

### Issue 2: Mock Setup Inconsistency

**Location**: `webhook-ordering.spec.ts:24-34` (top-level mocks) vs `beforeEach:71-117` (NestJS module mocks)

**Problem**: Tests mock controllers globally but then create NestJS testing modules with different mock instances. The tests call methods expecting promises, but mocked methods return `undefined`.

**Evidence**:

- Top-level mock: `jest.mock('../../integrations/ghl/ghl-webhook.controller', () => ({ GhlWebhookController: jest.fn().mockImplementation(() => ({ processWebhook: jest.fn() })) }));`
- NestJS module creates separate instances
- Test expects: `).rejects.toThrow()` (requires promise)
- Mock returns: `undefined` (not a promise)

### Issue 3: validHeaders Scope Issue

**Location**: `webhook-ordering.spec.ts:322-379` (Security Guarantees tests)

**Problem**: Tests reference `validHeaders` defined in "GHL Webhook Controller Ordering" describe block (line 124), but it's not in scope for "Security Guarantees" block.

**Evidence**:

```bash
$ nl -ba apps/core-api/src/rate-limit/__tests__/webhook-ordering.spec.ts | sed -n '124p;335p;360p'
   124    const validHeaders = {
   335          { ...validHeaders, 'x-webhook-signature': 'invalid' },
   360          { ...validHeaders, 'x-webhook-signature': 'invalid' },
```

### Issue 4: Test Method Signature Mismatch

**Problem**: Tests call controller methods with different signatures than the actual controllers:

**GHL Controller actual signature**:

```typescript
async processWebhook(
  @Body() payload: any,
  @Headers() headers: Record<string, string>,
  @Req() req: Request,
)
```

**Test calls**:

```typescript
ghlController.processWebhook(
  { event: 'contact.created' }, // payload
  validHeaders, // headers
  mockRequest as any // req
);
// Missing: response object (res) parameter
```

## Root Cause Determination

### Category: (d) unstable mocks / undefined test variables + (b) import-time NestJS decorator execution

**Primary Issue**: Mock setup creates confusion between global mocks and NestJS module mocks, plus actual controller has runtime bugs.

**Secondary Issue**: Test variable scoping and method signature mismatches.

## Minimal Fix Path

1. **Fix GHL Controller**: Remove invalid `res.status()` usage
2. **Fix Mock Setup**: Use consistent mocking approach (prefer NestJS module mocks)
3. **Fix Variable Scope**: Define `validHeaders` in Security Guarantees block
4. **Fix Method Signatures**: Update test calls to match actual controller signatures

## Commands Used for Analysis

```bash
# Find the response object bug
$ rg -n "return res\." apps/core-api/src/integrations/ghl/ghl-webhook.controller.ts

# Check variable scoping
$ nl -ba apps/core-api/src/rate-limit/__tests__/webhook-ordering.spec.ts | sed -n '124p;335p;360p'

# Verify controller method signatures
$ rg -A 5 "async processWebhook" apps/core-api/src/integrations/ghl/ghl-webhook.controller.ts
$ rg -A 5 "async handleStripeWebhook" apps/core-api/src/payments/webhooks/payment-webhook.controller.ts
```
