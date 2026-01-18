// E2E Tests for GHL Webhook Processing

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventBus } from '../src/eventing/eventing.module';

// Import test fixtures
import * as fs from 'fs';
import * as path from 'path';

const loadFixture = (filename: string) => {
  const filePath = path.join(__dirname, '../../test/fixtures/ghl', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

describe('GHL Webhook Processing (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBus;

  // Test fixtures
  const leadCreatedPayload = loadFixture('webhook_lead_created.json');
  const messageReceivedPayload = loadFixture('webhook_message_received.json');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );

    prisma = app.get<PrismaService>(PrismaService);
    eventBus = app.get<EventBus>(EventBus);

    // Mock event bus for testing
    jest.spyOn(eventBus, 'publish').mockResolvedValue();

    // Clear test data
    await prisma.event.deleteMany();
    await prisma.auditLog.deleteMany();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /integrations/ghl/webhooks', () => {
    it('should process valid lead created webhook', () => {
      // Mock signature for testing (in real implementation, this would be computed)
      const mockSignature = 'sha256=test_signature';

      return request(app.getHttpServer())
        .post('/integrations/ghl/webhooks')
        .set('x-webhook-signature', mockSignature)
        .set('x-tenant-id', 'test-tenant')
        .set('x-request-id', 'test-request-123')
        .send(leadCreatedPayload)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('status', 'processed');
          expect(res.body).toHaveProperty('eventId');
          expect(res.body).toHaveProperty('processingTime');
        })
        .then(() => {
          // Verify event was published
          expect(eventBus.publish).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'neuronx.contact.ingested',
              tenantId: 'test-tenant',
              metadata: expect.objectContaining({
                correlationId: expect.any(String),
                source: 'webhook',
                vendor: 'ghl',
                webhookId: leadCreatedPayload.metadata.webhookId,
              }),
            })
          );
        });
    });

    it('should process message received webhook', () => {
      const mockSignature = 'sha256=test_signature';

      return request(app.getHttpServer())
        .post('/integrations/ghl/webhooks')
        .set('x-webhook-signature', mockSignature)
        .set('x-tenant-id', 'test-tenant')
        .send(messageReceivedPayload)
        .expect(200)
        .then(() => {
          expect(eventBus.publish).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'neuronx.conversation.message.received',
              tenantId: 'test-tenant',
            })
          );
        });
    });

    it('should reject webhook with invalid signature', () => {
      return request(app.getHttpServer())
        .post('/integrations/ghl/webhooks')
        .set('x-webhook-signature', 'invalid_signature')
        .set('x-tenant-id', 'test-tenant')
        .send(leadCreatedPayload)
        .expect(401)
        .expect(res => {
          expect(res.body).toHaveProperty('status', 'skipped');
          expect(res.body).toHaveProperty('reason', 'signature_invalid');
        });
    });

    it('should handle replay attack (duplicate webhook)', () => {
      const mockSignature = 'sha256=test_signature';

      // First webhook should succeed
      return request(app.getHttpServer())
        .post('/integrations/ghl/webhooks')
        .set('x-webhook-signature', mockSignature)
        .set('x-tenant-id', 'test-tenant')
        .send(leadCreatedPayload)
        .expect(200)
        .then(() => {
          // Same webhook again should be rejected as duplicate
          return request(app.getHttpServer())
            .post('/integrations/ghl/webhooks')
            .set('x-webhook-signature', mockSignature)
            .set('x-tenant-id', 'test-tenant')
            .send(leadCreatedPayload)
            .expect(200) // HTTP 200 but marked as duplicate
            .expect(res => {
              expect(res.body).toHaveProperty('status', 'skipped');
              expect(res.body).toHaveProperty('reason', 'duplicate_webhook');
            });
        });
    });

    it('should handle unknown webhook event type', () => {
      const unknownPayload = {
        ...leadCreatedPayload,
        event: 'unknown.event.type',
      };
      const mockSignature = 'sha256=test_signature';

      return request(app.getHttpServer())
        .post('/integrations/ghl/webhooks')
        .set('x-webhook-signature', mockSignature)
        .set('x-tenant-id', 'test-tenant')
        .send(unknownPayload)
        .expect(400)
        .expect(res => {
          expect(res.body).toHaveProperty('status', 'skipped');
          expect(res.body).toHaveProperty('reason', 'unsupported_event');
        });
    });

    it('should handle malformed payload', () => {
      const mockSignature = 'sha256=test_signature';

      return request(app.getHttpServer())
        .post('/integrations/ghl/webhooks')
        .set('x-webhook-signature', mockSignature)
        .set('x-tenant-id', 'test-tenant')
        .send('invalid json')
        .expect(500)
        .expect(res => {
          expect(res.body).toHaveProperty('status', 'error');
          expect(res.body).toHaveProperty('message');
        });
    });
  });
});
