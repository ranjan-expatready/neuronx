/**
 * No Secret Keys Regression Test Utility
 *
 * Deep-scans JSON response objects for forbidden secret keys.
 * Throws detailed error if any forbidden keys are found.
 */

const FORBIDDEN_KEYS = [
  'apiKey',
  'accessToken',
  'refreshToken',
  'tokenValue',
  'webhookSecret',
  'secretRef',
  'secret',
  'privateKey',
] as const;

export type ForbiddenKey = (typeof FORBIDDEN_KEYS)[number];

/**
 * Whitelist entry for endpoints that are allowed to return specific secrets
 */
export interface SecretWhitelistEntry {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  allowedKeys: ForbiddenKey[];
  description: string;
}

/**
 * Default whitelist for known secret-returning endpoints
 */
const DEFAULT_SECRET_WHITELIST: SecretWhitelistEntry[] = [
  {
    endpoint: 'POST /api/auth/api-keys',
    method: 'POST',
    allowedKeys: ['apiKey'],
    description: 'API key creation returns the raw key once',
  },
  {
    endpoint: 'POST /webhooks/*/rotate-secret',
    method: 'POST',
    allowedKeys: ['secretRef'],
    description: 'Webhook secret rotation returns new secret reference',
  },
];

/**
 * Result of secret scanning
 */
export interface SecretScanResult {
  foundSecrets: Array<{
    key: ForbiddenKey;
    path: string;
    value: any;
  }>;
  isClean: boolean;
}

/**
 * Recursively scan an object/array for forbidden secret keys
 */
function scanForSecrets(
  obj: any,
  path: string = '',
  results: SecretScanResult['foundSecrets'] = []
): SecretScanResult['foundSecrets'] {
  if (obj === null || obj === undefined) {
    return results;
  }

  if (typeof obj === 'string') {
    // Check if this looks like a secret value (long string, contains common secret patterns)
    if (
      obj.length > 20 &&
      (obj.includes('sk_') || // Stripe-like keys
        obj.includes('pk_') || // Public keys
        obj.includes('Bearer ') || // Bearer tokens
        obj.includes('secret_') || // Generic secrets
        obj.includes('token_') || // Tokens
        /^[A-Za-z0-9+/=]{32,}$/.test(obj)) // Base64-like strings (32+ chars)
    ) {
      // This might be a secret, but we'll let the key name check catch it
      // We don't flag values directly, only by forbidden key names
    }
    return results;
  }

  if (typeof obj !== 'object') {
    return results;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      scanForSecrets(item, `${path}[${index}]`, results);
    });
    return results;
  }

  // Check each property
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    // Check if this key is forbidden
    if (FORBIDDEN_KEYS.includes(key as ForbiddenKey)) {
      results.push({
        key: key as ForbiddenKey,
        path: currentPath,
        value:
          typeof value === 'string' && value.length > 10
            ? `${value.substring(0, 10)}...` // Truncate long values
            : value,
      });
    }

    // Recursively scan nested objects/arrays
    scanForSecrets(value, currentPath, results);
  }

  return results;
}

/**
 * Assert that a response contains no forbidden secret keys
 */
export function assertNoSecretKeys(
  response: any,
  endpoint: string,
  method: string = 'GET',
  whitelist: SecretWhitelistEntry[] = DEFAULT_SECRET_WHITELIST
): void {
  const foundSecrets = scanForSecrets(response);

  // Check whitelist for allowed secrets
  const allowedForEndpoint = whitelist.filter(
    entry =>
      entry.method === method &&
      (entry.endpoint === `${method} ${endpoint}` ||
        (entry.endpoint.includes('*') &&
          new RegExp(entry.endpoint.replace(/\*/g, '.*')).test(
            `${method} ${endpoint}`
          )))
  );

  // Filter out whitelisted secrets
  const nonWhitelistedSecrets = foundSecrets.filter(secret => {
    const isAllowed = allowedForEndpoint.some(entry =>
      entry.allowedKeys.includes(secret.key)
    );
    return !isAllowed;
  });

  if (nonWhitelistedSecrets.length > 0) {
    const errorMessage = [
      `🚨 SECRET LEAKAGE DETECTED in ${method} ${endpoint}`,
      '',
      'Found forbidden secret keys:',
      ...nonWhitelistedSecrets.map(
        secret => `  - ${secret.key} at ${secret.path}: ${secret.value}`
      ),
      '',
      'This indicates a security regression where secrets are being leaked in API responses.',
      'Either fix the endpoint to not return secrets, or add to whitelist if this is intentional.',
      '',
      'Whitelisted endpoints for this check:',
      ...whitelist.map(
        entry =>
          `  - ${entry.endpoint}: ${entry.allowedKeys.join(', ')} (${entry.description})`
      ),
    ].join('\n');

    throw new Error(errorMessage);
  }
}

/**
 * Integration test helper for endpoint secret scanning
 */
export class SecretLeakageTester {
  private whitelist: SecretWhitelistEntry[];

  constructor(customWhitelist: SecretWhitelistEntry[] = []) {
    this.whitelist = [...DEFAULT_SECRET_WHITELIST, ...customWhitelist];
  }

  /**
   * Test an endpoint response for secret leakage
   */
  testEndpoint(endpoint: string, method: string, response: any): void {
    assertNoSecretKeys(response, endpoint, method, this.whitelist);
  }

  /**
   * Test multiple endpoints at once
   */
  testEndpoints(
    tests: Array<{
      endpoint: string;
      method?: string;
      response: any;
    }>
  ): void {
    for (const test of tests) {
      this.testEndpoint(test.endpoint, test.method || 'GET', test.response);
    }
  }

  /**
   * Add custom whitelist entries
   */
  addWhitelist(entries: SecretWhitelistEntry[]): void {
    this.whitelist.push(...entries);
  }
}
