import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Backend E2E Smoke Test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.SKIP_WEBHOOK_VERIFICATION = 'true';
    process.env.NODE_ENV = 'test';
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
      .expect(200);
  });
});
