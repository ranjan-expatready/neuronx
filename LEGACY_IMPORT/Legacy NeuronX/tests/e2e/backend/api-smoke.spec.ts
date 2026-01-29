import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../../apps/core-api/src/app.module';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Backend E2E Smoke Test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Config for Test Environment
    process.env.SKIP_WEBHOOK_VERIFICATION = 'true';
    process.env.NODE_ENV = 'test';
    // Ensure REDIS_URL is unset to force in-memory
    delete process.env.REDIS_URL;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/health (GET) - Should return 200 OK', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
          expect(res.body.status).toBeDefined();
      });
  });

  it('/integrations/ghl/webhooks (POST) - Should accept webhook (Mocked Signature)', () => {
    return request(app.getHttpServer())
      .post('/integrations/ghl/webhooks')
      .send({
          event: 'contact.created',
          tenantId: 'test-tenant',
          data: { id: 'lead-123', email: 'test@example.com' }
      })
      .set('Content-Type', 'application/json')
      .expect(201);
  });
});
