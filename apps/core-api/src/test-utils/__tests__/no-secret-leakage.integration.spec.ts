/**
 * No Secret Leakage Integration Tests - STOP-SHIP Regression Net
 *
 * Tests representative API endpoints to ensure no forbidden secret keys
 * are leaked in responses. Catches regressions where secrets appear in GET responses.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { SecretLeakageTester } from '../assert-no-secret-keys';
import * as request from 'supertest';

// Test configuration
const TEST_TENANT_ID = 'test-tenant-001';

describe('No Secret Leakage Regression Tests', () => {
  let app: INestApplication;
  let secretTester: SecretLeakageTester;

  beforeAll(async () => {
    // Set up UAT environment for testing
    process.env.NEURONX_ENV = 'uat';
    process.env.UAT_TENANT_IDS = TEST_TENANT_ID;
    process.env.UAT_MODE = 'dry_run';
    process.env.UAT_KILL_SWITCH = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    secretTester = new SecretLeakageTester();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    it('GET /health should not contain any secrets', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      secretTester.testEndpoint('/health', 'GET', response.body);
    });

    it('GET /health/live should not contain any secrets', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      secretTester.testEndpoint('/health/live', 'GET', response.body);
    });

    it('GET /health/ready should not contain any secrets', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      secretTester.testEndpoint('/health/ready', 'GET', response.body);
    });
  });

  describe('UAT Endpoints (UAT Environment)', () => {
    beforeAll(() => {
      // Ensure UAT environment is properly configured
      process.env.NEURONX_ENV = 'uat';
      process.env.UAT_TENANT_IDS = TEST_TENANT_ID;
    });

    it('GET /uat/status should not contain any secrets', async () => {
      const response = await request(app.getHttpServer())
        .get('/uat/status')
        .set('x-tenant-id', TEST_TENANT_ID)
        .expect(200);

      secretTester.testEndpoint('/uat/status', 'GET', response.body);
    });

    it('POST /uat/golden-run should not contain any secrets', async () => {
      const response = await request(app.getHttpServer())
        .post('/uat/golden-run')
        .set('x-tenant-id', TEST_TENANT_ID)
        .set('x-correlation-id', `test-correlation-${Date.now()}`)
        .expect(200);

      secretTester.testEndpoint('/uat/golden-run', 'POST', response.body);
    });

    it('GET /uat/audit should not contain any secrets', async () => {
      const response = await request(app.getHttpServer())
        .get('/uat/audit')
        .set('x-tenant-id', TEST_TENANT_ID)
        .expect(200);

      secretTester.testEndpoint('/uat/audit', 'GET', response.body);
    });
  });

  describe('API Key Endpoints', () => {
    let createdApiKeyId: string;
    let createdApiKey: string;

    it('POST /api/auth/api-keys should be allowed to return apiKey (whitelisted)', async () => {
      // Set up global tenant context (simulating admin auth)
      (global as any).currentTenantId = TEST_TENANT_ID;

      const response = await request(app.getHttpServer())
        .post('/api/auth/api-keys')
        .send({
          name: 'Test API Key',
          roleIds: ['test-role'],
          permissions: ['read'],
        })
        .expect(201);

      // This SHOULD contain the apiKey field (whitelisted)
      expect(response.body).toHaveProperty('key');
      expect(typeof response.body.key).toBe('string');
      expect(response.body.key.length).toBeGreaterThan(10);

      // Store for next test
      createdApiKeyId = response.body.id;
      createdApiKey = response.body.key;

      // The whitelisted key should pass the test
      secretTester.testEndpoint('/api/auth/api-keys', 'POST', response.body);
    });

    it('GET /api/auth/api-keys should not contain any apiKey fields', async () => {
      (global as any).currentTenantId = TEST_TENANT_ID;

      const response = await request(app.getHttpServer())
        .get('/api/auth/api-keys')
        .expect(200);

      // Should not contain any raw API keys
      secretTester.testEndpoint('/api/auth/api-keys', 'GET', response.body);
    });

    it('GET /api/auth/api-keys/:id should not contain apiKey field', async () => {
      (global as any).currentTenantId = TEST_TENANT_ID;

      const response = await request(app.getHttpServer())
        .get(`/api/auth/api-keys/${createdApiKeyId}`)
        .expect(200);

      // Should not contain the raw API key
      expect(response.body).not.toHaveProperty('key');
      expect(response.body).toHaveProperty('fingerprint');

      secretTester.testEndpoint(
        `/api/auth/api-keys/${createdApiKeyId}`,
        'GET',
        response.body
      );
    });

    it('POST /api/auth/api-keys/:id/rotate should be allowed to return new apiKey (whitelisted)', async () => {
      (global as any).currentTenantId = TEST_TENANT_ID;

      const response = await request(app.getHttpServer())
        .post(`/api/auth/api-keys/${createdApiKeyId}/rotate`)
        .expect(200);

      // This SHOULD contain the new apiKey field (whitelisted)
      expect(response.body).toHaveProperty('key');
      expect(typeof response.body.key).toBe('string');
      expect(response.body.key).not.toBe(createdApiKey); // Should be different

      secretTester.testEndpoint(
        `/api/auth/api-keys/${createdApiKeyId}/rotate`,
        'POST',
        response.body
      );
    });

    afterAll(async () => {
      // Clean up: revoke the created API key
      if (createdApiKeyId) {
        (global as any).currentTenantId = TEST_TENANT_ID;
        await request(app.getHttpServer())
          .post(`/api/auth/api-keys/${createdApiKeyId}/revoke`)
          .expect(204);
      }
    });
  });

  describe('Webhook Endpoints', () => {
    let createdWebhookId: string;

    it('GET /webhooks should not contain any secret fields', async () => {
      const response = await request(app.getHttpServer())
        .get('/webhooks')
        .set('Authorization', 'Bearer admin-token') // Mock admin auth
        .expect(200);

      secretTester.testEndpoint('/webhooks', 'GET', response.body);
    });

    // Note: Creating webhooks and rotating secrets would require more complex setup
    // For this regression test, we're primarily focused on ensuring GET responses
    // don't leak secrets. The POST /webhooks/*/rotate-secret endpoint is whitelisted
    // for secretRef returns, but would need webhook creation setup to test properly.
  });

  describe('GHL Read Endpoints', () => {
    it('GET /ghl-read/contacts should not contain any secrets', async () => {
      const response = await request(app.getHttpServer())
        .get('/ghl-read/contacts')
        .expect(200);

      secretTester.testEndpoint('/ghl-read/contacts', 'GET', response.body);
    });

    it('GET /ghl-read/opportunities should not contain any secrets', async () => {
      const response = await request(app.getHttpServer())
        .get('/ghl-read/opportunities')
        .expect(200);

      secretTester.testEndpoint(
        '/ghl-read/opportunities',
        'GET',
        response.body
      );
    });

    it('GET /ghl-read/pipelines should not contain any secrets', async () => {
      const response = await request(app.getHttpServer())
        .get('/ghl-read/pipelines')
        .expect(200);

      secretTester.testEndpoint('/ghl-read/pipelines', 'GET', response.body);
    });
  });

  describe('Regression Protection', () => {
    it('should fail if a forbidden key appears in any response', () => {
      const maliciousResponse = {
        status: 'ok',
        data: {
          apiKey: 'sk_test_123456789012345678901234567890',
          normalField: 'safe value',
        },
      };

      expect(() => {
        secretTester.testEndpoint('/test/endpoint', 'GET', maliciousResponse);
      }).toThrow(/SECRET LEAKAGE DETECTED/);
    });

    it('should allow whitelisted secrets for specific endpoints', () => {
      const whitelistedResponse = {
        id: 'test-key-id',
        name: 'Test Key',
        key: 'sk_test_whitelisted_key_1234567890',
        fingerprint: 'abc123',
      };

      // This should NOT throw because POST /api/auth/api-keys is whitelisted for apiKey
      expect(() => {
        secretTester.testEndpoint(
          '/api/auth/api-keys',
          'POST',
          whitelistedResponse
        );
      }).not.toThrow();
    });

    it('should detect secrets in nested objects and arrays', () => {
      const nestedResponse = {
        users: [
          {
            id: 1,
            name: 'User 1',
            credentials: {
              apiKey: 'sk_nested_secret_123',
            },
          },
        ],
        config: {
          webhookSettings: {
            secret: 'webhook_secret_value',
          },
        },
      };

      expect(() => {
        secretTester.testEndpoint('/test/nested', 'GET', nestedResponse);
      }).toThrow(/SECRET LEAKAGE DETECTED/);
    });
  });
});
