/**
 * Secret Key Assertion Utility Tests
 *
 * Unit tests for the secret scanning utility functions.
 */

import {
  assertNoSecretKeys,
  SecretLeakageTester,
} from '../assert-no-secret-keys';

describe('Secret Key Assertion Utility', () => {
  describe('assertNoSecretKeys', () => {
    it('should pass for clean responses', () => {
      const cleanResponse = {
        status: 'ok',
        data: {
          userId: '123',
          email: 'user@example.com',
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      expect(() => {
        assertNoSecretKeys(cleanResponse, '/test/endpoint', 'GET');
      }).not.toThrow();
    });

    it('should detect forbidden keys in top-level object', () => {
      const dirtyResponse = {
        status: 'ok',
        apiKey: 'sk_test_123456789012345678901234567890',
      };

      expect(() => {
        assertNoSecretKeys(dirtyResponse, '/test/endpoint', 'GET');
      }).toThrow(/SECRET LEAKAGE DETECTED/);
    });

    it('should detect all types of forbidden keys', () => {
      const forbiddenKeys = [
        'apiKey',
        'accessToken',
        'refreshToken',
        'tokenValue',
        'webhookSecret',
        'secretRef',
        'secret',
        'privateKey',
      ];

      forbiddenKeys.forEach(key => {
        const dirtyResponse = {
          status: 'ok',
          [key]: `test_${key}_value_1234567890`,
        };

        expect(() => {
          assertNoSecretKeys(dirtyResponse, '/test/endpoint', 'GET');
        }).toThrow(/SECRET LEAKAGE DETECTED/);
      });
    });

    it('should detect secrets in nested objects', () => {
      const nestedResponse = {
        data: {
          user: {
            credentials: {
              apiKey: 'sk_nested_secret_123',
            },
          },
        },
      };

      expect(() => {
        assertNoSecretKeys(nestedResponse, '/test/endpoint', 'GET');
      }).toThrow(/SECRET LEAKAGE DETECTED/);
    });

    it('should detect secrets in arrays', () => {
      const arrayResponse = {
        users: [
          { id: 1, name: 'User 1' },
          {
            id: 2,
            name: 'User 2',
            tokens: {
              accessToken: 'token_value_123',
            },
          },
        ],
      };

      expect(() => {
        assertNoSecretKeys(arrayResponse, '/test/endpoint', 'GET');
      }).toThrow(/SECRET LEAKAGE DETECTED/);
    });

    it('should allow whitelisted secrets for specific endpoints', () => {
      const apiKeyResponse = {
        id: 'key-123',
        name: 'Test Key',
        key: 'sk_test_api_key_value_1234567890',
        fingerprint: 'abc123',
      };

      // This should NOT throw because POST /api/auth/api-keys is whitelisted
      expect(() => {
        assertNoSecretKeys(apiKeyResponse, '/api/auth/api-keys', 'POST');
      }).not.toThrow();
    });

    it('should allow whitelisted webhook secrets', () => {
      const webhookResponse = {
        endpointId: 'webhook-123',
        secretRef: 'ref_webhook_secret_123',
        previousSecretRef: 'ref_old_secret_456',
      };

      // This should NOT throw because webhook rotate-secret is whitelisted
      expect(() => {
        assertNoSecretKeys(
          webhookResponse,
          '/webhooks/123/rotate-secret',
          'POST'
        );
      }).not.toThrow();
    });

    it('should reject non-whitelisted secrets even for whitelisted endpoints', () => {
      const mixedResponse = {
        id: 'key-123',
        name: 'Test Key',
        key: 'sk_test_allowed_key',
        webhookSecret: 'not_allowed_secret', // Not whitelisted for this endpoint
      };

      expect(() => {
        assertNoSecretKeys(mixedResponse, '/api/auth/api-keys', 'POST');
      }).toThrow(/SECRET LEAKAGE DETECTED/);
    });

    it('should provide detailed error messages', () => {
      const dirtyResponse = {
        status: 'ok',
        apiKey: 'sk_test_secret_value',
        secret: 'another_secret',
      };

      expect(() => {
        assertNoSecretKeys(dirtyResponse, '/test/endpoint', 'GET');
      }).toThrow(/apiKey at apiKey/);

      expect(() => {
        assertNoSecretKeys(dirtyResponse, '/test/endpoint', 'GET');
      }).toThrow(/secret at secret/);
    });

    it('should truncate long secret values in error messages', () => {
      const longSecret = 'sk_test_' + 'a'.repeat(100);
      const dirtyResponse = {
        apiKey: longSecret,
      };

      expect(() => {
        assertNoSecretKeys(dirtyResponse, '/test/endpoint', 'GET');
      }).toThrow(/sk_test_aa\.\.\./);
    });
  });

  describe('SecretLeakageTester', () => {
    let tester: SecretLeakageTester;

    beforeEach(() => {
      tester = new SecretLeakageTester();
    });

    it('should test single endpoints', () => {
      const cleanResponse = { status: 'ok' };

      expect(() => {
        tester.testEndpoint('/health', 'GET', cleanResponse);
      }).not.toThrow();
    });

    it('should test multiple endpoints', () => {
      const tests = [
        { endpoint: '/health', response: { status: 'ok' } },
        { endpoint: '/status', response: { uptime: 123 } },
      ];

      expect(() => {
        tester.testEndpoints(tests);
      }).not.toThrow();
    });

    it('should allow custom whitelist additions', () => {
      const customWhitelist = [
        {
          endpoint: 'GET /custom/endpoint',
          method: 'GET' as const,
          allowedKeys: ['secret' as const],
          description: 'Custom endpoint allows secrets',
        },
      ];

      tester.addWhitelist(customWhitelist);

      const responseWithSecret = { secret: 'allowed_secret_value' };

      expect(() => {
        tester.testEndpoint('/custom/endpoint', 'GET', responseWithSecret);
      }).not.toThrow();
    });
  });
});
