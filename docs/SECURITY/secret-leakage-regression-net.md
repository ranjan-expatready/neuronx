# STOP-SHIP: No Secret Leakage Regression Net

**Status**: ✅ IMPLEMENTED

**Purpose**: Repository-wide test utility that catches secret leakage regressions in API responses.

## Overview

This STOP-SHIP implementation adds a comprehensive regression test net that scans all JSON API responses for forbidden secret keys. It prevents security regressions where secrets are accidentally leaked in GET responses or other non-creation endpoints.

## Forbidden Keys Monitored

The system monitors for these forbidden keys in all API responses:

```typescript
const FORBIDDEN_KEYS = [
  'apiKey', // Raw API keys
  'accessToken', // OAuth access tokens
  'refreshToken', // OAuth refresh tokens
  'tokenValue', // Generic token values
  'webhookSecret', // Webhook signing secrets
  'secretRef', // Secret references
  'secret', // Generic secrets
  'privateKey', // Private cryptographic keys
];
```

## Implementation

### 1. Core Utility (`apps/core-api/src/test-utils/assert-no-secret-keys.ts`)

**Deep Scanning Function:**

- Recursively scans objects and arrays for forbidden keys
- Detects secrets in nested structures
- Provides detailed path information for violations
- Truncates long secret values in error messages

**Whitelist System:**

- Allows specific endpoints to return certain secrets (e.g., API key creation)
- Supports wildcard patterns for endpoint matching
- Includes descriptive explanations for whitelisted exceptions

### 2. Integration Tests (`apps/core-api/src/test-utils/__tests__/no-secret-leakage.integration.spec.ts`)

**Representative Endpoints Tested:**

- `GET /health` - Basic health checks
- `GET /uat/status` - UAT status (UAT environment)
- `POST /uat/golden-run` - UAT golden run (dry_run mode)
- `GET /api/auth/api-keys` - API key listing (should NOT contain keys)
- `POST /api/auth/api-keys` - API key creation (WHITELISTED: returns key once)
- `GET /api/auth/api-keys/:id` - API key details (should NOT contain key)
- `GET /webhooks` - Webhook listing
- `GET /ghl-read/*` - GHL read endpoints

**Test Environment:**

- Runs in UAT environment with `NEURONX_ENV=uat`
- Uses `UAT_MODE=dry_run` for safe testing
- Configures allowlisted tenant for UAT access

### 3. Unit Tests (`apps/core-api/src/test-utils/__tests__/assert-no-secret-keys.spec.ts`)

**Comprehensive Coverage:**

- Forbidden key detection in all nesting levels
- Whitelist functionality validation
- Error message formatting
- Edge cases (arrays, nested objects, long values)

## Whitelisted Endpoints

| Endpoint                         | Method | Allowed Keys | Reason                                        |
| -------------------------------- | ------ | ------------ | --------------------------------------------- |
| `POST /api/auth/api-keys`        | POST   | `apiKey`     | API key creation returns raw key once         |
| `POST /webhooks/*/rotate-secret` | POST   | `secretRef`  | Webhook secret rotation returns new reference |

## Usage

### In Tests

```typescript
import { SecretLeakageTester } from '../test-utils/assert-no-secret-keys';

const tester = new SecretLeakageTester();

// Test single endpoint
tester.testEndpoint('/api/users', 'GET', responseData);

// Test multiple endpoints
tester.testEndpoints([
  { endpoint: '/health', response: healthData },
  { endpoint: '/api/keys', response: keyData },
]);
```

### Direct Assertion

```typescript
import { assertNoSecretKeys } from '../test-utils/assert-no-secret-keys';

// Throws detailed error if secrets found
assertNoSecretKeys(responseData, '/api/users', 'GET');
```

## Error Output

When secrets are detected, the system provides detailed error messages:

```
🚨 SECRET LEAKAGE DETECTED in GET /api/users

Found forbidden secret keys:
  - apiKey at data.user.credentials.apiKey: sk_test_abc123...
  - secret at nested.config.secret: my_secret_value...

This indicates a security regression where secrets are being leaked in API responses.
Either fix the endpoint to not return secrets, or add to whitelist if this is intentional.

Whitelisted endpoints for this check:
  - POST /api/auth/api-keys: apiKey (API key creation returns the raw key once)
  - POST /webhooks/*/rotate-secret: secretRef (Webhook secret rotation returns new secret reference)
```

## Security Guarantees

✅ **Recursive Scanning**: Detects secrets in nested objects and arrays
✅ **Path Tracking**: Shows exact location of leaked secrets
✅ **Whitelist Control**: Allows intentional secret returns with audit trail
✅ **Value Truncation**: Prevents secret values from appearing in logs
✅ **Comprehensive Coverage**: Tests representative endpoints across the API
✅ **CI Integration**: Fails builds on secret leakage regressions

## Maintenance

**Adding New Whitelisted Endpoints:**

```typescript
const customWhitelist = [
  {
    endpoint: 'POST /custom/secrets',
    method: 'POST',
    allowedKeys: ['secret'],
    description: 'Custom endpoint creates secrets',
  },
];

const tester = new SecretLeakageTester(customWhitelist);
```

**Extending Forbidden Keys:**
Add new forbidden keys to the `FORBIDDEN_KEYS` array in the utility.

## Integration

This regression net is integrated into the CI pipeline and will:

- Run on every build
- Fail builds that leak secrets
- Provide actionable error messages
- Maintain audit trail of whitelisted exceptions

---

**STOP-SHIP Status**: Active regression prevention system deployed.
